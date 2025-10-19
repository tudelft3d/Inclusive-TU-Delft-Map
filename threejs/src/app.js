import { CamerasControls } from "./camera";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition, cj2gltf } from "./utils";
import { addBasemap, preloadAllLayers, getTileCacheStats } from "./basemap";
import proj4 from "https://cdn.jsdelivr.net/npm/proj4@2.9.0/+esm";
import { OutlineManager } from "./outlines";
import { BUILDINGS_COLOR } from "./constants";
import {
    IconSet,
    IconsSceneManager,
    TextIcon,
    SvgIcon,
    SvgLoader,
} from "./icons";
import { CSS2DRenderer } from "three/addons/renderers/CSS2DRenderer.js";
import { initSearchBar } from "./searchBar";
import { Searcher } from "./search";
import { BuildingView } from "./buildingView";
import { Highlighter } from "./highlighter";
import { PICKED_COLOR } from "./constants";
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };

export class Map {
    /**
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        this.mainContainer = container;
        this.activeBasemap = null;
        this.userLocationMarker = null;
        this.buildings = [];
        this.cityjson = cityjson;
        this.locationWatchId = null; // For tracking real-time location updates
        this.preloadingStarted = false; // Flag to ensure preloading starts only once

        // Cameras and controls
        const cameraPosition = new THREE.Vector3(85715, 1100, -445780);
        const cameraLookAt = new THREE.Vector3(85743, 30, -445791);
        this.cameraManager = new CamerasControls(
            this.mainContainer,
            cameraPosition,
            cameraLookAt
        );

        this.infoPane = document.getElementById("info-pane");

        this.tweens = new Array();

        this._initScenes();
        this._initLights();
        this.setBasemap();
        this._initRenderers();
        this.iconsSceneManager = new IconsSceneManager(
            this.iconsScene,
            this.css2dRenderer,
            this.css2dContainer,
            this.mainContainer
        );
        this.outlineManager = new OutlineManager(
            this.scene,
            this.iconsSceneManager,
            this.glRenderer
        );
        this.svgLoader = new SvgLoader();
        this._attachEvents();

        window.addEventListener(
            "resize",
            (e) => {
                this._resizeWindow();
            },
            false
        );

        this._initBuildingView();
        this._initPicker();
        this._initSearcher();

        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    _initScenes() {
        this.scene = new THREE.Scene();
        const loader = new THREE.CubeTextureLoader();
        loader.setPath("assets/threejs/graphics/");
        const skyboxTexture = loader.load([
            "sky_gradient_sides.png",
            "sky_gradient_sides.png",
            "sky_gradient_upper.png",
            "sky_gradient_lower.png",
            "sky_gradient_sides.png",
            "sky_gradient_sides.png",
        ]);
        this.scene.background = skyboxTexture;

        this.iconsScene = new THREE.Scene();
    }

    _initLights() {
        const color = 0xffffff;

        const ambientLight = new THREE.AmbientLight(color, 1);
        this.scene.add(ambientLight);

        this.light = new THREE.DirectionalLight(color, 3);
        this.scene.add(this.light);
        this.scene.add(this.light.target);
    }

    setBasemap(url, layer) {
        if (this.activeBasemap) {
            this.scene.remove(this.activeBasemap);
        }
        this.activeBasemap = addBasemap(this.scene, url, layer);

        // Start preloading other layers in the background (only once)
        if (!this.preloadingStarted) {
            this.preloadingStarted = true;
            console.log("Starting background preloading of map layers...");

            // Start preloading after a short delay to let the initial basemap finish loading
            setTimeout(() => {
                preloadAllLayers({
                    zoom: 12,
                    bbox: [84000, 443500, 87500, 448000], // Same bbox as main map
                });
            }, 3000); // 3 second delay
        }
    }

    // Method to get tile cache statistics and preloading progress
    getTileCacheInfo() {
        return getTileCacheStats();
    }

    _initRenderers() {
        // WebGL renderer for 3D objects
        this.glRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.glRenderer.setPixelRatio(window.devicePixelRatio);
        this.glContainer = this.glRenderer.domElement;
        this.mainContainer.appendChild(this.glContainer);

        // CSS2D renderer for icons and text
        this.css2dRenderer = new CSS2DRenderer();
        this.css2dContainer = this.css2dRenderer.domElement;
        this.css2dContainer.style.position = "absolute";
        this.css2dContainer.style.top = "0";
        this.css2dContainer.style.pointerEvents = "none";
        this.mainContainer.appendChild(this.css2dContainer);

        this._resizeWindow();
    }

    _initBuildingView() {
        this.buildingView = new BuildingView(
            this.cameraManager,
            this.scene,
            this.buildings,
            this.outlineManager
        );
    }

    _initPicker() {
        this.pickHighlighter = new Highlighter(PICKED_COLOR);
        this.picker = new ObjectPicker(
            this.infoPane,
            this.pickHighlighter,
            this.scene,
            this.cameraManager,
            this.buildingView
        );
    }

    _initSearcher() {
        this.searcher = new Searcher(
            this.cameraManager,
            this.picker,
            this.scene,
            this.buildingView
        );
        const search_delay = 250;
        const search_result_count = 5;
        initSearchBar(this.searcher, search_delay, search_result_count);
    }

    /* Convert GPS coordinates (lat/lon) to map's local coordinates, using proj4 */
    latLonToLocal(lat, lon) {
        // WGS84 (GPS coordinates) & RD New (Rijksdriehoek)
        const wgs84 = "EPSG:4326";
        const rdNew =
            "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs";

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
            alert("Geolocation is not supported by your browser");
            return;
        }

        console.log("Starting location tracking...");

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

                console.log(
                    `Location update: ${lat}, ${lon} (accuracy: ${accuracy}m)`
                );

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
                let message = "Unable to retrieve your location";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message =
                            "Location permission denied. Please enable location access in your browser settings.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = "Location information unavailable.";
                        break;
                    case error.TIMEOUT:
                        message = "Location request timed out.";
                        break;
                }
                console.error("Geolocation error:", error);
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
                maximumAge: 0,
            }
        );
    }

    /* Stop tracking user location */
    stopLocationTracking() {
        if (this.locationWatchId !== null) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
            console.log("Location tracking stopped");
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
            color: 0x4285f4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.2,
        });
        const circle = new THREE.Mesh(circleGeometry, circleMaterial);
        circle.rotation.x = -Math.PI / 2; // Lay flat
        markerGroup.add(circle);

        // Accuracy ring border
        const ringGeometry = new THREE.RingGeometry(
            accuracy - 1,
            accuracy + 1,
            64
        );
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x4285f4,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2;
        markerGroup.add(ring);

        // Center dot (actual position)
        const dotGeometry = new THREE.SphereGeometry(3, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0x4285f4,
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        //dot.position.y = 1; // Slightly above the circle
        markerGroup.add(dot);

        markerGroup.position.set(x, 1, z); // Position just above ground
        markerGroup.name = "user-location-marker"; // Name the user location marker

        this.userLocationMarker = markerGroup;
        this.scene.add(this.userLocationMarker);

        console.log(
            `Location marker updated at (${x}, ${z}) with accuracy ${accuracy}m`
        );
    }

    _attachEvents() {
        var hasMouseMoved = false;
        this.hasMouseMovedInFrame = false;
        window.addEventListener("mousedown", (e) => {
            hasMouseMoved = false;
        });
        window.addEventListener("mousemove", (e) => {
            hasMouseMoved = true;

            // if (this.hasMouseMovedInFrame) return;

            // this.hasMouseMovedInFrame = true;
            // const pos = getCanvasRelativePosition(e, this.glContainer);
            // const clicked_element = document.elementFromPoint(e.pageX, e.pageY);
            // if (
            //     clicked_element.nodeName &&
            //     clicked_element.nodeName == "CANVAS"
            // ) {
            //     console.log("Hovering");
            //     this.picker.hoverPosition(pos);
            // }
        });
        window.addEventListener("mouseup", (e) => {
            if (hasMouseMoved) return;

            const pos = getCanvasRelativePosition(e, this.glContainer);
            const clicked_element = document.elementFromPoint(e.pageX, e.pageY);
            if (
                clicked_element.nodeName &&
                clicked_element.nodeName == "CANVAS"
            ) {
                this.picker.pickPosition(pos);
            }
        });

        // Touch handling
        window.addEventListener("touchstart", (e) => {
            hasMouseMoved = false;
        });
        window.addEventListener("touchmove", (e) => {
            hasMouseMoved = true;
        });
        window.addEventListener("touchend", (e) => {
            if (hasMouseMoved) return;
            const touch = e.changedTouches[0];
            const pos = getCanvasRelativePosition(touch, this.glContainer);
            const clicked_element = document.elementFromPoint(
                e.changedTouches[0].pageX,
                e.changedTouches[0].pageY
            );
            if (
                clicked_element.nodeName &&
                clicked_element.nodeName == "CANVAS"
            ) {
                this.picker.pickPosition(pos);
            }
        });

        window.addEventListener(
            "resize",
            (e) => {
                this._resizeWindow();
            },
            false
        );
    }

    _resizeWindow() {
        const { clientWidth: width, clientHeight: height } = this.glContainer;
        this.cameraManager.resizeCameras(width, height);
        this.glRenderer.setSize(width, height);
        this.css2dRenderer.setSize(width, height);
    }

    loadGLTF(path) {
        const loader = new GLTFLoader();
        loader.load(
            path,
            (gltf) => {
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
                for (const [id, obj] of Object.entries(
                    this.cityjson.CityObjects
                )) {
                    if (obj.type !== "Building") continue;
                    buildingOutline.push(obj.attributes.key);
                }
                this.buildings = buildingOutline;
                this.outlineManager.setOutline(
                    this.buildings,
                    "lod_2",
                    "default"
                );
            },
            undefined,
            function (error) {
                console.error(error);
            }
        );
    }

    async loadIcon() {
        const paths = [
            "assets/threejs/graphics/icons/thematic-layers/education.svg",
            "assets/threejs/graphics/icons/thematic-layers/cafeteria.svg",
            "assets/threejs/graphics/icons/thematic-layers/library.svg",
        ];
        const keys = ["home", "cafe", "library"];
        const bgColors = ["#f7c286ff", "#f786f3ff", "#86f790ff"];
        var position = new THREE.Vector3(85193, 33, -446857);

        // Kick off all fetches at once
        const svgs = await Promise.all(
            paths.map((p) => this.svgLoader.getSvg(p))
        );

        // Make the icons
        const icons = [];
        for (var i = 0; i < paths.length; i++) {
            const svg = svgs[i];
            const key = keys[i];
            const bgColor = bgColors[i];
            const icon = new SvgIcon(key, svg, { bgColor: bgColor });
            icons.push(icon);
        }

        // Add the text
        const text = new TextIcon("Bouwkunde");

        // Click event listener
        const onClick = (e) => {
            const building = this.scene.getObjectByName(
                "Building_08-Building-08-lod_2"
            );
            this.picker.pickMesh(building);
            console.log(`Clicked on a icon!`);
        };

        // Put everything together
        const iconSet = new IconSet("BK", icons, text, position, onClick);

        // Add it to the scene
        this.iconsSceneManager.addIconSet(iconSet);
    }

    render(time) {
        setTimeout(() => {
            requestAnimationFrame(this.render);
        }, 1000 / 144);

        // this.hasMouseMovedInFrame = false;
        this.cameraManager.tweens.forEach((tween) => tween.update(time));
        this.outlineManager.render(time, this.cameraManager);
        this.iconsSceneManager.render(time, this.cameraManager);
        this.light.position.copy(this.cameraManager.camera.position);
        this.light.target.position.copy(this.cameraManager.controls.target);
    }

    lodVis(lod = "lod_2") {
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
                    if (vis.type == "Group") {
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
