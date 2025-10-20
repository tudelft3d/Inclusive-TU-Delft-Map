import { Map } from "./app";
// import { Searcher } from "./search";
import { BuildingView } from "./buildingView"
import { outline_code, load_codelist, populate_layer_buttons } from "./layers"


document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');

    const map = new Map(container);
    populate_layer_buttons('assets/threejs/buildings/thematic_codelist.csv');

    // Make map globally accessible for debugging preloading
    window.mapInstance = map;

    // Add console utilities for monitoring preloading
    window.checkPreloadingStatus = () => {
        const stats = map.getTileCacheInfo();
        console.log('=== Tile Cache & Preloading Status ===');
        console.log(`Cache size: ${stats.size} tiles`);
        console.log(`Memory estimate: ${stats.memoryEstimate}`);
        console.log(`Is preloading: ${stats.isPreloading}`);
        console.log(`Preloaded layers: ${stats.preloadedLayers.join(', ')}`);
        console.log(`Available layers: ${stats.availableLayers.join(', ')}`);
        return stats;
    };

    // Log initial status
    console.log('🗺️ TU Delft Map initialized!');
    console.log('💡 Use checkPreloadingStatus() in console to monitor tile preloading');
    console.log('💡 Use mapInstance.getTileCacheInfo() for detailed cache info (if available)');

    map.loadGLTF('assets/threejs/buildings/geometry.glb');
    map.loadIcon();

    // Set up compass element and rotation updates
    const compassIcon = document.querySelector('#compass-btn svg') ||
        document.querySelector('#compass-btn img') ||
        document.querySelector('#compass-btn .compass-icon');

    if (compassIcon) {
        map.cameraManager.setCompassElement(compassIcon);

        // Add controls change listener to update compass rotation
        map.cameraManager.addEventListenerControls('change', () => {
            map.cameraManager.updateCompassRotation();
        });

        // Initial compass update
        map.cameraManager.updateCompassRotation();
    }

    // Zoom buttons
    const zi = document.getElementById('zoom-in-btn');
    const zo = document.getElementById('zoom-out-btn');
    if (zi) zi.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        map.cameraManager.zoomIn();
    });
    if (zo) zo.addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        map.cameraManager.zoomOut();
    });

    // 2D/3D view toggle button
    const viewToggleBtn = document.getElementById('view-toggle-btn');

    function updateViewToggleUI() {
        if (!viewToggleBtn) return;
        const isOrtho = map.cameraManager.usesOrthographicCamera();
        // when in 3D show "2D"
        const label = isOrtho ? '3D' : '2D';
        viewToggleBtn.textContent = label;
        viewToggleBtn.setAttribute('aria-pressed', (!isOrtho).toString());
        viewToggleBtn.title = `${label} view`;
        // change appearance when the button shows "2D"
        viewToggleBtn.classList.toggle('shows-2d', label === '2D');
    }

    if (viewToggleBtn) {
        updateViewToggleUI();

        viewToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            map.cameraManager.toggleOrthographic();
            // update UI after camera change (with slight delay to allow for camera update)
            setTimeout(updateViewToggleUI, 80);
        });

        // keep UI in sync with external camera changes
        map.cameraManager.addEventListenerControls('change', updateViewToggleUI);

        const mq = window.matchMedia('(max-width:620px)');
        mq.addEventListener?.('change', updateViewToggleUI);
        window.addEventListener('resize', updateViewToggleUI);
    }

    // Basemap dropdown wiring
    const basemapBtn = document.getElementById('basemap-btn');
    const basemapDropdown = document.getElementById('basemap-dropdown');
    if (basemapBtn && basemapDropdown) {
        basemapBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // ensure other top-right dropdowns are closed
            const other = document.getElementById('layers-dropdown');
            const accessibility = document.getElementById('accessibility-dropdown');
            if (other && other !== basemapDropdown) other.style.display = 'none';
            if (accessibility && accessibility !== basemapDropdown) accessibility.style.display = 'none';

            basemapDropdown.style.display = (basemapDropdown.style.display === 'block') ? 'none' : 'block';
        });

        document.addEventListener('click', () => {
            basemapDropdown.style.display = 'none';
        });

        basemapDropdown.querySelectorAll('a').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const url = item.dataset.url;
                const layer = item.dataset.layer;
                if (typeof map.setBasemap === 'function') {
                    map.setBasemap(url, layer);
                } else if (typeof map.setBaseMap === 'function') {
                    map.setBaseMap(url, layer);
                } else {
                    console.warn('No basemap setter on map', url, layer);
                }
                basemapDropdown.style.display = 'none';
            });
        });
    }

    // Layers dropdown wiring
    const layersBtn = document.getElementById('layer-btn');
    const layersDropdown = document.getElementById('layers-dropdown');
    if (layersBtn && layersDropdown) {
        layersBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // close other top-right dropdowns before toggling this one
            const other = document.getElementById('basemap-dropdown');
            const accessibility = document.getElementById('accessibility-dropdown');
            if (other && other !== layersDropdown) other.style.display = 'none';
            if (accessibility && accessibility !== layersDropdown) accessibility.style.display = 'none';

            layersDropdown.style.display = (layersDropdown.style.display === 'block') ? 'none' : 'block';
        });

        layersDropdown.querySelectorAll('a').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                outline_code(item.dataset.code, map.scene, map.picker, map.outlineManager);
                layersDropdown.style.display = 'none';
            });
        });

        document.addEventListener('click', () => {
            layersDropdown.style.display = 'none';
        });
    }

    // Accessibility dropdown wiring
    // const accessibilityBtn = document.getElementById('accessibility-btn');
    // const accessibilityDropdown = document.getElementById('accessibility-dropdown');
    // if (accessibilityBtn && accessibilityDropdown) {
    //     accessibilityBtn.addEventListener('click', (event) => {
    //         event.stopImmediatePropagation();
    //         accessibilityDropdown.style.display = (accessibilityDropdown.style.display === 'block') ? 'none' : 'block';
    //     });

    //     document.addEventListener('click', () => {
    //         accessibilityDropdown.style.display = 'none';
    //     });
    // }

    // Reset view button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.cameraManager.resetView();
        });
    }

    // Compass button
    const compassBtn = document.getElementById('compass-btn');
    if (compassBtn) {
        compassBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.cameraManager.resetNorth();
        });
    }

    // Location button
    const locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.getUserLocationAndZoom();
        });
    }

    // BV (streetview) button
    const bvBtn = document.getElementById("bv-btn");
    if (bvBtn) {
        bvBtn.addEventListener("click", () => {
            map.buildingView.initiate_buildingView();
        });
    }

    // BV storey dropdown
    const bvDropdown_button = document.getElementById("bv-storey-btn");
    const bvDropdown_dropdown = document.getElementById("bv-dropdown");
    if (bvDropdown_button && bvDropdown_dropdown) {
        bvDropdown_button.addEventListener("click", (event) => {
            event.stopPropagation();
            bvDropdown_dropdown.style.display = (bvDropdown_dropdown.style.display === 'block') ? 'none' : 'block';
        });
    }

    // LOD dropdown (kept commented for future use)
    /*
    const lodBtn = document.getElementById('lod-btn');
    const lodDropdown = document.getElementById('lod-dropdown');
    if (lodBtn && lodDropdown) {
        // ...existing LOD wiring...
    }
    */

    // Reveal search bar after wiring all handlers to prevent initial flash
    // window.addEventListener('load', () => {
    //     const searchBar = document.getElementById('search-bar');
    //     if (searchBar) searchBar.style.visibility = 'visible';
    // });
});