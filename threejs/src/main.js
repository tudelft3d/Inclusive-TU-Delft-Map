import { Scene } from "three/src/Three.Core.js";
import { Map } from "./app";
import { createBasemap } from "./basemap";


document.addEventListener('DOMContentLoaded', () => {
    const container = document.querySelector('#scene-container');
    // const aerialPDOK = new PDOKProvider();
    
    const map = new Map(container);
    map.loadGLTF('assets/campus/geom/model.glb');
    createBasemap('basemap-aerial');
    // map.addWMTSBasemap(aerialPDOK);
    // map.loadGLTF('output/campus/bbox/model.glb')

    

});
