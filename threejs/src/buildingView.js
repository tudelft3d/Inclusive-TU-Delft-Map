import * as THREE from "three";
import { CamerasControls } from "./camera";
import { Scene } from "three";
import { OutlineManager } from "./outlines";
import { CjHelper } from "./cjHelper";
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };
import { LayerManager } from "./layers";
import { StoreyManager } from "./storeyManager"

const NOT_INITIALISED = 0;
const INITIALISED = 1;
const ACTIVATED = 2;


/**
 * This function handles all operations related to "building view".
 * With "building view" is meant the state that the map enters when viewing the floor plan of a building.
 * In this state the camera is locked to orthographic mode, the exterior of the building being view disappears,
 * and the interior of this building becomes visible.
 * 
 * Building view can be one of three states:
 * 1. Not initialized: when no building is selected and the map is not in building view.
 * 2. Initialized: when a building is selected, but building has not be activated yet.
 * 3. Activated: when building view has been activated.
 * 
 */
export class BuildingView {
    /**
     *
     * @param {CamerasControls} cameraManager
     * @param {Scene} scene
     * @param {OutlineManager} outlineManager
     * @param {LayerManager} layerManager
     */
    constructor(cameraManager, scene, outlineManager, layerManager) {
        this.active = false;

        this.cameraManager = cameraManager;
        this.scene = scene;
        this.outlineManager = outlineManager;
        this.layerManager = layerManager;
        this.cjHelper = new CjHelper(this.scene);

        this.storeyManager = new StoreyManager(this, this.cjHelper);

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

    initialise(buildingObjectKey, storeyCode = "00") {
        this.setBuilding(buildingObjectKey);
        this.setStorey(storeyCode);
        this._updateStatus(INITIALISED);
    }

    /**
     * @param {string} buildingObjectKey: The cityjson key of the building object that building view 
     * should be activated for.
     * 
     * Set the current building.
     */
    setBuilding(buildingObjectKey) {
        if (this._isActivated()) {
            console.error("Cannot update the building without deactivating.");
        }

        // Check if the key is indeed a building
        const buildingJson = cityjson.CityObjects[buildingObjectKey];
        if (buildingJson["type"] != "Building") {
            console.error("The input object has to be a Building.");
            return;
        }

        this.buildingObjectKey = buildingObjectKey;
        this.buildingMeshKey = this.cjHelper.keyToMeshKey(
            this.buildingObjectKey
        );
        this.buildingObject = this.scene.getObjectByName(
            this.buildingObjectKey
        );
    }

    /**
     * @param {string} storeyCode: The code of the new storey that needs to be switched to.
     * 
     * Sets the new storey, and calls the necessary update functions.
     */
    setStorey(storeyCode) {
        if (this.storeyCode == storeyCode) {
            return;
        }
        this.storeyCode = storeyCode;
        if (this._isActivated()) {
            this._updateView();
            this.storeyManager.setStorey(this.storeyCode);
        }
    }

    /**
     * Enables the viewing of the current storey.
     */
    _updateView() {
        // Get the storeys
        const roomsObjectKeys = this._getRoomsObjectKeys();

        // Show only the selected storey
        this._hideMeshChildren(this.buildingObject, true);
        const roomsObjects = roomsObjectKeys.map((roomObjectKey) => {
            return this.scene.getObjectByName(roomObjectKey);
        });
        roomsObjects.forEach((roomObject) => {
            this._unhideMeshChildren(roomObject, false);
        });

        this.layerManager.add_interior_building_layers(this.buildingObjectKey, this.storeyCode);

        this._applyOutlines(roomsObjects, "lod_0", "interior");
    }

    /**
     * Makes all changes necessary when enabling building view.
     */
    activate() {
        if (this._isActivated()) {
            return;
        }
        if (this._isNotInitialised()) {
            console.error(
                "Cannot activate the building view before initialising it."
            );
        }

        // Skip if the building has no children
        if (!cityjson.CityObjects[this.buildingObjectKey].children) {
            return;
        }

        this.initially3D =
            this.cameraManager.usesMapCamera() ||
            this.cameraManager.usesOrbitCamera();

        // Hide the outer shell
        this._unhideMeshChildren(this.buildingObject, true);
        this._hideMeshChildren(this.buildingObject, false);

        // Move the building up so every storey is visible
        // Translate with Z because the parent is rotated
        const bbox = new THREE.Box3().setFromObject(this.buildingObject);
        this.buildingTranslationZ = -bbox.min.y + 1;
        this.buildingObject.translateZ(this.buildingTranslationZ);

        const available_storeys = this._getStoreyObjectKeys();

        this.storeyManager.activate(this.buildingObjectKey, this.storeyCode, available_storeys);

        this._updateView();

        this._updateStatus(ACTIVATED);
    }

    /**
     * Resets everything necessary to leave building view.
     */
    deactivate() {
        if (this._isInitialisedNotActivated()) {
            return;
        }

        // Move the building back
        this.buildingObject.translateZ(-this.buildingTranslationZ);

        // Show only the building shell
        this._hideMeshChildren(this.buildingObject, true);
        this._unhideMeshChildren(this.buildingObject, false);

        // Set the icons properly
        this.layerManager.remove_interior_building_layers();

        // Update the outlines
        const allBuildingsObjectKeys =
            this.cjHelper.getAllBuildingsObjectKeys();
        const allBuildingsMeshKeys = allBuildingsObjectKeys.map((objectKey) => {
            return this.cjHelper.keyToMeshKey(objectKey);
        });
        this.outlineManager.setOutline(
            allBuildingsMeshKeys,
            "lod_2",
            "default"
        );
        // this._applyOutlines(allBuildingsMeshes, 'lod_2', 'default');

        this.storeyManager.deactivate();

        this._updateStatus(INITIALISED);
    }

    /**
     * Clears building data when uninitializing a building
     */
    uninitialise() {
        if (this._isNotInitialised()) {
            return;
        }
        if (this._isActivated()) {
            console.error(
                "Cannot uninitialise the building view before deactivating it."
            );
        }

        this.buildingObjectKey = null;
        this.buildingMeshKey = null;
        // this.floor = null;
        this._updateStatus(NOT_INITIALISED);
    }

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
            keys.push(this.cjHelper.keyToMeshKey(currentObject.name));
        });
        // Modify the outline
        this.outlineManager.setOutline(keys, lod, style);
    }

    /**
     * Extracts all the BuildingStorey inside a building and groups them per actual storey.
     *
     * @returns A dictionary mapping each storey code to a list of the corresponding keys of BuildingStorey objects.
     */
    _getStoreyObjectKeys() {
        // Extract all building parts
        const buildingJson = cityjson.CityObjects[this.buildingObjectKey];
        const buildingParts = buildingJson["children"].filter((element) => {
            return cityjson.CityObjects[element]["type"] == "BuildingPart";
        });

        // Extract the storeys in each building part
        let storeyObjectKeys = [];
        buildingParts.forEach((partObjectKey) => {
            const buildingPartJson = cityjson.CityObjects[partObjectKey];
            storeyObjectKeys = storeyObjectKeys.concat(
                buildingPartJson["children"]
            );
        });

        // Group them per storey
        let sortedStoreyObjectKeys = {};
        storeyObjectKeys.forEach((storeyObjectKey) => {
            const storeyCode = cityjson.CityObjects[storeyObjectKey][
                "attributes"
            ]["space_id"]
                .split(".")
                .pop();
            if (storeyCode in sortedStoreyObjectKeys) {
                sortedStoreyObjectKeys[storeyCode].push(storeyObjectKey);
            } else {
                sortedStoreyObjectKeys[storeyCode] = [storeyObjectKey];
            }
        });

        return sortedStoreyObjectKeys;
    }

    /**
     * Returns the keys for all room objects of the current storey
     *
     * @return {array}: An array containing all objects keys of the rooms of the current storey.
     */
    _getRoomsObjectKeys() {
        // Get the keys of the storeys
        const storeysObjectKeys = this._getStoreyObjectKeys();

        // Check if the storey code is valid
        if (!(this.storeyCode in storeysObjectKeys)) {
            console.error(
                "Invalid storey code, returning empty array: ",
                this.storeyCode
            );
            return [];
        }

        // Extract the keys of all the rooms in each BuildingStorey
        let roomsObjectKeys = [];
        storeysObjectKeys[this.storeyCode].forEach((partStoreyKey) => {
            roomsObjectKeys = roomsObjectKeys.concat(
                cityjson.CityObjects[partStoreyKey]["children"]
            );
        });

        return roomsObjectKeys;
    }

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
}
