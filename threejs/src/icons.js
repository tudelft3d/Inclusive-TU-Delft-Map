import * as THREE from 'three';
import { CamerasControls } from './camera';

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

export class Icon {

    /**
     * 
     * @param {THREE.CanvasTexture} svgTexture 
     * @param {THREE.Vector3} worldPos 
     */
    constructor(svgTexture, worldPos) {
        const material = new THREE.SpriteMaterial({
            map: svgTexture,
            // alphaTest: 0.5,
            // blending: THREE.NoBlending,
            transparent: true,
            depthTest: false,
            depthWrite: true,
            sizeAttenuation: true,
        });

        this.sprite = new THREE.Sprite(material);
        this.basePos = worldPos;
    }

    /** Set the size in world units.
     * 
     * @param {number} size 
     */
    _setSize(size) {
        this.sprite.scale.set(size, size, 1);
        this.sprite.position.copy(this.basePos.clone().add(new THREE.Vector3(0, size / 2, 0)));
    }

    /** Set the size of the sprite based on the camera position.
     * 
     * @param {CamerasControls} cameraManager 
     */
    setSizeFromCameraManager(cameraManager) {
        const camToIcon = this.sprite.position.clone().sub(cameraManager.camera.position);
        const camDirection = new THREE.Vector3();
        cameraManager.camera.getWorldDirection(camDirection);
        var distance;
        if (cameraManager.usesMapCamera() || cameraManager.usesOrbitCamera()) {
            distance = camToIcon.dot(camDirection);
        } else if (cameraManager.usesOrthographicCamera()) {
            distance = cameraManager.orthographicDistance();

            // distance = camToIcon.dot(camDirection) / cameraManager.camera.zoom;
        }
        distance = Math.min(distance, 1000);
        this._setSize(0.07 * distance);
    }
}


export class IconsSceneManager {

    /** A class to manage a scene of icons and its specificities.
     * 
     * @param {THREE.Scene} scene 
     */
    constructor(scene) {
        this.scene = scene;
        this.icons = [];
    }

    /** Add an icon to the scene.
     * 
     * @param {Icon} icon 
     */
    addIcon(icon) {
        this.scene.add(icon.sprite);
        this.icons.push(icon);
    }

    /** Resize the icons based on the camera position.
     * To call before rendering.
     * 
     * @param {CamerasControls} cameraManager 
     */
    beforeRender(cameraManager) {
        for (const icon of this.icons) {
            icon.setSizeFromCameraManager(cameraManager);
        }
    }

}


export async function addPointerSprite(scene, svgTexture, worldPos, size, constantSize = false) {
    const material = new THREE.SpriteMaterial({
        map: svgTexture,
        // alphaTest: 0.5,
        // blending: THREE.NoBlending,
        transparent: true,
        depthTest: false,
        depthWrite: true,
        sizeAttenuation: !constantSize,
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(worldPos);

    // Optional: scale the sprite in world units (not pixels)
    sprite.scale.set(size, size, 1);

    scene.add(sprite);
    return sprite;
}