import * as THREE from 'three';
import { hoveredColor, pickedColor } from "./constants";
import { InfoPane } from "./infoPane";

export class ObjectPicker {

    // constructor(infoPaneElement, buildingView = null) {
    //     this.raycaster = new THREE.Raycaster();
    //     this.picked = null;
    //     this.pickedColor = null;

    //     // Create InfoPane instance from the DOM element
    //     this.infoPane = new InfoPane(infoPaneElement, buildingView);
    // }

    constructor(infoPaneElement, buildingView = null) {
        this.raycaster = new THREE.Raycaster();
        this.picked = [];
        this.pickedColor = [];
        this.isObject = false;

        // Create InfoPane instance from the DOM element
        this.infoPane = new InfoPane(infoPaneElement, buildingView);
    }

    // hover(normalizedPosition, scene, camera) {
    //     // Restore the color if there is a hovered object
    //     if (this.hovered) {
    //         this.hovered.material.color.setHex(this.hoveredColor);
    //         this.hoveredColor = null;
    //         this.hovered = null;
    //     }

    //     // Cast a ray through the frustum
    //     this.raycaster.setFromCamera(normalizedPosition, camera);
    //     // Get the list of objects the ray intersected
    //     const intersected = this.raycaster.intersectObjects(scene.children);
    //     if (intersected.length) {
    //         // pick the first object. It's the closest one
    //         const mesh = intersected[0].object;
    //         if (mesh == this.picked) {
    //             return;
    //         }

    //         // To skip the background
    //         if (!mesh.name) { return }

    //         // To prevent the modification from applyting to all objects
    //         if (!mesh.userData.hasOwnProperty('materialCloned')) {
    //             // Clone the material and mark the mesh so we don’t clone again later
    //             mesh.material = mesh.material.clone();
    //             mesh.userData.materialCloned = true;
    //         }

    //         // Save its color
    //         if (this.hovered == mesh && this.hovered == this.picked) {
    //             this.hovered.material.color.setHex(pickedColor)
    //         } else {
    //             this.hoveredColor = mesh.material.color.getHex();
    //         }

    //         // Set its color color to red
    //         mesh.material.color.setHex(hoveredColor);

    //         this.hovered = mesh;
    //     }
    // }

    /**
     * Picks the closest object at the given position.
     * Returns a boolean stating if an object was found.
     * @param {THREE.Vector2} normalizedPosition
     * @param {THREE.Scene} scene
     * @param {THREE.Camera} camera
     * @returns true if an object was found, else false.
     */
    pick(normalizedPosition, scene, camera) {
        // Restore the color if there was a picked object
        if (this.picked.length > 0) {
            this.infoPane.hide(); // Clean separation - InfoPane handles hiding
        }
        this.isObject = false;
        this.unhighlight();

        // Cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);
        // Get the list of objects the ray intersected
        const hits = this.raycaster.intersectObjects(scene.children);

        // No hit
        if (!hits.length) { return false; }

        // Pick the first visible object
        let mesh = null;
        for (let i = 0; i < hits.length; i++) {
            if (hits[i].object.visible) {
                mesh = hits[i].object;
                break;
            }
        }

        // No visible object found
        if (!mesh) { return false; }

        if (!mesh.name) { return false; }
        this.isObject = true;
        this.highlight([mesh]);

        return true;
    }

    highlight(meshes) {
        if (!Array.isArray(meshes)) meshes = [meshes];
        if (!this.picked.length) {
            this.unhighlight();
        }
        for (const mesh of meshes) {
            // To prevent the modification from applying to all objects
            if (!mesh.userData.hasOwnProperty('materialCloned')) {
                // Clone the material and mark the mesh so we don't clone again later
                mesh.material = mesh.material.clone();
                mesh.userData.materialCloned = true;
            }

            this.pickedColor.push(mesh.material.color.getHex());

            // Set its color to picked color
            mesh.material.color.setHex(pickedColor);

            this.picked.push(mesh);
        }
        // Show info pane with object name - InfoPane handles everything else
        if (meshes.length === 1) this.infoPane.show(meshes[0].name);
    }
    unhighlight() {
        if (!this.picked) return;
        for (var i = 0; i < this.picked.length; i++) {
            this.picked[i].material.color.setHex(this.pickedColor[i]);
        }
        this.picked = [];
        this.pickedColor = [];
    }
}