import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';

// import * as constants from 'constants';

import * as THREE from 'three';


const MAP_CAMERA = 0;
const ORBIT_CAMERA = 1;
const ORTHOGRAPHIC_CAMERA = 2;


const fov = 75;
// const aspect = window.innerWidth / window.innerHeight;
const near = 0.1;
const far = 100000;

const frustumSize = 1;

function frustrumHeight(camera, distance) {
    const field_of_view = (camera.fov * Math.PI) / 180;
    return Math.tan(field_of_view / 2) * distance * 2;
}

function frustrumWidth(camera, distance) {
    return frustrumHeight(camera, distance) * camera.aspect;
}


export class CamerasControls {
    constructor(container, position, target) {
        this.container = container;

        this._initCameras(position);
        this._initControls(target);

        this.cameraInt = MAP_CAMERA;

        // Initial compass rotation
        this.compassElement = null;
    }

    _changeCameraInt(newCameraInt) {
        if (![MAP_CAMERA, ORBIT_CAMERA, ORTHOGRAPHIC_CAMERA].includes(newCameraInt)) {
            console.error("Unexpected input to '_changeCameraInt'.");
        }

        this.cameraInt = newCameraInt;

        this.previousCamera = this.camera;
        this.previousControls = this.controls;

        if (this.usesMapCamera()) {
            this.camera = this.mapCamera;
            this.controls = this.mapControls;
        } else if (this.usesOrbitCamera()) {
            this.camera = this.orbitCamera;
            this.controls = this.orbitControls;
        } else if (this.usesOrthographicCamera()) {
            this.camera = this.orthographicCamera;
            this.controls = this.orthographicControls;
        }
    }

    usesMapCamera() {
        return this.cameraInt == MAP_CAMERA;
    }

    usesOrbitCamera() {
        return this.cameraInt == ORBIT_CAMERA;
    }

    usesOrthographicCamera() {
        return this.cameraInt == ORTHOGRAPHIC_CAMERA;
    }

    // Method to set the compass element
    setCompassElement(element) {
        this.compassElement = element;
    }

    // Method to calculate and update compass rotation
    updateCompassRotation() {
        if (!this.compassElement) return;

        // Get camera direction vector (horizontal plane only)
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        // Project onto horizontal plane (ignore Y component)
        direction.y = 0;
        direction.normalize();

        // Calculate angle from north (positive Z axis), in degrees
        const angle = Math.atan2(direction.x, direction.z);
        const degrees = THREE.MathUtils.radToDeg(angle) + 180;

        // Apply rotation to compass
        this.compassElement.style.transform = `rotate(${degrees}deg)`;
    }

    _initCameras(position) {
        const aspect = window.innerWidth / window.innerHeight;
        this.mapCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.orbitCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.orthographicCamera = new THREE.OrthographicCamera((frustumSize * aspect) / - 2, (frustumSize * aspect) / 2, frustumSize / 2, frustumSize / - 2, 0, 100000);

        this.camera = this.mapCamera;
        this.previousCamera = this.mapCamera;

        this.initialPosition = new THREE.Vector3().copy(position);
        this.camera.position.copy(this.initialPosition);
        this.camera.updateProjectionMatrix();
    }


    _initControls(target) {
        this.mapControls = new MapControls(this.mapCamera, this.container);
        this.mapControls.target.copy(target);
        this.mapControls.maxPolarAngle = 0.49 * Math.PI;
        this.mapControls.update();

        this.orbitControls = new OrbitControls(this.orbitCamera, this.container);
        this.orbitControls.target.copy(target);
        this.orbitControls.maxPolarAngle = 0.49 * Math.PI;
        this.orbitControls.enablePan = false;
        this.orbitControls.update();

        this.orthographicControls = new MapControls(this.orthographicCamera, this.container);
        this.orthographicControls.target.copy(target);
        this.orthographicControls.screenSpacePanning = true;
        this.orthographicControls.maxPolarAngle = 0.0 * Math.PI;
        this.orthographicControls.enableDampening = true;
        this.orthographicControls.update()

        this.controls = this.mapControls;
        this.previousControls = this.mapControls;

        this.initialTarget = target.clone();
        this.controls.target.copy(this.initialTarget);
        this.controls.update();

    }

    // setInitial(position, target) {
    //     this.initialPosition = new THREE.Vector3(position.x, position.y, position.z);
    //     this.initialTarget = new THREE.Vector3(target.x, target.y, target.z);
    //     this.camera.position.set(position.x, position.y, position.z);
    //     this.controls.target.set(target.x, target.y, target.z);
    //     this.camera.updateProjectionMatrix();
    //     this.controls.update();
    // }

    resizeCameras(width, height) {
        const aspect = width / height;

        this.mapCamera.aspect = aspect;
        this.mapCamera.updateProjectionMatrix();
        this.orbitCamera.aspect = aspect;
        this.orbitCamera.updateProjectionMatrix();

        this.orthographicCamera.aspect = aspect;
        // this.orthographicCamera.left = (frustumSize * aspect) / - 2;
        // this.orthographicCamera.right = (frustumSize * aspect) / 2;
        // this.orthographicCamera.top = frustumSize / 2;
        // this.orthographicCamera.bottom = frustumSize / -2;

        this.orthographicCamera.position.copy(this.controls.target);
        this.orthographicCamera.position.y = 1000;

        const distance = this.camera.position.distanceTo(this.controls.target);
        const halfHeight = frustrumHeight(this.mapCamera, distance) / 2;
        const halfWidth = frustrumWidth(this.mapCamera, distance) / 2;

        this.orthographicCamera.top = halfHeight;
        this.orthographicCamera.bottom = -halfHeight;
        this.orthographicCamera.right = halfWidth;
        this.orthographicCamera.left = -halfWidth;

        this.orthographicCamera.updateProjectionMatrix();
    }

    /** Swith to map view */
    switchToMap() {
        console.log("Switching to map");
        if (this.usesOrthographicCamera()) {
            console.log(this.camera.quaternion);
            const frustrumHeight = this.orthographicCamera.top * 2;
            const field_of_view = (this.mapCamera.fov * Math.PI) / 180;
            const distance = frustrumHeight / (2 * Math.tan(field_of_view / 2)) / this.orthographicCamera.zoom;

            const newTarget = this.orthographicControls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget.clone().add(new THREE.Vector3(0, distance, 0));

            this.mapCamera.position.copy(newPosition);
            this.mapControls.target.copy(newTarget);

            this.mapCamera.updateProjectionMatrix();
            this.mapControls.update();
        } else if (this.usesOrbitCamera()) {
            // Nothing to do
        }

        this._changeCameraInt(MAP_CAMERA);
    }

    /** Switch to orbit view */
    switchToOrbit() {
        console.log("Switching to orbit");
        if (this.usesOrthographicCamera()) {
            this.switchToMap();
        } else if (this.usesMapCamera()) {
            // Nothing to do
        }

        this._changeCameraInt(ORBIT_CAMERA);
    }

    // Largely influenced by: https://gist.github.com/nickyvanurk/9ac33a6aff7dd7bd5cd5b8a20d4db0dc

    /** Switch to orthographic view */
    switchToOrthographic() {
        console.log("Switching to orthographic");
        if (this.usesMapCamera() || this.usesOrbitCamera()) {
            console.log(this.camera.quaternion);
            // Where we end up
            const newTarget = this.controls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget.clone().add(new THREE.Vector3(0, 1000, 0));
            this.orthographicCamera.position.copy(newPosition);
            this.orthographicControls.target.copy(newTarget);
            // this.orthographicCamera.quaternion.copy(this.camera.quaternion);
            // this.orthographicCamera.up.copy(this.camera.up);

            const distance = this.camera.position.distanceTo(this.controls.target);
            const halfHeight = frustrumHeight(this.camera, distance) / 2;
            const halfWidth = frustrumWidth(this.camera, distance) / 2;

            this.orthographicCamera.top = halfHeight;
            this.orthographicCamera.bottom = -halfHeight;
            this.orthographicCamera.right = halfWidth;
            this.orthographicCamera.left = -halfWidth;

            this.orthographicCamera.zoom = 1;

            this.orthographicCamera.updateProjectionMatrix();
            this.orthographicControls.update();
        }

        this._changeCameraInt(ORTHOGRAPHIC_CAMERA);
    }

    toggleOrthographic() {
        if (this.cameraInt != ORTHOGRAPHIC_CAMERA) {
            this.switchToOrthographic();
        } else {
            this.switchToMap();
        }
    }

    /** Keep the visual position when swapping cameras */
    // _syncPositions(sourceCam) {
    // if (!sourceCam) return;
    // const { x, y, z } = sourceCam.position;
    // this.camera.position.set(x, y, z);
    // }

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

    /* Update the home position to initial camera state (after having moved towards GLTF scene) */
    setHomeView() {
        console.log("Setting home view");
        this.initialPosition.copy(this.camera.position);
        this.initialTarget.copy(this.controls.target);
    }

    /* Reset camera to initial position and orientation */
    resetView() {
        console.log("Resetting view");

        // Store the initial position and target when creating the camera
        if (this.initialPosition && this.initialTarget) {
            this.camera.position.copy(this.initialPosition);
            this.controls.target.set(this.initialTarget.x, this.initialTarget.y, this.initialTarget.z);

            // Reset zoom for orthographic camera
            if (this.usesOrthographicCamera()) {
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

        // Calculate the height difference between camera and target
        const heightDiff = this.camera.position.y - target.y;

        // Calculate horizontal distance maintaining total distance
        const horizontalDistance = Math.sqrt(Math.max(0, distance * distance - heightDiff * heightDiff));

        // Set camera position north of target (positive Z direction)
        // Maintain the same distance and height relative to target
        this.camera.position.set(
            target.x,
            this.camera.position.y,
            target.z + horizontalDistance
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