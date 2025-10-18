import { CamerasControls } from "./camera";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition, cj2gltf } from "./utils";
import { ControlsManager } from "./controls";
import {
    Tween,
    Easing,
} from "https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js";
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

import cityjson from "../assets/threejs/buildings/attributes.city.json" assert { type: "json" };

export class Map {
    /**
     *
     * @param {HTMLElement} container
     */
    constructor(container) {
        this.mainContainer = container;
        this.activeBasemap = null;
        this.buildingView;
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
        this.picker = new ObjectPicker(this.infoPane, this.buildingView);
        this.controlsManager = new ControlsManager(
            this.mainContainer,
            this.cameraManager
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
        this.outlineManager = new OutlineManager(
            this.scene,
            this.iconsSceneManager,
            this.glRenderer
        );
        this.svgLoader = new SvgLoader();
        this._attachEvents();
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

        // const geometry = new THREE.BoxGeometry(100, 100, 100);
        // const material = new THREE.MeshBasicMaterial({
        //   color: 0x00ff00,
        //   wireframe: true,
        // });

        // const cube = new THREE.Mesh(geometry, material);
        // const cube_2 = new THREE.Mesh(geometry, material);
        // cube_2.position.y = 1000;
        // this.scene.add(cube);
    }

    _initLights() {
        const color = 0xffffff;

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
        this.glRenderer = new THREE.WebGLRenderer({ antialias: true });
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

        this.userLocationMarker = markerGroup;
        this.scene.add(this.userLocationMarker);

        console.log(
            `Location marker updated at (${x}, ${z}) with accuracy ${accuracy}m`
        );
    }

    _zoom_perspective(object) {
        // console.log("perspective");

        this.controlsManager.activateOrbit();

        const margin = 1.2;

        // Bounding sphere
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);
        const center = sphere.center;
        const radius = sphere.radius;

        // Compute distance based on fov
        const fov = this.cameraManager.camera.fov * (Math.PI / 180);
        const distance = (radius / Math.tan(fov / 2)) * margin;

        // Set camera position & orientation
        const direction = new THREE.Vector3()
            .subVectors(this.cameraManager.previousCamera.position, center)
            .normalize();
        const cameraPosition = center
            .clone()
            .addScaledVector(direction, distance);

        // Transition to the new position and target
        const initPosition = this.cameraManager.previousCamera.position.clone();
        var currentPosition = initPosition;
        const finalPosition = cameraPosition;

        if (finalPosition.y < radius * 2) {
            finalPosition.y = radius * 2;
        }

        const initTarget = this.cameraManager.previousControls.target.clone();
        var currentTarget = initTarget;
        const finalTarget = center;

        this.cameraManager.camera.position.copy(initPosition);
        this.cameraManager.camera.lookAt(initTarget);
        this.cameraManager.controls.target.copy(initTarget);
        this.cameraManager.controls.update();

        const extra_camera_parameters = { distance: distance };

        this._create_tween_animation(
            currentPosition,
            currentTarget,
            finalPosition,
            finalTarget,
            extra_camera_parameters
        );
    }

    _zoom_orthographic(object) {
        // console.log("orthographic");

        const margin = 10;

        // Bounding sphere
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);
        const center = sphere.center;
        const radius = sphere.radius;

        const rotation = this.cameraManager.camera.quaternion;

        var current_position = this.cameraManager.camera.position.clone();
        var current_target = new THREE.Vector3(
            this.cameraManager.camera.position.x,
            0,
            this.cameraManager.camera.position.z
        );

        const final_position = new THREE.Vector3(
            center.x,
            this.cameraManager.camera.position.y,
            center.z
        );
        const final_target = new THREE.Vector3(center.x, 0, center.z);

        // console.log("STARTING:")
        // console.log(this.cameraManager.camera.rotation);
        // console.log("########:")

        const extra_camera_parameters = {
            z_rotation: this.cameraManager.camera.rotation.z,
        };

        this._create_tween_animation(
            current_position,
            current_target,
            final_position,
            final_target,
            extra_camera_parameters
        );

        // this.orthographicCamera.top = halfHeight;
        // this.orthographicCamera.bottom = -halfHeight;
        // this.orthographicCamera.right = halfWidth;
        // this.orthographicCamera.left = -halfWidth;

        // this.orthographicCamera.zoom = 1;

        // this.orthographicCamera.lookAt(this.controls.target);

        // this.mapControls.maxPolarAngle = 0 * Math.PI;

        // this.orthographicCamera.updateProjectionMatrix();

        // this.cameraManager.camera.autoRotate = true;

        // this.cameraManager.camera.position.x = center.x;
        // this.cameraManager.camera.position.z = center.z;

        // this.cameraManager.camera.lookAt(center);
        // this.cameraManager.camera.applyQuaternion(rotation);

        // // this.cameraManager.camera.updateProjectionMatrix();

        // this.cameraManager.controls.target.copy(center);
        // this.cameraManager.controls.update();
    }

    // Operates on the current camera
    _create_tween_animation(
        current_position,
        current_target,
        final_position,
        final_target,
        extra_camera_parameters = {}
    ) {
        // Lock the camera from changing modes

        const current_values = {
            position: current_position,
            target: current_target,
        };

        const tweenCamera = new Tween(current_values, false)
            .to(
                {
                    position: {
                        x: final_position.x,
                        y: final_position.y,
                        z: final_position.z,
                    },
                    target: {
                        x: final_target.x,
                        y: final_target.y,
                        z: final_target.z,
                    },
                },
                1000
            )
            .easing(Easing.Quadratic.InOut) // Use an easing function to make the animation smooth.
            .onUpdate(() => {
                this.cameraManager.camera.position.copy(
                    current_values.position
                );
                this.cameraManager.camera.lookAt(current_values.target);
                this.cameraManager.controls.target.copy(current_values.target);
                this.cameraManager.controls.update();

                // if (this.cameraManager.usesOrthographicCamera()) {
                //     this.cameraManager.camera.rotation.z = extra_camera_parameters.z_rotation;
                //     console.log(this.cameraManager.camera.rotation);
                // }
            })
            .onComplete(() => {
                if (this.cameraManager.usesOrbitCamera()) {
                    this.cameraManager.controls.minDistance =
                        extra_camera_parameters.distance * 0.5;
                    this.cameraManager.controls.maxDistance =
                        extra_camera_parameters.distance * 3;
                }

                // if (this.cameraManager.usesOrthographicCamera()) {
                //     console.log("########");
                //     console.log("FINISHED");
                //     console.log(this.cameraManager.camera.rotation);
                //     console.log("########");
                //     this.cameraManager.camera.rotation.z = extra_camera_parameters.z_rotation;

                //     this.cameraManager.camera.updateProjectionMatrix();
                // }

                // Remove from the list of tween when completed
                const idx = this.tweens.indexOf(tweenCamera);
                if (idx !== -1) this.tweens.splice(idx, 1);
            })
            .start();

        this.tweens.push(tweenCamera);
    }

    zoom_on_object(object) {
        if (this.cameraManager.usesOrthographicCamera()) {
            this._zoom_orthographic(object);
        } else {
            this._zoom_perspective(object);
        }
    }

    _pickEvent(pos) {
        if (this.controlsManager.cameraMovedDuringTouch) {
            return;
        }

        this.picker.pick(pos, this.scene, this.cameraManager.camera);

        if (this.picker.isObject) {
            const object = this.picker.picked[0];

            this.buildingView.set_target(object.name);

            this.zoom_on_object(object);
        } else if (!this.cameraManager.usesOrthographicCamera()) {
            this.buildingView.set_target(undefined);

            this.controlsManager.activateMap();

            const { x, y, z } = this.cameraManager.previousCamera.position;
            this.cameraManager.camera.position.set(x, y, z);
            this.cameraManager.controls.target.copy(
                this.cameraManager.previousControls.target
            );
            this.cameraManager.controls.update();
        }
    }

    _attachEvents() {
        // // mouse move → hover
        // window.addEventListener('mousemove', (e) => {
        //     const pos = getCanvasRelativePosition(e, this.glContainer);
        //     this.picker.hover(pos, this.scene, this.cameraManager.camera);
        //     this.render();
        // });

        // click → pick
        window.addEventListener("mousedown", (e) => {
            this.controlsManager.resetTouchState();
        });
        window.addEventListener("mouseup", (e) => {
            const pos = getCanvasRelativePosition(e, this.glContainer);
            const clicked_element = document.elementFromPoint(e.pageX, e.pageY);
            if (
                clicked_element.nodeName &&
                clicked_element.nodeName == "CANVAS"
            ) {
                this._pickEvent(pos);
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
                this.setOutline(this.buildings, "lod_2", "default");
            },
            undefined,
            function (error) {
                console.error(error);
            }
        );
    }

    async loadIcon() {
        const paths = [
            "assets/threejs/graphics/icons/home.svg",
            "assets/threejs/graphics/icons/cafe.svg",
            "assets/threejs/graphics/icons/library.svg",
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
            this.zoom_on_object(building);
            console.log(`Clicked on a icon!`);
        };

        // Put everything together
        const iconSet = new IconSet("BK", icons, text, position, onClick);

        // Add it to the scene
        this.iconsSceneManager.addIconSet(iconSet);

        // const logIconClick = (e, evtType) => {
        //     if (iconSet.wrapper.contains(e.target)) {
        //         console.log(evtType);
        //     }
        // };

        // const events = ["pointerdown", "pointermove", "pointerup"];
        // events.map((evtType) =>
        //     this.mainContainer.addEventListener(evtType, (e) => {
        //         if (evtType == "pointerdown") {
        //             e.target.setPointerCapture(e.pointerId);
        //         }
        //         logIconClick(e, evtType);
        //     })
        // );

        // this.mainContainer.addEventListener("pointerdown", (e) => {
        //     e.target.setPointerCapture(e.pointerId);
        //     console.log("pointerdown", e.target);
        // });
        // this.mainContainer.addEventListener("pointermove", (e) => {
        //     console.log("pointermove", e.target);
        // });
        // this.mainContainer.addEventListener("pointerup", (e) => {
        //     console.log("pointerup", e.target);
        // });
        // this.mainContainer.addEventListener("click", (e) => {
        //     console.log("click", e.target);
        // });
    }

    render(time) {
        // this._resizeRenderer();
        this.tweens.forEach((tween) => tween.update(time));
        // this.glRenderer.render(this.scene, this.cameraManager.camera);
        this.outlineManager.render(time, this.cameraManager);
        this.iconsSceneManager.render(time, this.cameraManager);
        this.light.position.copy(this.cameraManager.camera.position);
        this.light.target.position.copy(this.cameraManager.controls.target);
        requestAnimationFrame(this.render);
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

    setOutline(objectList, lod = "lod_2", style) {
        const outlineObjects = [];
        for (const obj of objectList) {
            const target = this.scene.getObjectByName(`${obj}-${lod}`);
            if (target) outlineObjects.push(target);
        }

        this.outlineManager.outlineObjects(outlineObjects, style);
    }
}

// sample thematic layers to add:
// Lactation Room	E1-6
// Contemplation room	E1-8 - there are none in BK?
// All-gender restroom	S1-3
// Accessible toilet	S2
