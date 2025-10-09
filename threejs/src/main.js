import { Map } from "./app";
import { Searcher } from "./search";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');

    const map = new Map(container);
    const searcher = new Searcher();

    // The amount of time the searchbar will wait before searcing in miliseconds
    const search_delay = 500;

    // The number of results that are returned for partials searches
    const search_result_count = 10;

    // map.loadGLTF('assets/campus/geom/model.glb');
    // map.loadGLTF('assets/campus/geom/geometry.glb');
    map.loadGLTF('assets/threejs/buildings/geometry.glb');
    // map.lodToggle('lod_0');

    document.getElementById('zoom-in').addEventListener('click', (event) => {
        event.stopPropagation();
        event.preventDefault;
        map.cameraManager.zoomIn();
    });
    document.getElementById('zoom-out').addEventListener('click', (event) => {
        event.stopPropagation();
        map.cameraManager.zoomOut();
    });

    document.getElementById('orthographic-btn').addEventListener('click', () => {
        map.cameraManager.toggle_orthographic();
    });


    const searchBar = document.getElementById('search');

    // general idea of "debouncing" from: https://dev.to/rowsanali/how-to-implement-a-search-functionality-using-javascript-1n1b

    let timeout;

    function debounce(func, wait) {

        return function(...args) {

            window.clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }


    // Function that will have to handle the intermediate results
    function show_intermediate_results(results) {
        console.log(results);
    }

    searchBar.addEventListener('keyup', (event) => {

        let value = event.target.value;

        // If the key being released is enter, the user wants to search
        // If the key being released is not enter, we show intermediate results
        if (event.key === "Enter") {

            if (value && value.trim().length > 0){
                searcher.search_and_zoom(value, map);
            }

        } else {

            const debouncedSearch = debounce(() => {
                const results = searcher.search_n_best_matches(value, search_result_count);
                show_intermediate_results(results);
            }, search_delay);

            debouncedSearch();

        }

        

        // let value = event.target.value;

        // if (value && value.trim().length > 0){
        //     console.log(value);
        // }

        // if (event.key === "Enter") {

        //     if (value && value.trim().length > 0){
        //         console.log(value);
        //     }

        //     console.log(searcher.search_pattern(value, map));
        // }

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


    const thematicBtn = document.getElementById('thematic-btn');
    const thematicDropdown = document.getElementById('thematic-dropdown');

    thematicBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (thematicDropdown.style.display === 'none' || thematicDropdown.style.display === '') {
            thematicDropdown.style.display = 'block';
        } else {
            thematicDropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', () => {
        thematicDropdown.style.display = 'none';
    });

    const colorBlindBtn = document.getElementById('colorBlind-btn');
    const colorBlindDropdown = document.getElementById('colorBlind-dropdown');

    colorBlindBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (colorBlindDropdown.style.display === 'none' || colorBlindDropdown.style.display === '') {
            colorBlindDropdown.style.display = 'block';
        } else {
            colorBlindDropdown.style.display = 'none';
        }
    });


    const lodBtn = document.getElementById('lod-btn');
    const lodDropdown = document.getElementById('lod-dropdown');
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
    });

    lodDropdown.querySelectorAll('a').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const lod = item.dataset.lod;
            map.lodVis(lod);
            lodDropdown.style.display = 'none';
        });
    });

});




