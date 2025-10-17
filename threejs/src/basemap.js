import * as THREE from 'three';

// Function to calculate viewport center in map coordinates
function getViewportCenter(bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}

// Function to calculate distance from viewport center for tile prioritization
function getTileDistance(tileRow, tileCol, centerRow, centerCol) {
  const deltaRow = tileRow - centerRow;
  const deltaCol = tileCol - centerCol;
  return Math.sqrt(deltaRow * deltaRow + deltaCol * deltaCol);
}

// Function to create prioritized tile loading queue
function createPrioritizedQueue(minRow, maxRow, minCol, maxCol, wmtsBaseURL, layer, matrixSet, zoom) {
  const centerRow = (minRow + maxRow) / 2;
  const centerCol = (minCol + maxCol) / 2;

  const tiles = [];

  // Create all tile objects with distance from center
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      const distance = getTileDistance(row, col, centerRow, centerCol);
      const url = `${wmtsBaseURL}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0`
        + `&LAYER=${layer}`
        + `&STYLE=default`
        + `&FORMAT=image/png`
        + `&TILEMATRIXSET=${matrixSet}`
        + `&TILEMATRIX=${zoom}`
        + `&TILEROW=${row}`
        + `&TILECOL=${col}`;

      tiles.push({ row, col, url, distance });
    }
  }

  // Sort by distance - closest tiles first
  tiles.sort((a, b) => a.distance - b.distance);

  // console.log(`🎯 Prioritized ${tiles.length} tiles - center-out loading strategy`);
  return tiles;
}

// Tile cache to store loaded textures
const tileCache = new Map();

// Preloading state management
const preloadingState = {
  isPreloading: false,
  preloadedLayers: new Set(),
  preloadQueue: []
};

// Define available layers for preloading
const AVAILABLE_LAYERS = [
  { url: "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0", layer: "Actueel_orthoHR", name: "Satellite Imagery" },
  { url: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0", layer: "standaard", name: "Topographic Map" },
  { url: "https://service.pdok.nl/lv/bgt/wmts/v1_0", layer: "achtergrondvisualisatie", name: "BGT Colour" },
  { url: "https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0", layer: "grijs", name: "BGT Grayscale" }
];

// Function to preload all layers in the background
export function preloadAllLayers(options = {}) {
  if (preloadingState.isPreloading) {
    // console.log('Preloading already in progress...');
    return;
  }

  // console.log('Starting background preloading of all map layers...');
  preloadingState.isPreloading = true;

  const preloadOptions = {
    ...options,
    zoom: options.zoom || 12, // Use lower zoom for preloading to reduce data
    maxConcurrentLoads: 3 // Reduced concurrent loads for background preloading
  };

  AVAILABLE_LAYERS.forEach((layerConfig, index) => {
    if (!preloadingState.preloadedLayers.has(layerConfig.layer)) {
      // Stagger the preloading to avoid overwhelming the servers
      setTimeout(() => {
        preloadLayer(layerConfig.url, layerConfig.layer, layerConfig.name, preloadOptions);
      }, index * 2000); // 2 second delay between each layer
    }
  });
}

// Function to preload a specific layer
function preloadLayer(wmtsBaseURL, layer, layerName, options = {}) {
  // console.log(`Preloading ${layerName} (${layer})...`);

  const {
    matrixSet = "EPSG:28992",
    zoom = 12,
    tileSize = 256,
    resolutions = [
      3440.64, 1720.32, 860.16, 430.08, 215.04,
      107.52, 53.76, 26.88, 13.44, 6.72,
      3.36, 1.68, 0.84, 0.42, 0.21
    ],
    bbox = [84000, 443500, 87500, 448000], // better option: to change query bbox to camera view
    originX = -285401.92,
    originY = 903401.92,
    maxConcurrentLoads = 6
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

  const preloadQueue = [];
  let activePreloads = 0;
  let totalTiles = 0;
  let preloadedTiles = 0;

  // Calculate total tiles
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      totalTiles++;
    }
  }

  function preloadNextTile() {
    if (preloadQueue.length === 0 || activePreloads >= maxConcurrentLoads) {
      if (activePreloads === 0 && preloadQueue.length === 0) {
        // Preloading complete for this layer
        preloadingState.preloadedLayers.add(layer);
        // console.log(`✓ Preloading complete for ${layerName}: ${preloadedTiles}/${totalTiles} tiles cached`);

        // Check if all layers are preloaded
        if (preloadingState.preloadedLayers.size === AVAILABLE_LAYERS.length) {
          preloadingState.isPreloading = false;
          // console.log('🎉 All layers preloaded successfully!');
        }
      }
      return;
    }

    const { url } = preloadQueue.shift();
    activePreloads++;

    // Check if already cached
    const cacheKey = `${url}`;
    if (tileCache.has(cacheKey)) {
      activePreloads--;
      preloadedTiles++;
      preloadNextTile();
      return;
    }

    loader.load(
      url,
      (texture) => {
        // Cache the texture for later use
        tileCache.set(cacheKey, texture.clone());
        activePreloads--;
        preloadedTiles++;

        // Log progress every 10 tiles
        if (preloadedTiles % 10 === 0) {
          // console.log(`${layerName}: ${preloadedTiles}/${totalTiles} tiles preloaded`);
        }

        preloadNextTile();
      },
      undefined,
      (error) => {
        console.warn(`Failed to preload tile for ${layerName}: ${url}`, error);
        activePreloads--;
        preloadNextTile();
      }
    );
  }

  // Queue all tiles for preloading
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

      preloadQueue.push({ url });
    }
  }

  // Start preloading
  for (let i = 0; i < Math.min(maxConcurrentLoads, preloadQueue.length); i++) {
    preloadNextTile();
  }
}

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
    bbox = [84000, 443500, 87500, 448000], // better option: to change query bbox to camera view
    originX = -285401.92,
    originY = 903401.92,
    yOffset = -1, // prevent z-fighting for now
    maxConcurrentLoads = 6 // Limit concurrent tile loads
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

  // Create loading queue and progress tracking
  const loadingQueue = [];
  let activeLoads = 0;
  let totalTiles = 0;
  let loadedTiles = 0;

  // Calculate total tiles for progress tracking
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      totalTiles++;
    }
  }

  // console.log(`Loading ${totalTiles} tiles for ${layer}...`);

  // Function to load next tile from queue
  function loadNextTile() {
    if (loadingQueue.length === 0 || activeLoads >= maxConcurrentLoads) {
      return;
    }

    const { row, col, url } = loadingQueue.shift();
    activeLoads++;

    // Check cache first
    const cacheKey = `${url}`;
    if (tileCache.has(cacheKey)) {
      const cachedTexture = tileCache.get(cacheKey);
      createTileMesh(cachedTexture.clone(), row, col);
      activeLoads--;
      loadedTiles++;
      loadNextTile(); // Load next tile
      return;
    }

    loader.load(
      url,
      (texture) => {
        // Cache the texture
        tileCache.set(cacheKey, texture.clone());

        createTileMesh(texture, row, col);
        activeLoads--;
        loadedTiles++;

        // Enhanced progress logging for viewport-first loading
        const progressPercent = Math.round((loadedTiles / totalTiles) * 100);

        if (loadedTiles % 5 === 0 || progressPercent <= 20) {
          // Show more frequent updates for the first 20% (viewport tiles)
          // console.log(`🗺️ ${layer}: ${loadedTiles}/${totalTiles} tiles (${progressPercent}%) - viewport-first loading`);
        }

        loadNextTile(); // Load next tile
      },
      undefined,
      (error) => {
        console.warn(`Failed to load tile: ${url}`, error);
        activeLoads--;
        loadNextTile(); // Continue with next tile even if one fails
      }
    );
  }

  // Function to create tile mesh
  function createTileMesh(texture, row, col) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;

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

    basemapGroup.add(planeMesh); // Add to group instead of scene directly
  }

  // Create prioritized loading queue - center-out strategy
  // console.log(`🎯 Creating viewport-first loading strategy for ${layer}...`);
  const prioritizedTiles = createPrioritizedQueue(
    minRow, maxRow, minCol, maxCol,
    wmtsBaseURL, layer, matrixSet, zoom
  );

  // Add prioritized tiles to loading queue
  prioritizedTiles.forEach(tile => {
    loadingQueue.push(tile);
  });

  // Start loading tiles (viewport center loads first)
  for (let i = 0; i < Math.min(maxConcurrentLoads, loadingQueue.length); i++) {
    loadNextTile();
  }

  const oldBasemap = scene.getObjectByName("active-basemap");
  if (oldBasemap) {
    scene.remove(oldBasemap);
  }
  basemapGroup.name = "active-basemap";
  scene.add(basemapGroup);

  return basemapGroup;
}

// Function to clear tile cache if memory usage becomes too high
export function clearTileCache() {
  tileCache.forEach((texture) => {
    texture.dispose();
  });
  tileCache.clear();
  // console.log('Tile cache cleared');
}

// Function to get cache statistics
export function getTileCacheStats() {
  return {
    size: tileCache.size,
    memoryEstimate: `~${(tileCache.size * 0.25).toFixed(1)}MB`, // Rough estimate
    preloadedLayers: Array.from(preloadingState.preloadedLayers),
    isPreloading: preloadingState.isPreloading,
    availableLayers: AVAILABLE_LAYERS.map(l => l.name)
  };
}

// Function to check if a layer is preloaded
export function isLayerPreloaded(layer) {
  return preloadingState.preloadedLayers.has(layer);
}

// Function to get preloading progress
export function getPreloadingProgress() {
  return {
    isPreloading: preloadingState.isPreloading,
    preloadedCount: preloadingState.preloadedLayers.size,
    totalLayers: AVAILABLE_LAYERS.length,
    preloadedLayers: Array.from(preloadingState.preloadedLayers)
  };
}