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