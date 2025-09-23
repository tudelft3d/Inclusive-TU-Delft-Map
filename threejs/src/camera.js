import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { PerspectiveCamera } from 'three';
import * as THREE from 'three';

const fov = 75;
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 10000;

export class CamerasControls {
    // container: Element;
    // camera: THREE.PerspectiveCamera;
    // controls: OrbitControls | MapControls;
    // previousCamera: THREE.PerspectiveCamera;
    // previousControls: OrbitControls | MapControls;
    // mapCamera: THREE.PerspectiveCamera;
    // mapControls: MapControls;
    // orbitCamera: THREE.PerspectiveCamera;
    // orbitControls: OrbitControls;

    constructor(container, position, lookAt, startMap = true) {

        this.container = container;

        this._initCameras(position, startMap);
        this._initControls(lookAt, startMap);
    }

    _initCameras(position, startMap) {
        this.mapCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.orbitCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        if (startMap) {
            this.camera = this.mapCamera;
            this.previousCamera = this.mapCamera;
        } else {
            this.camera = this.orbitCamera;
            this.previousCamera = this.orbitCamera;
        }
        this.camera.position.set(position.x, position.y, position.z);
    }

    _initControls(lookAt, startMap) {
        this.mapControls = new MapControls(this.mapCamera, this.container);
        this.mapControls.target.set(lookAt.x, lookAt.y, lookAt.z);
        this.mapControls.maxPolarAngle = 0.49 * Math.PI;
        this.mapControls.update();

        this.orbitControls = new OrbitControls(this.orbitCamera, this.container);
        this.orbitControls.target.set(lookAt.x, lookAt.y, lookAt.z);
        // this.orbitControls.maxPolarAngle = 0.49 * Math.PI;
        this.orbitControls.update();

        if (startMap) {
            this.controls = this.mapControls;
            this.previousControls = this.mapControls;
        } else {
            this.controls = this.orbitControls;
            this.previousControls = this.orbitControls;

        }
    }

    /** Swith to map view */
    switchToMap() {
        this.previousCamera = this.camera;
        this.previousControls = this.controls;

        this.camera = this.mapCamera;
        this.controls = this.mapControls;
        this._syncPositions(this.previousCamera);
    }

    /** Switch to orbit view */
    switchToOrbit() {
        this.previousCamera = this.camera;
        this.previousControls = this.controls;

        this.camera = this.orbitCamera;
        this.controls = this.orbitControls;
        this._syncPositions(this.previousCamera);
    }

    /** Keep the visual position when swapping cameras */
    _syncPositions(sourceCam) {
        // if (!sourceCam) return;
        // const { x, y, z } = sourceCam.position;
        // this.camera.position.set(x, y, z);
    }

    zoomIn(factor=1.1) {
        if (this.controls._dollyOut) {
            this.controls._dollyOut(factor);
            this.controls.update();
        } 
        else if (this.camera.isPerspectiveCamera) {
            this.camera.position.multiplyScalar(factor);
        }
    }

    zoomOut(factor=1.1) {
        if (this.controls._dollyIn) {
            this.controls._dollyIn(factor);
            this.controls.update();
        } 
        else if (this.camera.isPerspectiveCamera) {
            this.camera.position.multiplyScalar(1/factor);
        }
    }
}