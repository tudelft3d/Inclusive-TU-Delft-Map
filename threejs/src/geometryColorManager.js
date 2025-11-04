import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layer_definition_json from "../assets/threejs/buildings/thematic_codelist-definition.json" assert {type: "json"};
import { CjHelper } from "./cjHelper";

import { PRIMARY_COLOR_3, SECONDARY_COLOR_3, TERTIARY_COLOR_3, QUATERNARY_COLOR_3, QUINARY_COLOR_3 } from "./constants";

export class GeometryColorManager {

	constructor(scene) {

		this.scene = scene;

		this.cjHelper = new CjHelper(this.scene);

		this.layer_definition = {};
		for (const [key, value] of Object.entries(layer_definition_json)) {
			if (value["Include"]) {
				this.layer_definition[key] = value;
			}
		}

		this.building_BuildingUnitContainers = this.cjHelper.extract_building_buildingUnitContainers();
		this.campus_OutdoorUnitContainers = this.cjHelper.extract_outdoor_unit_containers();

		this._initiate_colors();

	}

	_initiate_colors() {

		const threejs_world_object = this.scene.getObjectByName("world");

		if (threejs_world_object == undefined) {
			setTimeout(() => {
				this._initiate_colors();
			}, 100);
			return;
		}

		this._assign_building_colors();

		this._assign_standard_room_colors("#ede4d3");
		// this._assign_standard_room_colors("#ffffff");

		for (const [layer_code, layer_object] of Object.entries(this.layer_definition)) {
			if (layer_object["Geometry color"]) {
				this._assign_geometry_unit_colors(layer_code, layer_object["Geometry color"]);
			}
		}

		const hall_way_color = "#bdbdbd";

		this._assign_geometry_unit_colors("Na-Fl-Ha", hall_way_color);
		this._assign_geometry_unit_colors("Na-Fl-Co", hall_way_color);

	}

	_assign_building_colors() {

		for (const [building_key, building_json] of Object.entries(cityjson.CityObjects)) {

			if (building_json.type != "Building") {
				continue;
			}

			const color_class = building_json.attributes["Importance"];

			var constant_name;

			switch (color_class) {
				case "Primary":
					constant_name = PRIMARY_COLOR_3;
					break;
				case "Secondary":
					constant_name = SECONDARY_COLOR_3;
					break;
				case "Tertiary":
					constant_name = TERTIARY_COLOR_3;
					break;
				case "Quaternary":
					constant_name = QUATERNARY_COLOR_3;
					break;
				case "Quinary":
					constant_name = QUINARY_COLOR_3;
					break;
				default:
					console.error("invalid importance code for", building_key, "defaulting to Quinary importance");
					constant_name = QUINARY_COLOR_3;
			}

			let mesh_key = this.cjHelper.keyToMeshKey(building_key)

			let mesh_object = this.scene.getObjectByName(mesh_key);

			if (!mesh_object) {
				continue;
			}

			mesh_object.material = mesh_object.material.clone();

			mesh_object.material.color.setHex(constant_name);

		}

	}

	_assign_standard_room_colors(color) {

		for (const [building_key, building_json] of Object.entries(cityjson.CityObjects)) {

			if (building_json.type != "BuildingRoom") {
				continue;
			}

			let mesh_key = this.cjHelper.keyToMeshKey(building_key)

			let mesh_object = this.scene.getObjectByName(mesh_key);

			if (!mesh_object) {
				continue;
			}

			mesh_object.material = mesh_object.material.clone();

			const threejs_color = this._hex_to_threejs_hex(color);

			mesh_object.material.color.setHex(threejs_color);

		}

	}

	_assign_geometry_unit_colors(layer_code, color) {

		if (!(this.layer_definition[layer_code])) {
			console.error(layer_code, "is not a known layer code");
			return;
		}

		// if (!(this.layer_definition[layer_code]["Geometry"])) {
		// 	console.log("Layer:", layer_code, "does not have any geometry.");
		// 	return;
		// }

		for (const [building_key, layer_code_unit_key_dict] of Object.entries(this.building_BuildingUnitContainers)) {

			if (!(layer_code_unit_key_dict[layer_code])) {
				continue;
			}

			const unit_container_key = layer_code_unit_key_dict[layer_code];

			const unit_container_object = cityjson.CityObjects[unit_container_key];

			for (const unit_key of unit_container_object.children) {

				const unit_object = cityjson.CityObjects[unit_key];

				if (unit_object.attributes["unit_spaces"] && unit_object.attributes["unit_spaces"].length > 0) {

					for (const space_key of unit_object.attributes["unit_spaces"]) {

						this._color_mesh_with_key(space_key, color)

					}

				} else {

					this._color_mesh_with_key(unit_key, color)

				}

			}

		}

	}

	_color_mesh_with_key(object_key, color) {

		const mesh_key = this.cjHelper.keyToMeshKey(object_key);

		if (mesh_key != null && this.cjHelper.checkMeshKeyExists(mesh_key)) {

			let mesh_object = this.scene.getObjectByName(mesh_key);

			mesh_object.material = mesh_object.material.clone();

			const threejs_color = this._hex_to_threejs_hex(color);

			mesh_object.material.color.setHex(threejs_color);

		}

	}

	_hex_to_threejs_hex(hex_color) {
		return hex_color.toUpperCase().replace("#", "0x");
	}

}