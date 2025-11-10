import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { MapControls } from "three/addons/controls/MapControls.js";
import {
    Tween,
    Easing,
} from "https://unpkg.com/@tweenjs/tween.js@23.1.3/dist/tween.esm.js";

import * as THREE from "three";

const MAP_CAMERA = 0;
const ORBIT_CAMERA = 1;
const ORTHOGRAPHIC_CAMERA = 2;

const fov = 55;
const near = 0.1;
const far = 100000;
const frustumSize = 1;

const MIN_AZIMUTH_ANGLE = -Infinity;
const MAX_AZIMUTH_ANGLE = Infinity;

/**
 * @param {object} camera: The camera for which the frustrum height and width need to be calculated.
 * @param {distance} number: The distance between the camera position and control target
 * 
 * @return {array} An array containing the height and width of the frustrum.
 */
function frustrumHeightWidth(camera, distance) {
    const field_of_view = (camera.fov * Math.PI) / 180;
    const frustrumHeight = Math.tan(field_of_view / 2) * distance * 2;
    const frustrumWidth = frustrumHeight * camera.aspect;
    return [frustrumHeight, frustrumWidth];
}


/**
 * @param {html object} container: The scene-container.
 * @param {THREE.Vector3d} position: The starting position of the camera.
 * @param {object} target: The starting position of the controls.
 * 
 * This function initializes and maintains the variety of cameras and controls used throughout the map.
 * To fascilitate the map features, this class switches between three separate cameras, each of which
 * have their own controls object.
 * 
 */
export class CamerasControls {
    constructor(container, position, target) {
        this.container = container;

        this._initCameras(position);
        this._initControls(target);

        this.cameraInt = MAP_CAMERA;
        this.previousCameraInt = ORTHOGRAPHIC_CAMERA;
        this.tweens = [];
        this.cameraSwitchEvents = [];

        // Initial compass rotation
        this.compassElement = null;
    }

    /**
     * @param {THREE.Vector3d} position: The starting position for the initial camera.
     * 
     * Creates all three cameras (map, orbit and ortho) and initializes the map camera.
     */
    _initCameras(position) {
        const aspect = window.innerWidth / window.innerHeight;
        this.mapCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.orbitCamera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.orthographicCamera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            frustumSize / -2,
            0,
            100000
        );

        this.camera = this.mapCamera;
        this.previousCamera = this.mapCamera;

        this.initialPosition = new THREE.Vector3().copy(position);
        this.camera.position.copy(this.initialPosition);
        this.camera.updateProjectionMatrix();

        this.allCameras = [
            this.mapCamera,
            this.orbitCamera,
            this.orthographicCamera,
        ];
    }

    /**
     * @param {THREE.Vector3d} target: The starting position for the initial target.
     * 
     * Creates all three control schemes.
     */
    _initControls(target) {
        this.mapControls = new MapControls(this.mapCamera, this.container);
        this.mapControls.target.copy(target);
        this.mapControls.maxPolarAngle = 0.5 * Math.PI;
        this.mapControls.update();

        this.orbitControls = new OrbitControls(
            this.orbitCamera,
            this.container
        );
        this.orbitControls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
        };
        this.orbitControls.target.copy(target);
        this.orbitControls.maxPolarAngle = 0.5 * Math.PI;
        this.orbitControls.enablePan = false;
        this.orbitControls.update();

        this.orthographicControls = new MapControls(
            this.orthographicCamera,
            this.container
        );
        this.orthographicControls.target.copy(target);
        this.orthographicControls.screenSpacePanning = true;
        this.orthographicControls.maxPolarAngle = 0.0 * Math.PI;
        this.orthographicControls.enableDampening = true;
        this.orthographicControls.update();

        this.controls = this.mapControls;
        this.previousControls = this.mapControls;

        this.initialTarget = target.clone();
        this.controls.target.copy(this.initialTarget);
        this.controls.update();

        this.allControls = [
            this.mapControls,
            this.orbitControls,
            this.orthographicControls,
        ];
    }

    /**
     * @param {int} newCameraInt: The "CameraInt" of the desired camera.
     * 
     * Changes the camera int (which indicates which camera is currently active) and also
     * switches the active camera and control objects.
     */
    _changeCameraInt(newCameraInt) {
        if (
            ![MAP_CAMERA, ORBIT_CAMERA, ORTHOGRAPHIC_CAMERA].includes(
                newCameraInt
            )
        ) {
            console.error("Unexpected input to '_changeCameraInt'.");
        }

        if (this.cameraInt == newCameraInt) {
            return;
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

        this.cameraSwitchEvents.forEach((info) => {
            const { type: type, element: element } = info;
            const event = new CustomEvent(type);
            element.dispatchEvent(event);
        });
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
            camera.addEventListener(type, listener);
        }
    }

    /**
     * Adds a listener to an event type to all controls.
     */
    addEventListenerControls(type, listener) {
        for (const control of this.allControls) {
            control.addEventListener(type, listener);
        }
    }

    createEventCameraSwitch(type, element) {
        this.cameraSwitchEvents.push({ type, element });
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

    /**
     * @param {number} width: desired camera width.
     * @param {number} heigt: desirec camera height.
     * 
     * Changes the width and height of all three cameras.
     */
    resizeCameras(width, height) {
        const aspect = width / height;

        this.mapCamera.aspect = aspect;
        this.mapCamera.updateProjectionMatrix();
        this.orbitCamera.aspect = aspect;
        this.orbitCamera.updateProjectionMatrix();

        this.orthographicCamera.aspect = aspect;
        const halfHeight = this.orthographicCamera.top;
        const halfWidth = halfHeight * aspect;

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
        const distance =
            frustrumHeight /
            (2 * Math.tan(field_of_view / 2)) /
            this.orthographicCamera.zoom;
        return distance;
    }

    /**
     * Switch using camera int
     */
    switchToInt(cameraInt) {
        if (cameraInt == MAP_CAMERA) {
            this.switchToMap();
        } else if (cameraInt == ORBIT_CAMERA) {
            this.switchToOrbit();
        } else if (cameraInt == ORTHOGRAPHIC_CAMERA) {
            this.switchToOrthographic();
        } else {
            console.error(
                "This value does not correspond to a camera:",
                cameraInt
            );
        }
    }

    /**
     * Swith to map view
     */
    switchToMap(onComplete = () => { }) {
        if (this.usesMapCamera()) {
            // Do nothing
        } else if (this.usesOrthographicCamera()) {
            const distance = this.orthographicDistance();
            const initTheta = this.orthographicControls._spherical.theta;
            var newTarget = this.orthographicControls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget
                .clone()
                .add(new THREE.Vector3(0, distance, 0));

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
        onComplete();
    }

    /**
     * Switch to orbit view
     */
    switchToOrbit(onComplete = () => { }) {
        if (this.usesOrbitCamera()) {
            // Do nothing
        } else if (this.usesOrthographicCamera()) {
            const distance = this.orthographicDistance();
            const initTheta = this.orthographicControls._spherical.theta;
            var newTarget = this.orthographicControls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget
                .clone()
                .add(new THREE.Vector3(0, distance, 0));

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
        onComplete();
    }

    // Largely influenced by: https://gist.github.com/nickyvanurk/9ac33a6aff7dd7bd5cd5b8a20d4db0dc
    /** Switch to orthographic view */
    switchToOrthographic(onAnimationComplete = () => { }) {
        if (this.usesMapCamera() || this.usesOrbitCamera()) {
            // Compute the animation for the current camera
            const initPosition = this.camera.position;
            const initTarget = this.controls.target;

            const distance = initPosition.distanceTo(initTarget);

            const finalPosition = initTarget
                .clone()
                .add(new THREE.Vector3(0, distance, 0));
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
                onAnimationComplete();
            };

            // Animate the transition
            const duration = this.controls._spherical.phi * 500;
            this._createAnimation(
                initPosition,
                initTarget,
                finalPosition,
                finalTarget,
                duration,
                onComplete
            );

            // Where we end up with the orthographic camera
            const newTarget = this.controls.target.clone();
            newTarget.y = 0;
            const newPosition = newTarget
                .clone()
                .add(new THREE.Vector3(0, 1000, 0));
            this.orthographicCamera.position.copy(newPosition);
            this.orthographicControls.target.copy(newTarget);

            // Compute the new orthographic camera settings
            const [height, width] = frustrumHeightWidth(this.camera, distance);
            const halfHeight = height / 2;
            const halfWidth = width / 2;

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
        } else {
            onAnimationComplete();
        }
    }

    /**
     * Zoom in by the desired degree, or by a factor of 1.8 if unspecified.
     */
    zoomIn(factor = 1.8) {
        if (this.controls._dollyOut) {
            this.controls._dollyOut(factor);
            this.controls.update();
        } else if (this.camera.isPerspectiveCamera) {
            this.camera.position.multiplyScalar(factor);
        }
    }

    /**
     * Zoom out by the desired degree, or by a factor of 1.8 if unspecified.
     */
    zoomOut(factor = 1.8) {
        if (this.controls._dollyIn) {
            this.controls._dollyIn(factor);
            this.controls.update();
        } else if (this.camera.isPerspectiveCamera) {
            this.camera.position.multiplyScalar(1 / factor);
        }
    }

    /* Update the home position to initial camera state (after having moved towards GLTF scene) */
    setHomeView() {
        this.initialPosition.copy(this.camera.position);
        this.initialTarget.copy(this.controls.target);
    }

    /* Reset camera to initial position and orientation */
    resetView() {
        // Store the initial position and target when creating the camera
        if (this.initialPosition && this.initialTarget) {
            this.camera.position.copy(this.initialPosition);
            this.controls.target.set(
                this.initialTarget.x,
                this.initialTarget.y,
                this.initialTarget.z
            );

            // Reset zoom for orthographic camera
            if (this.usesOrthographicCamera()) {
                this.orthographicCamera.zoom = 1;
                this.orthographicCamera.updateProjectionMatrix();
            }

            this.controls.update();
        }
    }

    /* Reset camera rotation to point north (align with Z-axis) or return to previous position */
    resetNorth(onComplete = () => { }) {
        // Get current target and position (on click of button)
        const target = this.controls.target.clone();
        const currentPosition = this.camera.position.clone();

        // Check if the camera is already pointing north (within a small threshold)
        const currentDirection = currentPosition.clone().sub(target);
        currentDirection.y = 0; // Only check horizontal direction
        currentDirection.normalize();
        const northDirection = new THREE.Vector3(0, 0, 1);
        const angle = Math.acos(Math.max(-1, Math.min(1, currentDirection.dot(northDirection))));
        const isCurrentlyNorth = angle < 0.05; // ~3 degrees threshold

        let finalPosition;


        if (isCurrentlyNorth && this.previousNonNorthPosition) {
            // We're at north and have a previous position -> return to it
            finalPosition = this.previousNonNorthPosition.clone();
        } else {
            // Store current position if it's not north (and not during animation)
            if (!isCurrentlyNorth && !this._animating()) {
                this.previousNonNorthPosition = currentPosition.clone();
            }

            // Calculate position pointing north
            const distance = currentPosition.distanceTo(target);
            const heightDiff = currentPosition.y - target.y;
            const horizontalDistance = Math.sqrt(
                Math.max(0, distance * distance - heightDiff * heightDiff)
            );


            finalPosition = new THREE.Vector3(
                target.x,
                currentPosition.y,
                target.z + horizontalDistance
            );
        }

        // Store initial position and target
        const initPosition = currentPosition;
        const initTarget = this.controls.target.clone();

        // Calculate duration based on angular distance
        const initDirection = initPosition.clone().sub(target).normalize();
        const finalDirection = finalPosition.clone().sub(target).normalize();
        const rotationAngle = Math.acos(Math.max(-1, Math.min(1, initDirection.dot(finalDirection))));
        const duration = 300 + rotationAngle * 500; // Scale duration with rotation angle

        // Animate to final position
        return this._createAnimation(
            initPosition,
            initTarget,
            finalPosition,
            target,
            duration,
            onComplete
        );
    }

    /**
     * Zoom function for the perspective camera.
     */
    _zoomPerspective(newTarget, distance, onComplete = () => { }) {
        // Set camera position & orientation
        const initTarget = this.controls.target.clone();
        const initPosition = this.camera.position.clone();
        const initDirection = initPosition.clone().sub(initTarget).normalize();
        const finalTarget = newTarget;

        if (!distance) {
            distance = initPosition.distanceTo(initTarget);
        }

        const finalPosition = finalTarget
            .clone()
            .addScaledVector(initDirection, distance);

        // Compute the duration of the animation
        const cameraAnimationDistance = initPosition.distanceTo(finalPosition);
        const duration = 300 + 30 * Math.sqrt(cameraAnimationDistance);

        return this._createAnimation(
            initPosition,
            initTarget,
            finalPosition,
            finalTarget,
            duration,
            onComplete
        );
    }

    /**
     * @param {object} object: The object that needs to be zoomed towards.
     * @param {function} onComplete: Function to execute when done with the operation.
     */
    _zoomToObjectPerspective(object, onComplete = () => { }) {
        this.switchToOrbit();

        // Compute final target and distance to the building with its bounding sphere
        const sphere = new THREE.Sphere();
        new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);
        // This margin was chosen to try to encompass the object whatever the width of the screen
        const margin = 0.2 + 1000 / window.innerWidth;
        const fov = this.camera.fov * (Math.PI / 180);
        const distance = (sphere.radius / Math.tan(fov / 2)) * margin;

        // Zoom to the position
        return this._zoomPerspective(sphere.center, distance, onComplete);
    }

    /**
     * @param {THREE.vector3d} newTarget: The position that needs to be zoomed towards.
     * @param {number} distance: The distance between the current and desired targets
     * @param {function} onComplete: Function to execute when done with the operation.
     */
    _zoomOrthographic(newTarget, distance, onComplete = () => { }) {
        // Set camera position & orientation
        const initTarget = this.controls.target.clone();
        const initPosition = this.camera.position.clone();
        const initTargetToPosition = initPosition.clone().sub(initTarget);
        const finalTarget = newTarget;
        const finalPosition = finalTarget.clone().add(initTargetToPosition);

        return this._createAnimation(
            initPosition,
            initTarget,
            finalPosition,
            finalTarget,
            500,
            onComplete
        );
    }

    /**
     * @param {object} object: The object that needs to be zoomed towards.
     * @param {function} onComplete: Function to execute when done with the operation.
     */
    _zoomToObjectOrthographic(object, onComplete = () => { }) {
        if (!object) {
            return;
        }

        var sphere = new THREE.Sphere();
        if (Array.isArray(object)) {
            const group = new THREE.Group();
            object.forEach((obj) => {
                group.add(obj.clone());
            });
            group.rotateX(-Math.PI / 2);
            // const bbox = new THREE.Box3().setFromObject(group);
            // bbox.getBoundingSphere(sphere);
            new THREE.Box3().setFromObject(group).getBoundingSphere(sphere);
            group.clear();
        } else {
            // Bounding sphere
            new THREE.Box3().setFromObject(object).getBoundingSphere(sphere);
        }

        // Zoom to the position
        return this._zoomOrthographic(sphere.center, null, onComplete);
    }

    /**
     * @param {object} object: The object that needs to be zoomed towards.
     * @param {function} onComplete: Function to execute when done with the operation.
     */
    zoomToObject(object, onComplete = () => { }) {
        if (this.usesOrthographicCamera()) {
            return this._zoomToObjectOrthographic(object, onComplete);
        } else {
            return this._zoomToObjectPerspective(object, onComplete);
        }
    }

    /**
     * @param {THREE.vector3d} newTarget: The position that needs to be zoomed towards.
     * @param {number} distance: The distance between the current and desired targets
     * @param {function} onComplete: Function to execute when done with the operation.
     */
    zoomToCoordinates(newTarget, distance, onComplete = () => { }) {
        if (this.usesOrthographicCamera()) {
            return this._zoomOrthographic(newTarget, distance, onComplete);
        } else {
            return this._zoomPerspective(newTarget, distance, onComplete);
        }
    }

    /**
     * @return {boolean}: Whether or not an animation is currently happening.
     */
    _animating() {
        return this.tweens.length != 0;
    }

    /**
     * @param {THREE.vector3d} initPosition: Initial position of the current camera.
     * @param {THREE.vector3d} initTarget: Initial target of the current camera.
     * @param {THREE.vector3d} finalPosition: Desired position of the current camera.
     * @param {THREE.vector3d} finalTarget: Desired target of the current camera.
     * @param {number} duration: How long the animation should take, in miliseconds.
     * @param {function} onComplete: Function to execute when done with the animation.
     * 
     * This function creates and animation that allows a given camera to smoothly move between two
     * positions and targets.
     * 
     * @return {tween object}: object that is used by the tween library to guide the camera between two states.
     */
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
            target: initTarget,
        };

        const tweenCamera = new Tween(current_values, false)
            .to(
                {
                    position: {
                        x: finalPosition.x,
                        y: finalPosition.y,
                        z: finalPosition.z,
                    },
                    target: {
                        x: finalTarget.x,
                        y: finalTarget.y,
                        z: finalTarget.z,
                    },
                },
                duration
            )
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
            .start();

        this.tweens.push(tweenCamera);

        return tweenCamera;
    }
}
