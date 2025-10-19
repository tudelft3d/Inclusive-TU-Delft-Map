import { Map } from "./app";
import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import unfiltered_layers_json from "../assets/threejs/buildings/thematic_codelist.json" assert {type: "json"};
import Papa from 'papaparse';

import {
    IconSet,
    IconsSceneManager,
    TextIcon,
    SvgIcon,
    SvgLoader,
} from "./icons";

/*
NOTES:

TODO:
	- finish building icons
	- integrate the units
	- somehow determine a color for each icon, maybe save in json file? integrate with colorblind mode?
 
MENTION:
	- units and rooms have different names for code. they are "code" and "Usage Code" respectively
	- process from csv list to json needs to improve

*/


export class LayerManager {

	constructor(map) {

		this.map = map;

		this.layers_json = {};

		for (const [key, value] of Object.entries(unfiltered_layers_json)) {

			if (value["Include"] == "Y") {
				this.layers_json[key] = value;
			}

		}

		this._populate_layer_buttons();

		this.active_layers = [];

		this.campus_buildings_json = this._isolate_building_json();

		this.campus_buildings_codes = this._isolate_building_room_codes();

		console.log(this.campus_buildings_codes);

		this.current_building_key;

		this.current_storey_keys;

		this.building_view_active = false;

		this._create_initial_campus_icons();

	}

	_isolate_building_json() {

		const campus_buildings_json = {};

		for (const [building_key, building_json] of Object.entries(cityjson.CityObjects)) {

			if (building_json.type == "Building") {
				campus_buildings_json[building_key] = building_json;
			}

		}

		return campus_buildings_json;
	}

	_isolate_building_room_codes() {

		const campus_building_codes = {};

		for (const [building_key, building_json] of Object.entries(this.campus_buildings_json)) {

			let found_room_codes = this._recursive_room_code_searcher(building_key);

			campus_building_codes[building_key] = found_room_codes;

		}

		return campus_building_codes;

	}

	_recursive_room_code_searcher(key) {

		const current_json_object = cityjson.CityObjects[key];

		let codes = new Set();

		if (current_json_object.attributes["code"]) {

			codes.add(current_json_object.attributes["code"]);

		}else if (current_json_object.attributes["Usage Code"]){

			codes.add(current_json_object.attributes["Usage Code"]);

		}

		if (current_json_object["children"]) {

			current_json_object["children"].forEach((child_key) => {

				codes = codes.union(this._recursive_room_code_searcher(child_key));

			});

		}

		return codes;

	}

	switch_to_building_view(building_key, storey_room_keys) {

		this.building_view_active = true;

		this.current_building_key = building_key;

		this.map.iconsSceneManager.removeIconSet(building_key);

		this.enable_storey_icons(storey_room_keys);

	}


	// Called from the buildingView function whenever the storey is changed.
	enable_storey_icons(storey_room_keys) {

		if (this.current_storey_keys) {

			this._remove_storey_icon_sets();

		}

		this.current_storey_keys = storey_room_keys;

		this._add_storey_icon_sets();

	}

	_create_initial_campus_icons() {

		for (const [building_key, building_json] of Object.entries(this.campus_buildings_json)) {

			if(!building_json.attributes.icon_position) {
				continue;
			}

			if(building_json.attributes.space_id.includes("NL")) {
				continue;
			}

			const position = this._convert_cityjson_position(building_json.attributes.icon_position);

			this._add_icon_set(
				building_key,
				building_json.attributes["space_id"],
				[],
				[],
				[],
				position);	

		}

	}

	// Called from buildingView whenever switching back to the campus view
	switch_to_campus_view() {

		const current_building_json = cityjson.CityObjects[this.current_building_key];

		const position = this._convert_cityjson_position(current_building_json.attributes.icon_position);

		this._add_icon_set(
			this.current_building_key,
			current_building_json.attributes["space_id"],
			[],
			[],
			[],
			position);

		this._remove_storey_icon_sets();

		this.current_storey_keys = undefined;

	}

	// Used when changing from one storey to another
	// or when switching to campus view
	_remove_storey_icon_sets() {

		this.current_storey_keys.forEach((current_key) => {

			if (current_key in this.map.iconsSceneManager.iconSets) {

				this.map.iconsSceneManager.removeIconSet(current_key);

			}

		});

	}

	// Used when changing from one storey to another
	_add_storey_icon_sets() {

		this.current_storey_keys.forEach((current_key) => {

			const current_room_json = cityjson.CityObjects[current_key];

			const current_room_code = current_room_json.attributes["Usage Code"];

			if (this.active_layers.includes(current_room_code)) {

				const position = this._convert_cityjson_position(current_room_json.attributes.icon_position);

				this._add_icon_set(
					current_key,
					"",
					[this.layers_json[current_room_code]["path from assets:"]],
					[current_room_code],
					["#f7c286ff"],
					position);	

			}

		});
		 
	}

	// Used when removing a thematic layer
	_remove_icon(layer_code) {

		for (const [icon_set_key, icon_set_object] of Object.entries(this.map.iconsSceneManager.iconSets)) {

			if (layer_code in icon_set_object.svgIcons) {

	            this.map.iconsSceneManager.removeIconSet(icon_set_key)

        	}

		}

	}

	// Used when adding a thematic layer
	_add_icon(layer_code) {

		this._add_icon_buildings();

		if (this.building_view_active) {

			this._add_icon_rooms(layer_code);

		}

	}

	_add_icon_buildings(layer_code) {



	}

	_add_icon_rooms(layer_code) {

		this.current_storey_keys.forEach((current_key) => {

			const current_room_json = cityjson.CityObjects[current_key];

			if (current_room_json.attributes["Usage Code"] == layer_code) {

				// if (current_key in this.map.iconsSceneManager.iconSets) {
				// 	console.log(current_key, " already had an icon, somehow");
				// 	continue;
				// }

				const position = this._convert_cityjson_position(current_room_json.attributes.icon_position);

				this._add_icon_set(
					current_key,
					"",
					[this.layers_json[layer_code]["path from assets:"]],
					[layer_code],
					["#f7c286ff"],
					position);	

			}

		});

	}

	_update_active_layers(layer_code) {

		const index = this.active_layers.indexOf(layer_code);

		if (index == -1) {

			this.active_layers.push(layer_code);

			this._add_icon(layer_code);

		} else {
			this.active_layers.splice(index, 1);

			this._remove_icon(layer_code);
		}

	}

	_convert_cityjson_position(position_object) {

		const position = new THREE.Vector3(
			position_object[0],
			position_object[2],
			-position_object[1]);

		return position;

	}

	// this class needs to track the global status of:
	// 1. track building view versus 3d view - handle the visibility of indoor vs label icons 
	// 		function to transition between both 
	// 2. track status of each thematic layer
	//		function to toggle visibility of each theme
	// 3. incorporate the already existing functions below
	//		load codelist
	//		populate layer dropdown


	async _add_icon_set(icon_set_key, icon_set_text, paths, icon_keys, bg_colors, position) {

		const svgs = await Promise.all(
            paths.map((p) => this.map.svgLoader.getSvg(p))
        );

        const icons = [];

        for (var i = 0; i < paths.length; i++) {
            const svg = svgs[i];
            const key = icon_keys[i];
            const bgColor = bg_colors[i];
            const icon = new SvgIcon(key, svg, { bgColor: bgColor });
            icons.push(icon);
        }

        const text_icon = new TextIcon(icon_set_text);

        const icon_set = new IconSet(icon_set_key, icons, text_icon, position);

        this.map.iconsSceneManager.addIconSet(icon_set);
        
	}

	_populate_layer_buttons(path) {

		var layers_dropdown = document.getElementById("layers-dropdown");
		layers_dropdown.innerHTML = "";

		for (const [layer_key, layer_attributes] of Object.entries(this.layers_json)) {

			var a = document.createElement("a");

			a.appendChild(document.createTextNode(layer_attributes["Name (EN) [str]"]));

			a.addEventListener("click", (event) => {
				
				this._update_active_layers(layer_key);

			});

			a.href = "#";

			layers_dropdown.appendChild(a);

		}

	}

	_alter_thematic_codelist_json() {

		let json_data = {};

		this.layers_json.forEach((element) => {
			json_data[element["Code [str]"]] = element;
		})

		console.log(JSON.stringify(json_data));
	}

}

// export async function populate_layer_buttons(path) {


// 	const all_layers_json = await load_codelist(path); // this needs to be the codelist file
// 	const layers_json = all_layers_json.filter((element) => {
// 		return element["Include"] == "Y";
// 	});
// 	var layers_dropdown = document.getElementById("layers-dropdown");
// 	layers_dropdown.innerHTML = "";


// 	for (let i = 0; i < layers_json.length; i++) {

// 		var a = document.createElement("a");

// 		a.appendChild(document.createTextNode(layers_json[i]["Name-EN"]));

// 		a.addEventListener("click", (event) => {
// 			// if building view: toggle icons of objects that are in the current floor
// 			// remove 3d view icons for only the current building, and vice versa when leaving building view
// 			// this is to keep the icons for other buildings there
// 			// consider how to deal with external icons (above should solve it)
// 			// if 3d view: toggle icons with the building ID labels, above the building


// 			// hide or unhide layers (toggle function)
// 			console.log(layers_json[i]);

// 		});

// 		a.href = "#";

// 		layers_dropdown.appendChild(a);

// 	}

// }
// export function load_codelist(path) {
// 	return new Promise((resolve, reject) => {
// 		Papa.parse(path, {
// 			download: true,
// 			header: true,
// 			delimiter: ",",
// 			skipEmptyLines: "greedy",
// 			complete: (results) => resolve(results.data),
// 			error: (err) => reject(err)
// 		});
// 	});
// }

// export async function outline_code(code, map) {

// 	var object_attribute_list = [];

// 	for (const [key, value] of Object.entries(cityjson["CityObjects"])) {

// 		object_attribute_list.push(value);
// 	}

// 	let keys = [];
// 	let object_names = [];

// 	object_attribute_list.forEach((current_object) => {
// 		if (current_object.attributes["Usage Code"] == code) {
// 			keys.push(current_object.attributes.key);
// 			if (current_object.type == "Building") {
// 				object_names.push(map.scene.getObjectByName(current_object.attributes.key + '-lod_2'));
// 			}
// 			else {
// 				object_names.push(map.scene.getObjectByName(current_object.attributes.key + '-lod_0'));
// 			}

// 		}

// 	});
// 	console.log(object_names);
// 	map.setOutline(keys, "lod_0", "single");
// 	map.picker.highlight(object_names);

// }