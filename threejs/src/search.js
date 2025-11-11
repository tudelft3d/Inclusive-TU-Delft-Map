import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import Fuse from "fuse.js";
import * as THREE from 'three';
import { CamerasControls } from "./camera";
import { Scene } from "three";
import { BuildingView } from "./buildingView";

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

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

        this.raw_json = cityjson;

        this.processed_json = this._process_json(cityjson);

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
     * 
     * @param {object} json: The cityjson file.
     */
    _process_json(json) {
        json = json["CityObjects"];

        var object_attribute_list = [];

        for (const [key, value] of Object.entries(json)) {

            object_attribute_list.push(value);
        }

        return object_attribute_list;
    }

    /**
     * For an array of objects, retrieves all the corresponding threejs mesh objects
     * 
     * @param {array | object} object_list: The cityjson objects for which meshes are needed.
     * @param {object} scene: The threejs scene, which is queried for the mesh objects.
     * @param {string} lod: Indicates which lod the user expects the desired meshes to be.
     */
    _retrieve_threejs_objects(object_list, scene, lod = "infer") {
        const threejs_objects = [];
        const all_objects = [];
        object_list.forEach(object => {
            if (object.item.type == "BuildingUnit") {
                if (object.item.attributes["unit_spaces"].length == 0) {
                    var parent = this.raw_json["CityObjects"][object.item.parents[0]];
                    while (parent.type != "Building") {
                        parent = this.raw_json["CityObjects"][parent.parents[0]];
                    }
                    all_objects.push({ item: parent });
                }
                else {
                    let unitRoom = object.item.attributes["unit_spaces"];
                    for (var i = 0; i < unitRoom.length; i++) {
                        all_objects.push({ item: this.raw_json["CityObjects"][unitRoom[i]] });
                    }
                }
            } else all_objects.push(object);
        });
        // console.log('retrieve_threejs_objects, all_objects: ', all_objects);
        for (let i = 0; i < all_objects.length; i++) {

            const current_object = all_objects[i];

            if (lod == "infer") {
                if (current_object.item.type == "Building") {
                    lod = "-lod_2";
                } else if (current_object.item.type == "BuildingRoom") {
                    lod = "-lod_0";
                }
            }

            const threejs_object_name = current_object.item.attributes["key"].concat(lod);

            threejs_objects.push(scene.getObjectByName(threejs_object_name));

        }
        // console.log('all objects: ', threejs_objects);
        return threejs_objects;
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

        const threejs_objects = this._retrieve_threejs_objects(result, this.scene);

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


        if (matchItem.type === "BuildingRoom" || matchItem.type === "BuildingUnit") {
            let parent = this.raw_json["CityObjects"][matchItem.parents[0]];

            // Traverse upward until we find the Building
            while (parent.type !== "Building") {
                parent = this.raw_json["CityObjects"][parent.parents[0]];
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