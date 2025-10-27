import { Map } from "./app";

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
    function updateViewToggleUI(overrideIsOrtho) {
        if (!viewToggleBtn) return;
        const cm = map.cameraManager;

        let isOrtho;
        if (typeof overrideIsOrtho === 'boolean') {
            isOrtho = overrideIsOrtho;
        } else {
            isOrtho = !!(cm && typeof cm.usesOrthographicCamera === 'function' && cm.usesOrthographicCamera());
        }

        const label = isOrtho ? '3D' : '2D';
        viewToggleBtn.textContent = label;
        viewToggleBtn.setAttribute('aria-pressed', (!isOrtho).toString());
        viewToggleBtn.title = `${label} view`;
        viewToggleBtn.classList.toggle('shows-2d', label === '2D');
    }

    // New: toggle helper updates the UI, triggers the camera toggle,
    // and re-syncs after the animation completes (fallback timeout).
    function toggleViewAndUpdateButton(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }

        const cm = map.cameraManager;
        const currentlyOrtho = !!(cm && typeof cm.usesOrthographicCamera === 'function' && cm.usesOrthographicCamera());
        const predictedIsOrtho = !currentlyOrtho;

        // update UI so button doesn't lag
        updateViewToggleUI(predictedIsOrtho);

        // trigger the camera transition
        if (cm && typeof cm.toggleOrthographic === 'function') {
            cm.toggleOrthographic();
        } else {
            console.warn('cameraManager.toggleOrthographic is not available');
        }

        // ensure final sync after transition (animation in camera.js uses ~1000ms)
        setTimeout(() => updateViewToggleUI(), 1100);
    }

    if (viewToggleBtn) {
        updateViewToggleUI();

        viewToggleBtn.addEventListener('click', toggleViewAndUpdateButton);
 
         // keep UI in sync with external camera changes
         map.cameraManager.addEventListenerControls('change', () => updateViewToggleUI());
 
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
                const isSatellite = (
                    (item.dataset.satellite === 'true') ||
                    (layer && layer.toString().toLowerCase().includes('satellite')) ||
                    (url && url.toString().toLowerCase().includes('satellite')) ||
                    (layer && layer.toString().toLowerCase().includes('ortho')) ||
                    (url && url.toString().toLowerCase().includes('ortho'))
                );
                document.documentElement.classList.toggle('satellite-basemap', !!isSatellite);

                basemapDropdown.style.display = 'none';
            });
        });

        // Apply satellite class on initial load:
        (function applyInitialBasemapClass() {
            const selected = basemapDropdown.querySelector('a.selected, a[aria-selected="true"], a[data-selected="true"]') || basemapDropdown.querySelector('a');
            if (!selected) return;
            const url = selected.dataset.url;
            const layer = selected.dataset.layer;
            const isSatellite = (
                (selected.dataset.satellite === 'true') ||
                (layer && layer.toString().toLowerCase().includes('satellite')) ||
                (url && url.toString().toLowerCase().includes('satellite')) ||
                (layer && layer.toString().toLowerCase().includes('ortho')) ||
                (url && url.toString().toLowerCase().includes('ortho'))
            );
            document.documentElement.classList.toggle('satellite-basemap', !!isSatellite);
        })();

//         (function applyInitialBasemapClass() {
//             const selected = basemapDropdown.querySelector('a.selected, a[aria-selected="true"], a[data-selected="true"]');
//             if (!selected) return;
//             const url = selected.dataset.url;
//             const layer = selected.dataset.layer;
//             const isSatellite = (
//                 (selected.dataset.satellite === 'true') ||
//                 (layer && layer.toString().toLowerCase().includes('satellite')) ||
//                 (url && url.toString().toLowerCase().includes('satellite')) ||
//                 (layer && layer.toString().toLowerCase().includes('ortho')) ||
//                 (url && url.toString().toLowerCase().includes('ortho'))
//             );
//             document.documentElement.classList.toggle('satellite-basemap', !!isSatellite);
//         })();

    }

    // Layers dropdown wiring
    const layersBtn = document.getElementById('layers-btn');
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

        // layersDropdown.querySelectorAll('a').forEach(item => {
        //     item.addEventListener('click', (e) => {
        //         e.preventDefault();
        //         outline_code(item.dataset.code, map.scene, map.picker, map.outlineManager);
        //         layersDropdown.style.display = 'none';
        //     });
        // });

        // document.addEventListener('click', () => {
        //     layersDropdown.style.display = 'none';
        // });
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
    var movedSinceLastBtnPush = true;
    if (locationBtn) {
        locationBtn.addEventListener('click', (event) => {
            console.log("Pressed button")
            console.log(movedSinceLastBtnPush);
            event.stopPropagation();
            if (!map.locationManager.initialised) {
                map.locationManager.initialise(true, () => {
                    movedSinceLastBtnPush = false;
                });
            } else if (movedSinceLastBtnPush || map.locationManager.hidden) {
                map.locationManager.unhide();
                map.locationManager.moveToLocation(false, () => {
                    movedSinceLastBtnPush = false;
                });
            } else {
                map.locationManager.hide();
            }
            movedSinceLastBtnPush = false;
            console.log(movedSinceLastBtnPush);
        });
        map.cameraManager.addEventListenerControls("change", (e) => {
            movedSinceLastBtnPush = true;
        })
    }

    // BV (streetview) button
    const bvBtn = document.getElementById("bv-btn");
    if (bvBtn) {
        bvBtn.addEventListener("click", () => {
            map.buildingView.initialiseBuildingView();
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