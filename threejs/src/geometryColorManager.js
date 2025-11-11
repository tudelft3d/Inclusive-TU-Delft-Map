import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layer_definition_json from "../assets/threejs/buildings/thematic_codelist-definition.json" assert {type: "json"};
import { CjHelper } from "./cjHelper";

import {
	PRIMARY_COLOR,
	SECONDARY_COLOR,
	TERTIARY_COLOR,
	QUATERNARY_COLOR,
	QUINARY_COLOR,
	STANDARD_ROOM_COLOR} from "./constants";

/**
 * This class handles coloring the variety of geometry used in creating the map.
 */

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

	/**
	 * This function maintains all the additional function calls that color specific elements.
	 * It will repeatedly call itself until the threejs geometry has been loaded.
	 */
	_initiate_colors() {

		const threejs_world_object = this.scene.getObjectByName("world");

		if (threejs_world_object == undefined) {
			setTimeout(() => {
				this._initiate_colors();
			}, 100);
			return;
		}

		this._assign_building_colors();

		/**
		 * The hex code in this function determines what color rooms will be given if they do not
		 * have a color defined in thematic_codelist-definition.json
		 */
		this._assign_standard_room_colors(STANDARD_ROOM_COLOR);

		for (const [layer_code, layer_object] of Object.entries(this.layer_definition)) {
			if (layer_object["Geometry color"]) {
				this._assign_geometry_unit_colors(layer_code, layer_object["Geometry color"]);
			}
		}
	}

	/**
	 * Assigns colors to buildings based on the important value that is encoded in the cityjson object
	 * of each building. Which color corresponds with which importance value is determined in constants.js.
	 */
	_assign_building_colors() {

		for (const [building_key, building_json] of Object.entries(cityjson.CityObjects)) {

			if (building_json.type != "Building") {
				continue;
			}

			const color_class = building_json.attributes["Importance"];

			var constant_name;

			switch (color_class) {
				case "Primary":
					constant_name = PRIMARY_COLOR;
					break;
				case "Secondary":
					constant_name = SECONDARY_COLOR;
					break;
				case "Tertiary":
					constant_name = TERTIARY_COLOR;
					break;
				case "Quaternary":
					constant_name = QUATERNARY_COLOR;
					break;
				case "Quinary":
					constant_name = QUINARY_COLOR;
					break;
				default:
					console.error("invalid importance code for", building_key, "defaulting to Quinary importance");
					constant_name = QUINARY_COLOR;
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

	/**
	 * Assigns the standard room color to all known rooms.
	 * Rooms that need to be colored differently (such as stairs) have this value overwritten in
	 * a different function call.
	 */
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

			mesh_object.material.color.setHex(color);

		}

	}

	/**
	 * @param {string} layer_code: The code of the layer that needs to be assigned a color.
	 * @param {string} color: The color that the geometry needs to receive.
	 * 
	 * Assigns colors to units that are associated with geometry.
	 * This is used both for rooms AND for things such as ramps, mini stairs etc.
	 * 
	 * Whether something is assigned a color is determined by if its corresponding entry in
	 * thematic_codelist-definition.json has a value for the geometry color attribute.
	 */
	_assign_geometry_unit_colors(layer_code, color) {

		if (!(this.layer_definition[layer_code])) {
			console.error(layer_code, "is not a known layer code");
			return;
		}

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

	/**
	 * @param {string} object_key: The cityjson object key that is connected to the geometry that needs to be colored.
	 * @param {string} color: The color that the geometry needs to receive.
	 * 
	 * Assigns a color to a mesh object based on the corresponding cityjson object key.
	 * 
	 */
	_color_mesh_with_key(object_key, color) {

		const mesh_key = this.cjHelper.keyToMeshKey(object_key);

		if (mesh_key != null && this.cjHelper.checkMeshKeyExists(mesh_key)) {

			let mesh_object = this.scene.getObjectByName(mesh_key);

			mesh_object.material = mesh_object.material.clone();

			const threejs_color = this._hex_to_threejs_hex(color);

			mesh_object.material.color.setHex(threejs_color);

		}

	}

	/**
	 * @param {string} hex_color: The color that needs to be converted.
	 * 
	 * Converts a standard hex color code (starting with #) to one usable by threejs (starting with 0x)
	 * 
	 */
	_hex_to_threejs_hex(hex_color) {
		return hex_color.toUpperCase().replace("#", "0x");
	}

}