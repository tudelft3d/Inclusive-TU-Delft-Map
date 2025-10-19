import { CamerasControls } from "./camera";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition, cj2gltf } from "./utils";
import { addBasemap, preloadAllLayers, getTileCacheStats } from "./basemap";
import proj4 from 'https://cdn.jsdelivr.net/npm/proj4@2.9.0/+esm';
import { OutlineManager } from "./outlines";
import { Icon, svgToDiscTexture, IconsSceneManager } from './icons';
import { BUILDINGS_COLOR } from './constants';
import { initSearchBar } from "./searchBar"
import { Searcher } from "./search";
import { BuildingView } from "./buildingView"

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};


export class Map {
    constructor(container) {
        this.container = container;
        this.activeBasemap = null;
        this.userLocationMarker = null;
        this.buildings = [];
        this.cityjson = cityjson;
        this.locationWatchId = null; // For tracking real-time location updates
        this.preloadingStarted = false; // Flag to ensure preloading starts only once


        // Cameras and controls
        const cameraPosition = new THREE.Vector3(85715, 1100, -445780);
        const cameraLookAt = new THREE.Vector3(85743, 30, -445791);
        this.cameraManager = new CamerasControls(container, cameraPosition, cameraLookAt);

        this.infoPane = document.getElementById('info-pane');

        this.tweens = new Array();

        this._initScenes();
        this._initLights();
        this.setBasemap();
        this._initRenderer();
        this.outlineManager = new OutlineManager(this.scene, this.iconsSceneManager, this.renderer);
        this._attachEvents();
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);

        window.addEventListener('resize', (e) => {
            this._resizeWindow();
        }, false);

        this._initBuildingView();
        this.picker = new ObjectPicker(this.infoPane, this.buildingView);
        this._initSearcher();
    }

    _initScenes() {
        this.scene = new THREE.Scene();
        const loader = new THREE.CubeTextureLoader();
        loader.setPath('assets/threejs/graphics/');
        const skyboxTexture = loader.load([
            'sky_gradient_sides.png',
            'sky_gradient_sides.png',
            'sky_gradient_upper.png',
            'sky_gradient_lower.png',
            'sky_gradient_sides.png',
            'sky_gradient_sides.png',
        ]);
        this.scene.background = skyboxTexture;

        const iconsScene = new THREE.Scene();
        this.iconsSceneManager = new IconsSceneManager(iconsScene);
    }

    _initLights() {
        const color = 0xFFFFFF;

        // // Add 4 directional lights
        // const positions = [
        //     [new THREE.Vector3(0, 1, 0), 0.5],
        //     [new THREE.Vector3(0, -1, 0), 0.5],
        //     [new THREE.Vector3(0, 0, 1), 0.5],
        //     [new THREE.Vector3(0, 0, -1), 0.5],
        //     [new THREE.Vector3(-1, 0, 0), 0.5],
        //     [new THREE.Vector3(1, 0, 0), 0.5],
        // ];
        // for (const lightsProperties of positions) {
        //     var position, intensity
        //     [position, intensity] = lightsProperties;
        //     const light = new THREE.DirectionalLight(color, intensity);
        //     light.position.copy(position);
        //     this.scene.add(light);
        // }

        const ambientLight = new THREE.AmbientLight(color, 1);
        this.scene.add(ambientLight);

        this.light = new THREE.DirectionalLight(color, 3);
        this.scene.add(this.light);
        this.scene.add(this.light.target);


        // const light = new THREE.DirectionalLight(color, intensity);
        // light.position.set(0, 1000, 0);
        // light.target.position.copy(new THREE.Vector3(1, -1, 0));
        // this.scene.add(light);

        // const light = new THREE.PointLight(color, intensity, 0, 0.001);
        // light.position.set(85715, 30, -445780);
        // this.scene.add(light);

    }

    setBasemap(url, layer) {
        if (this.activeBasemap) {
            this.scene.remove(this.activeBasemap);
        }
        this.activeBasemap = addBasemap(this.scene, url, layer);

        // Start preloading other layers in the background (only once)
        if (!this.preloadingStarted) {
            this.preloadingStarted = true;
            console.log('Starting background preloading of map layers...');

            // Start preloading after a short delay to let the initial basemap finish loading
            setTimeout(() => {
                preloadAllLayers({
                    zoom: 12,
                    bbox: [84000, 443500, 87500, 448000] // Same bbox as main map
                });
            }, 3000); // 3 second delay
        }
    }

    // Method to get tile cache statistics and preloading progress
    getTileCacheInfo() {
        return getTileCacheStats();
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.canvas = this.renderer.domElement;
        this.container.appendChild(this.canvas);
        this._resizeWindow();
    }

    _initSearcher() {
        this.searcher = new Searcher(this.cameraManager, this.picker, this.scene, this.buildingView);
        const search_delay = 250;
        const search_result_count = 5;
        initSearchBar(this.searcher, search_delay, search_result_count);
    }

    _initBuildingView() {
        this.buildingView = new BuildingView(this.cameraManager, this.scene, this.buildings, this.outlineManager);
    }

    /* Convert GPS coordinates (lat/lon) to map's local coordinates, using proj4 */
    latLonToLocal(lat, lon) {

        // WGS84 (GPS coordinates) & RD New (Rijksdriehoek)
        const wgs84 = 'EPSG:4326';
        const rdNew = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';

        // Convert GPS to RD coordinates using proj4
        const [rdX, rdY] = proj4(wgs84, rdNew, [lon, lat]);
        console.log(`GPS (${lat}, ${lon}) -> RD (${rdX}, ${rdY})`);

        const x = rdX;
        const z = -rdY; // Negative Z because of coordinate system orientation

        console.log(`RD (${rdX}, ${rdY}) -> Local (${x}, ${z})`);

        return { x, z };
    }

    /* Get user location and zoom to it with continuous tracking */
    getUserLocationAndZoom() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        console.log('Starting location tracking...');

        // Stop any existing tracking
        if (this.locationWatchId !== null) {
            navigator.geolocation.clearWatch(this.locationWatchId);
        }

        let firstUpdate = true;

        // Use watchPosition for continuous updates
        this.locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const accuracy = position.coords.accuracy; // in meters

                console.log(`Location update: ${lat}, ${lon} (accuracy: ${accuracy}m)`);

                // Convert GPS to local coordinates
                const local = this.latLonToLocal(lat, lon);

                // Update or create marker at the user's location
                this.updateUserLocationMarker(local.x, local.z, accuracy);

                // Only zoom on first update (aka button click)
                if (firstUpdate) {
                    this.cameraManager.zoomToLocation(local.x, local.z);
                    firstUpdate = false;
                }
            },
            (error) => {
                let message = 'Unable to retrieve your location';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = 'Location permission denied. Please enable location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        message = 'Location request timed out.';
                        break;
                }
                console.error('Geolocation error:', error);
                alert(message);

                // Stop tracking on error
                if (this.locationWatchId !== null) {
                    navigator.geolocation.clearWatch(this.locationWatchId);
                    this.locationWatchId = null;
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 3000, // every 3 seconds
                maximumAge: 0
            }
        );
    }

    /* Stop tracking user location */
    stopLocationTracking() {
        if (this.locationWatchId !== null) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
            console.log('Location tracking stopped');
        }

        // Remove the marker
        if (this.userLocationMarker) {
            this.scene.remove(this.userLocationMarker);
            this.userLocationMarker = null;
        }
    }

    /* Update or create user location marker with accuracy circle */
    updateUserLocationMarker(x, z, accuracy) {
        // Remove previous marker if it exists
        if (this.userLocationMarker) {
            this.scene.remove(this.userLocationMarker);
        }

        const markerGroup = new THREE.Group();

        // Accuracy circle (transparent, sized to accuracy)
        const circleGeometry = new THREE.CircleGeometry(accuracy, 64);
        const circleMaterial = new THREE.MeshBasicMaterial({
            color: 0x4285F4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2; // Lay flat
        markerGroup.add(circle);

        // Accuracy ring border
        const ringGeometry = new THREE.RingGeometry(accuracy - 1, accuracy + 1, 64);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x4285F4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        markerGroup.add(ring);

        // Center dot (actual position)
        const dotGeometry = new THREE.SphereGeometry(3, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0x4285F4
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        //dot.position.y = 1; // Slightly above the circle
        markerGroup.add(dot);

        markerGroup.position.set(x, 1, z); // Position just above ground
        markerGroup.name = "user-location-marker"; // Name the user location marker

        this.userLocationMarker = markerGroup;
        this.scene.add(this.userLocationMarker);

        console.log(`Location marker updated at (${x}, ${z}) with accuracy ${accuracy}m`);
    }

    _pickEvent(pos) {
        this.picker.pick(pos, this.scene, this.cameraManager.camera);

        if (this.picker.isObject) {
            const object = this.picker.picked[0];
            this.buildingView.set_target(object.name);
            this.cameraManager.zoomToObject(object);
        } else if (this.cameraManager.usesOrbitCamera()) {
            this.buildingView.set_target(undefined);
            this.cameraManager.switchToMap();
        }

    }

    _attachEvents() {
        // // mouse move → hover
        // window.addEventListener('mousemove', (e) => {
        //     const pos = getCanvasRelativePosition(e, this.canvas);
        //     this.picker.hover(pos, this.scene, this.cameraManager.camera);
        //     this.render();
        // });

        // // click → pick
        // window.addEventListener('mousedown', (e) => {
        //     this.controlsManager.resetTouchState();
        // });
        var hasMouseMoved = false;
        window.addEventListener('mousedown', (e) => {
            hasMouseMoved = false;
        });
        window.addEventListener('mousemove', (e) => {
            hasMouseMoved = true;
        });
        window.addEventListener('mouseup', (e) => {
            if (hasMouseMoved) return;

            const pos = getCanvasRelativePosition(e, this.canvas);
            const clicked_element = document.elementFromPoint(e.pageX, e.pageY);
            if (clicked_element.nodeName && clicked_element.nodeName == "CANVAS") {
                this._pickEvent(pos);
            }
        });

        // Touch handling
        window.addEventListener('touchstart', (e) => {
            hasMouseMoved = false;
        });
        window.addEventListener('touchmove', (e) => {
            hasMouseMoved = true;
        });
        window.addEventListener('touchend', (e) => {
            if (hasMouseMoved) return;
            const touch = e.changedTouches[0];
            const pos = getCanvasRelativePosition(touch, this.canvas);
            const clicked_element = document.elementFromPoint(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
            if (clicked_element.nodeName && clicked_element.nodeName == "CANVAS") {
                this._pickEvent(pos);
            }
        });

        // // control change → re‑render
        // this.controlsManager.onChange(() => this.render());

        // // window resize
        // window.addEventListener('resize', () => this.render());
    }

    _resizeWindow() {
        const { clientWidth: w, clientHeight: h } = this.canvas;
        this.cameraManager.resizeCameras(w, h);
        this.renderer.setSize(w, h);
    }

    loadGLTF(path) {
        const loader = new GLTFLoader();
        loader.load(path, (gltf) => {
            let objs = gltf.scene;
            objs.rotateX(-Math.PI / 2);
            const newMaterial = new THREE.MeshStandardMaterial({
                color: BUILDINGS_COLOR,
                flatShading: true,
            });
            objs.traverse((o) => {
                if (o.isMesh) {
                    // o.geometry.computeVertexNormals();
                    o.material = newMaterial;
                    // console.log(o);
                }
            });

            const box = new THREE.Box3().setFromObject(objs);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            // console.log(center);

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.cameraManager.camera.fov * (Math.PI / 180);
            let cameraZ = maxDim / (2 * Math.tan(fov / 2));

            cameraZ *= 1.5; // add margin

            // console.log("gltf", gltf);

            // load only lod2 on startup
            this.model = objs;
            this.model.name = "buildings-3d-model"; // Name the buildings group
            this.lodVis();
            this.scene.add(this.model);

            const buildingOutline = [];
            for (const [id, obj] of Object.entries(this.cityjson.CityObjects)) {
                if (obj.type !== "Building") continue;
                buildingOutline.push(obj.attributes.key);
            }
            this.buildings = buildingOutline;
            this.outlineManager.setOutline(this.buildings, 'lod_2', 'default');

        }, undefined, function (error) {
            console.error(error);
        });
    }

    async loadIcon(path) {
        const iconTexture = await svgToDiscTexture(path, 64, '#f5ab56', 4);
        var position = new THREE.Vector3(85190.36380133804, 33.5478593669161, -446862.7335885112);
        const size = 20;
        position = position.add(new THREE.Vector3(0, size / 2, 0));
        const icon = new Icon(iconTexture, position);
        this.iconsSceneManager.addIcon(icon);
    }

    render(time) {
        // this._resizeRenderer();
        this.cameraManager.tweens.forEach(tween => tween.update(time));
        // this.renderer.render(this.scene, this.cameraManager.camera);
        this.outlineManager.render(time, this.cameraManager);
        this.light.position.copy(this.cameraManager.camera.position);
        this.light.target.position.copy(this.cameraManager.controls.target);
        requestAnimationFrame(this.render);
    }

    lodVis(lod = 'lod_2') {
        this.model.traverse((child) => {
            child.visible = false;
            if (child.isMesh) {
                child.material.side = THREE.DoubleSide;
            }

            if (child.name.includes(lod)) {
                // can search by floor sections in cityjson?
                // if (lod === 'lod_0') {
                //  }
                child.visible = true;
                var vis = child.parent;
                while (vis) {
                    vis.visible = true;
                    vis = vis.parent;
                    if (vis.type == 'Group') {
                        vis.visible = true;
                        break;
                    }
                }
            }
        });
    }
}

// sample thematic layers to add:
// Lactation Room	E1-6
// Contemplation room	E1-8 - there are none in BK?
// All-gender restroom	S1-3
// Accessible toilet	S2