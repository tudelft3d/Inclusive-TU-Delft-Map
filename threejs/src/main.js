import { Scene } from "three/src/Three.Core.js";
import { Map } from "./app";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');
    // const aerialPDOK = new PDOKProvider();

    const map = new Map(container);
    // map.loadGLTF('assets/campus/geom/model.glb');
    map.loadGLTF('assets/campus/geom/geometry.glb');
    // map.loadGLTF('output/campus/bbox/model.glb')

    document.getElementById('zoom-in').addEventListener('click', () => {
        map.cameraManager.zoomIn();
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
        map.cameraManager.zoomOut();
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

    document.getElementById('toggle-camera').addEventListener('click', () => {
        map.cameraManager.switchToOrtho(map.model);
    });
});




