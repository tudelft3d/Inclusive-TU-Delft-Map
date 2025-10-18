import { Map } from "./app";
import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import { estimateBytesUsed } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export function outline_code(code, map) {

	var object_attribute_list = [];

	for (const [key, value] of Object.entries(cityjson["CityObjects"])) {

		object_attribute_list.push(value);
	}

	let keys = [];
	let object_names = [];

	object_attribute_list.forEach((current_object) => {
		if (current_object.attributes["Usage Code"] == code) {
			keys.push(current_object.attributes.key);
			if (current_object.type == "Building") {
				object_names.push(map.scene.getObjectByName(current_object.attributes.key + '-lod_2'));
			}
			else {
				object_names.push(map.scene.getObjectByName(current_object.attributes.key + '-lod_0'));
			}

		}

	});
	console.log(object_names);
	map.setOutline(keys, "lod_0", "single");
	map.picker.highlight(object_names);

}