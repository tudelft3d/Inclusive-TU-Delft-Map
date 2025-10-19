import { Map } from "./app";
import { Searcher } from "./search";
import { BuildingView } from "./buildingView"
import { outline_code } from "./layers"
import { initSearchBar } from "./searchBar"

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');

    const map = new Map(container);

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
    map.loadIcon('assets/threejs/graphics/icons/home.svg');

    const buildingView = new BuildingView(map);

    map.buildingView = buildingView;

    const searcher = new Searcher();

    // The amount of time the searchbar will wait before searcing in miliseconds
    const search_delay = 250;

    // The number of results that are returned for partials searches
    const search_result_count = 5;

    // Set up compass element and rotation updates
    const compassIcon = document.querySelector('#compass-btn svg') ||
        document.querySelector('#compass-btn img') ||
        document.querySelector('#compass-btn .compass-icon');

    if (compassIcon) {
        map.cameraManager.setCompassElement(compassIcon);

        // Add controls change listener to update compass rotation
        map.cameraManager.controls.addEventListener('change', () => {
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

    function getIsOrthographic() {
        try {
            if (!map.cameraManager) return false;
            if (typeof map.cameraManager.isOrthographic === 'function') return map.cameraManager.isOrthographic();
            if (map.cameraManager.camera) {
                if ('isOrthographicCamera' in map.cameraManager.camera) return !!map.cameraManager.camera.isOrthographicCamera;
                if ('isPerspectiveCamera' in map.cameraManager.camera) return !map.cameraManager.camera.isPerspectiveCamera;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function updateViewToggleUI() {
        if (!viewToggleBtn) return;
        const isOrtho = getIsOrthographic();
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
            if (map && map.cameraManager && typeof map.cameraManager.toggleOrthographic === 'function') {
                map.cameraManager.toggleOrthographic();
            } else {
                console.warn('toggleOrthographic not available on cameraManager');
            }
            // update UI after camera change (with slight delay to allow for camera update)
            setTimeout(updateViewToggleUI, 80);
        });

        // keep UI in sync with external camera changes
        if (map && map.cameraManager && map.cameraManager.controls && typeof map.cameraManager.controls.addEventListener === 'function') {
            map.cameraManager.controls.addEventListener('change', updateViewToggleUI);
        }

        const mq = window.matchMedia('(max-width:620px)');
        mq.addEventListener?.('change', updateViewToggleUI);
        window.addEventListener('resize', updateViewToggleUI);
    }

    // Initialize search bar UI (handles intermediate results, mobile sheet, overlay)
    initSearchBar({ map, searcher, search_delay, search_result_count });

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
                outline_code(item.dataset.code, map);
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
            buildingView.initiate_buildingView();
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