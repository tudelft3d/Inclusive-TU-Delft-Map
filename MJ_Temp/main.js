import { Map } from "./app";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');
    const map = new Map(container);
    map.loadGLTF('assets/campus/geom/model.glb')
    // map.loadGLTF('output/campus/bbox/model.glb')

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

// Close dropdown when clicking outside
document.addEventListener('click', () => {
  basemapDropdown.style.display = 'none';
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

// Close dropdown when clicking outside
document.addEventListener('click', () => {
    thematicDropdown.style.display = 'none';
});

