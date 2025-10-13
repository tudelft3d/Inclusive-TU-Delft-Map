import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import * as THREE from 'three';

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class BuildingView {

	constructor(map) {

		this.active = false;

		this.map = map;

		this.building_space_id;

		this.building_json;

		this.storeys_json;

    }

    set_target(space_id) {

    	this.building_space_id = space_id;

    	const building_json_key = "Building_" + space_id + "-Building-" + space_id;

    	this.building_json = cityjson.CityObjects[building_json_key];

    	this.storeys_json = this._isolate_storey_json();

    	console.log(this._retrieve_room_threejs_objects("00"));

    }

    _isolate_storey_json() {

    	const building_children = this.building_json["children"];

    	const building_parts = building_children.filter((element) => {return element.includes("Part")});

    	let storey_json_keys = [];

    	building_parts.forEach((part_json_key) => {

    		const building_part_json = cityjson.CityObjects[part_json_key];

    		storey_json_keys = storey_json_keys.concat(building_part_json["children"]);

    	});

    	let sorted_storey_json_keys = {};

    	storey_json_keys.forEach((storey_key) => {

    		const storey_code = storey_key.split(".").pop();

    		if (storey_code in sorted_storey_json_keys) {
    			sorted_storey_json_keys[storey_code].push(storey_key);
    		} else {
    			sorted_storey_json_keys[storey_code] = [storey_key];
    		}

    	});

    	return sorted_storey_json_keys;

    }

    _retrieve_room_threejs_objects(storey_code) {

    	if (!(storey_code in this.storeys_json)) {
    		console.log("Invalid storey code, returning empty array");
    		return [];
    	}

    	let building_room_keys = [];

    	const building_part_storey_keys = this.storeys_json[storey_code];

    	building_part_storey_keys.forEach((part_storey_key) => {

    		building_room_keys = building_room_keys.concat(cityjson.CityObjects[part_storey_key]["children"]);

    	});

    	let room_threejs_objects = [];

    	building_room_keys.forEach((room_key) => {

    		const space_id = cityjson.CityObjects[room_key]["attributes"]["space_id"];

    		const threejs_object_name = space_id.split('.').join("-").concat("-lod_0");

    		console.log(threejs_object_name);

    		room_threejs_objects.push(this.map.scene.getObjectByName(threejs_object_name));

    	});

    	return room_threejs_objects;

    }

}