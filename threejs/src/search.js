import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import Fuse from "fuse.js";
import * as THREE from 'three';
import { loadGLTFTranslateX, loadGLTFTranslateY } from "./constants";

import cityjson from "../assets/campus/geom/attributes.city.json" assert {type: "json"};

export class Searcher {

	constructor() {

		this.processed_json = this.process_json(cityjson);
        
		this.searches = [];

		this.fuseOptions = {keys: ["attributes.room_str_id", "attributes.Campus Map Number", "attributes.Stipl Name"]};

		this.fuse = new Fuse(this.processed_json, this.fuseOptions);

    }

    process_json(json) {
    	json = json["CityObjects"];

    	var object_attribute_list = [];

    	for (const [key, value] of Object.entries(json)) {
    		value["key"] = key;
    		object_attribute_list.push(value);
    	}

    	return object_attribute_list;
    }

    searchPattern(pattern, map) {

    	console.log(map);

    	const result = this.fuse.search(pattern);

    	const top_result = result[0];

    	const coords = top_result.item.geographicalExtent;

    	const box = new THREE.Box3(
    		new THREE.Vector3(coords[0], coords[1], coords[2]),
    		new THREE.Vector3(coords[3], coords[4], coords[5]),
    	);

    	var position = box.getCenter(new THREE.Vector3());

    	position.x += loadGLTFTranslateX;
    	position.y += loadGLTFTranslateY;

    	const pos2D = new THREE.Vector2(position.x, position.y);

    	console.log(position, pos2D);

    	map.pickEvent(pos2D);

    	return top_result;

    }

}