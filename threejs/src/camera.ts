import {
    OrbitControls,
    OrbitControlsEventMap,
} from "three/addons/controls/OrbitControls.js";
import { MapControls } from "three/addons/controls/MapControls.js";
import { Tween, Easing } from "@tweenjs/tween.js";

import * as THREE from "three";

enum CameraValue {
    Map,
    Orbit,
    Ortho,
}

const fov = 55;
const near = 0.1;
const far = 100000;
const frustumSize = 1;

const MIN_AZIMUTH_ANGLE = -Infinity;
const MAX_AZIMUTH_ANGLE = Infinity;

function frustrumHeightWidth(
    camera: THREE.PerspectiveCamera,
    distance: number
) {
    const field_of_view = (camera.fov * Math.PI) / 180;
    const frustrumHeight = Math.tan(field_of_view / 2) * distance * 2;
    const frustrumWidth = frustrumHeight * camera.aspect;
    return [frustrumHeight, frustrumWidth];
}

export class CamerasControls {
    container: HTMLDivElement;
    mapCamera!: THREE.PerspectiveCamera;
    orbitCamera!: THREE.PerspectiveCamera;
    orthographicCamera!: THREE.OrthographicCamera;
    camera!: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    allCameras!: (THREE.PerspectiveCamera | THREE.OrthographicCamera)[];
    mapControls!: MapControls;
    orbitControls!: OrbitControls;
    orthographicControls!: MapControls;
    controls!: MapControls | OrbitControls;
    allControls!: (MapControls | OrbitControls)[];
    cameraInt: CameraValue;
    // previousCameraInt: CameraValue;
    initialPosition!: THREE.Vector3;
    initialTarget!: THREE.Vector3;
    tweens: Tween[];
    cameraSwitchEvents: {
        type: string;
        element: HTMLElement;
    }[];
    compassElement: HTMLButtonElement | null;
    previousNonNorthPosition: THREE.Vector3 | null;

    constructor(
        container: HTMLDivElement,
        position: THREE.Vector3,
        target: THREE.Vector3
    ) {
        this.container = container;

        this._initCameras(position);
        this._initControls(target);

        this.cameraInt = CameraValue.Map;
        // this.previousCameraInt = CameraValue.Ortho;
        this.tweens = [];
        this.cameraSwitchEvents = [];

        // Initial compass rotation
        this.compassElement = null;
        this.previousNonNorthPosition = null;
    }

    _initCameras(position: THREE.Vector3) {
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
        // this.previousCamera = this.mapCamera;

        this.initialPosition = new THREE.Vector3().copy(position);
        this.camera.position.copy(this.initialPosition);
        this.camera.updateProjectionMatrix();

        this.allCameras = [
            this.mapCamera,
            this.orbitCamera,
            this.orthographicCamera,
        ];
    }

    _initControls(target: THREE.Vector3) {
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
        this.orthographicControls.update();

        this.controls = this.mapControls;
        // this.previousControls = this.mapControls;

        this.initialTarget = target.clone();
        this.controls.target.copy(this.initialTarget);
        this.controls.update();

        this.allControls = [
            this.mapControls,
            this.orbitControls,
            this.orthographicControls,
        ];
    }

    _changeCameraInt(newCameraInt: CameraValue) {
        if (
            ![CameraValue.Map, CameraValue.Orbit, CameraValue.Ortho].includes(
                newCameraInt
            )
        ) {
            console.error("Unexpected input to '_changeCameraInt'.");
        }

        if (this.cameraInt == newCameraInt) {
            return;
        }

        // this.previousCameraInt = this.cameraInt;
        this.cameraInt = newCameraInt;

        // this.previousCamera = this.camera;
        // this.previousControls = this.controls;

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
        return this.cameraInt == CameraValue.Map;
    }

    usesOrbitCamera() {
        return this.cameraInt == CameraValue.Orbit;
    }

    usesOrthographicCamera() {
        return this.cameraInt == CameraValue.Ortho;
    }

    /**
     * Adds a listener to an event type to all cameras.
     */
    addEventListenerCameras(
        type: keyof THREE.Object3DEventMap,
        listener: () => void
    ) {
        for (const camera of this.allCameras) {
            camera.addEventListener(type, listener);
        }
    }

    /**
     * Adds a listener to an event type to all controls.
     */
    addEventListenerControls(
        type: keyof OrbitControlsEventMap,
        listener: () => void
    ) {
        for (const control of this.allControls) {
            control.addEventListener(type, listener);
        }
    }

    createEventCameraSwitch(type: string, element: HTMLElement) {
        this.cameraSwitchEvents.push({ type, element });
    }

    // Method to set the compass element
    setCompassElement(element: HTMLButtonElement) {
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

    resizeCameras(width: number, height: number) {
        const aspect = width / height;

        this.mapCamera.aspect = aspect;
        this.mapCamera.updateProjectionMatrix();
        this.orbitCamera.aspect = aspect;
        this.orbitCamera.updateProjectionMatrix();

        // this.orthographicCamera.aspect = aspect;
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
    switchToInt(cameraInt: CameraValue) {
        if (cameraInt == CameraValue.Map) {
            this.switchToMap();
        } else if (cameraInt == CameraValue.Orbit) {
            this.switchToOrbit();
        } else if (cameraInt == CameraValue.Ortho) {
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
    switchToMap(onComplete = () => {}) {
        if (this.usesMapCamera()) {
            // Do nothing
        } else if (this.usesOrthographicCamera()) {
            const distance = this.orthographicDistance();
            // @ts-ignore
            // Problem with _spherical
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

        this._changeCameraInt(CameraValue.Map);
        onComplete();
    }

    /**
     * Switch to orbit view
     */
    switchToOrbit(onComplete = () => {}) {
        if (this.usesOrbitCamera()) {
            // Do nothing
        } else if (this.usesOrthographicCamera()) {
            const distance = this.orthographicDistance();
            // @ts-ignore
            // Problem with _spherical
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
        this._changeCameraInt(CameraValue.Orbit);
        onComplete();
    }

    // Largely influenced by: https://gist.github.com/nickyvanurk/9ac33a6aff7dd7bd5cd5b8a20d4db0dc

    /** Switch to orthographic view */
    switchToOrthographic(onAnimationComplete = () => {}) {
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
            // @ts-ignore
            // Problem with _spherical
            const initTheta = this.controls._spherical.theta;
            const initControls = this.controls;
            initControls.minAzimuthAngle = initTheta;
            initControls.maxAzimuthAngle = initTheta;

            const onComplete = () => {
                initControls.minAzimuthAngle = MIN_AZIMUTH_ANGLE;
                initControls.maxAzimuthAngle = MAX_AZIMUTH_ANGLE;
                this._changeCameraInt(CameraValue.Ortho);
                onAnimationComplete();
            };

            // Animate the transition
            // @ts-ignore
            // Problem with _spherical
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
            // @ts-ignore
            // Implied by this.usesMapCamera() || this.usesOrbitCamera()
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

    // toggleOrthographic() {
    //     if (this._animating()) {
    //         return;
    //     }
    //     if (this.cameraInt != CameraValue.Ortho) {
    //         this.switchToOrthographic();
    //         this.updateCompassRotation();
    //     } else {
    //         this.switchToMap();
    //         if (this.previousCameraInt == CameraValue.Map) {
    //             this.switchToMap();
    //         } else {
    //             this.switchToOrbit();
    //         }
    //         this.updateCompassRotation();
    //     }
    // }

    zoomIn(factor = 1.8) {
        // Fix: make our own function instead of using a private one
        const ctrl = this.controls as any;
        if (ctrl._dollyOut) {
            ctrl._dollyOut(factor);
            ctrl.update();
        } else {
            console.error("Cannot zoom in.");
        }
    }

    zoomOut(factor = 1.8) {
        // Fix: make our own function instead of using a private one
        const ctrl = this.controls as any;
        if (ctrl._dollyIn) {
            ctrl._dollyIn(factor);
            ctrl.update();
        } else {
            console.error("Cannot zoom out.");
        }
    }

    _usesPerspectiveCamera() {
        return (this.camera as any).isPerspectiveCamera === true;
    }

    _usesOrthographicCamera() {
        return (this.camera as any).isPerspectiveCamera === true;
    }

    // zoom(factor = 1.8) {
    //     if (this._usesPerspectiveCamera()) {
    //         // Move the camera forward/backward along its view direction.
    //         const dir = new THREE.Vector3();
    //         this.camera.getWorldDirection(dir);
    //         this.camera.position.addScaledVector(
    //             dir,
    //             (factor - 1) * this.camera.position.length()
    //         );
    //     } else if (this._usesOrthographicCamera()) {
    //         // Orthographic zoom is just scaling the view size.
    //         this.camera.zoom *= factor;
    //         this.camera.updateProjectionMatrix();
    //     }

    //     // Keep the controls in sync.
    //     this.controls.update();
    // }

    // zoomIn(factor = 1.8) {
    //     this.zoom(factor);
    // }
    // zoomOut(factor = 1.8) {
    //     this.zoom(1 / factor);
    // }

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
    resetNorth(onComplete = () => {}) {
        // Get current target and position (on click of button)
        const target = this.controls.target.clone();
        const currentPosition = this.camera.position.clone();

        // Check if the camera is already pointing north (within a small threshold)
        const currentDirection = currentPosition.clone().sub(target);
        currentDirection.y = 0; // Only check horizontal direction
        currentDirection.normalize();
        const northDirection = new THREE.Vector3(0, 0, 1);
        const angle = Math.acos(
            Math.max(-1, Math.min(1, currentDirection.dot(northDirection)))
        );
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
        const rotationAngle = Math.acos(
            Math.max(-1, Math.min(1, initDirection.dot(finalDirection)))
        );
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

    _zoomPerspective(
        newTarget: THREE.Vector3,
        distance: number,
        onComplete = () => {}
    ) {
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

    _zoomToObjectPerspective(object: THREE.Object3D, onComplete = () => {}) {
        this.switchToOrbit();
        if (this.camera != this.orbitCamera) {
            console.error("Camera is not orbit.");
            return;
        }

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

    _zoomOrthographic(
        newTarget: THREE.Vector3,
        distance: number | null,
        onComplete = () => {}
    ) {
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

    _zoomToObjectOrthographic(object: THREE.Object3D, onComplete = () => {}) {
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

    zoomToObject(object: THREE.Object3D, onComplete = () => {}) {
        if (this.usesOrthographicCamera()) {
            return this._zoomToObjectOrthographic(object, onComplete);
        } else {
            return this._zoomToObjectPerspective(object, onComplete);
        }
    }

    zoomToCoordinates(
        newTarget: THREE.Vector3,
        distance: number,
        onComplete = () => {}
    ) {
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
        initPosition: THREE.Vector3,
        initTarget: THREE.Vector3,
        finalPosition: THREE.Vector3,
        finalTarget: THREE.Vector3,
        duration = 1000,
        onComplete = () => {}
    ) {
        const current_values = {
            position: initPosition,
            target: initTarget,
        };

        const tweenCamera = new Tween(current_values)
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
