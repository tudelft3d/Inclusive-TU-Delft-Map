import { CamerasControls } from "./camera";
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadGLTFTranslateX, loadGLTFTranslateY } from "./constants";
import { ObjectPicker } from "./objectPicker";
import { getCanvasRelativePosition } from "./utils";
import { ControlsManager } from "./controls";
import { Group, Tween, Easing } from 'https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js'
import { addBasemap } from "./basemap";


export class Map {
    constructor(container) {
        this.container = container;
        this.activeBasemap = null;

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
        loader.setPath('assets/graphics/');
        const skyboxTexture = loader.load([
            'sky_gradient_sides.png',
            'sky_gradient_sides.png',
            'sky_gradient_upper.png',
            'sky_gradient_lower.png',
            'sky_gradient_sides.png',
            'sky_gradient_sides.png',
        ]);
        this.scene.background = skyboxTexture;
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

    _pickEvent(pos) {
        if (this.controlsManager.cameraMovedDuringTouch) { return }
        const foundObject = this.picker.pick(pos, this.scene, this.cameraManager.camera);

        if (foundObject) {
            // Orbit around the found object
            const object = this.picker.picked;
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
        else {
            // Go back to the main map view
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

            // scene.add(objs);

            objs.traverse((child) => {
                console.log(child);
                // if (child.name.startsWith("08")) child.visible = false;
                // if (child.name != "08-lod_2") child.visible = false;
                if (child.name == "world" || child.name == "08" || child.name == "08-lod_2" || child.name == "") {
                    child.visible = true;
                } else { child.visible = false; }
            });
            scene.add(objs);

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
        // console.log(this.tweens);
        this.tweens.forEach(tween => tween.update(time));
        this.renderer.render(this.scene, this.cameraManager.camera);
        requestAnimationFrame(this.render);
    }
}



// export class PDOKProvider extends MapProvider
// {
//     constructor() {
//         super();
//         this.layer = 'Actueel_ortho25';
//         this.matrixSet = 'EPSG:3857';
//         this.format = 'image/png';
//         this.style = 'default';
//         this.baseURL = "https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/";
//     }

//     fetchTile(zoom, x, y) {
//         const url = `${this.baseURL}?service=WMTS&request=GetTile&version=1.0.0&layer=${this.layer}&style=${this.style}&tilematrixset=${this.matrixSet}&format=${this.format}&tilematrix=${zoom}&tilecol=${x}&tilerow=${y}`;
// 	        return new Promise((resolve, reject) => {
// 	            const image = document.createElement('img');
// 	            image.onload = function () {
// 	                resolve(image);
// 	            };
// 	            image.onerror = function () {
// 	                reject();
// 	            };
// 	            image.crossOrigin = 'Anonymous';
// 	            image.src = url;
// 	        });
// 	    }

// }