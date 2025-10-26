import { Mesh } from "three/src/Three.Core.js";

export class Highlighter {

    constructor(color) {
        this.highlighted = [];
        this.originalColors = [];
        this.color = color;
    }

    /**
     * 
     * @param {Mesh[] | Mesh} meshes 
     */
    highlight(meshes) {
        if (!Array.isArray(meshes)) meshes = [meshes];
        this.unhighlight();
        for (const mesh of meshes) {
            var originalColor;
            // To prevent the modification from applying to all objects
            if (!mesh.userData.hasOwnProperty(`GENERATED-initialColor`)) {
                // Clone the material and mark the mesh so we don't clone again later
                originalColor = mesh.material.color.getHex();
                mesh.material = mesh.material.clone();
                mesh.userData[`GENERATED-initialColor`] = originalColor;
            } else {
                originalColor = mesh.userData[`GENERATED-initialColor`];
            }

            // Save the original color
            this.originalColors.push(originalColor);

            // Set its color to highlighted color
            mesh.material.color.setHex(this.color);

            // Save the mesh
            this.highlighted.push(mesh);

        }
    }

    unhighlight() {
        for (var i = 0; i < this.highlighted.length; i++) {
            this.highlighted[i].material.color.setHex(this.originalColors[i]);
        }
        this.highlighted = [];
        this.originalColors = [];
    }

}