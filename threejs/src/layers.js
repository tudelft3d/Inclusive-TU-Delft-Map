import { Map } from "./app";
import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export function outline_code(code, map) {

    var object_attribute_list = [];

    for (const [key, value] of Object.entries(cityjson["CityObjects"])) {

        object_attribute_list.push(value);
    }

	let keys = [];

	object_attribute_list.forEach((current_object) => {

		console.log(current_object.attributes["Usage Code"]);

		if (current_object.attributes["Usage Code"] == code) {
			keys.push(current_object.attributes.key);

		}

	});

	map.setOutline(keys, "lod_0", "single");

}