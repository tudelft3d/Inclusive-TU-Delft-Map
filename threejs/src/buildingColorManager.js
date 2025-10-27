import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

import { PRIMARY_COLOR_3, SECONDARY_COLOR_3, TERTIARY_COLOR_3, QUATERNARY_COLOR_3, QUINARY_COLOR_3 } from "./constants";

export class BuildingColorManager {

	constructor(scene) {

		this.scene = scene;

		// TODO make this work properly @ LARS

		setTimeout(() => {
			this._random_color();
		}, 300);

	}

	_random_color() {

		for (const [building_key, building_json] of Object.entries(cityjson.CityObjects)) {

			if (building_json.type != "Building") {
				continue;
			}

			const color_class = building_json.attributes["Color_class"];

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
					console.log("invalid color code for", building_key, "defaulting to Quinary color");
					constant_name = QUINARY_COLOR_3;
			}

			let mesh_key = building_key + "-lod_2";

			let mesh = this.scene.getObjectByName(mesh_key);

			if (!mesh) {
				// console.log("no mesh found for:", building_key);
				continue;
			}

			mesh.material = mesh.material.clone();

			mesh.material.color.setHex(constant_name);

		}

	}

}