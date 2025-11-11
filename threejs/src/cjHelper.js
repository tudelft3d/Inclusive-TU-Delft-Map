import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };
import { Vector3 } from "three/src/Three.Core.js";

export class CjHelper {
    constructor(scene) {
        this.scene = scene;
    }

    /**
     * Transform a key (either geometry or CityJSON key) into the corresponding CityJSON key.
     *
     * @param {string} key:
     * @returns {string} 
     */
    keyToObjectKey(key) {
        return key.split("-").slice(0, 3).join("-");
    }

    /**
     * Transform a cityjson key into the corresponding threejs mesh key.
     *
     * @param {string} key: The cityjson key
     * @returns {string} The threejs mesh key
     */
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

    /**
     * @param {string} key: A key representing a room or storey for which they storey code needs to be retrieved.
     * 
     * @return {string} The storey code for the object associated with the key.
     */
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

    /**
     * @param {string} key: The key of the object for which all storey codes need to be retrieved.
     * 
     * @return {array} An array of all storey codes associated with the unit represented by the key.
     */
    getUnitAllStoreyCodes(key) {
        if (!this.isBuildingUnit(key)) {
            return;
        }
        const attributes = this.getAttributes(key);
        const allStoreysKeys = attributes["unit_storeys"];
        const allStoreyCodes = new Set(allStoreysKeys.map((storeyKey) => { return storeyKey.split(".")[2] }));
        return [...allStoreyCodes];
    }

    /**
     * @param {string} key: The key of the object for which a storey code needs to be retrieved.
     * 
     * @return {string} The storey code with which the key is most strongly associated with.
     */
    getUnitMainStoreyCode(key) {
        if (!this.isBuildingUnit(key)) {
            return;
        }
        const attributes = this.getAttributes(key);
        return attributes["Entrance Storey Code"]
    }

    /**
     * @param {string} key: The key for which an object needs to be retrieved.
     * 
     * @return {object} The object associated with the key.
     */
    getJson(key) {
        const objectKey = this.keyToObjectKey(key);
        return cityjson.CityObjects[objectKey];
    }

    /**
     * @param {string} key: The key of the object for which the type needs to be retrieved.
     * 
     * @return {string} The type of the object the key is associated with.
     */
    getType(key) {
        const json = this.getJson(key);
        return json["type"];
    }

    /**
     * @param {string} key: The key of the object for which the children need to be retrieved.
     * 
     * @return {array} The key(s) of the children object(s), if they exist.
     */
    getChildrenObjectKeys(key) {
        const json = this.getJson(key);
        if (Object.keys(json).includes("children")) {
            return json["children"];
        } else {
            return [];
        }
    }

    /**
     * @param {string} key: The key of the object for which the parent needs to be retrieved.
     * 
     * @return {object} The key of the parent object, if it exists.
     */
    getParentObjectKey(key) {
        const json = this.getJson(key);
        if (Object.keys(json).includes("parents")) {
            return json["parents"][0];
        } else {
            return null;
        }
    }

    /**
     * @param {string} key: The key of the object for which the attributes need to be retrieved.
     * 
     * @return {object} The attributes associated with the key, extracted from the cityjson file.
     */
    getAttributes(key) {
        const json = this.getJson(key);
        return json["attributes"];
    }

    /**
     * @param {string} key: The key of the object for which the corresponding mesh needs to be retrieved.
     * 
     * @return {threejs mesh object} The mesh object associated with the key, if it exists.
     */
    getMesh(key) {
        const meshKey = this.keyToMeshKey(key);
        return this.scene.getObjectByName(meshKey);
    }

    /**
     * @param {string} key: The key of the object from which the unit spaces need to be extracted.
     * 
     * @return {array} An array of unit spaces.
     */
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

    /**
     * @param {string} key: The key of the object from which the space id needs to be extracted.
     */
    getSpaceId(key) {
        const attributes = this.getAttributes(key);
        return attributes["space_id"];
    }

    /**
     * @param {string} key: The key of the object from which the icon position needs to be extracted.
     * 
     * @return {THREE.Vector3d} A threejs vector of the icon position.
     */
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

    /**
     * @param {key} buildingKey: The cityjson key of the building object from which the keys of the building unit groups need to be extracted.
     * 
     * @return {array} An array of building unit group keys.
     */
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

    /**
     * @param {string} buildingKey: The cityjson key of the building object from which the part keys need to be extracted.
     * 
     * @return {array} An array of building part object keys.
     */
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

    /**
     * @param {string} buildingKey: The cityjson key of the building object from which the storey keys need to be extracted.
     * @param {string} filteredStoreyCode: The storey code of the storey that is needed. If left null will return objects for all storeys.
     * 
     * @param {array} An array of storey object keys.
     */
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

    /**
     * @param {string} buildingKey: The cityjson key of the building object for which needs to be checked
     * if it has building parts, storeys and rooms.
     * 
     * @return {boolean}: A boolean indicating if the building has an interior.
     */
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
