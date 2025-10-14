import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';

// import * as constants from 'constants';

import * as THREE from 'three';

const fov = 75;
const aspect = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 100000;

const frustrumSize = 1;

function frustrumHeight(camera, distance) {
    const field_of_view = (camera.fov * Math.PI) / 180;
    return Math.tan(field_of_view / 2) * distance * 2;
}

function frustrumWidth(camera, distance) {
    return frustrumHeight(camera, distance) * camera.aspect;
}

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

        this.orthographic = false;
        this.orbit = false;
    }

    _initCameras(position, startMap) {
        this.mapCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.orbitCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);

        this.orthographicCamera = new THREE.OrthographicCamera((frustrumSize * aspect) / - 2, (frustrumSize * aspect) / 2, frustrumSize / 2, frustrumSize / - 2, 0, 100000);

        // this.orthographicCamera.position.set(0, 1000, 0);

        if (startMap) {
            this.camera = this.mapCamera;
            this.previousCamera = this.mapCamera;
        } else {
            this.camera = this.orbitCamera;
            this.previousCamera = this.orbitCamera;
        }

        //this.camera.position.set(position.x, position.y, position.z);
        this.orthographicCamera.position.set(position.x, 1, position.z);

        // Save initial position for reset functionality
        this.initialPosition = new THREE.Vector3(position.x, position.y, position.z);
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

        // this.orthgraphicControls = new OrbitControls(this.orthographicCamera, this.container);
        // this.orthgraphicControls.target.set(lookAt.x, lookAt.y, lookAt.z);
        // this.orthgraphicControls.maxPolarAngle = 0 * Math.PI;
        // this.orthgraphicControls.enableDampening = true;

        // this.orthographicCamera.position.set(0, 1000, 0);

        // this.orthgraphicControls.update()


        // Save initial target for reset functionality
        this.initialTarget = new THREE.Vector3(lookAt.x, lookAt.y, lookAt.z);

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

        console.log("Switching to map");

        if (this.orthographic) {

            this.mapControls.maxPolarAngle = 0.49 * Math.PI;

            const y = this.mapCamera.position.y;
            this.mapCamera.position.copy(this.orthographicCamera.position);
            this.mapCamera.position.y = y / this.orthographicCamera.zoom;
            this.mapCamera.updateProjectionMatrix();
            this.camera = this.mapCamera;
            this.controls.object = this.mapCamera;

            this.orthographic = false;

            return;
        }

        this.previousCamera = this.camera;
        this.previousControls = this.controls;

        this.camera = this.mapCamera;
        this.controls = this.mapControls;
        this._syncPositions(this.previousCamera);
    }

    /** Switch to orbit view */
    switchToOrbit() {   

        if (this.orthographic) {

            this.orthographic = false;
            this.switchToMap();
        }

        console.log("Switching to orbit");

        this.previousCamera = this.camera;
        this.previousControls = this.controls;

        this.camera = this.orbitCamera;
        this.controls = this.orbitControls;
        this._syncPositions(this.previousCamera);
    }

    // Largely influenced by: https://gist.github.com/nickyvanurk/9ac33a6aff7dd7bd5cd5b8a20d4db0dc

    switch_to_orthographic() {

        if (this.orthographic == false) {

            console.log("Switching to orthographic");

            this.mapControls.maxPolarAngle = 0.01 * Math.PI;
            this.mapControls.minPolarAngle = 0.01 * Math.PI;

            this.previousCamera = this.camera;
            this.previousControls = this.controls;

            // Where we start
            this.orthographicCamera.position.copy(this.camera.position);

            // Where we want to go
            this.orthographicCamera.position.copy(this.controls.target);
            this.orthographicCamera.position.y = 1000;

            const distance = this.camera.position.distanceTo(this.controls.target);
            const halfHeight = frustrumHeight(this.camera, distance) / 2;
            const halfWidth = frustrumWidth(this.camera, distance) / 2;

            this.orthographicCamera.top = halfHeight;
            this.orthographicCamera.bottom = -halfHeight;
            this.orthographicCamera.right = halfWidth;
            this.orthographicCamera.left = -halfWidth;

            this.orthographicCamera.zoom = 1;

            this.orthographicCamera.lookAt(this.controls.target);
            // this.orthographicCamera.lookAt(this.orthographicCamera.position.x, 1, this.orthographicCamera.position.z);

            this.mapControls.maxPolarAngle = 0.01 * Math.PI;
            this.mapControls.minPolarAngle = 0.01 * Math.PI;

            this.orthographicCamera.updateProjectionMatrix();

            this.controls = this.mapControls;

            this.camera = this.orthographicCamera;
            this.controls.object = this.orthographicCamera;

            this.orthographic = true;

        }
    }

    toggle_orthographic() {

        if (this.orthographic == false) {
            this.switch_to_orthographic();
        } else {
            this.switchToMap();
        }

    }

    /** Keep the visual position when swapping cameras */
    _syncPositions(sourceCam) {
        // if (!sourceCam) return;
        // const { x, y, z } = sourceCam.position;
        // this.camera.position.set(x, y, z);
    }

    zoomIn(factor = 1.8) {
        if (this.controls._dollyOut) {
            this.controls._dollyOut(factor);
            this.controls.update();
        }
        else if (this.camera.isPerspectiveCamera) {
            this.camera.position.multiplyScalar(factor);
        }
    }

    zoomOut(factor = 1.8) {
        if (this.controls._dollyIn) {
            this.controls._dollyIn(factor);
            this.controls.update();
        }
        else if (this.camera.isPerspectiveCamera) {
            this.camera.position.multiplyScalar(1 / factor);
        }
    }

     /* Reset camera to initial position and orientation */
    resetView() {
        console.log("Resetting view");

        // Store the initial position and target when creating the camera
        if (this.initialPosition && this.initialTarget) {
            this.camera.position.copy(this.initialPosition);
            this.controls.target.copy(this.initialTarget);

            // Reset zoom for orthographic camera
            if (this.orthographic) {
                this.orthographicCamera.zoom = 1;
                this.orthographicCamera.updateProjectionMatrix();
            }

            this.controls.update();
        }
    }

    /* Reset camera rotation to point north (align with Z-axis) */
    resetNorth() {
        console.log("Resetting to north");

        // Get current target position
        const target = this.controls.target.clone();

        // Get current distance from camera to target
        const distance = this.camera.position.distanceTo(target);

        // Calculate the current height (y position)
        const currentHeight = this.camera.position.y;

        // Set camera position north of target
        // Maintain the same distance and height
        const horizontalDistance = Math.sqrt(distance * distance - currentHeight * currentHeight);

        this.camera.position.set(
            target.x,
            currentHeight,
            target.z - horizontalDistance
        );

        this.camera.lookAt(target);
        this.controls.update();
    }

    /* Zoom to a specific coordinate */
    zoomToLocation(x, z, height = 200) {
        console.log(`Zooming to location: ${x}, ${z}`);

        // Set the target to the location
        this.controls.target.set(x, 0, z);

        // Position camera above and slightly back from the target
        this.camera.position.set(x, height, z + 100);

        this.camera.lookAt(this.controls.target);
        this.controls.update();
    }
}