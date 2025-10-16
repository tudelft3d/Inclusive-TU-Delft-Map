import { CamerasControls } from "./camera";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition, cj2gltf } from "./utils";
import { ControlsManager } from "./controls";
import { Tween, Easing } from 'https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js'
import { addBasemap } from "./basemap";
import proj4 from 'https://cdn.jsdelivr.net/npm/proj4@2.9.0/+esm';
import { OutlineManager } from "./outlines";
import cityjson from "../assets/threejs/buildings/attributes.city.json" assert {type: "json"};
// import { lodVis } from "./utils";
// import { loadGLTFTranslateX, loadGLTFTranslateY } from "./constants";
import { Icon, svgToCanvasTexture, svgToDiscTexture, IconsSceneManager } from './icons';

export class Map {
    constructor(container) {
        this.container = container;
        this.activeBasemap = null;
        this.buildingView;
        this.userLocationMarker = null;
        this.buildings = [];
        this.cityjson = cityjson;
        this.locationWatchId = null; // For tracking real-time location updates


        // Cameras and controls
        const cameraPosition = new THREE.Vector3(85715, 1100, -445780);
        const cameraLookAt = new THREE.Vector3(85743, 30, -445791);
        this.cameraManager = new CamerasControls(container, cameraPosition, cameraLookAt);

        this.infoPane = document.getElementById('info-pane');
        this.picker = new ObjectPicker(this.infoPane, this.buildingView);
        this.controlsManager = new ControlsManager(this.container, this.cameraManager);

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
        const color = 0xFFFFFF;
        const intensity = 1;

        // First light
        const light1 = new THREE.DirectionalLight(color, intensity);
        light1.position.set(0, 1, 1);
        light1.target.position.set(0, 0, 0);
        this.scene.add(light1);

        // Second light
        const light2 = new THREE.DirectionalLight(color, intensity);
        light2.position.set(0, 1, -1);
        light2.target.position.set(0, 0, 0);
        this.scene.add(light2);
    }

    setBasemap(url, layer) {
        if (this.activeBasemap) {
            this.scene.remove(this.activeBasemap);
        }
        this.activeBasemap = addBasemap(this.scene, url, layer);
    }

    _initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.canvas = this.renderer.domElement;
        this.container.appendChild(this.canvas);
        this._resizeWindow();
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

        this.userLocationMarker = markerGroup;
        this.scene.add(this.userLocationMarker);

        console.log(`Location marker updated at (${x}, ${z}) with accuracy ${accuracy}m`);
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
        const distance = radius / Math.tan(fov / 2) * margin;

        // Set camera position & orientation
        const direction = new THREE.Vector3()
            .subVectors(this.cameraManager.previousCamera.position, center)
            .normalize();
        const cameraPosition = center.clone().addScaledVector(direction, distance);

        // Transition to the new position and target
        const initPosition = this.cameraManager.previousCamera.position.clone();
        var currentPosition = initPosition;
        const finalPosition = cameraPosition

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

        const currentValues = { position: currentPosition, target: currentTarget }

        const tweenCamera = new Tween(currentValues, false)
            .to({
                position: { x: finalPosition.x, y: finalPosition.y, z: finalPosition.z },
                target: { x: finalTarget.x, y: finalTarget.y, z: finalTarget.z },
            }, 1000)
            .easing(Easing.Quadratic.InOut) // Use an easing function to make the animation smooth.
            .onUpdate(() => {
                this.cameraManager.camera.position.copy(currentValues.position);
                this.cameraManager.camera.lookAt(currentValues.target);
                this.cameraManager.controls.target.copy(currentValues.target);
                this.cameraManager.controls.update();
            })
            .onComplete(() => {
                this.cameraManager.controls.minDistance = distance * 0.5;
                this.cameraManager.controls.maxDistance = distance * 3;

                // Remove from the list of tween when completed
                const idx = this.tweens.indexOf(tweenCamera);
                if (idx !== -1) this.tweens.splice(idx, 1);
            })
            .start()

        this.tweens.push(tweenCamera);

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

        // this.orthographicCamera.top = halfHeight;
        // this.orthographicCamera.bottom = -halfHeight;
        // this.orthographicCamera.right = halfWidth;
        // this.orthographicCamera.left = -halfWidth;

        // this.orthographicCamera.zoom = 1;

        // this.orthographicCamera.lookAt(this.controls.target);

        // this.mapControls.maxPolarAngle = 0 * Math.PI;

        // this.orthographicCamera.updateProjectionMatrix();

        // this.cameraManager.camera.autoRotate = true;

        this.cameraManager.camera.position.x = center.x;
        this.cameraManager.camera.position.z = center.z;

        this.cameraManager.camera.lookAt(center);
        this.cameraManager.camera.applyQuaternion(rotation);

        // this.cameraManager.camera.updateProjectionMatrix();

        this.cameraManager.controls.target.copy(center);
        this.cameraManager.controls.update();

    }

    zoom_on_object(object) {
        if (this.cameraManager.usesOrthographicCamera()) {
            this._zoom_orthographic(object);
        } else {
            this._zoom_perspective(object);
        }
    }

    _pickEvent(pos) {
        if (this.controlsManager.cameraMovedDuringTouch) { return }

        const foundObject = this.picker.pick(pos, this.scene, this.cameraManager.camera);

        if (foundObject) {

            const object = this.picker.picked;

            this.buildingView.set_target(object.name);

            this.zoom_on_object(object);

        } else if (!this.cameraManager.usesOrthographicCamera()) {

            this.controlsManager.activateMap();

            const { x, y, z } = this.cameraManager.previousCamera.position;
            this.cameraManager.camera.position.set(x, y, z);
            this.cameraManager.controls.target.copy(this.cameraManager.previousControls.target);
            this.cameraManager.controls.update();
        }

    }

    _attachEvents() {
        // // mouse move → hover
        // window.addEventListener('mousemove', (e) => {
        //     const pos = getCanvasRelativePosition(e, this.canvas);
        //     this.picker.hover(pos, this.scene, this.cameraManager.camera);
        //     this.render();
        // });

        // click → pick
        window.addEventListener('mousedown', (e) => {
            this.controlsManager.resetTouchState();
        });
        window.addEventListener('mouseup', (e) => {
            const pos = getCanvasRelativePosition(e, this.canvas);

            const clicked_element = document.elementFromPoint(e.pageX, e.pageY);

            if (clicked_element.nodeName == "CANVAS") {
                this._pickEvent(pos);
            }


        });

        // touch handling (mirrors the mouse logic)
        window.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const pos = getCanvasRelativePosition(touch, this.canvas);

            const clicked_element = document.elementFromPoint(e.pageX, e.pageY);

            if (clicked_element.nodeName == "CANVAS") {
                this._pickEvent(pos);
            }

            this._pickEvent(pos);
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
            // objs.translateX(loadGLTFTranslateX);
            // objs.translateY(loadGLTFTranslateY);

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

            // if (child.name.startsWith("08")) child.visible = false;
            // if (child.name != "08-lod_2") child.visible = false;
            // if (child.name == "world" || child.name == "08" || child.name == "08-lod_2" || child.name == "") {
            //     child.visible = true;
            // } else { child.visible = false; }
            // });

            // Old camera positioning based on model bounds
            // this.cameraManager.camera.position.set(center.x, center.y + maxDim * 0.5, center.z + cameraZ);
            // this.cameraManager.controls.target.copy(center);

            // // New standard view position and target
            // this.cameraManager.camera.position.set(85715.53268458637, 1099.5279016009758, -445779.7690020757);
            // this.cameraManager.controls.target.set(85743.30835529274, 43.249941349128534, -445791.2428672409);

            // this.cameraManager.controls.update();
            // this.cameraManager.setHomeView();

            const buildingOutline = [];
            for (const [id, obj] of Object.entries(this.cityjson.CityObjects)) {
                if (obj.type !== "Building") continue;
                buildingOutline.push(obj.attributes.key);
            }
            this.buildings = buildingOutline;
            this.setOutline(this.buildings, 'lod_2', 'default');
            // this.outlineManager.composers

        }, undefined, function (error) {
            console.error(error);
        });
        // this.render();
    }

    async loadIcon(path) {
        const iconTexture = await svgToDiscTexture(path, 256, '#f5ab56');
        var position = new THREE.Vector3(85190.36380133804, 33.5478593669161, -446862.7335885112);
        const size = 20;
        position = position.add(new THREE.Vector3(0, size / 2, 0));
        const icon = new Icon(iconTexture, position);
        this.iconsSceneManager.addIcon(icon);
    }

    render(time) {
        // this._resizeRenderer();
        this.tweens.forEach(tween => tween.update(time));
        // this.renderer.render(this.scene, this.cameraManager.camera);
        this.outlineManager.render(time, this.cameraManager);
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

    setOutline(objectList, lod = 'lod_2', style) {

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