import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import * as THREE from 'three';
import { CamerasControls } from "./camera";
import { Scene } from "three";
import { OutlineManager } from "./outlines";

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

export class BuildingView {

    /**
     * 
     * @param {CamerasControls} cameraManager 
     * @param {Scene} scene 
     * @param {[]} buildings 
     * @param {OutlineManager} outlineManager
     */
    constructor(cameraManager, scene, buildings, outlineManager) {
        this.active = false;

        this.cameraManager = cameraManager;
        this.scene = scene;
        this.buildings = buildings;
        this.outlineManager = outlineManager;

        this.selectedKey;
        this.building_key;
        this.building_json;
        this.building_threejs;
        this.storeys_json;
        this.current_storey;
    }

    set_target(key) {

        if (this.active || !key) {
            return;
        }

        this.selectedKey = key;
        this.building_key = key.split("-").slice(0, 3).join("-");

        // Alternatively
        // this.building_key = this.scene.getObjectByName(key).parent.name;

    }

    initiate_buildingView() {

        if (!this.building_key) {
            console.log("no building selected");
            return;
        }

        if (this.active) {
            this.leave_buildingView();
            return;
        }

        if (!cityjson.CityObjects[this.building_key].children) {
            return;
        }

        this.active = true;


        this.cameraManager.switchToOrthographic();

        // Hide all other buildings except the current one
        this._hideOtherBuildings();

        this.building_json = cityjson.CityObjects[this.building_key];

        this.storeys_json = this._isolate_storey_json();

        this.building_threejs = this.scene.getObjectByName(this.building_key);

        // REMINDER FOR MJ: UN-HIGHLIGHT THIS BUILDING

        this._unhide_objects_recursive(this.building_threejs);

        this._hide_mesh_children(this.building_threejs);


        const storey_00_room_threejs = this._retrieve_room_threejs_objects("00");
        this._unhide_objects(storey_00_room_threejs);

        this._apply_outlines(storey_00_room_threejs, "lod_0", "default");

        this._populate_storey_buttons();

    }

    leave_buildingView() {

        if (!this.active) {
            return;
        }

        this._hide_mesh_children(this.building_threejs);

        const selectedBuilding = this.scene.getObjectByName(this.selectedKey);
        this._unhide_objects([selectedBuilding]);

        this.outlineManager.setOutline(this.buildings);

        // Show all other buildings again
        this._showOtherBuildings();

        // I disabled this because I expect when I exit orthographic view, 
        // the building remains selected (target)
        // this.building_key = undefined; 

        this.active = false;

        this.cameraManager.switchToOrbit();
        this.picker.pickMesh(selectedBuilding);

        var storey_dropdown = document.getElementById("bv-dropdown");

        storey_dropdown.innerHTML = "";

    }

    _apply_outlines(threejs_objects, lod, style) {

        let keys = [];

        threejs_objects.forEach((current_object) => {
            keys.push(current_object.name.split("-").slice(0, 3).join("-"));
        });

        this.outlineManager.setOutline(keys, lod, style);

    }

    _switch_to_storey(storey_code) {

        this._hide_mesh_children(this.building_threejs);

        const new_storey_threejs = this._retrieve_room_threejs_objects(storey_code);

        this._unhide_objects(new_storey_threejs);

        this._apply_outlines(new_storey_threejs, "lod_0", "default");

    }

    _isolate_storey_json() {

        const building_children = this.building_json["children"];

        const building_parts = building_children.filter((element) => { return element.includes("Part") });

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

            const roomObject = this.scene.getObjectByName(threejs_object_name);

            if (roomObject) {

                // if the Z value of the layer (picked from the lowest point of the room) is negative
                if (roomObject.geometry.boundingBox.min.z < 0) {
                    // set the position to the absolute value
                    roomObject.position.z = Math.abs(roomObject.geometry.boundingBox.min.z);
                }

            }

            room_threejs_objects.push(roomObject);

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

        storey_dropdown.innerHTML = "";

        const storey_codes = Object.keys(this.storeys_json);

        for (let i = 0; i < storey_codes.length; i++) {

            var a = document.createElement("a");

            a.appendChild(document.createTextNode(storey_codes[i]));

            a.addEventListener("click", (event) => {

                this._switch_to_storey(storey_codes[i]);

                // Close the dropdown after selecting a storey
                const bvDropdown = document.getElementById("bv-dropdown");
                if (bvDropdown) {
                    bvDropdown.style.display = 'none';
                }

            });

            a.href = "#";

            storey_dropdown.appendChild(a);

        }

    }

    _hideOtherBuildings() {
        // Find the world group that contains all buildings
        const worldGroup = this.scene.getObjectByName('world');

        if (!worldGroup) {
            console.log('World group not found');
            return;
        }

        console.log(`Found world group with ${worldGroup.children.length} buildings`);

        // Check each building in the world group
        worldGroup.children.forEach((building, index) => {

            // Hide all buildings except the current one
            if (building.name !== this.building_key) {
                building.visible = false;
                //console.log(`Hidden: ${building.name}`);
            } else {
                building.visible = true;
                // console.log(`Keeping visible: ${building.name}`);
            }
        });

        console.log(`✅ Hidden all buildings except: ${this.building_key}`);
    }

    _showOtherBuildings() {
        // Find the world group that contains all buildings
        const worldGroup = this.scene.getObjectByName('world');

        if (!worldGroup) {
            console.log('World group not found');
            return;
        }

        console.log(`Showing all ${worldGroup.children.length} buildings`);

        // Make all buildings visible again
        worldGroup.children.forEach((building) => {
            building.visible = true;
            // console.log(`Shown: ${building.name}`);
        });

        console.log(`All buildings are now visible`);
    }

}