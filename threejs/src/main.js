import { Map } from "./app";

document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');
    const map = new Map(container);
    map.loadGLTF('assets/campus/geom/model.glb')
    // map.loadGLTF('output/campus/bbox/model.glb')

});
