import * as THREE from 'three';
/**
 * Convert a mouse/touch event to normalized device coordinates (-1…+1).
 * Returns { x, y } ready for Raycaster.setFromCamera().
 */
export function getCanvasRelativePosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * canvas.width) / rect.width;
    const y = ((event.clientY - rect.top) * canvas.height) / rect.height;
    return {
        x: (x / canvas.width) * 2 - 1,
        y: -(y / canvas.height) * 2 + 1,
    };
}

export function lodVis(scene, lod = 'lod_2') {
    scene.traverse((child) => {
        child.visible = false;
        if (child.isMesh) {
            child.material.side = THREE.DoubleSide;
        }
        if (child.name.includes(lod)) {
            child.visible = true;
            var vis = child.parent;
            while (vis) {
                vis.visible = true;
                vis = vis.parent;
                if (vis.type == 'Group') {
                    vis.visible = true;
                    break;
                }
            }
        }
    });
}

export function cj2gltf(name){
    return name.replace(/[.:/]/g, '');
}