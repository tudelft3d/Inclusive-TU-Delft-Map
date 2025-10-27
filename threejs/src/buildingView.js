import { Map } from "./app";
import { ObjectPicker } from "./objectPicker"
import * as THREE from 'three';
import { CamerasControls } from "./camera";
import { Scene } from "three";
import { OutlineManager } from "./outlines";

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};

const NOT_INITIALISED = 0;
const INITIALISED = 1;
const ACTIVATED = 2;


export class BuildingView {

    /**
     * 
     * @param {CamerasControls} cameraManager 
     * @param {Scene} scene 
     * @param {[]} buildings 
     * @param {OutlineManager} outlineManager
     */
    constructor(cameraManager, scene, buildings, outlineManager, layerManager, picker) {
        this.active = false;

        this.cameraManager = cameraManager;
        this.scene = scene;
        // this.buildings = buildings;
        this.outlineManager = outlineManager;
        this.layerManager = layerManager;
        // this.picker = picker;

        // this.initially3D;
        // this.buildingKey;
        // this.buildingMeshKey;
        // this.targetObjectKey;
        // this.targetMeshKey;
        // this.buildingJson;
        // this.buildingThreejs;
        // this.storeysJson;
        // this.current_storey;

        this._status = NOT_INITIALISED;
    }

    _isNotInitialised() {
        return this._status == NOT_INITIALISED;
    }

    _isInitialisedNotActivated() {
        return this._status == INITIALISED;
    }

    _isActivated() {
        return this._status == ACTIVATED;
    }

    _updateStatus(newStatus) {
        this._status = newStatus;
    }

    /**
     * Transform a key (either geometry or CityJSON key) into the corresponding CityJSON key.
     * 
     * @param {string} key 
     * @returns 
     */
    _keyToObjectKey(key) {
        return key.split("-").slice(0, 3).join("-");
    }

    _keyToMeshKey(key) {
        const objectKey = key.split("-").slice(0, 3).join("-");
        const json = cityjson["CityObjects"][objectKey];
        if (json["type"] == "Building") {
            return objectKey + "-lod_2";
        } else {
            return objectKey + "-lod_0";
        }
    }

    _isObjectKey(key) {
        const keyInScene = !!this.scene.getObjectByName(key);
        const keyInJson = (key in cityjson.CityObjects);
        return keyInScene && keyInJson;
    }

    // /**
    //  * 
    //  * @param {string} targetMeshKey 
    //  */
    // setTargetOld(targetMeshKey) {
    //     console.log("setTarget")
    //     console.log("targetMeshKey", targetMeshKey)
    //     if (!targetMeshKey) {
    //         this.targetObjectKey = null;
    //         this.targetMeshKey = null;
    //         this._setBuilding(null);
    //     } else {
    //         if (this.targetMeshKey == targetMeshKey) { return }
    //         this.targetObjectKey = this._keyToObjectKey(targetMeshKey);
    //         this.targetMeshKey = targetMeshKey;
    //         const buildingObjectKey = this._findParentBuildingObjectKey(this.targetObjectKey);
    //         const buildingMeshKey = this._keyToMeshKey(buildingObjectKey);
    //         this._setBuilding(buildingMeshKey);
    //     }
    // }

    // /**
    //  * 
    //  * @param {string} buildingMeshKey 
    //  */
    // _setBuilding(buildingMeshKey) {
    //     console.log("setBuilding")
    //     console.log("buildingMeshKey", buildingMeshKey)
    //     if (!buildingMeshKey) {
    //         this.buildingKey = null;
    //         this.buildingMeshKey = null;
    //         this.buildingJson = null;
    //         this.buildingMesh = null;
    //         this.buildingObject = null;
    //         if (this.active) {
    //             this.leaveBuildingView();
    //         }
    //     } else {
    //         this.buildingKey = this._keyToObjectKey(buildingMeshKey);
    //         this.buildingMeshKey = buildingMeshKey;
    //         this.buildingJson = cityjson.CityObjects[this.buildingKey];
    //         this.buildingMesh = this.scene.getObjectByName(this.buildingMeshKey);
    //         this.buildingObject = this.scene.getObjectByName(this.buildingKey);
    //         if (!this.active) {
    //             this.initialiseBuildingView();
    //         }
    //         this.updateBuildingView();
    //     }
    // }

    initialise(buildingObjectKey, storeyCode = "00") {
        console.log("### initialise")
        this.setBuilding(buildingObjectKey);
        this.setStorey(storeyCode);
        this._updateStatus(INITIALISED);
    }

    // initialiseFromChild(childObjectKey, storeyCode = "00") {
    //     if (!this._isObjectKey(childObjectKey)) {
    //         console.error("The given key is not an object key: ", childObjectKey);
    //     }
    //     const buildingObjectKey = this._findParentBuildingObjectKey(childObjectKey);
    //     this.initialise(buildingObjectKey, storeyCode);
    // }

    // updateFromTarget(targetObjectKey) {
    //     if (!this._isObjectKey(targetObjectKey)) {
    //         console.error("The given key is not an object key: ", targetObjectKey);
    //     }

    //     const buildingObjectKey = this._findParentBuildingObjectKey(targetObjectKey);
    //     if (buildingObjectKey != this.buildingObjectKey) {
    //         this.setBuilding(buildingObjectKey);
    //     }

    //     const storeyCode = cityjson.CityObjects[targetObjectKey]["attributes"]["space_id"].split(".").pop();
    //     this.setStorey(storeyCode);
    //     this._updateView();
    // }

    setBuilding(buildingObjectKey) {
        console.log("### setBuilding")
        if (this._isActivated()) {
            console.error("Cannot update the building without deactivating.")
        }

        // Check if the key is indeed a building
        const buildingJson = cityjson.CityObjects[buildingObjectKey];
        if (buildingJson["type"] != "Building") {
            console.error("The input object has to be a Building.")
            return;
        }

        this.buildingObjectKey = buildingObjectKey;
        this.buildingMeshKey = this._keyToMeshKey(this.buildingObjectKey);
        this.buildingObject = this.scene.getObjectByName(this.buildingObjectKey);
    }

    setStorey(storeyCode) {
        console.log("### setStorey")
        this.storeyCode = storeyCode;
    }

    updateStorey(storeyCode) {
        console.log("### updateStorey")
        if (this.storeyCode == storeyCode) { return }
        this.storeyCode = storeyCode;
        this._updateView();
    }

    _updateView() {
        console.log("### _updateView")
        // Get the storeys
        const roomsObjectKeys = this._getRoomsObjectKeys();

        // Show only the selected storey
        this._hideMeshChildren(this.buildingObject, true);
        const roomsObjects = roomsObjectKeys.map((roomObjectKey) => {
            return this.scene.getObjectByName(roomObjectKey);
        })
        console.log(roomsObjects);
        roomsObjects.forEach((roomObject) => { this._unhideMeshChildren(roomObject, false) });
        console.log(this.buildingObject);

        // Set the icons properly
        this.layerManager.switch_to_building_view(this.buildingObjectKey, roomsObjectKeys);

        this._applyOutlines(roomsObjects, "lod_0", "default");
    }

    activate() {
        console.log("### activate")
        if (this._isActivated()) { return }
        if (this._isNotInitialised()) {
            console.error("Cannot activate the building view before initialising it.")
        }

        // Skip if the building has no children
        if (!cityjson.CityObjects[this.buildingObjectKey].children) {
            return;
        }

        this.initially3D = this.cameraManager.usesMapCamera() || this.cameraManager.usesOrbitCamera();

        // Hide the outer shell
        this._unhideMeshChildren(this.buildingObject, true);
        this._hideMeshChildren(this.buildingObject, false);

        // Populate the buttons to switch between storeys
        this._populateStoreyButtons();

        this._updateView();

        this._updateStatus(ACTIVATED);
    }

    deactivate() {
        console.log("### deactivate")
        if (this._isInitialisedNotActivated()) { return }

        // Show only the building shell
        this._hideMeshChildren(this.buildingObject, true);
        this._unhideMeshChildren(this.buildingObject, false);

        // console.log("this.initially3D", this.initially3D);
        // var onAnimationComplete;
        // if (this.initially3D) {
        //     onAnimationComplete = () => { this.cameraManager.switchToOrbit(); }
        // }
        // else {
        //     onAnimationComplete = () => { this.cameraManager.switchToOrthographic(); }
        // }
        // onAnimationComplete();
        // this.picker.pickMeshes([this.buildingThreejs], onAnimationComplete);

        // var storey_dropdown = document.getElementById("bv-dropdown");
        // storey_dropdown.innerHTML = "";

        // Set the icons properly
        this.layerManager.switch_to_campus_view();

        // Update the outlines
        const allBuildings = this._getAllBuildings();
        this._applyOutlines(allBuildings, 'lod_2', 'default');

        this._updateStatus(INITIALISED);
    }

    uninitialise() {
        console.log("### uninitialise")
        if (this._isNotInitialised()) { return }
        if (this._isActivated()) {
            console.error("Cannot uninitialise the building view before deactivating it.")
        }

        this.buildingObjectKey = null;
        this.buildingMeshKey = null;
        this.floor = null;
        this._updateStatus(NOT_INITIALISED);
    }

    // switchBuildingView(floor = "00", pass = true) {
    //     if (this.active) {
    //         this.leaveBuildingView();
    //     } else {
    //         this.initialiseBuildingView(floor, pass);
    //     }
    // }

    // initialiseBuildingView(floor = "00", pass = true) {
    //     console.log("############### initialiseBuildingView")
    //     console.log("this.buildingKey", this.buildingKey)
    //     console.log("this.active", this.active)

    //     this.initially3D = this.cameraManager.usesMapCamera() || this.cameraManager.usesOrbitCamera();

    //     if (!this.buildingKey) {
    //         console.error("No building selected.");
    //         return;
    //     }

    //     if (this.active) {
    //         console.error("Building view is already activated.")
    //         return;
    //     }

    //     // Skip if the building has no children
    //     if (!cityjson.CityObjects[this.buildingKey].children) {
    //         return;
    //     }

    //     const onAnimationComplete = () => {
    //         this.cameraManager.switchToOrthographic();
    //     }
    //     this.cameraManager.zoomToObject(this.buildingMesh, onAnimationComplete);

    //     // // Hide all other buildings except the current one
    //     // this._hideOtherBuildings();

    //     // Carry over highlights
    //     // if (pass) this.picker.unpick();

    //     this._recursivelyUnhideObject(this.buildingObject);
    //     this._hideObjects([this.buildingMesh]);
    //     this._recursivelyHideMeshChildren(this.buildingObject);

    //     // this.storeysJson = this._getStoreyObjectKeys();
    //     // const [storey_00_room_keys, storey_00_room_threejs] = this._retrieveRoomKeysAndObjects(floor);
    //     // console.log("storey_00_room_threejs", storey_00_room_threejs)
    //     // this._unhideObjects(storey_00_room_threejs);

    //     // console.log("this.buildingKey", this.buildingKey);
    //     // this.layerManager.switch_to_building_view(this.buildingKey, storey_00_room_keys);

    //     // this._applyOutlines(storey_00_room_threejs, "lod_0", "default");
    //     // this._populateStoreyButtons();

    //     this.active = true;
    // }

    // updateBuildingView(floor = "00") {
    //     this.storeysJson = this._getStoreyObjectKeys();
    //     const [storey_00_room_keys, storey_00_room_threejs] = this._retrieveRoomKeysAndObjects(floor);
    //     console.log("storey_00_room_threejs", storey_00_room_threejs)
    //     this._unhideObjects(storey_00_room_threejs);

    //     console.log("this.buildingKey", this.buildingKey);
    //     this.layerManager.switch_to_building_view(this.buildingKey, storey_00_room_keys);

    //     this._applyOutlines(storey_00_room_threejs, "lod_0", "default");
    //     this._populateStoreyButtons();
    // }

    // leaveBuildingView() {
    //     console.log("############### leaveBuildingView");
    //     console.log("this.active", this.active);

    //     if (!this.active) {
    //         console.error("Building view is not yet activated.")
    //         return;
    //     }

    //     // Hide everything
    //     console.log("this.buildingObject", this.buildingObject);
    //     this._recursivelyHideMeshChildren(this.buildingObject);

    //     // Unhide the building
    //     this._unhideObjects([this.buildingMesh]);

    //     console.log("this.initially3D", this.initially3D);
    //     var onAnimationComplete;
    //     if (this.initially3D) {
    //         onAnimationComplete = () => { this.cameraManager.switchToOrbit(); }
    //     }
    //     else {
    //         onAnimationComplete = () => { this.cameraManager.switchToOrthographic(); }
    //     }
    //     onAnimationComplete();
    //     // this.picker.pickMeshes([this.buildingThreejs], onAnimationComplete);

    //     // Update the layers
    //     var storey_dropdown = document.getElementById("bv-dropdown");
    //     storey_dropdown.innerHTML = "";
    //     this.layerManager.switch_to_campus_view();

    //     // Update the outlines
    //     const allBuildings = this._getAllBuildings();
    //     this._applyOutlines(allBuildings, 'lod_2', 'default');

    //     this.active = false;
    // }

    /**
     * Modify the outline to only show the given objects, with the given style.
     * 
     * @param {THREE.Object3D[]} threejsObjects 
     * @param {string} lod 
     * @param {string} style 
     */
    _applyOutlines(threejsObjects, lod, style) {
        // Get the keys corresponding to the objects
        let keys = [];
        threejsObjects.forEach((currentObject) => {
            keys.push(this._keyToMeshKey(currentObject.name));
        });
        // Modify the outline
        this.outlineManager.setOutline(keys, lod, style);
    }

    // /**
    //  * Hide the current storey and show the new storey instead.
    //  * 
    //  * @param {string} storeyCode 
    //  */
    // _switchToStorey(storeyCode) {
    //     // Hide everything in the building
    //     this._recursivelyHideMeshChildren(this.buildingObject);

    //     // Get the objects in the new storey
    //     const [newStoreyKeys, newStoreyObjects] = this._retrieveRoomKeysAndObjects(storeyCode);

    //     // Unhide the objects in the new storey
    //     this._unhideObjects(newStoreyObjects);

    //     // Outline them
    //     this._applyOutlines(newStoreyObjects, "lod_0", "default");

    //     // Enable the icons
    //     this.layerManager.enable_storey_icons(newStoreyKeys);
    // }

    /**
     * Extracts all the BuildingStorey inside a building and groups them per actual storey.
     * 
     * @returns A dictionary mapping each storey code to a list of the corresponding keys of BuildingStorey objects.
     */
    _getStoreyObjectKeys() {
        // Extract all building parts
        const buildingJson = cityjson.CityObjects[this.buildingObjectKey];
        const buildingParts = buildingJson["children"].filter((element) => {
            return cityjson.CityObjects[element]["type"] == "BuildingPart"
        });
        console.log("buildingParts", buildingParts)

        // Extract the storeys in each building part
        let storeyObjectKeys = [];
        buildingParts.forEach((partObjectKey) => {
            const buildingPartJson = cityjson.CityObjects[partObjectKey];
            storeyObjectKeys = storeyObjectKeys.concat(buildingPartJson["children"]);
        });
        console.log("storeyObjectKeys", storeyObjectKeys)

        // Group them per storey
        let sortedStoreyObjectKeys = {}
        storeyObjectKeys.forEach((storeyObjectKey) => {
            const storeyCode = cityjson.CityObjects[storeyObjectKey]["attributes"]["space_id"].split(".").pop();
            if (storeyCode in sortedStoreyObjectKeys) {
                sortedStoreyObjectKeys[storeyCode].push(storeyObjectKey);
            } else {
                sortedStoreyObjectKeys[storeyCode] = [storeyObjectKey];
            }
        });
        console.log("sortedStoreyObjectKeys", sortedStoreyObjectKeys)

        return sortedStoreyObjectKeys;
    }

    // /**
    //  * Retrieve all the rooms at a given storey.
    //  * 
    //  * @param {string} storeyCode 
    //  * @returns A list of keys and a list of three.js objects
    //  */
    // _retrieveRoomKeysAndObjects(storeyCode) {
    //     // Get the keys of the storeys
    //     const storeysObjectKeys = this._getStoreyObjectKeys();

    //     // Check if the storey code is valid
    //     if (!(storeyCode in storeysObjectKeys)) {
    //         console.error("Invalid storey code, returning empty array.");
    //         return [];
    //     }

    //     // Extract the keys of all the rooms in each BuildingStorey
    //     let buildingRoomKeys = [];
    //     storeysObjectKeys[storeyCode].forEach((partStoreyKey) => {
    //         buildingRoomKeys = buildingRoomKeys.concat(cityjson.CityObjects[partStoreyKey]["children"]);
    //     });


    //     // Extract the objects of all the rooms in each BuildingStorey
    //     let roomThreejsObjects = [];
    //     buildingRoomKeys.forEach((room_key) => {
    //         const threejsObjectName = room_key.concat("-lod_0");
    //         const roomObject = this.scene.getObjectByName(threejsObjectName);

    //         if (roomObject) {
    //             // // if the Z value of the layer (picked from the lowest point of the room) is negative
    //             // if (roomObject.geometry.boundingBox.min.z < 0) {
    //             //     // set the position to the absolute value
    //             //     roomObject.position.z = Math.abs(roomObject.geometry.boundingBox.min.z);
    //             // }
    //         } else {
    //             console.error(`Object '${threejsObjectName}' does not exist.`)
    //         }
    //         roomThreejsObjects.push(roomObject);
    //     });
    //     console.log("buildingRoomKeys.length", buildingRoomKeys.length);
    //     return [buildingRoomKeys, roomThreejsObjects];
    // }

    _getRoomsObjectKeys() {
        // Get the keys of the storeys
        const storeysObjectKeys = this._getStoreyObjectKeys();

        // Check if the storey code is valid
        if (!(this.storeyCode in storeysObjectKeys)) {
            console.error("Invalid storey code, returning empty array: ", this.storeyCode);
            return [];
        }

        // Extract the keys of all the rooms in each BuildingStorey
        let roomsObjectKeys = [];
        storeysObjectKeys[this.storeyCode].forEach((partStoreyKey) => {
            roomsObjectKeys = roomsObjectKeys.concat(cityjson.CityObjects[partStoreyKey]["children"]);
        });

        return roomsObjectKeys;
    }


    // /**
    //  * 
    //  * @param {THREE.Object3D[]} threejsObjects 
    //  */
    // _unhideObjects(threejsObjects) {
    //     threejsObjects.forEach((currentObject) => {
    //         currentObject.visible = true;
    //     });
    // }

    // /**
    //  * 
    //  * @param {THREE.Object3D} threejsObject 
    //  */
    // _recursivelyUnhideObject(threejsObject) {
    //     threejsObject.visible = true;
    //     threejsObject.children.forEach((current_child) => {
    //         this._recursivelyUnhideObject(current_child);
    //     });
    // }

    // _hide_objects(threejsObjects) {
    //     threejsObjects.forEach((currentObject) => {

    //         currentObject.visible = false;

    //     });
    // }

    // _hide_objects_recursive(threejsObject) {
    //     threejsObject.visible = false;

    //     threejsObject.children.forEach((current_child) => {

    //         this._hide_objects_recursive(current_child);

    //     });
    // }

    // _acquire_building_object(threejsObject) {
    //     if (threejsObject.parent.name == "world") {
    //         return threejsObject;
    //     } else {
    //         return this._acquire_building_object(threejsObject.parent);
    //     }
    // }

    // _hideObjects(threejsObjects) {
    //     console.log("_hideObject");
    //     console.log(threejsObjects);

    //     threejsObjects.forEach((currentObject) => {
    //         if (!currentObject.isMesh) {
    //             console.error("_hideObject expects a mesh as an input.");
    //             return;
    //         }
    //         currentObject.visible = false;
    //     })
    // }

    /**
     * Unhide all the Mesh children of the given three.js object.
     * Can be recursive if specified.
     * 
     * @param {THREE.Object3D} threejsObject 
     * @param {bool} recursive
     */
    _unhideMeshChildren(threejsObject, recursive) {
        threejsObject.children.forEach((currentChild) => {
            if (currentChild.isMesh) {
                currentChild.visible = true;
            } else if (recursive && currentChild.children) {
                currentChild.visible = true;
                this._unhideMeshChildren(currentChild, recursive);
            }
        });
    }

    /**
     * Hide all the Mesh children of the given three.js object.
     * Can be recursive if specified.
     * 
     * @param {THREE.Object3D} threejsObject 
     * @param {bool} recursive
     */
    _hideMeshChildren(threejsObject, recursive) {
        threejsObject.children.forEach((currentChild) => {
            if (currentChild.isMesh) {
                currentChild.visible = false;
            } else if (recursive && currentChild.children) {
                currentChild.visible = true;
                this._hideMeshChildren(currentChild, recursive);

            }
        });
    }

    // /**
    //  * Recursively hide all the Mesh children of the given three.js object.
    //  * 
    //  * @param {THREE.Object3D} threejsObject 
    //  */
    // _recursivelyHideMeshChildren(threejsObject) {
    //     threejsObject.children.forEach((currentChild) => {
    //         if (currentChild.isMesh) {
    //             currentChild.visible = false;
    //         } else {
    //             if (currentChild.children) {
    //                 this._recursivelyHideMeshChildren(currentChild);
    //             }
    //         }
    //     });
    // }

    _populateStoreyButtons() {

        const storey_dropdown = document.getElementById("bv-dropdown");
        storey_dropdown.innerHTML = "";

        const storeysObjectKeys = this._getStoreyObjectKeys();
        for (var storeyCode of Object.keys(storeysObjectKeys)) {

            var a = document.createElement("a");
            a.appendChild(document.createTextNode(storeyCode));
            a.addEventListener("click", (event) => {
                this.updateStorey(storeyCode);

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

    // _hideOtherBuildings() {
    //     // Find the world group that contains all buildings
    //     const worldGroup = this.scene.getObjectByName('world');

    //     if (!worldGroup) {
    //         console.log('World group not found');
    //         return;
    //     }

    //     console.log(`Found world group with ${worldGroup.children.length} buildings`);

    //     // Check each building in the world group
    //     worldGroup.children.forEach((building, index) => {

    //         // Hide all buildings except the current one
    //         if (building.name !== this.buildingKey) {
    //             building.visible = false;
    //             //console.log(`Hidden: ${building.name}`);
    //         } else {
    //             building.visible = true;
    //             // console.log(`Keeping visible: ${building.name}`);
    //         }
    //     });

    //     console.log(`✅ Hidden all buildings except: ${this.buildingKey}`);
    // }

    _getAllBuildings() {
        // Find the world group that contains all buildings
        const worldGroup = this.scene.getObjectByName('world');

        if (!worldGroup) {
            console.log('World group not found');
            return;
        }

        console.log(`Showing all ${worldGroup.children.length} buildings`);
        // this._applyOutlines(worldGroup.children, 'lod_2', 'default');

        // // Make all buildings visible again
        // worldGroup.children.forEach((building) => {
        //     building.visible = true;
        //     // console.log(`Shown: ${building.name}`);
        // });

        // console.log(`All buildings are now visible`);

        return worldGroup.children;
    }

}