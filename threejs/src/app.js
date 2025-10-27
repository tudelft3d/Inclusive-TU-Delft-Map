import { CamerasControls } from "./camera";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition, cj2gltf } from "./utils";
import { addBasemap, preloadAllLayers, getTileCacheStats } from "./basemap";
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
import { CSS3DRenderer } from "three/addons/renderers/CSS3DRenderer.js";
import { initSearchBar } from "./searchBar";
import { LayerManager } from "./layers";
import { BuildingColorManager } from "./buildingColorManager";
import { Searcher } from "./search";
import { BuildingView } from "./buildingView";
import { Highlighter } from "./highlighter";
import { PICKED_COLOR } from "./constants";
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };
import { LocationManager, LocationSceneManager } from "./location";
import { BASEMAP_BOUNDARIES } from "./basemap";

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
        this.preloadingStarted = false; // Flag to ensure preloading starts only once

        // Cameras and controls
        const cameraPosition = new THREE.Vector3(85715, 1100, -445780);
        const cameraLookAt = new THREE.Vector3(85743, 30, -445791);
        this.cameraManager = new CamerasControls(
            this.mainContainer,
            cameraPosition,
            cameraLookAt
        );

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
        this.locationSceneManager = new LocationSceneManager(
            this.locationScene,
            this.css3dRenderer,
            this.css3dContainer,
            this.mainContainer
        );
        this.locationManager = new LocationManager(
            this.locationSceneManager,
            this.cameraManager
        );
        this.outlineManager = new OutlineManager(this.scene, this.glRenderer);
        this.svgLoader = new SvgLoader();
        this._attachEvents();

        window.addEventListener(
            "resize",
            (e) => {
                this._resizeWindow();
            },
            false
        );

        this._initLayerManager();
        this._initBuildingView();
        this._initPicker();
        this._initSearcher();
        this._initBuildingColorManager();

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

        this.locationScene = new THREE.Scene();
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
                    bbox: BASEMAP_BOUNDARIES, // Same bbox as main map
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
        this.glRenderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        this.glRenderer.setPixelRatio(window.devicePixelRatio);
        this.glContainer = this.glRenderer.domElement;
        this.mainContainer.appendChild(this.glContainer);

        // CSS3D renderer for location
        this.css3dRenderer = new CSS3DRenderer();
        this.css3dContainer = this.css3dRenderer.domElement;
        this.css3dContainer.style.position = "absolute";
        this.css3dContainer.style.top = "0";
        this.css3dContainer.style.pointerEvents = "none";
        this.mainContainer.appendChild(this.css3dContainer);

        // CSS2D renderer for icons and text
        this.css2dRenderer = new CSS2DRenderer();
        this.css2dContainer = this.css2dRenderer.domElement;
        this.css2dContainer.style.position = "absolute";
        this.css2dContainer.style.top = "0";
        this.css2dContainer.style.pointerEvents = "none";
        this.mainContainer.appendChild(this.css2dContainer);

        this._resizeWindow();
    }

    _initLayerManager() {
        this.layerManager = new LayerManager(
            this.scene,
            this.iconsSceneManager,
            this.svgLoader,
            this.cameraManager,
        );
    }

    _initBuildingView() {
        this.buildingView = new BuildingView(
            this.cameraManager,
            this.scene,
            this.buildings,
            this.outlineManager,
            this.layerManager,
            this.picker
        );
    }

    _initPicker() {
        this.pickHighlighter = new Highlighter(PICKED_COLOR);
        this.picker = new ObjectPicker(
            this.pickHighlighter,
            this.scene,
            this.cameraManager,
            this.buildingView
        );
        this.buildingView.picker = this.picker;
        this.layerManager.picker = this.picker;
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

    _initBuildingColorManager() {
        this.buildingColorManager = new BuildingColorManager(
            this.scene
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
                this.picker.pickScreenPosition(pos);
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
                this.picker.pickScreenPosition(pos);
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
        this.css3dRenderer.setSize(width, height);
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

    render(time) {
        setTimeout(() => {
            requestAnimationFrame(this.render);
        }, 1000 / 144);

        // this.hasMouseMovedInFrame = false;
        this.cameraManager.tweens.forEach((tween) => tween.update(time));
        this.outlineManager.render(time, this.cameraManager);
        this.iconsSceneManager.render(time, this.cameraManager);
        this.locationSceneManager.render(time, this.cameraManager);
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
