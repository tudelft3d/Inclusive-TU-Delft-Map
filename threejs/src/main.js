import { Map } from "./app";
import { Searcher } from "./search";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');

    const map = new Map(container);
    const searcher = new Searcher();

    // The amount of time the searchbar will wait before searcing in miliseconds
    const search_delay = 250;

    // The number of results that are returned for partials searches
    const search_result_count = 3;

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

        console.log(search_results);

        var ul = document.createElement("ul");
        
        intermediateResults.innerHTML = '';

        search_results = search_results.map((element) => {return element.item.attributes["space_id"]});

        for (let i=0; i<search_results.length; i++) {

            var li = document.createElement("li");
            li.appendChild(document.createTextNode(search_results[i]));

            // Example of how to engage with the intermediate result:
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

    intermediateResults.addEventListener("click", (event) => {

        let value = event.target.textContent

        searcher.search_and_zoom(value, map);

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




