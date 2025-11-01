import { InfoPane } from "./infoPane";
import { Highlighter } from "./highlighter";
import { BuildingView } from "./buildingView";
import { Vector2, Scene, Camera, Raycaster, Mesh, Vector3 } from "three";
import { CamerasControls } from "./camera";
import { HOVERED_COLOR } from "./constants";
import { CjHelper } from "./cjHelper";

export class ObjectPicker {
    /**
     *
     * @param {HTMLElement} infoPaneElement
     * @param {Highlighter} pickHighlighter
     * @param {Scene} scene
     * @param {CamerasControls} cameraManager
     * @param {BuildingView} buildingView
     */
    constructor(pickHighlighter, scene, cameraManager, buildingView) {
        this.pickHighlighter = pickHighlighter;
        this.hoverHightlighter = new Highlighter(HOVERED_COLOR);
        this.scene = scene;
        this.cameraManager = cameraManager;
        this.buildingView = buildingView;

        this.cjHelper = new CjHelper(this.scene);
        this.raycaster = new Raycaster();

        // Create InfoPane instance from the DOM element
        this.infoPane = new InfoPane(
            document.getElementById("info-pane"),
            this,
            this.cjHelper,
        );
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
        } else {
            this.pickMesh(mesh.name, onAnimationComplete);
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
     * Pick the mesh corresponding to the given key.
     *
     * @param {string} pickedKey (object or mesh key)
     * @param {*} onAnimationComplete
     */
    pickMesh(pickedKey, onAnimationComplete = () => { }) {
        const pickedObjectKey = this.cjHelper.keyToObjectKey(pickedKey);
        const pickedObjectType = this.cjHelper.getType(pickedObjectKey);

        if (pickedObjectType == "Building") {
            // Pick a Building
            console.log("Picking a Building");

            // Highlight the picked mesh
            const pickedMesh = this.cjHelper.getMesh(pickedObjectKey);
            this.pickHighlighter.highlight([pickedMesh]);

            const buildingObjectKey = pickedObjectKey;
            const buildingMesh = this.cjHelper.getMesh(buildingObjectKey);

            if (this.buildingView._isNotInitialised()) {
                // Building view not initialised
                this.buildingView.initialise(buildingObjectKey);
                this.cameraManager.zoomToObject(
                    buildingMesh,
                    onAnimationComplete
                );
            } else if (this.buildingView._isInitialisedNotActivated()) {
                // Building view not activated
                if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                    // Same building
                    this.cameraManager.zoomToObject(
                        buildingMesh,
                        onAnimationComplete
                    );
                } else {
                    // Different building
                    this.buildingView.initialise(buildingObjectKey);
                    this.cameraManager.zoomToObject(
                        buildingMesh,
                        onAnimationComplete
                    );
                }
            } else if (this.buildingView._isActivated()) {
                // Building view actvated
                if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                    // Same building
                    this.buildingView.deactivate();
                    this.cameraManager.zoomToObject(
                        buildingMesh,
                        onAnimationComplete
                    );
                } else {
                    // Different building
                    this.buildingView.deactivate();
                    this.buildingView.initialise(buildingObjectKey);
                    this.cameraManager.zoomToObject(
                        buildingMesh,
                        onAnimationComplete
                    );
                }
            }
        } else if (pickedObjectType == "BuildingRoom") {
            // Pick a BuildingRoom
            console.log("Picking a BuildingRoom");

            // Highlight the picked mesh
            const pickedMesh = this.cjHelper.getMesh(pickedObjectKey);
            this.pickHighlighter.highlight([pickedMesh]);

            const buildingObjectKey =
                this.cjHelper.findParentBuildingObjectKey(pickedObjectKey);
            const buildingMesh = this.cjHelper.getMesh(buildingObjectKey);
            const storeyCode = this.cjHelper.getRoomStoreyCode(pickedObjectKey);

            if (this.buildingView._isNotInitialised()) {
                // Building view not initialised
                this.buildingView.initialise(buildingObjectKey, storeyCode);
                this.buildingView.activate();
                this.buildingViewActivationCamera =
                    this.cameraManager.cameraInt;
                const onComplete = () => {
                    const onComplete2 = () => {
                        this.cameraManager.zoomToObject(
                            pickedMesh,
                            onAnimationComplete
                        );
                    };
                    this.cameraManager.switchToOrthographic(onComplete2);
                };
                this.cameraManager.zoomToObject(buildingMesh, onComplete);
            } else if (this.buildingView._isInitialisedNotActivated()) {
                // Building view not activated
                if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                    // Same building
                    this.buildingView.setStorey(storeyCode);
                    this.buildingView.activate();
                    this.buildingViewActivationCamera =
                        this.cameraManager.cameraInt;
                    const onComplete = () => {
                        const onComplete2 = () => {
                            this.cameraManager.zoomToObject(
                                pickedMesh,
                                onAnimationComplete
                            );
                        };
                        this.cameraManager.switchToOrthographic(onComplete2);
                    };
                    this.cameraManager.zoomToObject(buildingMesh, onComplete);
                } else {
                    // Different building
                    this.buildingView.initialise(buildingObjectKey, storeyCode);
                    this.buildingView.activate();
                    this.buildingViewActivationCamera =
                        this.cameraManager.cameraInt;
                    const onComplete = () => {
                        const onComplete2 = () => {
                            this.cameraManager.zoomToObject(
                                pickedMesh,
                                onAnimationComplete
                            );
                        };
                        this.cameraManager.switchToOrthographic(onComplete2);
                    };
                    this.cameraManager.zoomToObject(buildingMesh, onComplete);
                }
            } else if (this.buildingView._isActivated()) {
                if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                    // Same building
                    this.buildingView.setStorey(storeyCode);
                    const onComplete = () => {
                        this.cameraManager.zoomToObject(
                            pickedMesh,
                            onAnimationComplete
                        );
                    };
                    this.cameraManager.switchToOrthographic(onComplete);
                } else {
                    // Different building
                    this.buildingView.deactivate();
                    this.buildingView.initialise(objectKey, storeyCode);
                    const onComplete = () => {
                        const onComplete2 = () => {
                            this.cameraManager.zoomToObject(
                                pickedMesh,
                                onAnimationComplete
                            );
                        };
                        this.cameraManager.switchToOrthographic(onComplete2);
                    };
                    this.cameraManager.zoomToObject(buildingMesh, onComplete);
                }
            }
        } else if (pickedObjectType == "BuildingUnit") {
            // Pick a BuildingUnit
            console.log("Picking a BuildingUnit");

            // Get the spaces of the units
            const unitSpacesObjectKeys =
                this.cjHelper.getUnitSpaces(pickedObjectKey);
            if (unitSpacesObjectKeys.length == 0) {
                console.error("A unit with 0 space is not supported yet.");
                return;
            }
            const unitSpacesMeshes = unitSpacesObjectKeys.map((objectKey) => {
                return this.cjHelper.getMesh(objectKey);
            });
            const unitSpacesBuildingObjectKeys = unitSpacesObjectKeys.map(
                (objectKey) => {
                    return this.cjHelper.findParentBuildingObjectKey(objectKey);
                }
            );

            // Check if all the unit spaces are in the same building
            if (
                !unitSpacesBuildingObjectKeys.every(
                    (v) => v === unitSpacesBuildingObjectKeys[0]
                )
            ) {
                console.error(
                    "A unit with spaces in multiple buildings is not supported."
                );
                return;
            }

            const buildingObjectKey = unitSpacesBuildingObjectKeys[0];
            const buildingMesh = this.cjHelper.getMesh(buildingObjectKey);

            // Find the most frequent storey code
            const unitSpacesStoreyCodes = unitSpacesObjectKeys.map(
                (objectKey) => {
                    return this.cjHelper.getRoomStoreyCode(objectKey);
                }
            );
            var counts = {};
            var compare = 0;
            var storeyCode;
            for (const spaceStoreyCode of unitSpacesStoreyCodes) {
                if (counts[spaceStoreyCode] === undefined) {
                    counts[spaceStoreyCode] = 1;
                } else {
                    counts[spaceStoreyCode] += 1;
                }
                if (counts[spaceStoreyCode] > compare) {
                    compare = counts[spaceStoreyCode];
                    storeyCode = spaceStoreyCode;
                }
            }

            // Highlight the meshes
            this.pickHighlighter.highlight(unitSpacesMeshes);

            if (this.buildingView._isNotInitialised()) {
                // Building view not initialised
                this.buildingView.initialise(buildingObjectKey, storeyCode);
                this.buildingView.activate();
                this.buildingViewActivationCamera =
                    this.cameraManager.cameraInt;
                const onComplete = () => {
                    const onComplete2 = () => {
                        this.cameraManager.zoomToObject(
                            unitSpacesMeshes,
                            onAnimationComplete
                        );
                    };
                    this.cameraManager.switchToOrthographic(onComplete2);
                };
                this.cameraManager.zoomToObject(buildingMesh, onComplete);
            } else if (this.buildingView._isInitialisedNotActivated()) {
                // Building view not activated
                if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                    // Same building
                    this.buildingView.setStorey(storeyCode);
                    this.buildingView.activate();
                    this.buildingViewActivationCamera =
                        this.cameraManager.cameraInt;
                    const onComplete = () => {
                        const onComplete2 = () => {
                            this.cameraManager.zoomToObject(
                                unitSpacesMeshes,
                                onAnimationComplete
                            );
                        };
                        this.cameraManager.switchToOrthographic(onComplete2);
                    };
                    this.cameraManager.zoomToObject(buildingMesh, onComplete);
                } else {
                    // Different building
                    this.buildingView.initialise(buildingObjectKey, storeyCode);
                    this.buildingView.activate();
                    this.buildingViewActivationCamera =
                        this.cameraManager.cameraInt;
                    const onComplete = () => {
                        const onComplete2 = () => {
                            this.cameraManager.zoomToObject(
                                unitSpacesMeshes,
                                onAnimationComplete
                            );
                        };
                        this.cameraManager.switchToOrthographic(onComplete2);
                    };
                    this.cameraManager.zoomToObject(buildingMesh, onComplete);
                }
            } else if (this.buildingView._isActivated()) {
                if (buildingObjectKey == this.buildingView.buildingObjectKey) {
                    // Same building
                    this.buildingView.setStorey(storeyCode);
                    const onComplete = () => {
                        this.cameraManager.zoomToObject(
                            unitSpacesMeshes,
                            onAnimationComplete
                        );
                    };
                    this.cameraManager.switchToOrthographic(onComplete);
                } else {
                    // Different building
                    this.buildingView.deactivate();
                    this.buildingView.initialise(objectKey, storeyCode);
                    const onComplete = () => {
                        const onComplete2 = () => {
                            this.cameraManager.zoomToObject(
                                unitSpacesMeshes,
                                onAnimationComplete
                            );
                        };
                        this.cameraManager.switchToOrthographic(onComplete2);
                    };
                    this.cameraManager.zoomToObject(buildingMesh, onComplete);
                }
            }
        } else {
            console.error(
                "The object has a type that is not supported for picking:",
                pickedObjectType
            );
        }
        this.infoPane.show(pickedObjectKey);
    }

    unpick(onAnimationComplete) {
        // Unhighlight
        this.pickHighlighter.unhighlight();

        // Reset the building view
        if (this.buildingView._isActivated()) {
            this.buildingView.deactivate();
            this.cameraManager.switchToInt(this.buildingViewActivationCamera);
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
            const onComplete = () => {
                this.cameraManager.switchToOrthographic();
            };
            const buildingMesh = this.scene.getObjectByName(
                this.buildingView.buildingMeshKey
            );
            this.cameraManager.zoomToObject(buildingMesh, onComplete);
        } else if (this.buildingView._isActivated()) {
            this.buildingView.deactivate();
            this.cameraManager.switchToInt(this.buildingViewActivationCamera);
            this.cameraManager.switchToOrbit();
        } else {
            console.error("Unexpected status!");
        }
    }

    switch2D3D(onComplete = () => { }) {
        if (this.cameraManager.usesOrthographicCamera()) {
            if (this.buildingView._isNotInitialised()) {
                this.cameraManager.switchToMap(onComplete);
            } else if (this.buildingView._isInitialisedNotActivated()) {
                const onComplete2 = () => {
                    this.pickMesh(
                        this.buildingView.buildingObject.name,
                        onComplete
                    );
                };
                this.cameraManager.switchToOrbit(onComplete2);
            } else if (this.buildingView._isActivated()) {
                this.buildingView.deactivate();
                const onComplete2 = () => {
                    this.pickMesh(
                        this.buildingView.buildingObject.name,
                        onComplete
                    );
                };
                this.cameraManager.switchToOrbit(onComplete2);
            } else {
                console.error("Unexpected status!");
            }
        } else {
            if (this.buildingView._isNotInitialised()) {
                this.cameraManager.switchToOrthographic(onComplete);
            } else if (this.buildingView._isInitialisedNotActivated()) {
                const onComplete2 = () => {
                    this.cameraManager.switchToOrthographic(onComplete);
                };
                this.cameraManager.zoomToObject(
                    this.buildingView.buildingObject,
                    onComplete2
                );
            } else if (this.buildingView._isActivated()) {
                this.buildingView.deactivate();
                const onComplete2 = () => {
                    this.cameraManager.switchToOrthographic(onComplete);
                };
                this.cameraManager.zoomToObject(
                    this.buildingView.buildingObject,
                    onComplete2
                );
            } else {
                console.error("Unexpected status!");
            }
        }
    }
}
