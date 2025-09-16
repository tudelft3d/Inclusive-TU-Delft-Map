/** Helper to fill the pane with arbitrary key/value pairs
 * @param {Object} data Data to display, formatted like: { name:'BK', number: 8 }
 */
export function setInfoContent(data, pane) {
    const rows = Object.entries(data)
        .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
        .join('<br>');
    pane.innerHTML = rows;
    pane.style.opacity = rows ? '1' : '0';
}