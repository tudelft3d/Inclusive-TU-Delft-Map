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
        // event.stopPropagation();
        // event.preventDefault();
        map.cameraManager.zoomIn();
    });
    if (zo) zo.addEventListener('click', (event) => {
        // event.stopPropagation();
        // event.preventDefault();
        map.cameraManager.zoomOut();
    });

    // 2D/3D view toggle button
    const viewToggleBtn = document.getElementById('view-toggle-btn');
    if (viewToggleBtn) {
        function updateViewToggleUI() {
            if (!viewToggleBtn) return;

            const cameraManager = map.cameraManager;
            const isOrtho = cameraManager.usesOrthographicCamera();
            const label = isOrtho ? '3D' : '2D';
            viewToggleBtn.textContent = label;
            viewToggleBtn.setAttribute('aria-pressed', (!isOrtho).toString());
            viewToggleBtn.title = `${label} view`;
            viewToggleBtn.classList.toggle('shows-2d', label === '2D');
        }

        function toggleView(e) {
            const picker = map.picker;
            if (!picker) return;
            picker.switch2D3D();
        }

        updateViewToggleUI();

        viewToggleBtn.addEventListener('click', e => { toggleView(e) });
        const cameraManager = map.cameraManager;
        cameraManager.createEventCameraSwitch("cameraswitch", viewToggleBtn);
        viewToggleBtn.addEventListener("cameraswitch", e => updateViewToggleUI());
    }

    // Basemap dropdown wiring
    const basemapBtn = document.getElementById('basemap-btn');
    const basemapDropdown = document.getElementById('basemap-dropdown');
    if (basemapBtn && basemapDropdown) {
        basemapBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // ensure other top-right dropdowns are closed
            const other = document.getElementById('layers-dropdown');
            const legend = document.getElementById('legend-dropdown');
            const accessibility = document.getElementById('accessibility-dropdown');

            if (other && other !== basemapDropdown) other.style.display = 'none';

            if (legend && legend !== basemapDropdown) {
                legend.style.display = 'none';
                const legendBtnEl = document.getElementById('legend-btn');
                if (legendBtnEl) legendBtnEl.setAttribute('aria-expanded', 'false');
                legend.setAttribute('aria-hidden', 'true');
            }

            if (accessibility && accessibility !== basemapDropdown) accessibility.style.display = 'none';

            const open = basemapDropdown.style.display === 'block';
            basemapDropdown.style.display = open ? 'none' : 'block';
            basemapBtn.setAttribute('aria-expanded', (!open).toString());
            basemapDropdown.setAttribute('aria-hidden', open ? 'true' : 'false');
        });

        document.addEventListener('click', () => {
            basemapDropdown.style.display = 'none';
            basemapBtn.setAttribute('aria-expanded', 'false');
            basemapDropdown.setAttribute('aria-hidden', 'true');
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
    }

    // Legend dropdown wiring (matches other top-right controls)
    const legendBtn = document.getElementById('legend-btn');
    const legendDropdown = document.getElementById('legend-dropdown');
    if (legendBtn && legendDropdown) {
        legendBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            // close other top-right dropdowns before toggling this one
            const other = document.getElementById('basemap-dropdown');
            const layers = document.getElementById('layers-dropdown');
            const accessibility = document.getElementById('accessibility-dropdown');
            if (other && other !== legendDropdown) other.style.display = 'none';
            if (layers && layers !== legendDropdown) layers.style.display = 'none';
            if (accessibility && accessibility !== legendDropdown) accessibility.style.display = 'none';

            const open = legendDropdown.style.display === 'block';
            legendDropdown.style.display = open ? 'none' : 'block';
            legendBtn.setAttribute('aria-expanded', (!open).toString());
            legendDropdown.setAttribute('aria-hidden', open ? 'true' : 'false');
        });

        // clicking elsewhere closes the legend
        document.addEventListener('click', () => {
            legendDropdown.style.display = 'none';
            legendBtn.setAttribute('aria-expanded', 'false');
            legendDropdown.setAttribute('aria-hidden', 'true');
        });
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
    }

    // Unified mobile bottom-sheet wiring for top-right controls
    (function unifyTopRightMobileDropdowns() {
        const MOBILE_QUERY = '(max-width: 620px)';

        function ensureOverlay(id) {
            let o = document.getElementById(id);
            if (!o) {
                o = document.createElement('div');
                o.id = id;
                document.body.appendChild(o);
            }
            return o;
        }

        const items = [
            { btn: document.getElementById('basemap-btn'), dropdown: document.getElementById('basemap-dropdown'), overlayId: 'basemap-overlay', bodyClass: 'basemap-active-mobile' },
            { btn: document.getElementById('legend-btn'), dropdown: document.getElementById('legend-dropdown'), overlayId: 'legend-overlay', bodyClass: 'legend-active-mobile' },
            { btn: document.getElementById('layers-btn'), dropdown: document.getElementById('layers-dropdown'), overlayId: 'layers-overlay', bodyClass: 'layers-active-mobile' },
        ].filter(i => i.btn && i.dropdown);

        function closeAllMobile() {
            items.forEach(i => {
                i.dropdown.classList.remove('mobile-open');
                i.dropdown.style.removeProperty('display'); // let CSS decide if mobile
                const ov = document.getElementById(i.overlayId);
                if (ov) ov.classList.remove('visible');
                document.body.classList.remove(i.bodyClass);
            });
        }

        items.forEach(i => {
            const overlay = ensureOverlay(i.overlayId);
            overlay.classList.add('topright-overlay'); // optional hook if you want custom styles

            function isMobile() {
                return window.matchMedia(MOBILE_QUERY).matches;
            }

            function openMobile() {
                // close others first
                items.forEach(other => {
                    if (other !== i) {
                        other.dropdown.classList.remove('mobile-open');
                        const ov2 = document.getElementById(other.overlayId);
                        if (ov2) ov2.classList.remove('visible');
                        document.body.classList.remove(other.bodyClass);
                    }
                });
                // ensure CSS mobile sheet is visible (mobile CSS controls animation)
                i.dropdown.style.display = ''; // remove inline hide
                i.dropdown.classList.add('mobile-open');
                overlay.classList.add('visible');
                document.body.classList.add(i.bodyClass);
            }

            function closeMobile() {
                i.dropdown.classList.remove('mobile-open');
                overlay.classList.remove('visible');
                document.body.classList.remove(i.bodyClass);
            }

            i.btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!isMobile()) {
                    // Desktop/default behavior left untouched
                    // Let existing click handlers do their job (some already wired above)
                    return;
                }
                // Mobile toggling
                if (i.dropdown.classList.contains('mobile-open')) {
                    closeMobile();
                } else {
                    openMobile();
                }
            });

            // clicking overlay closes the sheet
            overlay.addEventListener('click', (ev) => {
                ev.stopPropagation();
                closeMobile();
            });
        });

        // global handlers: escape to close, resize to reset
        document.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') closeAllMobile();
        });
        window.addEventListener('resize', () => {
            // if exiting mobile size, ensure we close mobile-only UI
            if (!window.matchMedia(MOBILE_QUERY).matches) {
                closeAllMobile();
            }
        });
    })();

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

});