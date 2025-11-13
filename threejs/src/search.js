import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import Fuse from "fuse.js";
import * as THREE from 'three';
import { CamerasControls } from "./camera";
import { Scene } from "three";
import { BuildingView } from "./buildingView";

import { CjHelper } from "./cjHelper";

/**
 * This class manages the functionality of the search bar.
 */
export class Searcher {

    /**
     * 
     * @param {CamerasControls} cameraManager  
     * @param {ObjectPicker} picker 
     * @param {Scene} scene 
     */
    constructor(cameraManager, picker, scene) {

        this.cameraManager = cameraManager;
        this.picker = picker;
        this.scene = scene;
        this.cjHelper = new CjHelper(this.scene);

        this.processed_json = this._process_json();

        this.searches = [];

        this.fuseOptions = {
            threshold: 0.3,
            ignoreLocation: true,
            includeScore: true,
            includeMatches: true,
            keys: ["attributes.space_id",
                "attributes.key",
                "attributes.Name",
                "attributes.Name (EN)",
                "attributes.Name (NL)",
                "attributes.Nicknames"]
        };

        this.attribute_searcher = new Fuse(this.processed_json, this.fuseOptions);
        this.geometry_searcher = new Fuse();

    }

    /**
     * The Fuse searching library is easier to work with if the objects being searched are
     * available as an array.
     * This function strips the key from each object and pushes the attributes into an array.
     */
    _process_json() {
        const objectKeys = this.cjHelper.getAllObjectKeys();
        var object_attribute_list = [];

        for (const objectKey of objectKeys) {
            if (this.cjHelper.isBuildingStorey(objectKey)) {
                continue;
            }
            const attributes = this.cjHelper.getJson(objectKey);
            object_attribute_list.push(attributes);
        }

        return object_attribute_list;
    }


    /**
     * Given a pattern, returns the closest n results from the cityjson file, where n = return_count.
     * 
     * @param {string} pattern: The string that the user is searching for.
     * @param {int} return_count: The maximum number of results that are desired.
     */
    _search_pattern(pattern, return_count) {

        const all_results = this.attribute_searcher.search(pattern);
        if (all_results.length === 0) return [];
        const sliced_results = all_results.slice(0, return_count);

        return sliced_results;

    }

    /**
     * Searches for a pattern and then zooms towards the corresponding object.
     * This function is called when the user clicks on an auto-completed result in the search bar.
     * We can guarantee that it will result in a valid object, as the pattern has already been tested
     * against the cityjson file
     * 
     * @param {string} pattern: Pattern that when searched will result in object that needs to be zoomed to.
     */
    search_and_zoom(pattern) {
        const result = this._search_pattern(pattern, 1);
        // console.log('pattern: ', pattern);

        // const threejs_objects = this._retrieve_threejs_objects(result, this.scene);

        this.picker.pickMesh(result[0].item["attributes"]["key"]);
    }

    /**
     * A wrapper for _search_pattern() that ensures that results have proper names.
     * 
     * @param {string} pattern: The string that the user is searching for.
     * @param {int} n: The maximum number of results that are desired.
     */
    search_n_best_matches(pattern, n) {

        const results = this._search_pattern(pattern, n);
        const results_obj = [];
        for (var i = 0; i < results.length; i++) {
            const r = results[i];
            const attr = r.item.attributes;
            if (!attr.display_name) {
                attr.display_name = this.results_to_name(results[i]);
            }
            results_obj.push(results[i]);
        };
        return results_obj;

    }

    /**
     * For a given object, determines a suitable display name if the object doesn't have one
     * as a listed attribute.
     * 
     * @param {object} obj: The object for which a name is needed.
     */
    results_to_name(obj) {
        const matchItem = obj.item;
        const attr = matchItem.attributes;
        let displayName = "";
        // if (obj.matches) {
        //     let nicknameMatch = obj.matches.find(m => m.key === "attributes.Name (EN)");
        //     if (nicknameMatch) displayName = nicknameMatch.value;
        // }
        if (!displayName) {
            if (attr["Name"]) displayName = attr["Name"];
            else if (attr["Name (EN)"] && attr["Name (EN)"].trim() !== "")
                displayName = attr["Name (EN)"];
            else if (attr["Nicknames"] && attr["Nicknames"].length > 0)
                displayName = attr["Nicknames"][0];
            else displayName = "No name found";
        }

        if (matchItem.type == "Building") {
            displayName = "Building " + attr["space_id"] + " | " + attr["Name (EN)"];
        }


        if (matchItem.type === "BuildingRoom" || matchItem.type === "BuildingPart" || matchItem.type === "BuildingUnit") {
            let parentKey = this.cjHelper.getParentObjectKey(matchItem.attributes.key)
            let parent = this.cjHelper.getJson(parentKey);

            // Traverse upward until we find the Building
            while (parent.type !== "Building") {
                parentKey = this.cjHelper.getParentObjectKey(parent.attributes.key)
                parent = this.cjHelper.getJson(parentKey);
            }

            if (parent && parent.attributes) {
                const buildingName =
                    parent.attributes["Name (EN)"] ||
                    parent.attributes["Name (NL)"] ||
                    parent.attributes["Name"] ||
                    "Unknown Building";

                displayName += ` | ${buildingName} `;
            }
        }
        return displayName;
    }
}