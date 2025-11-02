import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };

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
        }else if (objectType == "BuildingUnit") {
            meshKey = objectKey + "-lod_0";
        } else {
            console.error(
                "Only Building, BuildingRoom and occasionally buildingUnit objects have a mesh."
            );
        }

        if (!this.checkMeshKeyExists(meshKey)) {
            console.error(
                "The mesh key obtained doesn't correspond to an object in the scene."
            );
        }
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

    getRoomStoreyCode(key) {
        const roomType = this.getType(key);
        if (roomType != "BuildingRoom") {
            console.error("This function expects a BuildingRoom as an input.");
            return;
        }
        const roomAttributes = this.getAttributes(key);
        const spaceId = roomAttributes["space_id"];
        const allCodes = spaceId.split(".");
        if (allCodes.length != 4) {
            console.error(
                "A BuildingRoom is expected to have 4 numbers in its space ID."
            );
            return;
        }
        return allCodes[2];
    }

    getJson(key) {
        const objectKey = this.keyToObjectKey(key);
        return cityjson.CityObjects[objectKey];
    }

    getType(key) {
        const json = this.getJson(key);
        return json["type"];
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

    getAllBuildingsObjectKeys() {
        const allBuildings = [];
        for (const [objectKey, object] of Object.entries(
            cityjson.CityObjects
        )) {
            const objectType = this.getType(objectKey);
            if (objectType == "Building") {
                allBuildings.push(objectKey);
            }
        }
        return allBuildings;
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
}
