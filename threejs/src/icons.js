import * as THREE from 'three';

export function svgToCanvasTexture(svgUrl, size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Load the SVG image
    const img = new Image();
    img.crossOrigin = 'anonymous';          // needed if the SVG is hosted elsewhere
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
        img.crossOrigin = 'anonymous';               // needed for remote SVGs
        img.onload = () => {
            // ---- 1️⃣ Create the canvas -------------------------------------------------
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = size;
            const ctx = canvas.getContext('2d');

            // ---- 2️⃣ Draw the white disc ------------------------------------------------
            const radius = size / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(radius, radius, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.fillStyle = bgColor;                  // white by default
            ctx.fill();
            ctx.restore();

            // ---- 3️⃣ Draw the SVG centred on the disc ---------------------------------
            // Scale the SVG to fit nicely inside the disc (e.g. 80 % of the diameter)
            const paddingFactor = 1;                // 0.9 → 90 % of canvas size
            const drawSize = size * paddingFactor;
            const offset = (size - drawSize) / 2;     // centre it

            ctx.drawImage(img, offset, offset, drawSize, drawSize);

            // ---- 4️⃣ Turn the canvas into a Three.js texture ---------------------------
            const tex = new THREE.CanvasTexture(canvas);
            tex.needsUpdate = true;
            tex.minFilter = THREE.LinearFilter;       // avoid mip‑map warnings for non‑power‑of‑2
            resolve(tex);
        };
        img.onerror = reject;
        img.src = svgUrl;
    });
}

export async function addPointerSprite(scene, svgTexture, worldPos) {
    const material = new THREE.SpriteMaterial({
        map: svgTexture,
        // alphaTest: 0.5,
        // blending: THREE.NoBlending,
        transparent: true,
        depthTest: false,
        depthWrite: true,
        // sizeAttenuation: false,
    });

    const worldScale = 50;

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(worldPos.add(new THREE.Vector3(0, worldScale / 2, 0)));   // THREE.Vector3 where you want the pointer

    // Optional: scale the sprite in world units (not pixels)
    sprite.scale.set(worldScale, worldScale, 1);

    scene.add(sprite);
    return sprite;
}