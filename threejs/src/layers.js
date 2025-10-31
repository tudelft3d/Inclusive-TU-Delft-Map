import * as THREE from 'three';
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
import layers_json from "../assets/threejs/buildings/thematic_codelist.json" assert {type: "json"};
import layers_definition_json from "../assets/threejs/buildings/thematic_codelist-definition.json" assert {type: "json"};
import layers_hierarchy_json from "../assets/threejs/buildings/thematic_codelist-hierarchy.json" assert {type: "json"};
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

	constructor(scene, iconsSceneManager, svgLoader, cameraManager) {

		this.scene = scene;
		this.iconsSceneManager = iconsSceneManager;
		this.svgLoader = svgLoader;
		this.cameraManager = cameraManager;

		this.layer_definition = {};

		for (const [key, value] of Object.entries(layers_definition_json)) {

			if (value["Include"] && value["Shown with icon"]) {
				this.layer_definition[key] = value;
			}

		}

		this.layer_hierarchy = layers_hierarchy_json;

		// Maybe have these taken from codelist?
		// Or otherwise pass as argument
		this.active_layers = [];

		this._populate_layer_buttons();

		this.campus_buildings_json = this._isolate_building_json();

		this.campus_buildings_codes = this._isolate_building_room_codes();

		this.campus_outdoor_codes = this._isolate_oudoor_units_codes();

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

	_isolate_oudoor_units_codes() {
		const campus_unit_codes = {};
		const outdoor_code_containers = cityjson.CityObjects["Outdoor-CityObjectGroup-OutdoorObject"]["children"];
		for (const [_, code_container_key] of Object.entries(outdoor_code_containers)) {

			const code_container = cityjson.CityObjects[code_container_key];
			const code = code_container["attributes"]["code"];

			if (!code_container["children"]) {
				console.error("A code container does not have children!")
			}

			for (const unit_key of code_container["children"]) {
				campus_unit_codes[unit_key] = new Set([code]);
			}

		}

		return campus_unit_codes;
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

			if (!building_json.attributes["space_id"]) {
				continue
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
		if (!this.current_building_key) {
			this.current_storey_room_keys = undefined;
			this.building_view_active = false;
			return;
		}

		const current_building_json = cityjson.CityObjects[this.current_building_key];

		const active_layers_set = new Set(this.active_layers);

		console.log("this.campus_buildings_codes", this.campus_buildings_codes);
		console.log("this.current_building_key", this.current_building_key);
		const needed_layers = Array.from(this.campus_buildings_codes[this.current_building_key].intersection(active_layers_set));

		const paths = needed_layers.map((element) => { return this._get_icon_path(element) });
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

				paths.push(this._get_icon_path(code));
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

	_get_icon_path(code) {
		return `../assets/threejs/graphics/icons/thematic-layers/${this.layer_definition[code]["Icon name"]}`
	}

	// Used when removing a thematic layer
	_remove_icon(code) {

		for (const [icon_set_key, icon_set_object] of Object.entries(this.iconsSceneManager.iconSets)) {

			if (code in icon_set_object.svgIcons) {

				if (Object.keys(icon_set_object.svgIcons).length > 1 || icon_set_object.hasText()) {

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
		this._add_icon_outdoors(code);

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

					const path = [this._get_icon_path(code)];
					const color = ["#f7c286ff"];

					this._add_icon_svg(building_key, code, path, color);

				} else {

					console.log(building_json.attributes["space_id"]);
					if (!building_json.attributes["space_id"]) {
						continue
					}

					const position = this._convert_cityjson_position(building_json.attributes.icon_position);

					this._add_icon_set(
						building_key,
						null,
						[this._get_icon_path(code)],
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

					const path = [this._get_icon_path(code)];
					const color = ["#f7c286ff"];

					this._add_icon_svg(current_key, code, path, color);

				} else {

					const position = this._convert_cityjson_position(current_room_json.attributes.icon_position);

					this._add_icon_set(
						current_key,
						null,
						[this._get_icon_path(code)],
						[code],
						["#f7c286ff"],
						position);

				}

			}

		});

	}

	_add_icon_outdoors(code) {
		for (const [key, codes] of Object.entries(this.campus_outdoor_codes)) {

			if (codes.has(code)) {

				if (this.iconsSceneManager.iconSets[key]) {

					const path = [this._get_icon_path(code)];
					const color = ["#f7c286ff"];

					this._add_icon_svg(key, code, path, color);

				} else {
					const icon_position = cityjson.CityObjects[key]["attributes"]["icon_position"];
					const position = this._convert_cityjson_position(icon_position);

					this._add_icon_set(
						key,
						null,
						[this._get_icon_path(code)],
						[code],
						["#f7c286ff"],
						position);

				}

			}
		}
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

	_generate_icon_onclick(cj_key) {

		const object_json = cityjson.CityObjects[cj_key];

		let object_threejs_name;
		let icon_position_vector;

		if (object_json.type == "Building") {

			object_threejs_name = cj_key + "-lod_2";
			icon_position_vector = null;

		} else if (object_json.type == "BuildingRoom") {

			object_threejs_name = cj_key + "-lod_0";

		} else if (object_json.type == "GenericCityObject") {

			object_threejs_name = null;

		} else {

			console.error("UNRECOGNIZED OBJECT type:", cj_key);

		}

		const icon_position = object_json["attributes"]["icon_position"];
		icon_position_vector = this._convert_cityjson_position(icon_position);


		const onClick = (e) => {
			// if (!object_threejs_name || !this.scene.getObjectByName(object_threejs_name)) {
			// 	if (!icon_position_vector) {
			// 		console.error("Either the object or the position of the icon must be given.")
			// 	}
			// 	this.picker.pickIcon(cj_key, icon_position_vector, 50);
			// }
			// else {
			// 	this.picker.pickMesh(cj_key);
			// }
			console.log(cj_key);
			this.picker.pickMesh(cj_key);
		};

		return onClick;

	}

	async _add_icon_set(icon_set_key, icon_set_text, paths, icon_keys, bg_colors, position) {
		// Load SVGs by handling errors
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

		if (!icon_set_text || icon_set_text == "") {
			text_icon = null;
		} else {
			// Get the object from the CityJSON
			const cityObject = cityjson.CityObjects[icon_set_key];

			// Only add building name if of type "Building", and its' "ShortName (EN)" is not empty. Otherwise only show number
			let fullText = icon_set_text;
			if (cityObject?.type === "Building" && cityObject?.attributes?.["ShortName (EN)"]) {
				fullText = `${icon_set_text} | ${cityObject.attributes["ShortName (EN)"]}`;
			}

			text_icon = new TextIcon(fullText);
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

	//ALENA-start
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

					this._add_single_layer(layer_name, layer_code, itemsContainer, updateGroupCheckbox);

				} else {

					for (const [sub_layer_name, sub_layer_code] of Object.entries(layer_code)) {

						this._add_single_layer(sub_layer_name, sub_layer_code, itemsContainer, updateGroupCheckbox);

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

	_add_single_layer(layer_name, layer_code, itemsContainer_object, updateGroupCheckbox) {

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

	//ALENA-end

	_alter_thematic_codelist_json() {

		let json_data = {};

		this.layer_definition.forEach((element) => {
			json_data[element["Code [str]"]] = element;
		})

		console.log(JSON.stringify(json_data));
	}

}


// Toggle layers dropdown as a mobile bottom sheet - Alena
(function () {
	const layersBtn = document.getElementById('layers-btn');
	const layersDropdown = document.getElementById('layers-dropdown');
	let overlay = document.getElementById('layers-overlay');

	// create overlay if missing
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'layers-overlay';
		document.body.appendChild(overlay);
	}

	// initial styles for overlay so it doesn't intercept taps until it's enabled
	overlay.style.pointerEvents = 'none';
	overlay.style.position = overlay.style.position || 'fixed';
	overlay.style.inset = overlay.style.inset || '0';
	// z-index: a default here if missing
	if (!overlay.style.zIndex) overlay.style.zIndex = '999';

	let mobileOpen = false;

	function openMobileLayers() {
		// set state first
		mobileOpen = true;

		// enable overlay pointer events *after* state is set so it doesn't catch the same tap
		overlay.classList.add('visible');
		overlay.style.pointerEvents = 'auto';

		layersDropdown.classList.add('mobile-open');
		document.body.classList.add('layers-active-mobile');
		// prevent background scrolling while open
		document.body.style.overflow = 'hidden';

		// mark attributes for accessibility 
		layersBtn?.setAttribute('aria-expanded', 'true');
		layersDropdown?.setAttribute('aria-hidden', 'false');
	}

	function closeMobileLayers() {
		// set state early so handlers see the correct state
		mobileOpen = false;

		layersDropdown.classList.remove('mobile-open');
		overlay.classList.remove('visible');

		// disable pointer events so overlay cannot intercept accidental taps
		overlay.style.pointerEvents = 'none';

		document.body.classList.remove('layers-active-mobile');
		document.body.style.overflow = '';

		layersBtn?.setAttribute('aria-expanded', 'false');
		layersDropdown?.setAttribute('aria-hidden', 'true');
	}

	function toggleMobileLayers() {
		if (mobileOpen) closeMobileLayers();
		else openMobileLayers();
	}

	// check for small screens
	function isSmallScreen() {
		return window.matchMedia('(max-width: 620px)').matches;
	}

	// handle clicks and touch starts on the button 
	function onButtonActivate(e) {
		if (!isSmallScreen()) return; // only use mobile behavior on small screens
		e.stopPropagation();
		e.preventDefault();

		// toggle using the explicit boolean state
		toggleMobileLayers();
	}

	// listen for both click and touchstart to avoid mobile tap delays / race conditions
	layersBtn?.addEventListener('click', onButtonActivate, { passive: false });
	layersBtn?.addEventListener('touchstart', onButtonActivate, { passive: false });

	// overlay should only close when the overlay background itself is clicked/touched
	function onOverlayActivate(e) {
		// only handle direct clicks/touches on the overlay background 
		if (e.currentTarget !== e.target) return;
		// close panel
		closeMobileLayers();
	}

	overlay.addEventListener('click', onOverlayActivate);
	overlay.addEventListener('touchstart', onOverlayActivate, { passive: true });

	// close when pressing Escape
	document.addEventListener('keydown', (ev) => {
		if (ev.key === 'Escape') {
			closeMobileLayers();
		}
	});

	// Prevent clicks/touches inside dropdown from bubbling out and triggering overlay/document handlers
	layersDropdown?.addEventListener('click', (ev) => {
		ev.stopPropagation();
	});
	layersDropdown?.addEventListener('touchstart', (ev) => {
		ev.stopPropagation();
	}, { passive: true });

	mobileOpen = layersDropdown?.classList.contains('mobile-open') || false;
	// ensure overlay pointer-events matches the initial state
	overlay.style.pointerEvents = mobileOpen ? 'auto' : 'none';
})();