import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import * as THREE from 'three';

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class BuildingView {

	constructor(map) {

        this.active = false;

		this.map = map;

		this.building_key;

		this.building_json;

        this.building_threejs;

		this.storeys_json;

        this.current_storey;

    }

    set_target(key) {

    	this.building_key = key.split("-").slice(0, 3).join("-");

        // Alternatively
        // this.building_key = this.map.scene.getObjectByName(key).parent.name;

    }

    initiate_buildingView() {

    	if (!this.building_key) {
    		console.log("no building selected");
    		return;
    	}

        if(this.active) {
            this.leave_buildingView();
            return;
        }

        this.active = true;


        this.map.cameraManager.switch_to_orthographic();


    	this.building_json = cityjson.CityObjects[this.building_key];

    	this.storeys_json = this._isolate_storey_json();

        this.building_threejs = this.map.scene.getObjectByName(this.building_key);

        this._unhide_objects_recursive(this.building_threejs);

        this._hide_mesh_children(this.building_threejs);


        const storey_00_room_threejs = this._retrieve_room_threejs_objects("00");
        this._unhide_objects(storey_00_room_threejs);

        console.log(storey_00_room_threejs);

        this._apply_outlines(storey_00_room_threejs, "lod_0", "default");

        this._populate_storey_buttons();

    }

    leave_buildingView() {

        this._hide_mesh_children(this.building_threejs);

        this._unhide_objects([this.map.scene.getObjectByName(this.building_key.concat("-lod_2"))]);

        this.building_key = undefined;

        this.active = false;

    }

    _apply_outlines(threejs_objects, lod, style) {

        let keys = [];

        threejs_objects.forEach((current_object) => {
            keys.push(current_object.name.split("-").slice(0, 3).join("-"));
        });

        this.map.setOutline(keys, lod, style);

    }

    _switch_to_storey(storey_code) {

        this._hide_mesh_children(this.building_threejs);

        const new_storey_threejs = this._retrieve_room_threejs_objects(storey_code);

        this._unhide_objects(new_storey_threejs);

        this._apply_outlines(new_storey_threejs, "lod_0", "default");

    }

    _isolate_storey_json() {

    	const building_children = this.building_json["children"];

    	const building_parts = building_children.filter((element) => {return element.includes("Part")});

    	let storey_json_keys = [];

    	building_parts.forEach((part_json_key) => {

    		const building_part_json = cityjson.CityObjects[part_json_key];

    		storey_json_keys = storey_json_keys.concat(building_part_json["children"]);

    	});

    	let sorted_storey_json_keys = {};

    	storey_json_keys.forEach((storey_key) => {

    		const storey_code = storey_key.split("_").pop();

    		if (storey_code in sorted_storey_json_keys) {
    			sorted_storey_json_keys[storey_code].push(storey_key);
    		} else {
    			sorted_storey_json_keys[storey_code] = [storey_key];
    		}

    	});

    	return sorted_storey_json_keys;

    }

    _retrieve_room_threejs_objects(storey_code) {

    	if (!(storey_code in this.storeys_json)) {
    		console.log("Invalid storey code, returning empty array");
    		return [];
    	}

    	let building_room_keys = [];

    	const building_part_storey_keys = this.storeys_json[storey_code];

    	building_part_storey_keys.forEach((part_storey_key) => {

    		building_room_keys = building_room_keys.concat(cityjson.CityObjects[part_storey_key]["children"]);

    	});

    	let room_threejs_objects = [];

    	building_room_keys.forEach((room_key) => {

    		// const space_id = cityjson.CityObjects[room_key]["attributes"]["space_id"];

    		const threejs_object_name = room_key.concat("-lod_0");

    		room_threejs_objects.push(this.map.scene.getObjectByName(threejs_object_name));

    	});

    	return room_threejs_objects;

    }

    _unhide_objects(threejs_objects) {
        threejs_objects.forEach((current_object) => {

            current_object.visible = true;

        });
    }

    _unhide_objects_recursive(threejs_object) {
        threejs_object.visible = true;

        threejs_object.children.forEach((current_child) => {

            this._unhide_objects_recursive(current_child);

        });
    }

    _hide_objects(threejs_objects) {
        threejs_objects.forEach((current_object) => {

            current_object.visible = false;

        });
    }

    _hide_objects_recursive(threejs_object) {
        threejs_object.visible = false;

        threejs_object.children.forEach((current_child) => {

            this._hide_objects_recursive(current_child);

        });
    }

    _acquire_building_object(threejs_object) {

        if (threejs_object.parent.name == "world") {
            return threejs_object;
        } else {
            return this._acquire_building_object(threejs_object.parent);
        }

    }

    _hide_mesh_children(threejs_object) {

        threejs_object.children.forEach((current_child) => {

            if (current_child.isMesh) {
                current_child.visible = false;

            } else {
                if (current_child.children) {
                    this._hide_mesh_children(current_child);
                }
            }

        });

    }

    _populate_storey_buttons() {

        var storey_dropdown = document.getElementById("bv-dropdown");

        const storey_codes = Object.keys(this.storeys_json);

        for (let i=0; i<storey_codes.length; i++) {

            var a = document.createElement("a");

            a.appendChild(document.createTextNode(storey_codes[i]));

            a.addEventListener("click", (event) => {

                this._switch_to_storey(storey_codes[i]);

            });

            a.href = "#";

            storey_dropdown.appendChild(a);

        }

    }

}