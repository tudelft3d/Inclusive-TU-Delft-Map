import { InfoPane } from "./infoPane";
import { Highlighter } from "./highlighter";
import { BuildingView } from "./buildingView";
import { Vector2, Scene, Camera, Raycaster, Mesh, Vector3 } from "three";
import { CamerasControls } from "./camera";
import { HOVERED_COLOR } from "./constants";
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};


export class ObjectPicker {
    /**
     *
     * @param {HTMLElement} infoPaneElement
     * @param {Highlighter} pickHighlighter
     * @param {Scene} scene
     * @param {CamerasControls} cameraManager
     * @param {BuildingView} buildingView
     */
    constructor(
        pickHighlighter,
        scene,
        cameraManager,
        buildingView
    ) {
        this.pickHighlighter = pickHighlighter;
        this.hoverHightlighter = new Highlighter(HOVERED_COLOR);
        this.scene = scene;
        this.cameraManager = cameraManager;
        this.buildingView = buildingView;

        this.raycaster = new Raycaster();

        // Create InfoPane instance from the DOM element
        this.infoPane = new InfoPane(document.getElementById("info-pane"), this);
        this.buildingViewActivateCamera = null;
    }

    _raycastPosition(normalizedPosition) {
        // Cast a ray through the frustum
        this.raycaster.setFromCamera(
            normalizedPosition,
            this.cameraManager.camera
        );
        // Get the list of objects the ray intersected
        const hits = this.raycaster.intersectObjects(this.scene.children);

        // Pick the first visible object
        let mesh = null;
        for (let i = 0; i < hits.length; i++) {
            if (hits[i].object.visible) {
                mesh = hits[i].object;
                break;
            }
        }

        return mesh;
    }

    // hoverPosition(normalizedPosition) {
    //     const mesh = this._raycastPosition(normalizedPosition);
    //     this.hoverMesh(mesh);
    // }

    // /**
    //  * Hover the given mesh, or resets if the mesh is null.
    //  * 
    //  * @param {Mesh | null} mesh 
    //  */
    // hoverMesh(mesh) {
    //     // Skip if the mesh is picked
    //     for (const pickedMesh in this.pickHighlighter.highlighted) {
    //         if (pickedMesh.name == mesh.name) return;
    //     }
    //     if (mesh.name in this.pickHighlighter.highlighted) return;
    //     console.log(mesh);
    //     console.log(this.pickHighlighter.highlighted);

    //     if (!mesh || !mesh.name) {
    //         // Unhover
    //         this._unhover();
    //     } else {
    //         // Hover the mesh
    //         this.hoverHightlighter.highlight([mesh]);
    //     }
    // }

    // _unhover() {
    //     this.hoverHightlighter.unhighlight();
    // }


    /**
     * Picks the closest object at the given screen position.
     *
     * @param {Vector2} normalizedPosition
     */
    pickScreenPosition(normalizedPosition, onAnimationComplete = () => { }) {
        const mesh = this._raycastPosition(normalizedPosition);
        if (!mesh || !mesh.name) {
            this.unpick(onAnimationComplete);
        }
        else {
            this.pickMeshes([mesh], onAnimationComplete);
        }
    }

    /**
     * Pick the object based on the given name, using its icon position.
     * 
     * @param {string} cj_name
     * @param {Vector3} icon_position
     * @param {number} distance
     */
    pickIcon(cj_name, icon_position, distance) {
        // Zoom to the mesh
        this.cameraManager.zoomToCoordinates(icon_position, distance);

        // Show info pane with object name - InfoPane handles everything else
        this.infoPane.show(cj_name);
    }

    /**
     * Pick the given mesh, or resets if the mesh is null.
     * 
     * @param {Mesh[]} meshes
     * @param {*} onAnimationComplete
     */
    pickMeshes(meshes, onAnimationComplete = () => { }) {
        console.log("pickMeshes", meshes)
        if (!Array.isArray(meshes)) {
            console.error("pickMeshes expects an array as an input.")
            return;
        };
        if (meshes.length == 0) {
            console.error("pickMeshes expects an array with a length > 0 as an input");
            return;
        }
        if (meshes.length == 1) {
            const mesh = meshes[0];
            if (!mesh || !mesh.name) {
                console.error("pickMeshes expects an array of meshes as an input, but got an array containing: ", mesh);
                return;
            }
            console.log("Picking");
            // Highlight the mesh
            this.pickHighlighter.highlight([mesh]);
            const meshKey = mesh.name;
            const objectKey = meshKey.split("-").slice(0, 3).join("-")
            const json = cityjson["CityObjects"][objectKey];
            const jsonType = json["type"];
            console.log("Picking meshKey", meshKey);
            console.log("Picking objectKey", objectKey);

            if (jsonType == "Building") {
                console.log("Picking a Building")
                if (this.buildingView._isNotInitialised()) {
                    this.buildingView.initialise(objectKey);
                    this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                } else if (this.buildingView._isInitialisedNotActivated()) {
                    if (objectKey == this.buildingView.buildingObjectKey) {
                        // Same building
                    } else {
                        this.buildingView.initialise(objectKey);
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    }
                } else if (this.buildingView._isActivated()) {
                    if (objectKey == this.buildingView.buildingObjectKey) {
                        this.buildingView.deactivate();
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    } else {
                        this.buildingView.deactivate();
                        this.buildingView.initialise(objectKey);
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    }
                }
            } else if (jsonType == "BuildingRoom") {
                console.log("Picking a BuildingRoom")
                const buildingObjectKey = this._findParentBuildingObjectKey(objectKey);
                const storeyCode = this._findRoomStoreyCode(objectKey);
                if (this.buildingView._isNotInitialised()) {
                    console.log("BuildingView was not initialised")
                    this.buildingView.initialise(buildingObjectKey, storeyCode);
                    this.buildingView.activate();
                    this.buildingViewActivationCamera = this.cameraManager.cameraInt;
                    this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                } else if (this.buildingView._isInitialisedNotActivated()) {
                    console.log("BuildingView was not activated")
                    if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                        this.buildingView.setStorey(storeyCode);
                        this.buildingView.activate();
                        this.buildingViewActivationCamera = this.cameraManager.cameraInt;
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    } else {
                        this.buildingView.initialise(buildingObjectKey, storeyCode);
                        this.buildingView.activate();
                        this.buildingViewActivationCamera = this.cameraManager.cameraInt;
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    }
                } else if (this.buildingView._isActivated()) {
                    console.log("BuildingView was activated")
                    if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                        this.buildingView.updateStorey(storeyCode);
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    } else {
                        this.buildingView.deactivate();
                        this.buildingView.initialise(objectKey, storeyCode);
                        this.cameraManager.zoomToObject(mesh, onAnimationComplete);
                    }
                }

            }

            // // Set the building view
            // if (this.buildingView._isNotInitialised()) {
            //     console.log("Pick initialise")
            //     this.buildingView.initialiseFromChild(objectKey);
            // } else if (this.buildingView._isInitialisedNotActivated()) {
            //     console.log("Pick activate")
            //     this.buildingView.activate();
            // } else {
            //     console.log("Pick update")
            //     this.buildingView.updateFromTarget(objectKey);
            // }
            // this.cameraManager.zoomToObject(mesh, onAnimationComplete);

            // console.log('zooming to: ', mesh);
            // Show info pane with object name - InfoPane handles everything else
            this.infoPane.show(meshKey);
        }
        // case of multiple building units - set building view to parent building
        else {
            // // Highlight the meshes
            // // console.log(mesh);
            // this.pickHighlighter.highlight(mesh);

            // const first_mesh = mesh[0];
            // const first_json = cityjson["CityObjects"][first_mesh.name.slice(0, -6)];
            // parentMesh = this.findParentBuilding(first_json);

            // // Set the building view
            // if (this.buildingView) { // is this needed? @Alex

            //     if (first_json.type == "BuildingRoom") {
            //         let allFloors = {};
            //         mesh.forEach(room => {
            //             const floor = room.name.slice(-12, -10);
            //             allFloors[floor] = (allFloors[floor] || 0) + 1;
            //         });

            //         let mostCommonFloor = null;
            //         let maxCount = 0;
            //         for (const [floor, count] of Object.entries(allFloors)) {
            //             if (count > maxCount) {
            //                 mostCommonFloor = floor;
            //                 maxCount = count;
            //             }
            //         }
            //         this.buildingView.initialiseBuildingView(mostCommonFloor, false);
            //     }
            //     this.cameraManager.zoomToObject(parentMesh);


            //     // Show info pane with object name - InfoPane handles everything else
            //     // This needs to be outside of this function, and called when the input is known to be Building/Unit/Room. pickMeshes does not know the context.
            //     this.infoPane.show(parentKey);
            // }
        }
    }

    /**
     * Finds the key of the Building that is the parent of this object.
     * 
     * @param {string} objectKey 
     * @returns The CityJSON key of the parent building.
     */
    _findParentBuildingObjectKey(objectKey) {
        var json = cityjson["CityObjects"][objectKey];
        while (json["type"] != "Building") {
            objectKey = json["parents"][0];
            json = cityjson["CityObjects"][objectKey];
        }
        return objectKey;
    }

    _findRoomStoreyCode(objectKey) {
        const roomJson = cityjson.CityObjects[objectKey];
        if (roomJson["type"] != "BuildingRoom") {
            console.error("This function expects a BuildingRoom as an input.")
            return;
        }
        const spaceId = cityjson.CityObjects[objectKey]["attributes"]["space_id"]
        const allCodes = spaceId.split(".");
        if (allCodes.length != 4) {
            console.error("A BuildingRoom is expected to have 4 numbers in its space ID.")
            return;
        }
        return allCodes[2];
    }


    unpick(onAnimationComplete) {
        // Unhighlight
        this.pickHighlighter.unhighlight();

        // Reset the building view
        if (this.buildingView._isActivated()) {
            this.buildingView.deactivate();
            this.buildingViewActivationCamera = null;
        }
        if (this.buildingView._isInitialisedNotActivated()) {
            this.buildingView.uninitialise();
        }

        if (this.cameraManager.usesOrbitCamera()) {
            this.cameraManager.switchToMap();
        }

        // Hide the info pane
        this.infoPane.hide();
    }

    switchBuildingView() {
        if (this.buildingView._isNotInitialised()) {
            console.error("The BuildingView is not initialised.");
        } else if (this.buildingView._isInitialisedNotActivated()) {
            this.buildingView.activate();
            this.buildingViewActivationCamera = this.cameraManager.cameraInt;
            this.cameraManager.switchToOrthographic();
        } else if (this.buildingView._isActivated()) {
            this.buildingView.deactivate();
            this.buildingViewActivationCamera = null;
            this.cameraManager.switchToOrbit();
        } else {
            console.error("Unexpected status!")
        }
    }

}
