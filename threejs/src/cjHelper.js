import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };
import { Vector3 } from "three/src/Three.Core.js";

export class CjHelper {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Transform a key (either geometry or CityJSON key) into the corresponding CityJSON key.
     *
     * @param {string} key
     * @returns
     */
    keyToObjectKey(key) {
        return key.split("-").slice(0, 3).join("-");
    }

    keyToMeshKey(key) {
        const objectKey = this.keyToObjectKey(key);
        const objectType = this.getType(key);
        var meshKey;
        if (objectType == "Building") {
            meshKey = objectKey + "-lod_2";
        } else if (objectType == "BuildingRoom") {
            meshKey = objectKey + "-lod_0";
        } else if (objectType == "BuildingUnit") {
            meshKey = objectKey + "-lod_0";
        } else if (objectType == "GenericCityObject") {
            meshKey = objectKey + "-lod_0";
            // } else {
            //     console.error(
            //         `Only Building, BuildingRoom, BuildingUnit and GenericCityObject objects can have a mesh, not ${objectType}.`
            //     );
        }

        // if (!this.checkMeshKeyExists(meshKey)) {
        //     console.error(
        //         "The mesh key obtained doesn't correspond to an object in the scene."
        //     );
        // }
        return meshKey;
    }

    isObjectKey(key) {
        const keyInScene = !!this.scene.getObjectByName(key);
        const keyInJson = key in cityjson.CityObjects;
        return keyInScene && keyInJson;
    }

    checkMeshKeyExists(meshKey) {
        const mesh = this.scene.getObjectByName(meshKey);
        return !!mesh;
    }

    hasMesh(key) {
        const meshKey = this.keyToMeshKey(key);
        return checkMeshKeyExists(meshKey);
    }

    isBuilding(key) {
        const type = this.getType(key);
        return type == "Building";
    }

    isBuildingUnit(key) {
        const type = this.getType(key);
        return type == "BuildingUnit";
    }

    isBuildingSomething(key) {
        const type = this.getType(key);
        return type.startsWith("Building");
    }

    /**
     * Finds the key of the Building that is the parent of this object.
     *
     * @param {string} key
     * @returns The CityJSON key of the parent building.
     */
    findParentBuildingObjectKey(key) {
        var json = this.getJson(key);
        var objectKey = key;
        while (json["type"] != "Building") {
            objectKey = json["parents"][0];
            json = this.getJson(objectKey);
        }
        return objectKey;
    }

    getStoreyCode(key) {
        const roomType = this.getType(key);
        var storeyObjectKey;
        if (roomType == "BuildingRoom") {
            storeyObjectKey = this.getParentObjectKey(key);
        } else if (roomType == "BuildingStorey") {
            storeyObjectKey = key;
        } else {
            console.error(
                "This function expects a BuildingRoom or BuildingStorey as an input."
            );
            return;
        }
        console.log("storeyObjectKey", storeyObjectKey);
        return this.getAttributes(storeyObjectKey)["storey_space_id"];
    }

    getUnitMainStoreyCode(key) {
        if (!this.isBuildingUnit(key)) {
            return;
        }
        const attributes = this.getAttributes(key);
        return attributes["Entrance Storey Code"]
    }

    getJson(key) {
        const objectKey = this.keyToObjectKey(key);
        return cityjson.CityObjects[objectKey];
    }

    getType(key) {
        const json = this.getJson(key);
        return json["type"];
    }

    getChildrenObjectKeys(key) {
        const json = this.getJson(key);
        if (Object.keys(json).includes("children")) {
            return json["children"];
        } else {
            return [];
        }
    }

    getParentObjectKey(key) {
        const json = this.getJson(key);
        if (Object.keys(json).includes("parents")) {
            return json["parents"][0];
        } else {
            return null;
        }
    }

    getAttributes(key) {
        const json = this.getJson(key);
        return json["attributes"];
    }

    getMesh(key) {
        const meshKey = this.keyToMeshKey(key);
        return this.scene.getObjectByName(meshKey);
    }

    getUnitSpaces(key) {
        const type = this.getType(key);
        if (type != "BuildingUnit") {
            console.error("The given object is not a unit.");
            return [];
        }
        const attributes = this.getAttributes(key);
        const unitSpacesAttribute = "unit_spaces";
        if (!(unitSpacesAttribute in attributes)) {
            console.error(
                `The given unit does not have an attribute called ${unitSpacesAttribute}.`
            );
            return [];
        }
        return attributes[unitSpacesAttribute];
    }

    getSpaceId(key) {
        const attributes = this.getAttributes(key);
        return attributes["space_id"];
    }

    getIconPositionVector3(key) {
        const attributes = this.getAttributes(key);
        const iconPosition = attributes["icon_position"];
        // Rotate to have the correct axes
        return new Vector3(
            iconPosition[0],
            iconPosition[2],
            -iconPosition[1]
        );
    }

    /**
     * Get the object keys of all the objects of one of the given types.
     *
     * @param {string[]} objectTypes
     * @returns
     */
    _getAllObjectKeysFilter(objectTypes) {
        const allObjectKeys = [];
        for (const [objectKey, object] of Object.entries(
            cityjson.CityObjects
        )) {
            const objectType = this.getType(objectKey);
            if (objectTypes.includes(objectType)) {
                allObjectKeys.push(objectKey);
            }
        }
        return allObjectKeys;
    }

    getAllBuildingsObjectKeys() {
        return this._getAllObjectKeysFilter(["Building"]);
    }

    getAllUnitsObjectKeys() {
        return this._getAllObjectKeysFilter([
            "BuildingUnit",
            "GenericCityObject",
        ]);
    }

    getBuildingPartsObjectKeys(buildingKey) {
        // Check if the object is a building
        const objectType = this.getType(buildingKey);
        if (objectType != "Building") {
            console.error("The queried object is not a building.");
            return;
        }

        const childrenObjectKeys = this.getChildrenObjectKeys(buildingKey);
        const buildingPartsObjectKeys = childrenObjectKeys.filter(
            (childObjectKey) => this.getType(childObjectKey) == "BuildingPart"
        );
        return buildingPartsObjectKeys;
    }

    getBuildingStoreysObjectKeys(buildingKey, filteredStoreyCode = null) {
        const buildingParts = this.getBuildingPartsObjectKeys(buildingKey);
        if (!buildingParts) {
            return;
        }
        const buildingStoreys = [];
        buildingParts.forEach((partObjectKey) => {
            const storeysObjectKeys = this.getChildrenObjectKeys(partObjectKey);
            storeysObjectKeys.forEach((storeyObjectKey) => {
                const currentStoreyCode = this.getStoreyCode(storeyObjectKey);
                if (
                    !filteredStoreyCode ||
                    currentStoreyCode == filteredStoreyCode
                ) {
                    buildingStoreys.push(storeyObjectKey);
                }
            });
        });
        console.log(buildingStoreys);
        return buildingStoreys;
    }

    buildingHasFloorPlan(buildingKey) {
        // Check if the object is a building
        const buildingParts = this.getBuildingPartsObjectKeys(buildingKey);
        if (!buildingParts) {
            return;
        }
        return buildingParts.length > 0;
    }
}
