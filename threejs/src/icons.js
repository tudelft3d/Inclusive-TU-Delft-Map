import * as THREE from 'three';
import { CamerasControls } from './camera';
import SpriteText from 'three-spritetext';

export function svgToCanvasTexture(svgUrl, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Load the SVG image
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Needed for remote SVGs
    img.src = svgUrl;

    // Return a promise that resolves once the image is ready
    return new Promise((resolve) => {
        img.onload = () => {
            // Clear background (optional – keep transparent)
            ctx.clearRect(0, 0, size, size);
            // Draw the SVG centered on the canvas
            ctx.drawImage(img, 0, 0, size, size);

            // Build a Three.js texture from the canvas
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            resolve(tex);
        };
    });
}

export function svgToDiscTexture(svgUrl, size = 256, bgColor = '#ffffff', lineWidth = 10, lineColor = '#000000') {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Needed for remote SVGs
        img.onload = () => {
            // Create the canvas
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size + lineWidth;
            const ctx = canvas.getContext('2d');

            // Draw the disc
            const radius = size / 2;
            const position = radius + lineWidth / 2
            ctx.save();
            ctx.beginPath();
            ctx.arc(position, position, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = bgColor;
            ctx.fill();

            // Draw the outline
            ctx.lineWidth = lineWidth; // Adjust thickness as needed
            ctx.strokeStyle = lineColor;
            ctx.stroke();
            ctx.restore();

            // Draw the SVG centred on the disc
            const paddingFactor = 0.8; // Scale for the SVG to fit in the disc
            const drawSize = size * paddingFactor;
            const offset = (size - drawSize) / 2 + lineWidth / 2;

            ctx.drawImage(img, offset, offset, drawSize, drawSize);

            // Turn the canvas into a three.js texture
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            tex.minFilter = THREE.LinearFilter;
            resolve(tex);
        };
        img.onerror = reject;
        img.src = svgUrl;
    });
}

export class IconSet {

    /**
     * Create a set of icons at the same position.
     * 
     * @param {THREE.CanvasTexture[]} svgTextures
     * @param {THREE.Vector3} worldPos
     */
    constructor(svgTextures, worldPos) {
        this.basePos = worldPos;

        this.sprites = [];
        svgTextures.map((svgTexture) => {
            const material = new THREE.SpriteMaterial({
                map: svgTexture,
                transparent: true,
                depthTest: true,
                depthWrite: true,
                sizeAttenuation: true,
            });

            this.sprites.push(new THREE.Sprite(material));
        })

        console.log("Loading the text...")
        this.text = new SpriteText('My text', 10, 'rgba(0, 0, 0, 1)');
        this.text.strokeColor = 'rgba(255, 255, 255, 1)';
        this.text.strokeWidth = 1
        this.text.fontFace = 'Open Sans'
        this.text.fontWeight = 600
        this.text.padding = 1
        this.text.borderWidth = 1
        this.text.borderRadius = 5
        // this.text.material.transparent = true;
        // this.text.material.depthTest = true;
        // this.text.material.depthWrite = true;
        // this.text.material.sizeAttenuation = true;
    }

    /**
     * Set the size in world units.
     * 
     * @param {number} size
     * @param {THREE.Vector3} xAxis 
     * @param {THREE.Vector3} yAxis 
     */
    _setSize(size, xAxis, yAxis) {
        const baseOffset = new THREE.Vector3(0, size / 2, 0)
        for (var i = 0; i < this.sprites.length; i++) {
            const multiplier = 1.05 * (i - (this.sprites.length - 1) / 2) * size;
            const sprite = this.sprites[i];
            sprite.scale.set(size, size, 1);
            const offset = baseOffset.clone().add(xAxis.clone().multiplyScalar(multiplier));

            sprite.position.copy(this.basePos.clone().add(offset));
        }
        const textSize = 1.0 * size;
        var textScaleX, textScaleY, textScaleZ;
        [textScaleX, textScaleY, textScaleZ] = this.text.scale;
        textScaleX *= textSize / textScaleY;
        textScaleZ *= textSize / textScaleY;
        textScaleY = textSize;
        this.text.scale.set(textScaleX, textScaleY, textScaleZ);
        this.text.position.copy(this.basePos.clone().add(yAxis.clone().multiplyScalar(size, 0)).add(baseOffset));
    }

    /**
     * Set the size in world units.
     * 
     * @param {number} size
     * @param {number} distance
     * @param {THREE.Vector3} xAxis 
     * @param {THREE.Vector3} yAxis 
     */
    _setScreenSize(screenSize, distance, xAxis, yAxis) {
        this._setSize(screenSize * distance, xAxis, yAxis);
    }

    /** 
     * Set the size of the sprite based on the camera position.
     * 
     * @param {CamerasControls} cameraManager 
     */
    setSizeFromCameraManager(cameraManager) {
        const camToIcon = this.basePos.clone().sub(cameraManager.camera.position);
        const camDirection = new THREE.Vector3();
        cameraManager.camera.getWorldDirection(camDirection);
        var distance;
        if (cameraManager.usesMapCamera() || cameraManager.usesOrbitCamera()) {
            distance = camToIcon.dot(camDirection);
        } else if (cameraManager.usesOrthographicCamera()) {
            distance = cameraManager.orthographicDistance();
        }
        const thresholdDistance = 1000;
        var screenSize;
        if (distance < thresholdDistance) {
            screenSize = 0.05;
        } else {
            screenSize = 0.05 * thresholdDistance / distance
        }
        const xAxisWorld = new THREE.Vector3(1, 0, 0).applyQuaternion(cameraManager.camera.quaternion);
        const yAxisWorld = new THREE.Vector3(0, 1, 0).applyQuaternion(cameraManager.camera.quaternion);

        this._setScreenSize(screenSize, distance, xAxisWorld, yAxisWorld);
    }
}


export class IconsSceneManager {

    /** A class to manage a scene of icons and its specificities.
     * 
     * @param {THREE.Scene} scene 
     */
    constructor(scene) {
        this.scene = scene;
        this.iconSets = [];
    }

    /** Add an icon to the scene.
     * 
     * @param {IconSet} icon
     */
    addIcon(iconSet) {
        for (const sprite of iconSet.sprites) {
            this.scene.add(sprite);
        }
        this.iconSets.push(iconSet);
        this.scene.add(iconSet.text);
    }

    /** Resize the icons based on the camera position.
     * To call before rendering.
     * 
     * @param {CamerasControls} cameraManager 
     */
    beforeRender(cameraManager) {
        for (const icon of this.iconSets) {
            icon.setSizeFromCameraManager(cameraManager);
        }
    }

}


// export async function addPointerSprite(scene, svgTexture, worldPos, size, constantSize = false) {
//     const material = new THREE.SpriteMaterial({
//         map: svgTexture,
//         // alphaTest: 0.5,
//         // blending: THREE.NoBlending,
//         transparent: true,
//         depthTest: false,
//         depthWrite: true,
//         sizeAttenuation: !constantSize,
//     });

//     const sprite = new THREE.Sprite(material);
//     sprite.position.copy(worldPos);

//     // Optional: scale the sprite in world units (not pixels)
//     sprite.scale.set(size, size, 1);

//     scene.add(sprite);
//     return sprite;
// }