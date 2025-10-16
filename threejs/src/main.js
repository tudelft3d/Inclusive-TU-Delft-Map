import { Map } from "./app";
import { Searcher } from "./search";
import { BuildingView } from "./buildingView"
import { outline_code } from "./layers"
import { initSearchBar } from "./searchbar"

document.addEventListener('DOMContentLoaded', () => {
    // Root DOM container for the 3D scene / map
    const container = document.querySelector('#scene-container');

    // Instantiate the app-level Map and load assets
    const map = new Map(container);
    map.loadGLTF('assets/threejs/buildings/geometry.glb');
    map.loadIcon('assets/threejs/graphics/icons/home.svg');

    // Utility view that manages building-specific UI/behavior
    const buildingView = new BuildingView(map);
    map.buildingView = buildingView;

    // Search backend used by the UI
    const searcher = new Searcher();

    // Search UI tuning
    const search_delay = 250;         // milliseconds debounce before searching
    const search_result_count = 5;    // max intermediate results to show

    // Compass setup: find an element inside the compass button to rotate
    const compassIcon = document.querySelector('#compass-btn svg') ||
        document.querySelector('#compass-btn img') ||
        document.querySelector('#compass-btn .compass-icon');

    if (compassIcon) {
        // Let cameraManager rotate the found icon as the view changes
        map.cameraManager.setCompassElement(compassIcon);
        map.cameraManager.controls.addEventListener('change', () => {
            map.cameraManager.updateCompassRotation();
        });
        map.cameraManager.updateCompassRotation(); // initial update
    }

    // Zoom controls: wired to camera manager
    document.getElementById('zoom-in-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        map.cameraManager.zoomIn();
    });

    document.getElementById('zoom-out-btn').addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault();
        map.cameraManager.zoomOut();
    });

    // Toggle between 2D / 3D (orthographic/perspective)
    document.getElementById('view-toggle-btn').addEventListener('click', () => {
        map.cameraManager.toggleOrthographic();
    });

    // Initialize the search bar UI (handlers live in searchbar.js)
    initSearchBar({ map, searcher, search_delay, search_result_count });

    // Compass button: reset north orientation
    const compassBtn = document.getElementById('compass-btn');
    if (compassBtn) {
        compassBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.cameraManager.resetNorth();
        });
    }

    // Location button: ask for user location and zoom to it
    const locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.getUserLocationAndZoom();
        });
    }

    // BV (streetview / building view) button: enter building view
    const bvBtn = document.getElementById("bv-btn");
    bvBtn.addEventListener("click", (event) => {
        buildingView.initiate_buildingView();
    });

    // BV storey dropdown: simplest toggle behavior
    const bvDropdown_button = document.getElementById("bv-storey-btn");
    const bvDropdown_dropdown = document.getElementById("bv-dropdown");

    bvDropdown_button.addEventListener("click", (event) => {
        event.stopPropagation();
        // toggle display state
        if (bvDropdown_dropdown.style.display === 'none' || bvDropdown_dropdown.style.display === '') {
            bvDropdown_dropdown.style.display = 'block';
        } else {
            bvDropdown_dropdown.style.display = 'none';
        }
    });

    // TOP-RIGHT DROPDOWNS: utilities to open/close and wire option clicks
    function closeAllDropdowns() {
        // hide any dropdown that is a direct child div of top-right container
        document.querySelectorAll('#top-right-sidebar-controls > div > div').forEach(dd => {
            if (dd && dd.style) dd.style.display = 'none';
        });
    }

    // Generic helper: wire a button to its dropdown and handle option selection
    function wireDropdown(buttonId, dropdownId, onOptionClick) {
        const btn = document.getElementById(buttonId);
        const dd = document.getElementById(dropdownId);
        if (!btn || !dd) return;

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            // toggle this dropdown while closing others
            const isOpen = dd.style.display === 'block';
            closeAllDropdowns();
            dd.style.display = isOpen ? 'none' : 'block';
        });

        // Attach click handlers to each anchor inside the dropdown
        dd.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', (evt) => {
                evt.preventDefault();
                evt.stopPropagation();
                const url = a.dataset.url;
                const layer = a.dataset.layer;
                if (typeof onOptionClick === 'function') {
                    onOptionClick({ url, layer, anchor: a });
                }
                // close the dropdown after selection
                dd.style.display = 'none';
            });
        });
    }

    // Basemap dropdown: attempt to call a Map API to change the basemap
    wireDropdown('basemap-btn', 'basemap-dropdown', ({ url, layer }) => {
        if (url) {
            // try common setter names; replace with your actual API if different
            if (typeof map.setBaseMap === 'function') {
                map.setBaseMap(url, layer);
            } else if (typeof map.setBasemap === 'function') {
                map.setBasemap(url, layer);
            } else {
                console.warn('No basemap setter found on map. Selected:', url, layer);
            }
        }
    });

    // Layers dropdown: call the provided outline_code or log selection
    wireDropdown('layers-btn', 'layers-dropdown', ({ anchor }) => {
        const code = anchor.dataset.code;
        if (code && typeof outline_code === 'function') {
            outline_code(code);
        } else {
            console.log('layer selected', code);
        }
    });

    // Accessibility dropdown: placeholder handler to implement color-mode toggles
    wireDropdown('accessibility-btn', 'accessibility-dropdown', ({ anchor }) => {
        const mode = anchor.textContent && anchor.textContent.trim();
        console.log('accessibility option', mode);
        // Implement accessibility mode toggles here (contrast, color-blind modes, etc.)
    });

    // Close open dropdowns when clicking anywhere else on the document
    document.addEventListener('click', () => {
        closeAllDropdowns();
    });

    // LOD dropdown: commented-out code kept for future use
    /*
    const lodBtn = document.getElementById('lod-btn');
    const lodDropdown = document.getElementById('lod-dropdown');

    if (lodBtn && lodDropdown) {
        lodBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            if (lodDropdown.style.display === 'none' || lodDropdown.style.display === '') {
                lodDropdown.style.display = 'block';
            } else {
                lodDropdown.style.display = 'none';
            }
        });

        document.addEventListener('click', () => {
            lodDropdown.style.display = 'none';

            if (lod === 'lod_0') {
                console.log('lod0');
                map.setOutline('BuildingRoom','lod_0');
            }
        });

        lodDropdown.querySelectorAll('a').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const lod = item.dataset.lod;                const lod = item.dataset.lod;
                map.lodVis(lod);
                lodDropdown.style.display = 'none';
            });
        });
    }
    */
});