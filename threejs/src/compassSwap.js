// Swap compass SVG depending on whether the page has the `satellite-basemap`.

const COMPASS_WHITE = 'assets/threejs/graphics/icons/ui-buttons/compass_white.svg';
const COMPASS_DARK = 'assets/threejs/graphics/icons/ui-buttons/compass_black.svg';

/**
 * Fetch the compass html img object
 */
function getCompassImg() {
    return document.querySelector('#compass-btn img');
}

/**
 * Update the img source depending on the current basemap mode
 */
function updateCompassSrc() {
    const img = getCompassImg();
    if (!img) return;
    const isSat = document.documentElement.classList.contains('satellite-basemap') || document.body.classList.contains('satellite-basemap');
    img.src = isSat ? COMPASS_DARK : COMPASS_WHITE;
}

/**
 * Initiate the swap
 */
function startCompassSwap() {
    updateCompassSrc();

    // Observe class changes on <html> and <body>
    const observerCallback = () => updateCompassSrc();
    const observer = new MutationObserver(observerCallback);
    const observeTarget = document.documentElement;
    observer.observe(observeTarget, { attributes: true, attributeFilter: ['class'] });

    if (document.body) {
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } else {
        // if body not yet present, wait for DOMContentLoaded then observe
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
            updateCompassSrc();
        }, { once: true });
    }

    // respond to dynamic replacement of the button (re-run on click of basemap menu)
    document.addEventListener('click', () => {
        requestAnimationFrame(updateCompassSrc);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startCompassSwap, { once: true });
} else {
    startCompassSwap();
}