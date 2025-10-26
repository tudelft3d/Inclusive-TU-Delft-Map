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
        this.infoPane = new InfoPane(document.getElementById("info-pane"), this.buildingView);
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
    pickScreenPosition(normalizedPosition) {
        const mesh = this._raycastPosition(normalizedPosition);
        if (!mesh || !mesh.name) {
            this.unpick();
        }
        else {
            this.pickMesh(mesh);
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
     * @param {Mesh | null} mesh 
     */
    pickMesh(mesh) {
        if (!Array.isArray(mesh)) mesh = [mesh];
        if (mesh.length == 0) {
            console.error(mesh, "No mesh was sent into pickMesh");
            return;
        }
        if (mesh.length == 1) {
            mesh = mesh[0];
            if (!mesh || !mesh.name) {
                // Unhighlight
                this.unpick();

                // Reset the building view
                if (this.buildingView) {
                    this.buildingView.set_target(null);
                }

                // Reset the camera
                this.cameraManager.zoomToObject(null);
            }
            else {
                // Highlight the mesh
                this.pickHighlighter.highlight([mesh]);
                const json = cityjson["CityObjects"][mesh.name.slice(0, -6)];

                // Set the building view
                if (this.buildingView && json.type === "Building") {
                    this.buildingView.set_target(mesh.name);
                }
                else if (this.buildingView && json.type === "BuildingRoom") {
                    const parentBuilding = this.findParentBuilding(json);
                    this.buildingView.initiate_buildingView(mesh.name.slice(-12, -10), false);


                }
                this.cameraManager.zoomToObject(mesh);
                console.log('zooming to: ', mesh);
                // Show info pane with object name - InfoPane handles everything else
                this.infoPane.show(mesh.name);
            }
        }
        // case of multiple building units - set building view to parent building
        else {
            // Highlight the meshes
            // console.log(mesh);
            this.pickHighlighter.highlight(mesh);

            const first_mesh = mesh[0];
            const first_json = cityjson["CityObjects"][first_mesh.name.slice(0, -6)];
            parentMesh = this.findParentBuilding(first_json);

            // Set the building view
            if (this.buildingView) { // is this needed? @Alex

                if (first_json.type == "BuildingRoom") {
                    let allFloors = {};
                    mesh.forEach(room => {
                        const floor = room.name.slice(-12, -10);
                        allFloors[floor] = (allFloors[floor] || 0) + 1;
                    });

                    let mostCommonFloor = null;
                    let maxCount = 0;
                    for (const [floor, count] of Object.entries(allFloors)) {
                        if (count > maxCount) {
                            mostCommonFloor = floor;
                            maxCount = count;
                        }
                    }
                    this.buildingView.initiate_buildingView(mostCommonFloor, false);
                }
                this.cameraManager.zoomToObject(parentMesh);


                // Show info pane with object name - InfoPane handles everything else
                // This needs to be outside of this function, and called when the input is known to be Building/Unit/Room. pickMesh does not know the context.
                this.infoPane.show(parentKey);
            }
        }
    }

    findParentBuilding(json) {
        let parentKey = json.parents[0];
        let parent = cityjson["CityObjects"][parentKey];
        while (parent.type != "Building") {
            parentKey = parent.parents[0];
            parent = cityjson["CityObjects"][parentKey];
        }
        let meshKey = parentKey + '-lod_2';
        this.buildingView.set_target(meshKey);
        var parentMesh = this.scene.getObjectByName(meshKey);
        return parentMesh;
    }

    unpick() {
        // Unhighlight
        this.pickHighlighter.unhighlight();

        // Reset the building view
        if (this.buildingView) {
            this.buildingView.set_target(null);
        }

        // Reset the camera
        this.cameraManager.zoomToObject(null);

        // Hide the info pane
        this.infoPane.hide();
    }
}
