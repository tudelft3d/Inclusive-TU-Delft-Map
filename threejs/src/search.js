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

        this.fuseOptions = { keys: ["attributes.space_id", "attributes.key", "attributes.Name (EN)", "attributes.Name (NL)", "attributes.Nicknames"] };

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

        for (let i = 0; i < object_list.length; i++) {

            const current_object = object_list[i];

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

        return threejs_objects;
    }


    _search_pattern(pattern, return_count) {

        const all_results = this.attribute_searcher.search(pattern);

        const sliced_results = all_results.slice(0, return_count);

        return sliced_results;

    }


    search_and_zoom(pattern) {

        const result = this._search_pattern(pattern, 1);

        const threejs_object = this._retrieve_threejs_objects(result, this.scene)[0];

        console.log(threejs_object);
        this.picker.pickMesh(threejs_object);
        this.cameraManager.zoomToObject(threejs_object);

        // Set the building as target for building view
        if (this.buildingView && threejs_object) {
            this.buildingView.set_target(threejs_object.name);
        }

    }


    search_n_best_matches(pattern, n) {

        const results = this._search_pattern(pattern, n);

        return results;

    }

}