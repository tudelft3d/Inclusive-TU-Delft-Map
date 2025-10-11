import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import Fuse from "fuse.js";
import * as THREE from 'three';

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class Searcher {

    constructor() {

        // what to do when searching for a room type that will have multiple instances?
        // Highlight all bathrooms?

        // Can also search within arrays <- use for nicknames

        this.raw_json = cityjson;

        this.processed_json = this._process_json(cityjson);
        
        this.searches = [];

        this.fuseOptions = {keys: ["attributes.space_id", "attributes.Name (EN)", "attributes.Name (NL)", "attributes.Nicknames"]};

        this.attribute_searcher = new Fuse(this.processed_json, this.fuseOptions);
        this.geometry_searcher = new Fuse();

    }

    _process_json(json) {
        json = json["CityObjects"];

        var object_attribute_list = [];

        for (const [key, value] of Object.entries(json)) {
            value["key"] = key;
            object_attribute_list.push(value);
        }

        return object_attribute_list;
    }

    _traverse_children(object) {



    }

    // Perhaps make lod extractable from the map
    // Will have to change this if not all searchable objects have a space_id
    _retrieve_threejs_objects(object_list, lod, map) {

        const threejs_objects = [];

        for (let i = 0; i < object_list.length; i++) {

        	const current_object = object_list[i];

        	console.log(current_object.item.attributes);

        	let space_id = current_object.item.attributes["space_id"];
        	const threejs_object_name = space_id.split('.').join("-").concat(lod);
        	threejs_objects.push(map.scene.getObjectByName(threejs_object_name));

		}

        return threejs_objects;
    }


    _search_pattern(pattern, return_count) {

    	const all_results = this.attribute_searcher.search(pattern);

    	const sliced_results = all_results.slice(0, return_count);

    	return sliced_results;

    }


    search_and_zoom(pattern, map) {

    	const result = this._search_pattern(pattern, 1);

    	const threejs_object = this._retrieve_threejs_objects(result, "-lod_2", map)[0];

    	map.zoom_on_object(threejs_object);

    }


    search_n_best_matches(pattern, n) {

    	const results = this._search_pattern(pattern, n);

    	return results;

    }


    search_pattern_old(pattern, map) {

        const result = this.attribute_searcher.search(pattern);

        const top_result = result[0];

        if (typeof top_result == 'undefined') {
            return "No results";
        }

        var object_name;

        if (top_result.item.type == "Building") {
            object_name = top_result.item.attributes["Campus Map Number"].split('.').join("").concat("-lod_2");
        } else if (top_result.item.type == "BuildingRoom")  {
            object_name = top_result.item.attributes["room_str_id"].split('.').join("").concat("-lod_0");
        }

        const threejs_object = map.scene.getObjectByName(object_name);

        // map.zoom_on_object(threejs_object);

        return top_result;

    }

}