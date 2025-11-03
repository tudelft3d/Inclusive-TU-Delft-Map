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

    setStorey(storeyCode) {
        if (this.storeyCode == storeyCode) {
            return;
        }
        this.storeyCode = storeyCode;
        if (this._isActivated()) {
            this._updateView();
        }
    }

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

        this._applyOutlines(roomsObjects, "lod_0", "default");
    }

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

        // Populate the buttons to switch between storeys
        this._populateStoreyButtons();

        const available_storeys = this._getStoreyObjectKeys();

        this.storeyManager.activate(this.buildingObjectKey, this.storeyCode, available_storeys);

        this._updateView();

        this._updateStatus(ACTIVATED);
    }

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
        this.floor = null;
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

    _populateStoreyButtons() {
        const storey_dropdown = document.getElementById("bv-dropdown");
        storey_dropdown.innerHTML = "";

        const storeysObjectKeys = this._getStoreyObjectKeys();
        for (var storeyCode of Object.keys(storeysObjectKeys)) {
            var a = document.createElement("a");
            a.appendChild(document.createTextNode(storeyCode));
            a.addEventListener("click", (event) => {
                this.setStorey(storeyCode);

                // Close the dropdown after selecting a storey
                const bvDropdown = document.getElementById("bv-dropdown");
                if (bvDropdown) {
                    bvDropdown.style.display = "none";
                }
            });

            a.href = "#";
            storey_dropdown.appendChild(a);
        }
    }
}
