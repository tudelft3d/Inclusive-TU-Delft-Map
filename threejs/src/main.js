import { Map } from "./app";
import { Searcher } from "./search";
import { BuildingView } from "./buildingView"

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');

    const map = new Map(container);

    // map.loadGLTF('assets/campus/geom/model.glb');
    // map.loadGLTF('assets/campus/geom/geometry.glb');
    map.loadGLTF('assets/threejs/buildings/geometry.glb');

    const buildingView = new BuildingView(map);

    map.buildingView = buildingView;

    const searcher = new Searcher();

    // The amount of time the searchbar will wait before searcing in miliseconds
    const search_delay = 250;

    // The number of results that are returned for partials searches
    const search_result_count = 5;

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

    document.getElementById('view-toggle-btn').addEventListener('click', () => {
        map.cameraManager.toggle_orthographic();
    });

    const searchBar = document.getElementById('search');
    const intermediateResults = document.getElementById("intermediate_results");

    // general idea of "debouncing" from: https://dev.to/rowsanali/how-to-implement-a-search-functionality-using-javascript-1n1b

    let timeout;

    function debounce(func, wait) {

        return function(...args) {

            window.clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }


    // Since we are adding html elements, we could in theory add entire subviews to the
    // intermediate results, like a little picture of the result or other data.
    function show_intermediate_results(search_results) {

        var ul = document.createElement("ul");

        intermediateResults.innerHTML = '';

        search_results = search_results.map((element) => {return element.item.attributes["key"]});

        for (let i=0; i<search_results.length; i++) {

            var li = document.createElement("li");
            li.appendChild(document.createTextNode(search_results[i]));

            li.addEventListener("click", (event) => {

                searcher.search_and_zoom(search_results[i], map);

            });

            //Example of how to engage with the intermediate result:
            // li.addEventListener("mouseover", (event) => {
            //     console.log("yeah that works");
            // });

            ul.appendChild(li);

        }

        intermediateResults.appendChild(ul);
    }



    searchBar.addEventListener('keyup', (event) => {

        let value = event.target.value;

        if (!value || value.trim().length <= 0){
                return;
        }

        // If the key being released is enter, the user wants to search
        // If the key being released is not enter, we show intermediate results
        if (event.key === "Enter") {

            searcher.search_and_zoom(value, map);

        } else {

            const debouncedSearch = debounce(() => {
                const results = searcher.search_n_best_matches(value, search_result_count);
                show_intermediate_results(results);
            }, search_delay);

            debouncedSearch();

        }

    });

    // These two make sure the suggestions are hidden,
    // but they also cause the suggestions to disappear before they can be clicked
    searchBar.addEventListener("focusout", (event) => {
        //intermediateResults.style.visibility = 'hidden';
    });

    searchBar.addEventListener("focusin", (event) => {
        //intermediateResults.style.visibility = 'visible';
    });

    const basemapBtn = document.getElementById('basemap-btn');
    const basemapDropdown = document.getElementById('basemap-dropdown');

    basemapBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (basemapDropdown.style.display === 'none' || basemapDropdown.style.display === '') {
            basemapDropdown.style.display = 'block';
        } else {
            basemapDropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', () => {
        basemapDropdown.style.display = 'none';
    });

    basemapDropdown.querySelectorAll('a').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const url = item.dataset.url;
            const layer = item.dataset.layer;
            map.setBasemap(url, layer);
            basemapDropdown.style.display = 'none';
        });
    });

    const layersBtn = document.getElementById('layers-btn');
    const layersDropdown = document.getElementById('layers-dropdown');

    layersBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (layersDropdown.style.display === 'none' || layersDropdown.style.display === '') {
            layersDropdown.style.display = 'block';
        } else {
            layersDropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', () => {
        layersDropdown.style.display = 'none';
    });

    const accessibilityBtn = document.getElementById('accessibility-btn');
    const accessibilityDropdown = document.getElementById('accessibility-dropdown');

    accessibilityBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (accessibilityDropdown.style.display === 'none' || accessibilityDropdown.style.display === '') {
            accessibilityDropdown.style.display = 'block';
        } else {
            accessibilityDropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', () => {
        accessibilityDropdown.style.display = 'none';
    });

    // RESET VIEW BUTTON
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.cameraManager.resetView();
        });
    }

    // COMPASS BUTTON
    const compassBtn = document.getElementById('compass-btn');
    if (compassBtn) {
        compassBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.cameraManager.resetNorth();
        });
    }

    // LOCATION BUTTON
    const locationBtn = document.getElementById('location-btn');
    if (locationBtn) {
        locationBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            map.getUserLocationAndZoom();
        });
    }

    const bvBtn = document.getElementById("bv-btn");
    bvBtn.addEventListener("click", (event) => {

        buildingView.initiate_buildingView();

    });


    const bvDropdown_button = document.getElementById("bv-storey-btn");
    const bvDropdown_dropdown = document.getElementById("bv-dropdown");

    bvDropdown_button.addEventListener("click", (event) => {

        event.stopPropagation();
        if (bvDropdown_dropdown.style.display === 'none' || bvDropdown_dropdown.style.display === '') {
            bvDropdown_dropdown.style.display = 'block';
        } else {
            bvDropdown_dropdown.style.display = 'none';
        }

    });

    // LOD DROPDOWN - Commented out
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
                const lod = item.dataset.lod;
                map.lodVis(lod);
                lodDropdown.style.display = 'none';
            });
        });
    }
    */

});