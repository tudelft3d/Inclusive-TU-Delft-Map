import { InfoPane } from "./infoPane";
import { Highlighter } from "./highlighter";
import { BuildingView } from "./buildingView";
import { Vector2, Scene, Camera, Raycaster, Mesh } from "three";
import { CamerasControls } from "./camera";
import { HOVERED_COLOR } from "./constants";

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
        infoPaneElement,
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
        this.infoPane = new InfoPane(infoPaneElement, this.buildingView);
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
     * Picks the closest object at the given position.
     *
     * @param {Vector2} normalizedPosition
     */
    pickPosition(normalizedPosition) {
        const mesh = this._raycastPosition(normalizedPosition);
        this.pickMesh(mesh);
    }

    /**
     * Pick the given mesh, or resets if the mesh is null.
     * 
     * @param {Mesh | null} mesh 
     */
    pickMesh(mesh) {

        if (mesh === undefined) {
            console.error(mesh, "mesh was undefined");
        }
        else if (!mesh || !mesh.name) {
            // Unhighlight
            this.unpick();

            // Reset the building view
            if (this.buildingView) {
                this.buildingView.set_target(null);
            }

            // Reset the camera
            this.cameraManager.zoomToObject(null);
        } else {
            // Highlight the mesh
            this.pickHighlighter.highlight([mesh]);

            // Set the building view
            if (this.buildingView) {
                this.buildingView.set_target(mesh.name);
            }

            // Zoom to the mesh
            this.cameraManager.zoomToObject(mesh);

            // Show info pane with object name - InfoPane handles everything else
            this.infoPane.show(mesh.name);
        }
    }

    unpick() {
        this.pickHighlighter.unhighlight();
        this.infoPane.hide();
    }
}
