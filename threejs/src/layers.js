import { Map } from "./app";
import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layers_json from "../assets/threejs/buildings/thematic_codelist.json" assert {type: "json"};
import Papa from 'papaparse';


export class LayerManager {

	constructor() {

		this.layer_codes = layers_json.filter((element) => {
			return element["Include"] == "Y";
		});

		this._populate_layer_buttons();

		this.active_layers = [];

		this.campus_buildings_json = this._isolate_building_json();

		console.log(this.campus_buildings_json);


	}

	_isolate_building_json() {

		const campus_buildings_json = {};

		for (const [key, value] of Object.entries(cityjson.CityObjects)) {

			if (value.type == "Building") {
				campus_buildings_json[value.attributes.key] = value;
			}

		}

		return campus_buildings_json;
	}

	switch_to_building_view(building_key, building_storey_code) {

	}

	switch_to_campus_view() {

	}

	_update_active_layers(layer_code) {

		const index = this.active_layers.indexOf(layer_code);

		if (index != -1) {
			this.active_layers.splice(index, 1);
		} else {
			this.active_layers.push(layer_code);
		}

		console.log(this.active_layers);

	}

	// this class needs to track the global status of:
	// 1. track building view versus 3d view - handle the visibility of indoor vs label icons 
	// 		function to transition between both 
	// 2. track status of each thematic layer
	//		function to toggle visibility of each theme
	// 3. incorporate the already existing functions below
	//		load codelist
	//		populate layer dropdown

	_populate_layer_buttons(path) {

		var layers_dropdown = document.getElementById("layers-dropdown");
		layers_dropdown.innerHTML = "";

		for (let i = 0; i < this.layer_codes.length; i++) {

			var a = document.createElement("a");

			a.appendChild(document.createTextNode(this.layer_codes[i]["Name-EN"]));

			a.addEventListener("click", (event) => {
				// if building view: toggle icons of objects that are in the current floor
				// remove 3d view icons for only the current building, and vice versa when leaving building view
				// this is to keep the icons for other buildings there
				// consider how to deal with external icons (above should solve it)
				// if 3d view: toggle icons with the building ID labels, above the building


				// hide or unhide layers (toggle function)
				
				this._update_active_layers(this.layer_codes[i]["Code"]);

			});

			a.href = "#";

			layers_dropdown.appendChild(a);

		}

}

}

export async function populate_layer_buttons(path) {


	const all_layer_codes = await load_codelist(path); // this needs to be the codelist file
	const layer_codes = all_layer_codes.filter((element) => {
		return element["Include"] == "Y";
	});
	var layers_dropdown = document.getElementById("layers-dropdown");
	layers_dropdown.innerHTML = "";


	for (let i = 0; i < layer_codes.length; i++) {

		var a = document.createElement("a");

		a.appendChild(document.createTextNode(layer_codes[i]["Name-EN"]));

		a.addEventListener("click", (event) => {
			// if building view: toggle icons of objects that are in the current floor
			// remove 3d view icons for only the current building, and vice versa when leaving building view
			// this is to keep the icons for other buildings there
			// consider how to deal with external icons (above should solve it)
			// if 3d view: toggle icons with the building ID labels, above the building


			// hide or unhide layers (toggle function)
			console.log(layer_codes[i]);

		});

		a.href = "#";

		layers_dropdown.appendChild(a);

	}

}
export function load_codelist(path) {
	return new Promise((resolve, reject) => {
		Papa.parse(path, {
			download: true,
			header: true,
			delimiter: ",",
			skipEmptyLines: "greedy",
			complete: (results) => resolve(results.data),
			error: (err) => reject(err)
		});
	});
}

export async function outline_code(code, map) {

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