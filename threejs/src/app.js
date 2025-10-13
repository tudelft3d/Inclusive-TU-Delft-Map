import { CamerasControls } from "./camera";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition } from "./utils";
import { ControlsManager } from "./controls";
import { Tween, Easing } from 'https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js'
import { addBasemap } from "./basemap";
import proj4 from 'https://cdn.jsdelivr.net/npm/proj4@2.9.0/+esm';
// import { lodVis } from "./utils";
// import { loadGLTFTranslateX, loadGLTFTranslateY } from "./constants";


export class Map {
    constructor(container) {
        this.container = container;
        this.activeBasemap = null;
        this.userLocationMarker = null;

        // Cameras and controls
        const cameraPosition = new THREE.Vector3(0, 1000, 0);
        const cameraLookAt = new THREE.Vector3(0, 0, 0);
        this.cameraManager = new CamerasControls(container, cameraPosition, cameraLookAt, true);

        this.infoPane = document.getElementById('info-pane');
        this.picker = new ObjectPicker(this.infoPane);
        this.controlsManager = new ControlsManager(this.container, this.cameraManager);

        this.tweens = new Array();

        this._initScene();
        this._initLights();
        this.setBasemap();
        this._initRenderer();
        this._attachEvents();

        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);

    }

    _initScene() {
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
        this._resizeRenderer();
    }

    /* Convert GPS coordinates (lat/lon) to map's local coordinates */
    latLonToLocal(lat, lon) {
        // Define coordinate systems
        // WGS84 (GPS coordinates)
        const wgs84 = 'EPSG:4326';

        // RD New (Rijksdriehoek) - Dutch coordinate system
        const rdNew = '+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs';

        // Convert GPS to RD coordinates using proj4
        const [rdX, rdY] = proj4(wgs84, rdNew, [lon, lat]);

        console.log(`GPS (${lat}, ${lon}) -> RD (${rdX}, ${rdY})`);

        // RD coordinates ARE the local model coordinates
        const x = rdX;
        const z = -rdY; // Negative Z because of coordinate system orientation

        console.log(`RD (${rdX}, ${rdY}) -> Local (${x}, ${z})`);

        return { x, z };
    }

    /* Get user location and zoom to it */
    getUserLocationAndZoom() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        console.log('Requesting user location...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const accuracy = position.coords.accuracy;

                console.log(`User location: ${lat}, ${lon} (accuracy: ${accuracy}m)`);

                // Convert GPS to local coordinates
                const local = this.latLonToLocal(lat, lon);

                // Add a marker at the user's location
                this.addUserLocationMarker(local.x, local.z);

                // Zoom to the location
                this.cameraManager.zoomToLocation(local.x, local.z);
            },
            (error) => {
                let message = 'Unable to retrieve your location';
                switch(error.code) {
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
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    }

    /* Add a visual marker at user's location */
    addUserLocationMarker(x, z) {
        // Remove previous marker if it exists
        if (this.userLocationMarker) {
            this.scene.remove(this.userLocationMarker);
        }

        // Create a LARGE marker so it's easy to find for debugging
        const markerGroup = new THREE.Group();

        // Inner dot - make it bigger
        const dotGeometry = new THREE.SphereGeometry(20, 16, 16);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000, // Changed to red for visibility
            transparent: true,
            opacity: 1
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        markerGroup.add(dot);

        // Outer ring (for pulsing effect)
        const ringGeometry = new THREE.RingGeometry(25, 30, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF0000, // Changed to red for visibility
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = -Math.PI / 2; // Lay flat
        markerGroup.add(ring);

        markerGroup.position.set(x, 1, z); // Position higher above ground

        this.userLocationMarker = markerGroup;
        this.scene.add(this.userLocationMarker);

        console.log('====== USER LOCATION MARKER ======');
        console.log(`Marker position: X=${x}, Z=${z}`);
        console.log('===================================');

        // Also log the current camera position for reference
        console.log('Current camera position:', this.cameraManager.camera.position);
        console.log('Current camera target:', this.cameraManager.controls.target);
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

        if (finalPosition.y < radius* 2) {
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

        this.cameraManager.camera.autoRotate = true;

        console.log(this.cameraManager.controls);


        this.cameraManager.camera.position.x = center.x;
        this.cameraManager.camera.position.z = center.z;

        this.cameraManager.camera.lookAt(center);
        this.cameraManager.camera.applyQuaternion(rotation);

        // this.cameraManager.camera.updateProjectionMatrix();

        this.cameraManager.controls.target.copy(center);
        this.cameraManager.controls.update();

    }

     zoom_on_object(object) {

        if (this.cameraManager.orthographic) {
                this._zoom_orthographic(object);
                return;
            } else {
                this._zoom_perspective(object);
        }

     }

    _pickEvent(pos) {
        if (this.controlsManager.cameraMovedDuringTouch) { return }

        const foundObject = this.picker.pick(pos, this.scene, this.cameraManager.camera);

        if (foundObject) {

            const object = this.picker.picked;

            this.zoom_on_object(object);

        } else {

            if (!this.cameraManager.orthographic) {

                this.controlsManager.activateMap();

                const { x, y, z } = this.cameraManager.previousCamera.position;
                this.cameraManager.camera.position.set(x, y, z);
                this.cameraManager.controls.target.copy(this.cameraManager.previousControls.target);
                this.cameraManager.controls.update();
            }
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
            this._pickEvent(pos);
        });

        // touch handling (mirrors the mouse logic)
        window.addEventListener('touchend', (e) => {
            const touch = e.changedTouches[0];
            const pos = getCanvasRelativePosition(touch, this.canvas);
            this._pickEvent(pos);
        });

        // // control change → re‑render
        // this.controlsManager.onChange(() => this.render());

        // // window resize
        // window.addEventListener('resize', () => this.render());
    }

    _resizeRenderer() {
        const { clientWidth: w, clientHeight: h } = this.canvas;
        this.renderer.setSize(w, h, false);
        this.cameraManager.camera.aspect = w / h;
        this.cameraManager.camera.updateProjectionMatrix();
    }

    loadGLTF(path) {
        const loader = new GLTFLoader();
        const scene = this.scene
        loader.load(path, (gltf) => {
            let objs = gltf.scene;
            objs.rotateX(-Math.PI / 2);
            // objs.translateX(loadGLTFTranslateX);
            // objs.translateY(loadGLTFTranslateY);

            const box = new THREE.Box3().setFromObject(objs);
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());

            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.cameraManager.camera.fov * (Math.PI / 180);
            let cameraZ = maxDim / (2 * Math.tan(fov / 2));

            cameraZ *= 1.5; // add margin

            console.log("gltf", gltf);

            // load only lod2 on startup
            this.model = objs;
            this.lodVis();
            scene.add(objs);

            // if (child.name.startsWith("08")) child.visible = false;
            // if (child.name != "08-lod_2") child.visible = false;
            // if (child.name == "world" || child.name == "08" || child.name == "08-lod_2" || child.name == "") {
            //     child.visible = true;
            // } else { child.visible = false; }
            // });
            this.cameraManager.camera.position.set(center.x, center.y + maxDim * 0.5, center.z + cameraZ);
            this.cameraManager.controls.target.copy(center);
            this.cameraManager.controls.update();
        }, undefined, function (error) {
            console.error(error);
        });
        // this.render();
    }

    render(time) {
        this._resizeRenderer();
        this.tweens.forEach(tween => tween.update(time));
        this.renderer.render(this.scene, this.cameraManager.camera);
        requestAnimationFrame(this.render);
    }

    lodToggle(level) {
        this.lodVis(level);
    }

    lodVis(lod = 'lod_2') {
        this.model.traverse((child) => {
            child.visible = false;
            if (child.isMesh) {
                child.material.side = THREE.DoubleSide;
            }
            if (child.name.includes(lod)) {
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