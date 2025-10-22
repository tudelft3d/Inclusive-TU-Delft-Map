import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import Fuse from "fuse.js";
import * as THREE from 'three';
import { CamerasControls } from "./camera";
import { Scene } from "three";
import { BuildingView } from "./buildingView";

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class Searcher {

    /**
     * 
     * @param {CamerasControls} cameraManager  
     * @param {ObjectPicker} picker 
     * @param {Scene} scene 
     * @param {BuildingView} buildingView
     */
    constructor(cameraManager, picker, scene, buildingView) {

        // what to do when searching for a room type that will have multiple instances?
        // Highlight all bathrooms?

        // Can also search within arrays <- use for nicknames

        this.cameraManager = cameraManager;
        this.picker = picker;
        this.scene = scene;
        this.buildingView = buildingView;

        this.raw_json = cityjson;

        this.processed_json = this._process_json(cityjson);

        this.searches = [];

        this.fuseOptions = {
            threshold: 0.3,
            ignoreLocation: true,
            includeScore: true,
            keys: ["attributes.space_id",
                "attributes.key",
                "attributes.Name (EN)",
                "attributes.Name (NL)",
                "attributes.Nicknames"]
        };

        this.attribute_searcher = new Fuse(this.processed_json, this.fuseOptions);
        this.geometry_searcher = new Fuse();

    }

    _process_json(json) {
        json = json["CityObjects"];

        var object_attribute_list = [];

        for (const [key, value] of Object.entries(json)) {

            object_attribute_list.push(value);
        }

        return object_attribute_list;
    }

    // Perhaps make lod extractable from the map
    // Will have to change this if not all searchable objects have a space_id
    _retrieve_threejs_objects(object_list, scene, lod = "infer") {
        const threejs_objects = [];
        const all_objects = [];
        object_list.forEach(object => {
            if (object.item.type == "BuildingUnit") {
                if (object.item.attributes["unit_spaces"].length == 0) {
                    var parent = this.raw_json["CityObjects"][object.item.parents[0]];
                    // console.log(parent);
                    while (parent.type != "Building") {
                        parent = this.raw_json["CityObjects"][parent.parents[0]];
                    }
                    console.log(parent);
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
        console.log('all objects: ', threejs_objects);
        return threejs_objects;
    }


    _search_pattern(pattern, return_count) {

        const all_results = this.attribute_searcher.search(pattern);
        if (all_results.length === 0) return [];
        const sliced_results = all_results.slice(0, return_count);

        return sliced_results;

    }


    search_and_zoom(pattern) {
        const result = this._search_pattern(pattern, 1);
        console.log('pattern: ', pattern);

        const threejs_object = this._retrieve_threejs_objects(result, this.scene)[0];

        this.picker.pickMesh(threejs_object);
    }


    search_n_best_matches(pattern, n) {

        const results = this._search_pattern(pattern, n);

        const results_obj = [];
        for (var i = 0; i < results.length; i++) {
            const r = results[i];
            const attr = r.item.attributes;
            if (!attr.display_name) {
                attr.display_name = this.results_to_name(results[i].item);
            }
            results_obj.push(results[i]);
        };
        return results_obj;

    }

    results_to_name(obj) {
        const attr = obj.attributes;
        if (attr["Name"]) return attr["Name"];
        if (attr["Name (EN)"] && attr["Name (EN)"].trim() !== "") return attr["Name (EN)"];
        if (attr["Nicknames"] && attr["Nicknames"].length > 0) return attr["Nicknames"][0];
        return "No name found";
    }
}