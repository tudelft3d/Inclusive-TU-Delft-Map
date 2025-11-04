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
        return this.checkMeshKeyExists(meshKey);
    }

    isBuilding(key) {
        const type = this.getType(key);
        return type == "Building";
    }

    isBuildingRoom(key) {
        const type = this.getType(key);
        return type == "BuildingRoom";
    }

    isBuildingUnit(key) {
        const type = this.getType(key);
        return type == "BuildingUnit";
    }

    isBuildingSomething(key) {
        const type = this.getType(key);
        return type.startsWith("Building");
    }

    isCityObjectGroup(key) {
        const type = this.getType(key);
        return type.startsWith("CityObjectGroup");
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
        return this.getAttributes(storeyObjectKey)["storey_space_id"];
    }

    getUnitAllStoreyCodes(key) {
        if (!this.isBuildingUnit(key)) {
            return;
        }
        const attributes = this.getAttributes(key);
        const allStoreysKeys = attributes["unit_storeys"];
        const allStoreyCodes = new Set(allStoreysKeys.map((storeyKey) => { return storeyKey.split(".")[2] }));
        return [...allStoreyCodes];
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

    getBuildingUnitGroupsObjectKeys(key) {
        if (!this.isBuilding(key)) {
            return null;
        }
        const childrenKeys = this.getChildrenObjectKeys(key).filter(
            (childKey) => { return this.isCityObjectGroup(childKey); }
        );
        if (childrenKeys.length == 0) {
            return [];
        } else if (childrenKeys.length > 1) {
            console.error("Expected only one CityObjectGroup child for a building.");
            return null;
        }
        const buildingUnitMainGroup = childrenKeys[0];
        return this.getChildrenObjectKeys(buildingUnitMainGroup);
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

    /**
     * Extracts all the buildingUnitContainers for each building on the campus from the cityjson.
     * 
     * This function assumes that buildings have a child of type BuildingUnitObject.
     * If not, the building will be skipped.
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
    extract_building_buildingUnitContainers() {

        const building_buildingUnitContainers = {};

        for (const [building_key, building_object] of Object.entries(cityjson.CityObjects)) {

            if (building_object.type == "Building") {

                if (!(building_object.children)) {
                    building_buildingUnitContainers[building_key] = {};
                    continue;
                }

                const buildingUnitObject_key = building_object.children.find((element) => element.includes("BuildingUnitObject"));

                if (buildingUnitObject_key == undefined) {
                    console.error("Building:", building_key, " did not have any BuildingUnitObject");
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
    extract_outdoor_unit_containers() {

        const campus_OutdoorUnitContainers = {};

        const outdoor_unit_keys = cityjson.CityObjects["Outdoor-CityObjectGroup-OutdoorObject"].children;

        outdoor_unit_keys.forEach((current_unit_key) => {

            const current_layer_code = cityjson.CityObjects[current_unit_key].attributes["code"];
            campus_OutdoorUnitContainers[current_layer_code] = current_unit_key;

        });

        return campus_OutdoorUnitContainers;

    }

    /**
     * Extracts all the buildingUnitContainers for each building on the campus from the cityjson.
     * 
     * This function assumes that buildings have a child of type BuildingUnitObject.
     * If not, the building will be skipped.
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
    extract_building_buildingUnitContainers() {

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
    extract_outdoor_unit_containers() {

        const campus_OutdoorUnitContainers = {};

        const outdoor_unit_keys = cityjson.CityObjects["Outdoor-CityObjectGroup-OutdoorObject"].children;

        outdoor_unit_keys.forEach((current_unit_key) => {

            const current_layer_code = cityjson.CityObjects[current_unit_key].attributes["code"];
            campus_OutdoorUnitContainers[current_layer_code] = current_unit_key;

        });

        return campus_OutdoorUnitContainers;

    }
}
