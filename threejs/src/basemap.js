import * as THREE from 'three';

export function addBasemap(scene, wmtsBaseURL = "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0", layer = "Actueel_orthoHR", options = {}) {
  const {
    matrixSet = "EPSG:28992",
    zoom = 12,
    tileSize = 256,
    resolutions = [
      3440.64, 1720.32, 860.16, 430.08, 215.04,
      107.52, 53.76, 26.88, 13.44, 6.72,
      3.36, 1.68, 0.84, 0.42, 0.21
    ],
    bbox = [84500, 444000, 87000, 447500], // better option: to change query bbox to camera view
    originX = -285401.92,
    originY = 903401.92,
    yOffset = -1 // prevent z-fighting for now
  } = options;

  const resolution = resolutions[zoom];
  const tileSpan = tileSize * resolution;
  const [minX, minY, maxX, maxY] = bbox;

  const minCol = Math.floor((minX - originX) / tileSpan);
  const maxCol = Math.floor((maxX - originX) / tileSpan);
  const minRow = Math.floor((originY - maxY) / tileSpan);
  const maxRow = Math.floor((originY - minY) / tileSpan);

  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";

  const basemapGroup = new THREE.Group();
  basemapGroup.name = `basemap-${layer}`; // create THREE.Group for removing basemap on toggle


  // try async?
  // add retry process
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const url = `${wmtsBaseURL}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0`
        + `&LAYER=${layer}`
        + `&STYLE=default`
        + `&FORMAT=image/png`
        + `&TILEMATRIXSET=${matrixSet}`
        + `&TILEMATRIX=${zoom}`
        + `&TILEROW=${row}`
        + `&TILECOL=${col}`;

      loader.load(url, (texture) => {
        texture.minFilter = THREE.LinearFilter;

        const tileMinX = originX + col * tileSpan;
        const tileMaxY = originY - row * tileSpan;

        const tileCenterX = (tileMinX + tileMinX + tileSpan) / 2;
        const tileCenterY = (tileMaxY + tileMaxY - tileSpan) / 2;

        const planeGeometry = new THREE.PlaneGeometry(tileSpan, tileSpan);
        const planeMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          side: THREE.DoubleSide
        });
        const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);

        planeMesh.rotateX(-Math.PI / 2);
        planeMesh.position.set(tileCenterX, yOffset, -tileCenterY);

        scene.add(planeMesh);
      });
    }
  }

  const oldBasemap = scene.getObjectByName("active-basemap");
  if (oldBasemap) {
    scene.remove(oldBasemap);
  }
  basemapGroup.name = "active-basemap";
  scene.add(basemapGroup);

  return basemapGroup;
}