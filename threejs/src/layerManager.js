import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layer_definition_json from "../assets/threejs/buildings/thematic_codelist-definition.json" assert {type: "json"};
import layer_hierarchy_json from "../assets/threejs/buildings/thematic_codelist-hierarchy.json" assert {type: "json"};
import { CjHelper } from './cjHelper';

import {
	// layerset,
	IconsSceneManager,
	TextIcon,
	SvgIcon,
	SvgLoader,
	IconSet
} from "./icons";

export class LayerManager {

	constructor(scene, iconsSceneManager, svgLoader) {

		this.scene = scene;
		this.iconsSceneManager = iconsSceneManager;
		this.svgLoader = svgLoader;

		this.layer_hierarchy = layer_hierarchy_json;
		this.layer_definition = {};
		this.cjHelper = new CjHelper(this.scene);

		// for (const [key, value] of Object.entries(layer_definition_json)) {
		// 	if (value["Include"] && value["Shown with icon"]) {
		// 		this.layer_definition[key] = value;
		// 	}
		// }

		for (const [key, value] of Object.entries(layer_definition_json)) {
			if (value["Include"]) {
				this.layer_definition[key] = value;
			}
		}

		this.active_layers = [];
		this.importance_baseline = "Tertiary";

		this.active_building_object_key = null;
		this.active_storey_code = null;

		this.building_BuildingUnitContainers = this._extract_building_buildingUnitContainers();
		this.campus_OutdoorUnitContainers = this._extract_outdoor_unit_containers();

		this._populate_layer_buttons();

		this._add_initial_iconsets();

		this._unhide_mesh_parents();

	}

	/**
	 * Extracts all the buildingUnitContainers for each building on the campus from the cityjson.
	 * 
	 * This function assumes that buildings have a child of type BuildingUnitObject.
	 * If not, the building will be skipped and never be assigned icons.
	 * 
	 * The end result is:
	 * 
	 * {
		  * building_1: {
				* code1: b1_code1_key,
				* code2: b1_code2_key
		  * },
		  * building_2: {
				* code1: b2_code1_key,
				* code2: b2_code2_key
		  * }
	 * }
	 *
	 * @returns A dictionary mapping building keys to a dictionary mapping layer codes to buildingUnitContainer keys.
	 */
	_extract_building_buildingUnitContainers() {

		const building_buildingUnitContainers = {};

		for (const [building_key, building_object] of Object.entries(cityjson.CityObjects)) {

			if (building_object.type == "Building") {

				if (!(building_object.children)) {
					building_buildingUnitContainers[building_key] = {};
					continue;
				}

				const buildingUnitObject_key = building_object.children.find((element) => element.includes("BuildingUnitObject"));

				if (buildingUnitObject_key == undefined) {
					// console.error("Building:", building_key, " did not have any BuildingUnitObject");
					building_buildingUnitContainers[building_key] = {};
					continue;
				}

				const buildingUnitObject_children_keys = cityjson.CityObjects[buildingUnitObject_key].children;

				let buildingUnitObject_children_dict = {};

				buildingUnitObject_children_keys.forEach((current_unit_key) => {

					const current_layer_code = cityjson.CityObjects[current_unit_key].attributes["code"];
					buildingUnitObject_children_dict[current_layer_code] = current_unit_key;

				});

				building_buildingUnitContainers[building_key] = buildingUnitObject_children_dict;

			}
		}
		return building_buildingUnitContainers;
	}

	/**
	 * Extracts all the OutdoorUnitContainers from the cityjson
	 * 
	 * This function assumes that the cityjson file has one object called Outdoor-CityObjectGroup-OutdoorObject.
	 *
	 * The end result is:
	 * 
	 * {
		  * code1: unit1_key,
		  * code2: unit2_key
	 * }
	 * 
	 * @returns An object where layer codes map to their respective OutdoorUnitContainer.
	 */
	_extract_outdoor_unit_containers() {

		const campus_OutdoorUnitContainers = {};

		const outdoor_unit_keys = cityjson.CityObjects["Outdoor-CityObjectGroup-OutdoorObject"].children;

		outdoor_unit_keys.forEach((current_unit_key) => {

			const current_layer_code = cityjson.CityObjects[current_unit_key].attributes["code"];
			campus_OutdoorUnitContainers[current_layer_code] = current_unit_key;

		});

		return campus_OutdoorUnitContainers;

	}

	/**
	 * By default (?) the parents of the geometry layer geometry objects are hidden.
	 * These need to be made visible, so that the mesh children can be toggled.
	 */
	_unhide_mesh_parents() {

		const threejs_world_object = this.scene.getObjectByName("world");

		if (threejs_world_object == undefined) {
			setTimeout(() => {
				this._unhide_mesh_parents();
			}, 100);
			return;
		}

		for (const current_child_object of threejs_world_object.children) {
			this._unhide_mesh_parents_recursive(current_child_object);
		}
	}

	/**
	 * Unhide all the parents of unit meshes and hide the meshes themselves
	 *
	 * @param {THREE.Object3D} threejsObject
	 */
	_unhide_mesh_parents_recursive(threejsObject) {
		threejsObject.children.forEach((currentChild) => {
			if (currentChild.isMesh && currentChild.name.toLowerCase().includes("unit")) {
				currentChild.visible = false;
			} else if (currentChild.children && currentChild.name.toLowerCase().includes("unit")) {
				currentChild.visible = true;
				this._unhide_mesh_parents_recursive(currentChild);
			} else {
				return;
			}
		});
	}

	/**
	 * @param {string} new_importance_value: The new importance value.
	 * 
	 * This function updates the importance value, and then iterates over the buildings
	 * to update their labels (if necessary).
	 * 
	 */
	update_importance_baseline(new_importance_value) {

		const old_importance_value = this.baseline_importance;
		this.baseline_importance = new_importance_value;

		for (const [building_key, layer_code_unit_key_dict] of Object.entries(this.building_BuildingUnitContainers)) {

			const building_object = cityjson.CityObjects[building_key];

			const old_comparison = this._is_importance_sufficient(building_object.attributes["Importance"], old_importance_value);
			const new_comparison = this._is_importance_sufficient(building_object.attributes["Importance"], new_importance_value);

			if (old_comparison == new_comparison) {
				continue;
			} else {
				this._remove_single_iconset(building_key);
				this._add_single_building_iconset(building_key);
			}
		}
	}

	/**
	 * @param {string} importance_value: One of the five importance values
	 * @param {string} importance_baseline_value: One of the five importance values that the other input is compared against
	 * 
	 * This function returns whether or not a specific importance value is enough when compared to the current baseline.
	 * This function can be used to determine if an iconset needs to include a label
	 * 
	 * True is returned if incoming is equally or more important than baseline.
	 * False is returned if incoming is less important than baseline.
	 * 
	 */
	_is_importance_sufficient(incoming_importance_value, baseline_importance_value) {

		const importance_scale = ["Primary", "Secondary", "Tertiary", "Quaternary", "Quinary"];

		const incoming_importance_index = importance_scale.indexOf(incoming_importance_value);

		if (incoming_importance_index == -1) {
			console.error("Incorrect importance value encountered:", incoming_importance_value);
			return false;
		}

		const baseline_importance_index = importance_scale.indexOf(baseline_importance_value);

		if (baseline_importance_index == -1) {
			console.error("Incorrect importance baseline value encountered:", baseline_importance_value);
			return false;
		}

		if (incoming_importance_index <= baseline_importance_index) {
			return true;
		} else {
			return false;
		}

	}

	/**
	 * This function adds the initial labels and icons for the buildings and outdoor objects on campus
	 */
	_add_initial_iconsets() {

		for (const [building_key, layer_code_unit_key_dict] of Object.entries(this.building_BuildingUnitContainers)) {
			this._add_single_building_iconset(building_key);
		}

		for (const layer_code of this.active_layers) {

			if (this.campus_OutdoorUnitContainers[layer_code]) {
				this._add_single_outdoor_iconset(layer_code);
			}

		}

	}

	/**
	 * @param {string} building_key: cityjson key for a building object that needs to be given a label and icons
	 * 
	 * This function adds a label and icon to a single building.
	 * This function is called initially for each building when the map is loaded to give them their starting labels,
	 * and later on when leaving buildingView so that the removed label and icons can be restored.
	 */
	_add_single_building_iconset(building_key) {

		const building_object = cityjson.CityObjects[building_key];

		let building_label;

		if (this._is_importance_sufficient(building_object.attributes["Importance"], this.importance_baseline)) {
			if (building_object.type == "Building" && building_object.attributes["ShortName (EN)"]) {
				building_label = `${building_object.attributes["space_id"]} | ${building_object.attributes["ShortName (EN)"]}`;
			} else {
				building_label = building_object.attributes["space_id"];
			}
		} else {
			building_label = null;
		}

		let icon_paths = [];
		let icon_keys = [];
		let icon_colors = [];

		for (const layer_code of this.active_layers) {

			if (layer_code in this.building_BuildingUnitContainers[building_key] && this._is_icon_layer(layer_code)) {

				icon_paths.push(this._get_icon_path(layer_code));
				icon_keys.push(layer_code);
				icon_colors.push(this._get_icon_color(layer_code));

			}

		}

		if (building_label == null && icon_paths.length == 0) {
			return;
		}

		const position = this._convert_cityjson_position(building_object.attributes["icon_position"]);

		this._add_icon_set(building_key, building_label, icon_paths, icon_keys, icon_colors, position)

	}

	/**
	 * @param {string} unit_key: cityjson key for an outdoor unit object that needs to be given an iconset
	 * 
	 * This function adds an iconset to a single outdoor unit.
	 * This function is called on map startup to create the initial outdoor iconsets.
	 */
	_add_single_outdoor_iconset(layer_code) {

		const unit_container_key = this.campus_OutdoorUnitContainers[layer_code];

		const unit_container_object = cityjson.CityObjects[unit_container_key];

		for (const current_unit_key of unit_container_object.children) {

			const current_unit_object = cityjson.CityObjects[current_unit_key];

			const icon_path = [this._get_icon_path(layer_code)];
			const icon_key = [layer_code];
			const icon_color = [this._get_icon_color(layer_code)];

			const position = this._convert_cityjson_position(current_unit_object.attributes["icon_position"]);

			this._add_icon_set(current_unit_key, null, icon_path, icon_key, icon_color, position)

		}
	}

	/**
	 * @param {string} iconset_ket: iconset key for the iconset that needs to be removed.
	 */
	_remove_single_iconset(iconset_key) {
		this.iconsSceneManager.removeIconSet(icon_set_key);
	}

	/**
	 * @param {string} building_key: cityjson key for a building object
	 * @param {string} storey_code: identifier of one of the storeys in the building indicated by the building_key 
	 * 
	 * This function is called either when:
	 * 1. Building view is activated
	 * 2. The active storey in building view is changed
	 * 
	 * This function will first remove all icons associated with the building key,
	 * and then create all icons that are both currently active and present
	 * within the building.
	 * 
	 * First removing the icons serves a dual purpose of clearing the building label and building icons
	 * that may be active, as well as clearing any icons that are active on the storey that is being left.
	 * 
	 */
	add_interior_building_layers(building_key, storey_code) {

		this.active_building_object_key = this.cjHelper.keyToObjectKey(building_key);
		this.active_storey_code = storey_code;

		this.remove_interior_building_layers(false);

		for (const layer_code of this.active_layers) {

			if (layer_code in this.building_BuildingUnitContainers[this.active_building_object_key]) {

				if (this._is_geometry_layer(layer_code)) {
					this._toggle_single_interior_geometry_layer(layer_code, true);
				}

				if (this._is_icon_layer(layer_code)) {
					this._add_single_interior_icon_layer(layer_code);
				}
			}
		}
	}

	/**
	 * @param {string} layer_code: layer code of the layer for which iconsets need to be added inside
	 * the active building.
	 * 
	 */
	_add_single_interior_icon_layer(layer_code) {

		const layer_BuildingUnitContainer_key = this.building_BuildingUnitContainers[this.active_building_object_key][layer_code];

		for (const current_unit_key of cityjson.CityObjects[layer_BuildingUnitContainer_key].children) {

			const current_unit_object = cityjson.CityObjects[current_unit_key];

			for (const full_storey_code of current_unit_object.attributes.unit_storeys) {

				if (full_storey_code.split(".")[2] == this.active_storey_code) {

					const icon_path = [this._get_icon_path(layer_code)];
					const icon_key = [layer_code];
					const icon_color = [this._get_icon_color(layer_code)];

					const position = this._convert_cityjson_position(current_unit_object.attributes["icon_position"]);

					const icon_set_key = current_unit_key;

					this._add_icon_set(icon_set_key, null, icon_path, icon_key, icon_color, position)

				}
			}
		}
	}

	/**
	 * @param {string} layer_code: Toggle the visiblity of a single geometry layer inside a building
	 * 
	 */
	_toggle_single_interior_geometry_layer(layer_code, visibility) {

		const unit_container_key = this.building_BuildingUnitContainers[this.active_building_object_key][layer_code];

		const unit_container_object = cityjson.CityObjects[unit_container_key];

		for (const unit_key of unit_container_object.children) {

			const unit_object = cityjson.CityObjects[unit_key];

			for (const full_storey_code of unit_object.attributes.unit_storeys) {

				if (full_storey_code.split(".")[2] == this.active_storey_code) {

					const unit_mesh_key = unit_key + "-lod_0";

					const threejs_object = this.scene.getObjectByName(unit_mesh_key);

					threejs_object.visible = visibility;

					break;

				}
			}
		}
	}

	/**
	 * @param {string} layer_code: Toggle the visiblity of a single geometry layer that is outdoors on campus
	 * 
	 */
	_toggle_single_outdoor_geometry_layer(layer_code, visibility) {

		const unit_container_key = this.campus_OutdoorUnitContainers[layer_code];

		const unit_container_object = cityjson.CityObjects[unit_container_key];

		for (const unit_key of unit_container_object.children) {

			const unit_object = cityjson.CityObjects[unit_key];

			const unit_mesh_key = unit_key + "-lod_0";

			const threejs_object = this.scene.getObjectByName(unit_mesh_key);

			threejs_object.visible = visibility;

		}
	}

	/**
	 * @param {boolean} clear_active_values: Whether or not identifying values need to be cleared.
	 * 
	 * This function is called when layers in the interior of the active building need to be removed.
	 * Internally this function is used when switching storeys, as it is called by _add_single_interior_icon_layer
	 * to clear any icons.
	 * 
	 * Externally this function is called by buildingView when leaving the building view.
	 * 
	 * If clear_active_values is true the active building key and active storey code will be cleared,
	 * and the label of the active building will be restored.
	 *  
	 */
	remove_interior_building_layers(clear_active_values = true) {

		if (this.active_building_object_key in this.iconsSceneManager.iconSets) {
			this.iconsSceneManager.removeIconSet(this.active_building_object_key);
		}

		for (const [icon_set_key, icon_set_object] of Object.entries(this.iconsSceneManager.iconSets)) {
			// Skip outdoor elements
			if (!this.cjHelper.isBuildingSomething(icon_set_key)) { continue }

			// Remove if key corresponds to something in the current building
			const building_object_key = this.cjHelper.findParentBuildingObjectKey(icon_set_key);
			if (building_object_key == this.active_building_object_key) {
				this.iconsSceneManager.removeIconSet(icon_set_key);
			}
		}

		for (const layer_code of this.active_layers) {
			if (layer_code in this.building_BuildingUnitContainers[this.active_building_object_key] && this._is_geometry_layer(layer_code)) {
				this._toggle_single_interior_geometry_layer(layer_code, false);
			}
		}

		if (clear_active_values) {

			this._add_single_building_iconset(this.active_building_object_key);

			this.active_building_object_key = null;
			this.active_storey_code = null;

		}

	}

	/**
	 * @param {string} layer_code: The layer code of the layer that needs to be added. 
	 */
	_add_layer(layer_code) {
		if (this._is_geometry_layer(layer_code)) {
			this._add_geometry_layer(layer_code);
		}

		if (this._is_icon_layer(layer_code)) {
			this._add_icon_layer(layer_code);
		}
	}

	/**
	 * @param {string} layer_code: The layer code of the icon layer that needs to be added.
	 * 
	 * This function adds ALL instances of a layer: building, interior, outdoor.
	 * 
	 * 1. Iterate over the extracted layer_code: unit_key dictionary, skip if the building key is currently active.
	 * 2. If the given layer_code is in the building, add its icon.
	 * 3. For the current building key, iterate over the units of the layer code type, and add icons if they match the current storey.	 * 
	 */
	_add_icon_layer(layer_code) {

		/**
		 * This section handles adding icons to buildings that aren't currently active.
		 */

		for (const [building_key, layer_code_unit_key_dict] of Object.entries(this.building_BuildingUnitContainers)) {

			if (building_key == this.active_building_object_key) {
				continue;
			}

			if (!(layer_code in layer_code_unit_key_dict)) {
				continue;
			}

			if (building_key in this.iconsSceneManager.iconSets) {
				const icon_path = [this._get_icon_path(layer_code)];
				const icon_color = [this._get_icon_color(layer_code)];
				this._add_icon_svg(building_key, layer_code, icon_path, icon_color);
			} else {
				this._add_single_building_iconset(building_key);
			}
		}

		/**
		 * This section handles adding icons to outdoor objects.
		 */

		if (layer_code in this.campus_OutdoorUnitContainers) {

			const unit_container_key = this.campus_OutdoorUnitContainers[layer_code];

			this._add_single_outdoor_iconset(layer_code);
		}

		/**
		 * This section handles adding icons to the building that is currently active, if there is one.
		 * 
		 * Currently this does not check if the room that the unit is connected to already has an
		 * icon from a different unit. These cases are complex but rare, so are unlikely to show up often.
		 * 
		 * To properly deal with these situation would require checking if the room the unit is connected to
		 * has other units, then also checking if they are active and if they have the same icon position.
		 * 
		 * Icons can also not be consolidated, as clicking an icon opens the infopane on a specific unit,
		 * which would cause one of the units to never get selected.
		 * 
		 */

		if (this.active_building_object_key == null) {
			return;
		}

		if (!(layer_code in this.building_BuildingUnitContainers[this.active_building_object_key])) {
			return;
		}

		this._add_single_interior_icon_layer(layer_code);
	}

	/**
	 * @param {string} layer_code: The layer code of the geometry layer that needs to be added.
	 */
	_add_geometry_layer(layer_code) {

		if (layer_code in this.campus_OutdoorUnitContainers) {
			this._add_single_outdoor_geometry_layer(layer_code);
		}

		if (this.active_building_object_key == null) {
			return;
		}

		if (!(layer_code in this.building_BuildingUnitContainers[this.active_building_object_key])) {
			return;
		}

		this._toggle_single_interior_geometry_layer(layer_code, true);

	}

	/**
	 * @param {string} layer_code: The layer code of the layer that needs to be hidden.
	 * 
	 * This function removes ALL instances of a layer: building, interior, outdoor.
	 * 
	 */
	_remove_layer(layer_code) {
		if (this._is_geometry_layer(layer_code)) {
			this._remove_geometry_layer(layer_code);
		}

		if (this._is_icon_layer(layer_code)) {
			this._remove_icon_layer(layer_code);
		}
	}

	/**
	 * @param {string} layer_code: The layer code of the icon layer that needs to be hidden.
	 */
	_remove_icon_layer(layer_code) {
		for (const [icon_set_key, icon_set_object] of Object.entries(this.iconsSceneManager.iconSets)) {
			if (layer_code in icon_set_object.svgIcons) {
				if (Object.keys(icon_set_object.svgIcons).length > 1 || icon_set_object.hasText()) {
					icon_set_object.removeSvgIcon(layer_code);
				} else {
					this.iconsSceneManager.removeIconSet(icon_set_key)
				}
			}
		}
	}

	/**
	 * @param {string} layer_code: The layer code of the geometry layer that needs to be hidden.
	 */
	_remove_geometry_layer(layer_code) {

		if (layer_code in this.campus_OutdoorUnitContainers) {
			this._toggle_single_outdoor_geometry_layer(layer_code, false);
		}

		if (this.active_building_object_key == null) {
			return;
		}

		if (!(layer_code in this.building_BuildingUnitContainers[this.active_building_object_key])) {
			return;
		}

		this._toggle_single_interior_geometry_layer(layer_code, false);

	}

	/**
	 * @param {string} layer_code: The layer code of the icon for which a path is needed.
	 * @return {string}: The path to the icon of the layer code.
	 */
	_get_icon_path(layer_code) {
		return `../assets/threejs/graphics/icons/thematic-layers/${this.layer_definition[layer_code]["Icon name"]}`
	}

	/**
	 * @param {string} layer_code: The layer code of the icon for which a color is needed.
	 * @return {string}: The hexcode for the color associated with the layer code.
	 */
	_get_icon_color(layer_code) {

		// ENABLE THIS ONCE COLOR IS ADDED TO THEMATIC-CODELIST-DEFINITION

		// return this.layer_definition[layer_code]["Icon color"];

		return "#f7c286ff";
	}

	/**
	 * @param {string} icon_set_key: name of the icon set object the icon needs to be added too.
	 * @param {string} icon_key: key for the new icon, should just be the layer code.
	 * @param {string} icon_path: path to icon svg.
	 * @param {string} icon_color: background color that the icon needs to have.
	 * 
	 * Adds a new icon to an existing icon_set
	 */
	async _add_icon_svg(icon_set_key, icon_key, icon_path, icon_color) {

		const svg = await Promise.all(
			icon_path.map((p) => this.svgLoader.getSvg(p))
		);

		const icon = new SvgIcon(icon_key, svg[0], { bgColor: icon_color });

		this.iconsSceneManager.iconSets[icon_set_key].addSvgIcon(icon);

	}


	/**
	 * @param {string} icon_set_key: name of the icon set.
	 * @param {string} icon_set_text: text for the icon label, use null if no label is needed.
	 * @param {array} paths: paths to icon svgs.
	 * @param {array} icon_keys: names for the icon_svg elements
	 * @param {array} bg_colors: colors for the icon_svg elements
	 * @param {THREE.Vector3} position: threejs position for the icon
	 * 
	 * Adds a new icon set object to the iconSceneManager
	 */
	async _add_icon_set(icon_set_key, icon_set_text, paths, icon_keys, bg_colors, position) {

		const svgPromises = paths.map(p => this.svgLoader.getSvg(p));
		const settled = await Promise.allSettled(svgPromises);
		const svgs = settled.map(r => r.value);

		const icons = [];

		for (var i = 0; i < paths.length; i++) {
			const svg = svgs[i];
			// Skip if no correct SVG was found
			if (!svg) {
				console.error("A SVG icon is missing.")
			}

			const key = icon_keys[i];
			const bgColor = bg_colors[i];
			const icon = new SvgIcon(key, svg, { bgColor: bgColor });
			icons.push(icon);
		}

		var text_icon;

		if (icon_set_text == null || icon_set_text == "") {
			text_icon = null;
		} else {
			text_icon = new TextIcon(icon_set_text);
		}

		const onClick = this._generate_icon_onclick(icon_set_key);

		const icon_set = new IconSet(icon_set_key, icons, text_icon, position, onClick);

		this.iconsSceneManager.addIconSet(icon_set);
	}

	/**
	 * @param {object} position_object: The icon_position object found in unit attributes
	 * 
	 * The order of the values is changed because threejs considers the y-axis to be "up", instead
	 * of the z-axis. For some reason the new z-axis also needs to be flipped.
	 * 
	 * @return {THREE.Vector3}: A threejs vector3 with the coordinates from the icon position.
	 * 
	 */
	_convert_cityjson_position(position_object) {

		const position = new THREE.Vector3(
			position_object[0],
			position_object[2],
			-position_object[1]);

		return position;
	}


	/**
	 * @param {string} object_key: Cityjson key for the object that the onclick needs to reference.
	 * 
	 * @return {function}: The function that needs to be executed when the icon is clicked.
	 * 
	 */
	_generate_icon_onclick(object_key) {

		const onClick = (event) => {
			this.picker.pickMesh(object_key);
		};

		return onClick;
	}

	/**
	 * @param {string} layer_code: The layer code to add or remove from the active layers.
	 * 
	 * Updates the currently active layers.
	 * Layers that are not present in the active layers array are added, those that are present are removed.
	 * Automatically adds or removes the layer in question.
	 */
	_update_active_layers(layer_code) {

		/**
		 * If the layer IS NOT active: activate it
		 */
		if (!(this._is_layer_active(layer_code))) {

			this.active_layers.push(layer_code);
			this._add_layer(layer_code);

			for (const implied_layer_code of this.layer_definition[layer_code]["Implies"]) {

				if (!(this._is_layer_active(implied_layer_code))) {
					this._update_active_layers(implied_layer_code);
				}
			}

			/**
			 * If the layer IS active: deactivate it
			 */
		} else {
			this.active_layers.splice(this.active_layers.indexOf(layer_code), 1);
			this._remove_layer(layer_code);

			for (const implied_layer_code of this.layer_definition[layer_code]["Implies"]) {

				let found = false;

				for (const implied_by_layer_code of this.layer_definition[implied_layer_code]["Implied by"]) {
					if (this._is_layer_active(implied_by_layer_code)) {
						found = true;
						break;
					}
				}

				if (!found) {
					this._update_active_layers(implied_layer_code);
				}
			}
		}
	}

	_is_layer_active(layer_code) {
		if (this.active_layers.indexOf(layer_code) == -1) {
			return false;
		} else {
			return true;
		}
	}

	/**
	 * Each layer code that is returned is both currently active and is a geometry layer.
	 * 
	 * @returns An array of active geometry layer layer_codes.
	 */
	_active_geometry_layers() {

		let active_geometry_layers = [];

		this.active_layers.forEach((layer_code) => {

			if (this.layer_definition[layer_code]["Geometry"]) {
				active_geometry_layers.push(layer_code);
			}

		});

		return active_geometry_layers;
	}

	/**
	 * @param {string} layer_code: The layer code to check.
	 * 
	 * Returns true or false depending on if the layer is a geometry one or not.
	 * 
	 * @returns A boolean describing if the layer in question is a geometry one.
	 */
	_is_geometry_layer(layer_code) {
		return this.layer_definition[layer_code]["Geometry"];
	}

	_is_icon_layer(layer_code) {
		return !!this.layer_definition[layer_code]["Icon name"];
	}

	_populate_layer_buttons() {

		var layers_dropdown = document.getElementById("layers-dropdown");
		// clear current contents but keep dropdown container
		layers_dropdown.innerHTML = "";

		for (const [group_name, group_layers] of Object.entries(this.layer_hierarchy)) {

			// container for group
			let group_div = document.createElement("div");
			group_div.className = "layer-group";
			layers_dropdown.appendChild(group_div);

			// header row: title + small controls
			let header = document.createElement("div");
			header.className = "layer-group-header";
			group_div.appendChild(header);

			// create title container 
			let title = document.createElement("div");
			title.className = "layer-group-title";
			// create and append group checkbox inside the title
			const sanitizeId = (s) => s.replace(/[^\w\-]/g, "_");
			let groupCheckbox = document.createElement("input");
			groupCheckbox.type = "checkbox";
			groupCheckbox.className = "layer-group-checkbox";
			groupCheckbox.id = `group_chk_${sanitizeId(group_name)}`;
			title.appendChild(groupCheckbox);

			// text node for the group name
			let titleText = document.createElement("span");
			titleText.textContent = group_name;
			title.appendChild(titleText);

			header.appendChild(title);

			// controls 
			let controls = document.createElement("div");
			controls.className = "layer-group-controls";
			header.appendChild(controls);

			// caret / toggle button
			let toggleBtn = document.createElement("button");
			toggleBtn.className = "layer-group-toggle";
			toggleBtn.type = "button";
			const downIcon = new URL("../assets/threejs/graphics/icons/ui-buttons/carret-down.svg", import.meta.url).href;
			const upIcon = new URL("../assets/threejs/graphics/icons/ui-buttons/carret-up.svg", import.meta.url).href;
			const toggleImg = document.createElement("img");
			toggleImg.className = "layer-group-toggle-icon";
			toggleImg.src = downIcon;
			toggleImg.alt = "expand/collapse";
			toggleBtn.appendChild(toggleImg);
			controls.appendChild(toggleBtn);

			// items container (collapsible)
			let itemsContainer = document.createElement("div");
			itemsContainer.className = "layer-group-items";
			group_div.appendChild(itemsContainer);

			// convenience array of codes for this group
			const codes = Object.values(group_layers);

			// helper to sync group checkbox state (checked / indeterminate)
			const updateGroupCheckbox = () => {
				const activeCount = codes.filter(c => this.active_layers.includes(c)).length;
				groupCheckbox.checked = activeCount === codes.length && codes.length > 0;
				groupCheckbox.indeterminate = activeCount > 0 && activeCount < codes.length;
			};

			// add each layer / facility as a checklist row
			for (const [layer_name, layer_code] of Object.entries(group_layers)) {

				if (typeof layer_code === 'string' || layer_code instanceof String) {

					this._add_single_layer_entry(layer_name, layer_code, itemsContainer, updateGroupCheckbox);

				} else {

					for (const [sub_layer_name, sub_layer_code] of Object.entries(layer_code)) {

						this._add_single_layer_entry(sub_layer_name, sub_layer_code, itemsContainer, updateGroupCheckbox);

					}
				}
			}

			// initialize group checkbox state
			updateGroupCheckbox();

			// Toggle open/close group when clicking header (but ignore clicks on controls area)
			const toggleGroup = () => {
				const isOpen = itemsContainer.style.display === "flex";
				itemsContainer.style.display = isOpen ? "none" : "flex";
				// swap image
				toggleImg.src = isOpen ? downIcon : upIcon;
			};

			header.addEventListener("click", (ev) => {
				if (controls.contains(ev.target)) return;
				// toggleGroup();
			});

			toggleBtn.addEventListener("click", (ev) => {
				ev.stopPropagation();
				toggleGroup();
			});

			// group checkbox behavior: check/uncheck all members
			groupCheckbox.addEventListener("change", (ev) => {
				ev.stopPropagation();
				const shouldActivate = ev.target.checked;
				codes.forEach(c => {
					const alreadyActive = this.active_layers.includes(c);
					if (shouldActivate && !alreadyActive) {
						this._update_active_layers(c);
					} else if (!shouldActivate && alreadyActive) {
						this._update_active_layers(c);
					}
				});
				// refresh child checkboxes to match active_layers
				itemsContainer.querySelectorAll("input[type=checkbox]").forEach(ch => {
					ch.checked = this.active_layers.includes(ch.value);
				});
				// no indeterminate after explicit user action
				groupCheckbox.indeterminate = false;
				updateGroupCheckbox();
			});
		}
	}

	_make_icon_img(path) {
		const img = document.createElement("img");
		img.className = "icon";
		if (path) {
			img.src = path;
		} else {
			img.src = "";
		}
		return img;
	}

	_add_single_layer_entry(layer_name, layer_code, itemsContainer_object, updateGroupCheckbox) {

		let itemRow = document.createElement("label");
		itemRow.className = "layer-item";
		itemRow.setAttribute("data-code", layer_code);

		// checkbox
		let checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.value = layer_code;
		checkbox.id = `layer_chk_${layer_code}`;
		checkbox.checked = this.active_layers.includes(layer_code);

		// text 
		let spanText = document.createElement("span");
		spanText.textContent = layer_name;
		spanText.style.flex = "1";

		// icon
		let iconImg = this._make_icon_img(
			(this.layer_definition[layer_code] && this._get_icon_path(layer_code)) || ""
		);


		// wire change event -> update active layers and group checkbox
		checkbox.addEventListener("change", (ev) => {
			ev.stopPropagation();
			this._update_active_layers(layer_code);
			// make sure UI matches resulting active_layers
			ev.target.checked = this.active_layers.includes(layer_code);
			updateGroupCheckbox();
		});

		// clicking the label toggles checkbox 
		itemRow.appendChild(checkbox);
		itemRow.appendChild(spanText);
		itemRow.appendChild(iconImg);

		itemsContainer_object.appendChild(itemRow);

	}

}