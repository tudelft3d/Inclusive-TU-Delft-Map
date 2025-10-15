import * as THREE from 'three';

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

export function svgToDiscTexture(svgUrl, size = 256, bgColor = '#ffffff') {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; // Needed for remote SVGs
        img.onload = () => {
            // Create the canvas
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // Draw the white disc
            const radius = size / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(radius, radius, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = bgColor;
            ctx.fill();
            ctx.restore();

            // Draw the SVG centred on the disc
            const paddingFactor = 0.8; // Scale for the SVG to fit in the disc
            const drawSize = size * paddingFactor;
            const offset = (size - drawSize) / 2;

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