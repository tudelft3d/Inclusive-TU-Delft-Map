import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import Fuse from "fuse.js";
import * as THREE from 'three';
import { loadGLTFTranslateX, loadGLTFTranslateY } from "./constants";

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class Searcher {

	constructor() {

		// what to do when searching for a room type that will have multiple instances?
		// Highlight all bathrooms?

		// Can also search within arrays <- use for nicknames

		this.processed_json = this._process_json(cityjson);
        
		this.searches = [];

		this.fuseOptions = {keys: ["attributes.room_str_id", "attributes.Campus Map Number", "attributes.Stipl Name"]};

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

    search_pattern(pattern, map) {

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

    	map.zoom_on_object(threejs_object);

    	return top_result;

    }

}