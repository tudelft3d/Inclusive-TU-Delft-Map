import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { Tween, Easing } from 'https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js'

import * as THREE from 'three';

const MAP_CAMERA = 0;
const ORBIT_CAMERA = 1;
const ORTHOGRAPHIC_CAMERA = 2;

const fov = 75;
const near = 0.1;
const far = 100000;
const frustumSize = 1;

const MIN_AZIMUTH_ANGLE = -Infinity
const MAX_AZIMUTH_ANGLE = Infinity

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
        this.previousCameraInt = ORTHOGRAPHIC_CAMERA;
        this.tweens = [];

        // Initial compass rotation
        this.compassElement = null;
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

        this.allCameras = [this.mapCamera, this.orbitCamera, this.orthographicCamera];
    }


    _initControls(target) {
        this.mapControls = new MapControls(this.mapCamera, this.container);
        this.mapControls.target.copy(target);
        this.mapControls.maxPolarAngle = 0.49 * Math.PI;
        this.mapControls.update();

        this.orbitControls = new OrbitControls(this.orbitCamera, this.container);
        this.orbitControls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE
        }
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

        this.allControls = [this.mapControls, this.orbitControls, this.orthographicControls];
    }

    _changeCameraInt(newCameraInt) {
        if (![MAP_CAMERA, ORBIT_CAMERA, ORTHOGRAPHIC_CAMERA].includes(newCameraInt)) {
            console.error("Unexpected input to '_changeCameraInt'.");
        }

        if (this.cameraInt == newCameraInt) {
            return
        }

        this.previousCameraInt = this.cameraInt;
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

    /**
     * Adds a listener to an event type to all cameras.
     */
    addEventListenerCameras(type, listener) {
        for (const camera of this.allCameras) {
            camera.addEventListener(type, listener)
        }
    }

    /**
     * Adds a listener to an event type to all controls.
     */
    addEventListenerControls(type, listener) {
        for (const control of this.allControls) {
            control.addEventListener(type, listener)
        }
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

    resizeCameras(width, height) {
        const aspect = width / height;

        this.mapCamera.aspect = aspect;
        this.mapCamera.updateProjectionMatrix();
        this.orbitCamera.aspect = aspect;
        this.orbitCamera.updateProjectionMatrix();

        this.orthographicCamera.aspect = aspect;

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

    /**
     * The theoretical distance corresponding to the view of the OrthographicCamera
     * with the fov used by the PerspectiveCameras.
     * 
     * @returns the distance to the plane z=0.
     */
    orthographicDistance() {
        const frustrumHeight = this.orthographicCamera.top * 2;
        const field_of_view = (this.mapCamera.fov * Math.PI) / 180;
        const distance = frustrumHeight / (2 * Math.tan(field_of_view / 2)) / this.orthographicCamera.zoom;
        return distance;
    }

    /** 
     * Swith to map view
     */
    switchToMap() {
        console.log("Switching to map");
        if (this.usesMapCamera()) {
            return;
        }

        if (this.usesOrthographicCamera()) {
            const distance = this.orthographicDistance();
            const initTheta = this.orthographicControls._spherical.theta;
            var newTarget = this.orthographicControls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget.clone().add(new THREE.Vector3(0, distance, 0));

            this.mapCamera.position.copy(newPosition);
            this.mapControls.target.copy(newTarget);

            this.mapControls.minAzimuthAngle = initTheta;
            this.mapControls.maxAzimuthAngle = initTheta;

            this.mapCamera.updateProjectionMatrix();
            this.mapControls.update();

            this.mapControls.minAzimuthAngle = MIN_AZIMUTH_ANGLE;
            this.mapControls.maxAzimuthAngle = MAX_AZIMUTH_ANGLE;

        } else if (this.usesOrbitCamera()) {
            const newTarget = this.orbitControls.target.clone();
            const newPosition = this.orbitCamera.position.clone();

            this.mapCamera.position.copy(newPosition);
            this.mapControls.target.copy(newTarget);

            this.mapCamera.updateProjectionMatrix();
            this.mapControls.update();

        } else {
            console.error("Not using any of the expected cameras!");
        }

        this._changeCameraInt(MAP_CAMERA);
    }

    /**
     * Switch to orbit view
     */
    switchToOrbit() {
        console.log("Switching to orbit");
        if (this.usesOrbitCamera()) {
            return;
        }

        if (this.usesOrthographicCamera()) {
            const distance = this.orthographicDistance();
            const initTheta = this.orthographicControls._spherical.theta;
            var newTarget = this.orthographicControls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget.clone().add(new THREE.Vector3(0, distance, 0));

            this.orbitCamera.position.copy(newPosition);
            this.orbitControls.target.copy(newTarget);

            this.orbitControls.minAzimuthAngle = initTheta;
            this.orbitControls.maxAzimuthAngle = initTheta;

            this.orbitCamera.updateProjectionMatrix();
            this.orbitControls.update();

            this.orbitControls.minAzimuthAngle = MIN_AZIMUTH_ANGLE;
            this.orbitControls.maxAzimuthAngle = MAX_AZIMUTH_ANGLE;

        } else if (this.usesMapCamera()) {
            const newTarget = this.mapControls.target.clone();
            const newPosition = this.mapCamera.position.clone();

            this.orbitCamera.position.copy(newPosition);
            this.orbitControls.target.copy(newTarget);

            this.orbitCamera.updateProjectionMatrix();
            this.orbitControls.update();

        } else {
            console.error("Not using any of the expected cameras!");
        }

        this._changeCameraInt(ORBIT_CAMERA);
    }

    // Largely influenced by: https://gist.github.com/nickyvanurk/9ac33a6aff7dd7bd5cd5b8a20d4db0dc

    /** Switch to orthographic view */
    switchToOrthographic() {
        console.log("Switching to orthographic");
        if (this.usesMapCamera() || this.usesOrbitCamera()) {
            // Compute the animation for the current camera
            const initPosition = this.camera.position;
            const initTarget = this.controls.target;

            const distance = initPosition.distanceTo(initTarget);

            const finalPosition = initTarget.clone().add(new THREE.Vector3(0, distance, 0));
            const finalTarget = initTarget.clone();

            // Limit theta to prevent it from being reset
            const initTheta = this.controls._spherical.theta;
            const initControls = this.controls;
            initControls.minAzimuthAngle = initTheta;
            initControls.maxAzimuthAngle = initTheta;

            const onComplete = () => {
                initControls.minAzimuthAngle = MIN_AZIMUTH_ANGLE;
                initControls.maxAzimuthAngle = MAX_AZIMUTH_ANGLE;
                this._changeCameraInt(ORTHOGRAPHIC_CAMERA);
            }

            // Animate the transition
            this._createAnimation(initPosition, initTarget, finalPosition, finalTarget, 1000, onComplete);

            // Where we end up with the orthographic camera
            const newTarget = this.controls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget.clone().add(new THREE.Vector3(0, 1000, 0));
            this.orthographicCamera.position.copy(newPosition);
            this.orthographicControls.target.copy(newTarget);

            // Compute the new orthographic camera settings
            const halfHeight = frustrumHeight(this.camera, distance) / 2;
            const halfWidth = frustrumWidth(this.camera, distance) / 2;

            this.orthographicCamera.top = halfHeight;
            this.orthographicCamera.bottom = -halfHeight;
            this.orthographicCamera.right = halfWidth;
            this.orthographicCamera.left = -halfWidth;

            this.orthographicCamera.zoom = 1;

            // Limit theta for the rotation before updating
            this.orthographicControls.minAzimuthAngle = initTheta;
            this.orthographicControls.maxAzimuthAngle = initTheta;

            this.orthographicCamera.updateProjectionMatrix();
            this.orthographicControls.update();

            // Reset theta limitations
            this.orthographicControls.minAzimuthAngle = MIN_AZIMUTH_ANGLE;
            this.orthographicControls.maxAzimuthAngle = MAX_AZIMUTH_ANGLE;
        }
    }

    toggleOrthographic() {
        if (this._animating()) { return }
        if (this.cameraInt != ORTHOGRAPHIC_CAMERA) {
            this.switchToOrthographic();
            this.updateCompassRotation();
        } else {
            if (this.previousCameraInt == MAP_CAMERA) { this.switchToMap(); }
            else { this.switchToOrbit(); }
            this.updateCompassRotation();
        }
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

    // /* Zoom to a specific coordinate */
    // zoomToLocation(x, z, height = 200) {
    //     console.log(`Zooming to location: ${x}, ${z}`);

    //     // Set the target to the location
    //     this.controls.target.set(x, 0, z);

    //     // Position camera above and slightly back from the target
    //     this.camera.position.set(x, height, z + 100);

    //     this.camera.lookAt(this.controls.target);
    //     this.controls.update();
    // }

    _zoomPerspective(newTarget, distance, onComplete = () => { }) {
        // Set camera position & orientation
        const initTarget = this.controls.target.clone();
        const initPosition = this.camera.position.clone();
        const initDirection = initPosition.clone().sub(initTarget).normalize();
        const finalTarget = newTarget;

        if (!distance) {
            distance = initPosition.distanceTo(initTarget);
        }

        const finalPosition = finalTarget.clone().addScaledVector(initDirection, distance);

        return this._createAnimation(initPosition, initTarget, finalPosition, finalTarget, 1000, onComplete);
    }

    _zoomToObjectPerspective(object, onComplete = () => { }) {
        if (!object) {
            this.switchToMap();
            return;
        }

        this.switchToOrbit();

        // Compute final target and distance to the building with its bounding sphere
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);
        const margin = 1.2;
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = sphere.radius / Math.tan(fov / 2) * margin;

        // Zoom to the position
        return this._zoomPerspective(sphere.center, distance, onComplete);
    }

    _zoomOrthographic(newTarget, distance, onComplete = () => { }) {
        // Set camera position & orientation
        const initTarget = this.controls.target.clone();
        const initPosition = this.camera.position.clone();
        const initTargetToPosition = initPosition.clone().sub(initTarget);
        const finalTarget = newTarget;
        const finalPosition = finalTarget.clone().add(initTargetToPosition);

        return this._createAnimation(initPosition, initTarget, finalPosition, finalTarget, 500, onComplete);
    }

    _zoomToObjectOrthographic(object, onComplete = () => { }) {
        if (!object) {
            return;
        }

        // Bounding sphere
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);

        // Zoom to the position
        return this._zoomOrthographic(sphere.center, null, onComplete);
    }

    zoomToObject(object, onComplete = () => { }) {
        if (this.usesOrthographicCamera()) {
            return this._zoomToObjectOrthographic(object, onComplete);
        } else {
            return this._zoomToObjectPerspective(object, onComplete);
        }
    }

    zoomToCoordinates(newTarget, distance, onComplete = () => { }) {
        if (this.usesOrthographicCamera()) {
            return this._zoomOrthographic(newTarget, distance, onComplete);
        } else {
            return this._zoomPerspective(newTarget, distance, onComplete);
        }
    }

    _animating() {
        return this.tweens.length != 0;
    }

    _createAnimation(
        initPosition,
        initTarget,
        finalPosition,
        finalTarget,
        duration = 1000,
        onComplete = () => { }
    ) {
        const current_values = {
            position: initPosition,
            target: initTarget
        }

        const tweenCamera = new Tween(current_values, false)
            .to({
                position: { x: finalPosition.x, y: finalPosition.y, z: finalPosition.z },
                target: { x: finalTarget.x, y: finalTarget.y, z: finalTarget.z },
            }, duration)
            .easing(Easing.Quadratic.InOut) // Use an easing function to make the animation smooth.
            .onUpdate(() => {
                this.camera.position.copy(current_values.position);
                this.controls.target.copy(current_values.target);

                this.camera.updateProjectionMatrix();
                this.controls.update();
            })
            .onComplete(() => {
                // Remove from the list of tween when completed
                const idx = this.tweens.indexOf(tweenCamera);
                if (idx !== -1) this.tweens.splice(idx, 1);
                onComplete();
            })
            .start()


        this.tweens.push(tweenCamera);

        return tweenCamera;
    }

}