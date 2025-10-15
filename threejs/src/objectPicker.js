import * as THREE from 'three';
import { setInfoContent } from "./infoPane";
import { hoveredColor, pickedColor } from "./constants";

export class ObjectPicker {

    constructor(infoPane) {
        this.raycaster = new THREE.Raycaster();
        // this.hovered = null;
        // this.hoveredColor = null;
        this.picked = null;
        this.pickedColor = null;

        this.infoPane = infoPane;
    }

    // hover(normalizedPosition, scene, camera) {
    //     // Restore the color if there is a hovered object
    //     if (this.hovered) {
    //         this.hovered.material.emissive.setHex(this.hoveredColor);
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
    //             this.hovered.material.emissive.setHex(pickedColor)
    //         } else {
    //             this.hoveredColor = mesh.material.emissive.getHex();
    //         }

    //         // Set its emissive color to red
    //         mesh.material.emissive.setHex(hoveredColor);

    //         this.hovered = mesh;
    //     }
    // }
    /**
     * Picks the closest object at the given position.
     * Returns a boolean stating if an object was found.
     * @param {THREE.Vector2} normalizedPosition 
     * @param {THREE.Scene} scene 
     * @returns true if an object was found, else false.
     */
    pick(normalizedPosition, scene, camera) {
        // Restore the color if there was a picked object
        if (this.picked) {
            this.picked.material.emissive.setHex(this.pickedColor);
            this.picked = null;
            this.pickedColor = null;
            setInfoContent({}, this.infoPane);
        }

        // Cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);
        // Get the list of objects the ray intersected
        const hits = this.raycaster.intersectObjects(scene.children);

        // No hit
        if (!hits.length) { return false; }

        // Pick the first object. It's the closest one

        var object_count = hits.length;

        let mesh;

        for (var i = 0; i < object_count; i++) {

            if (hits[i].object.visible) {
                mesh = hits[i].object;
                break;
            }
        }

        // const mesh = hits[0].object;

        // To skip the background
        if (!mesh.name) { return false; }

        // To prevent the modification from applying to all objects
        if (!mesh.userData.hasOwnProperty('materialCloned')) {
            // Clone the material and mark the mesh so we don’t clone again later
            mesh.material = mesh.material.clone();
            mesh.userData.materialCloned = true;
        }
        // Save its color
        this.pickedColor = mesh.material.emissive.getHex();

        // Set its emissive color to red
        mesh.material.emissive.setHex(pickedColor);

        const info = {
            Name: mesh.name || 'unnamed',
            Type: mesh.geometry?.type || 'unknown',
        };
        setInfoContent(info, this.infoPane);

        this.picked = mesh;
        return true;
    }
}
