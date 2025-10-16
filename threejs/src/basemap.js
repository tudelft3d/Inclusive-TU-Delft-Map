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

  const cols = maxCol - minCol + 1;
  const rows = maxRow - minRow + 1;

  // Remove old basemap
  const oldBasemap = scene.getObjectByName("active-basemap");
  if (oldBasemap) {
    scene.remove(oldBasemap);
    oldBasemap.traverse((child) => {
      if (child.isMesh) {
        child.geometry?.dispose();
        child.material?.map?.dispose();
        child.material?.dispose();
      }
    });
  }

  const basemapGroup = new THREE.Group();
  basemapGroup.name = "active-basemap";
  scene.add(basemapGroup);

  // Create ONE massive canvas for all tiles
  const canvasWidth = cols * tileSize;
  const canvasHeight = rows * tileSize;
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d', { alpha: false });

  // Fill with placeholder color
  ctx.fillStyle = '#e0e0e0';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  // Create single mesh for entire basemap
  const totalWidth = cols * tileSpan;
  const totalHeight = rows * tileSpan;

  const geometry = new THREE.PlaneGeometry(totalWidth, totalHeight);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geometry, material);

  geometry.rotateX(-Math.PI / 2);

  const centerX = originX + (minCol + maxCol + 1) * tileSpan / 2;
  const centerY = originY - (minRow + maxRow + 1) * tileSpan / 2;
  mesh.position.set(centerX, yOffset, -centerY);

  basemapGroup.add(mesh);

  // Load all tiles in parallel, draw to canvas as they arrive
  let loadedTiles = 0;
  const totalTiles = rows * cols;

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

      const img = new Image();
      img.crossOrigin = "anonymous";

      const canvasX = (col - minCol) * tileSize;
      const canvasY = (row - minRow) * tileSize;

      img.onload = () => {
        // Draw tile directly to canvas
        ctx.drawImage(img, canvasX, canvasY, tileSize, tileSize);
        texture.needsUpdate = true;

        loadedTiles++;
        if (loadedTiles === totalTiles) {
          console.log(`Basemap loaded: ${totalTiles} tiles`);
        }
      };

      img.onerror = () => {
        console.warn(`Failed to load tile: row=${row}, col=${col}`);
        loadedTiles++;
      };

      img.src = url;
    }
  }

  return basemapGroup;
}