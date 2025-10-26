import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layers_json from "../assets/threejs/buildings/thematic_codelist.json" assert {type: "json"};
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
	- refactor code to reduce duplication
	- refactor code to make buildings and rooms loop in the same way
	- somehow determine a color for each icon, maybe save in json file? integrate with colorblind mode?
 
MENTION:
	- process from csv list to json needs to improve

*/

export class LayerManager {

	constructor(scene, iconsSceneManager, svgLoader) {

		this.scene = scene;
		this.iconsSceneManager = iconsSceneManager;
		this.svgLoader = svgLoader;

		this.layer_definition = {};

		for (const [key, value] of Object.entries(layers_json["Layer Definition"])) {

			if (value["Include"] == "Y") {
				this.layer_definition[key] = value;
			}

		}

		this.layer_hierarchy = layers_json["Layer Hierarchy"];

		// Maybe have these taken from codelist?
		// Or otherwise pass as argument
		this.active_layers = [];


		// this._populate_layer_buttons();

		this._populate_layer_buttons_alt();

		this.campus_buildings_json = this._isolate_building_json();

		this.campus_buildings_codes = this._isolate_building_room_codes();

		this.current_building_key;

		this.current_storey_room_keys;

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

			if (!building_json.children) {

				campus_building_codes[building_key] = new Set();

				continue;
			}

			const building_units_key = building_json.children.find((key) => key.includes("Unit"));

			let found_unit_codes = this._recursive_unit_code_searcher(building_units_key);

			campus_building_codes[building_key] = found_unit_codes;

		}

		return campus_building_codes;

	}

	_recursive_unit_code_searcher(key) {

		const current_json_object = cityjson.CityObjects[key];

		let codes = new Set();

		if (current_json_object.attributes["code"]) {

			codes.add(current_json_object.attributes["code"]);

		}

		if (current_json_object["children"]) {

			current_json_object["children"].forEach((child_key) => {

				codes = codes.union(this._recursive_unit_code_searcher(child_key));

			});

		}

		return codes;

	}

	switch_to_building_view(building_key, storey_room_keys) {

		this.building_view_active = true;

		this.current_building_key = building_key;

		this.iconsSceneManager.removeIconSet(building_key);

		this.enable_storey_icons(storey_room_keys);

	}


	// Called from the buildingView function whenever the storey is changed.
	enable_storey_icons(storey_room_keys) {

		if (this.current_storey_room_keys) {

			this._remove_storey_icon_sets();

		}

		this.current_storey_room_keys = storey_room_keys;

		this._add_storey_icon_sets();

	}

	_create_initial_campus_icons() {

		const active_layers_set = new Set(this.active_layers);

		for (const [building_key, building_json] of Object.entries(this.campus_buildings_json)) {

			if (!building_json.attributes.icon_position) {
				continue;
			}

			if (building_json.attributes.space_id.includes("NL")) {
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

		const active_layers_set = new Set(this.active_layers);

		const needed_layers = Array.from(this.campus_buildings_codes[this.current_building_key].intersection(active_layers_set));

		const paths = needed_layers.map((element) => { return this.layer_definition[element]["path from assets"] });
		const colors = Array(needed_layers.length).fill("#f7c286ff");

		const position = this._convert_cityjson_position(current_building_json.attributes.icon_position);

		if (this.iconsSceneManager.iconSets[this.current_building_key]) {
			this.iconsSceneManager.removeIconSet(this.current_building_key);
		}

		this._add_icon_set(
			this.current_building_key,
			current_building_json.attributes["space_id"],
			paths,
			needed_layers,
			colors,
			position);

		this._remove_storey_icon_sets();

		this.current_storey_room_keys = undefined;

		this.building_view_active = false;

	}

	// Used when changing from one storey to another
	// or when switching to campus view
	_remove_storey_icon_sets() {

		this.current_storey_room_keys.forEach((current_key) => {

			if (current_key in this.iconsSceneManager.iconSets) {

				this.iconsSceneManager.removeIconSet(current_key);

			}

		});

	}

	// Used when changing from one storey to another
	_add_storey_icon_sets() {

		this.current_storey_room_keys.forEach((current_key) => {

			const current_room_json = cityjson.CityObjects[current_key];

			const current_room_parent_unit_key_array = current_room_json.attributes["parent_units"];

			if (current_room_parent_unit_key_array.length == 0) {
				return;
			}

			const parent_unit_codes = current_room_parent_unit_key_array.map((element) => {

				return cityjson.CityObjects[element].attributes.code;

			});

			const active_parent_unit_codes = parent_unit_codes.filter((element) => {

				return this.active_layers.includes(element);

			});

			if (active_parent_unit_codes.length == 0) {
				return;
			}

			const position = this._convert_cityjson_position(current_room_json.attributes.icon_position);

			let paths = [];
			let keys = [];
			let colors = [];

			active_parent_unit_codes.forEach((code) => {

				paths.push(this.layer_definition[code]["path from assets"]);
				keys.push(code);
				colors.push("#f7c286ff");

			})

			this._add_icon_set(
				current_key,
				null,
				paths,
				keys,
				colors,
				position);

		});

	}

	// Used when removing a thematic layer
	_remove_icon(code) {

		for (const [icon_set_key, icon_set_object] of Object.entries(this.iconsSceneManager.iconSets)) {

			if (code in icon_set_object.svgIcons) {

				if (Object.keys(icon_set_object.svgIcons).length > 1 || icon_set_object.textIcon.is_populated()) {

					icon_set_object.removeSvgIcon(code);

				} else {

					this.iconsSceneManager.removeIconSet(icon_set_key)

				}

			}

		}

	}

	// Used when adding a thematic layer
	_add_icon(code) {

		this._add_icon_buildings(code);

		if (this.building_view_active) {

			this._add_icon_rooms(code);

		}

	}

	_add_icon_buildings(code) {

		for (const [building_key, building_json] of Object.entries(this.campus_buildings_json)) {

			if (this.building_view_active && building_key == this.current_building_key) {
				continue;
			}

			if (this.campus_buildings_codes[building_key].has(code)) {

				if (this.iconsSceneManager.iconSets[building_key]) {

					const path = [this.layer_definition[code]["path from assets"]];
					const color = ["#f7c286ff"];

					this._add_icon_svg(building_key, code, path, color);

				} else {

					const position = this._convert_cityjson_position(building_json.attributes.icon_position);

					this._add_icon_set(
						building_key,
						null,
						[this.layer_definition[code]["path from assets"]],
						[code],
						["#f7c286ff"],
						position);

				}

			}

		}

	}

	_add_icon_rooms(code) {

		this.current_storey_room_keys.forEach((current_key) => {

			const current_room_json = cityjson.CityObjects[current_key];

			const current_room_parent_unit_key_array = current_room_json.attributes["parent_units"];

			if (current_room_parent_unit_key_array.length == 0) {
				return;
			}

			const parent_unit_codes = current_room_parent_unit_key_array.map((element) => {

				return cityjson.CityObjects[element].attributes.code;

			});

			if (parent_unit_codes.includes(code)) {

				if (this.iconsSceneManager.iconSets[current_key]) {

					const path = [this.layer_definition[code]["path from assets"]];
					const color = ["#f7c286ff"];

					this._add_icon_svg(current_key, code, path, color);

				} else {

					const position = this._convert_cityjson_position(current_room_json.attributes.icon_position);

					this._add_icon_set(
						current_key,
						null,
						[this.layer_definition[code]["path from assets"]],
						[code],
						["#f7c286ff"],
						position);

				}

			}

		});

	}


	_convert_cityjson_position(position_object) {

		const position = new THREE.Vector3(
			position_object[0],
			position_object[2],
			-position_object[1]);

		return position;

	}

	async _add_icon_svg(icon_set_key, icon_key, icon_path, icon_color) {

		const svg = await Promise.all(
			icon_path.map((p) => this.svgLoader.getSvg(p))
		);

		const icon = new SvgIcon(icon_key, svg[0], { bgColor: icon_color });

		this.iconsSceneManager.iconSets[icon_set_key].addSvgIcon(icon);

	}

	_generate_icon_onclick(object_key) {

		const object_json = cityjson.CityObjects[object_key];

		let object_threejs_name;

		if (object_json.type == "Building") {

			object_threejs_name = object_key + "-lod_2";

		} else if (object_json.type == "BuildingRoom") {

			object_threejs_name = object_key + "-lod_0";

		} else {

			console.error("UNRECOGNIZED OBJECT type:", object_key);

		}

		const onClick = (e) => {
			this.picker.pickMesh(this.scene.getObjectByName(object_threejs_name));
		};

		return onClick;

	}

	async _add_icon_set(icon_set_key, icon_set_text, paths, icon_keys, bg_colors, position) {

		const svgs = await Promise.all(
			paths.map((p) => this.svgLoader.getSvg(p))
		);

		const icons = [];

		for (var i = 0; i < paths.length; i++) {
			const svg = svgs[i];
			const key = icon_keys[i];
			const bgColor = bg_colors[i];
			const icon = new SvgIcon(key, svg, { bgColor: bgColor });
			icons.push(icon);
		}

		var text_icon;

		if (!icon_set_text || icon_set_text == "") {
			text_icon = null;
		} else {
			text_icon = new TextIcon(icon_set_text);
		}

		const onClick = this._generate_icon_onclick(icon_set_key);

		const icon_set = new IconSet(icon_set_key, icons, text_icon, position, onClick);

		this.iconsSceneManager.addIconSet(icon_set);

	}

	_update_active_layers(code) {

		const index = this.active_layers.indexOf(code);

		if (index == -1) {

			this.active_layers.push(code);

			this._add_icon(code);

		} else {
			this.active_layers.splice(index, 1);

			this._remove_icon(code);
		}

	}

	_populate_layer_buttons_alt() {

		var layers_dropdown = document.getElementById("layers-dropdown");

		// layers_dropdown.innerHTML = "";

		for (const [group_name, group_layers] of Object.entries(this.layer_hierarchy)) {

			let group_div = document.createElement("div");
			layers_dropdown.appendChild(group_div);

			let group_span_div = document.createElement("div");
			group_span_div.className = "layer-button-row";
			group_div.appendChild(group_span_div);


			let open_span = document.createElement("span");
			let activate_span = document.createElement("span");

			group_span_div.appendChild(open_span);
			group_span_div.appendChild(activate_span);


			let open_button = document.createElement("button");
			open_button.append(document.createTextNode("+"));
			open_button.className = "layer-button";

			

			open_span.appendChild(open_button);


			let activate_button = document.createElement("button");
			activate_button.append(document.createTextNode(group_name));
			activate_button.className = "layer-button";

			activate_span.appendChild(activate_button);


			let layer_div = document.createElement("div");
			layer_div.className = "layer-button-background";
			layer_div.id = group_name + "_div_id"

			group_div.appendChild(layer_div);

			for (const [layer_name, layer_code] of Object.entries(group_layers)) {

				let current_layer_button = document.createElement("button");
				current_layer_button.append(document.createTextNode(layer_name));
				current_layer_button.className = "layer-button";

				current_layer_button.addEventListener('click', () => {
					this._update_active_layers(layer_code);
		        });

		        layer_div.appendChild(current_layer_button);

			}

			open_button.addEventListener('click', (event) => {

				let current_group_div = document.getElementById(group_name + "_div_id");

				current_group_div.style.display = (current_group_div.style.display === '') ? 'none' : '';
		    });

		    activate_button.addEventListener('click', (event) => {

		    	for (const [layer_name, layer_code] of Object.entries(group_layers)) {

		    		this._update_active_layers(layer_code);

				}

		    });



			// let text_span = document.createElement("span");
			// let icon_span = document.createElement("span");

			// var ul = document.createElement("ul");
			// ul.className = "layer-button-background";

			// let header_text = document.createTextNode(group_name);
			// text_span.appendChild(header_text);

			// let img = document.createElement("img");
			// img.setAttribute('width', '20');
			// img.setAttribute('height', '20');
			// img.setAttribute('align', 'top');

			// img.src = "../assets/threejs/graphics/icons/ui-buttons/plus_white.svg";
			// img.setAttribute('fill', 'black');

			// icon_span.appendChild(img);

			// div.appendChild(icon_span);
			// div.appendChild(text_span);
			// div.appendChild(ul);

			// for (const [layer_name, layer_code] of Object.entries(group_layers)) {

			// 	var li = document.createElement("li");

			// 	var a_li = document.createElement("a");

			// 	let button_text = document.createTextNode(layer_name);

			// 	a_li.appendChild(button_text);

			// 	li.appendChild(a_li);

			// 	ul.appendChild(li);

			// 	a_li.addEventListener('click', (event) => {

			// 		console.log(layer_name);

			// 	});

			// }

			// text_span.addEventListener('click', (event) => {

			// 	// console.log(event.srcElement.parentNode.children);

			// 	let current_ul = event.srcElement.parentNode.getElementsByTagName("ul")[0];

			// 	// let current_ul = event.srcElement.nextElementSibling;

			// 	current_ul.style.display = (current_ul.style.display === '') ? 'none' : '';

			// });

			// layers_dropdown.appendChild(div);

		}

	}

	_populate_layer_buttons() {

		var layers_dropdown = document.getElementById("layers-dropdown");
		layers_dropdown.innerHTML = "";

		for (const [group_name, group_layers] of Object.entries(this.layer_definition)) {

		}

		for (const [layer_key, layer_attributes] of Object.entries(this.layer_definition)) {

			var a = document.createElement("a");

			let text = document.createTextNode(layer_attributes["Name (EN) [str]"]);

			let img = document.createElement("img");
			img.setAttribute('width', '20');
			img.setAttribute('height', '20');
			img.setAttribute('align', 'top');
			img.src = layer_attributes["path from assets"];

			a.appendChild(img);
			a.appendChild(text);

			a.addEventListener("click", (event) => {

				this._update_active_layers(layer_key);

				if (event.srcElement.style.backgroundColor == "green") {

					event.srcElement.style.backgroundColor = "";

				} else {

					event.srcElement.style.backgroundColor = "green";

				}

			});

			a.href = "#";

			layers_dropdown.appendChild(a);

		}

	}

	_alter_thematic_codelist_json() {

		let json_data = {};

		this.layer_definition.forEach((element) => {
			json_data[element["Code [str]"]] = element;
		})

		console.log(JSON.stringify(json_data));
	}

}

// export async function populate_layer_buttons(path) {


// 	const all_layer_definition = await load_codelist(path); // this needs to be the codelist file
// 	const layer_definition = all_layer_definition.filter((element) => {
// 		return element["Include"] == "Y";
// 	});
// 	var layers_dropdown = document.getElementById("layers-dropdown");
// 	layers_dropdown.innerHTML = "";


// 	for (let i = 0; i < layer_definition.length; i++) {

// 		var a = document.createElement("a");

// 		a.appendChild(document.createTextNode(layer_definition[i]["Name-EN"]));

// 		a.addEventListener("click", (event) => {
// 			// if building view: toggle icons of objects that are in the current floor
// 			// remove 3d view icons for only the current building, and vice versa when leaving building view
// 			// this is to keep the icons for other buildings there
// 			// consider how to deal with external icons (above should solve it)
// 			// if 3d view: toggle icons with the building ID labels, above the building


// 			// hide or unhide layers (toggle function)
// 			console.log(layer_definition[i]);

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