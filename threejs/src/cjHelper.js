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
        } else {
            console.error(
                "Only Building and BuildingRoom objects have a mesh."
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
}
