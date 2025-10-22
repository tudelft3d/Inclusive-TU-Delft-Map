import { CamerasControls } from "./camera";
import { Vector3 } from "three/src/Three.Core.js";
import proj4 from "https://cdn.jsdelivr.net/npm/proj4@2.9.0/+esm";
import * as THREE from "three";
import { CSS3DObject, CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";
import { v4 as uuidv4 } from 'uuid';
import { BASEMAP_MIN_X, BASEMAP_MIN_Y, BASEMAP_MAX_X, BASEMAP_MAX_Y } from "./basemap";


export class LocationManager {

    /**
     * 
     * @param {LocationSceneManager} locationSceneManager 
     * @param {CamerasControls} cameraManager 
     */
    constructor(locationSceneManager, cameraManager) {
        this.locationSceneManager = locationSceneManager;
        this.cameraManager = cameraManager;
        this.locationWatchId = null;
        this.key = uuidv4();
        this.scale = 10;
        this.initialised = false;
        this.hidden = false;
    }

    /* Convert GPS coordinates (lat/lon) to map's local coordinates, using proj4 */
    latLonToLocal(lat, lon) {
        // WGS84 (GPS coordinates) & RD New (Rijksdriehoek)
        const wgs84 = "EPSG:4326";
        const rdNew =
            "+proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +towgs84=565.417,50.3319,465.552,-0.398957,0.343988,-1.8774,4.0725 +units=m +no_defs";

        // Convert GPS to RD coordinates using proj4
        const [rdX, rdY] = proj4(wgs84, rdNew, [lon, lat]);
        // console.log(`GPS (${lat}, ${lon}) -> RD (${rdX}, ${rdY})`);

        const x = rdX;
        const z = -rdY; // Negative Z because of coordinate system orientation

        // console.log(`RD (${rdX}, ${rdY}) -> Local (${x}, ${z})`);

        return { x, z };
    }

    /* Get user location and zoom to it with continuous tracking */
    inititialise(zoomIn, onComplete) {
        if (!navigator.geolocation) {
            alert("Geolocation is not supported by your browser");
            return;
        }

        console.log("Starting location tracking...");

        // Stop any existing tracking
        if (this.locationWatchId !== null) {
            this.stopLocationTracking();
        }

        // Use watchPosition for continuous updates
        this.locationWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                this.accuracy = position.coords.accuracy; // in meters
                // this.accuracy = 100;

                // Convert GPS to local coordinates
                const local = this.latLonToLocal(lat, lon);
                this.position = new Vector3(local.x, -0.9, local.z);
                // this.position = new Vector3(85193, -0.9, -446857);

                if (!this.initialised) {
                    this.createMarker();
                }

                // Update or create marker at the user's location
                this.updateMarker();

                if (!this.initialised) {
                    this.moveToLocation(zoomIn, onComplete);
                }
                this.initialised = true;
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

    _inBoundaries() {
        const x = this.position.x;
        const y = -this.position.z;
        if (x < BASEMAP_MIN_X || x > BASEMAP_MAX_X) {
            return false;
        }
        if (y < BASEMAP_MIN_Y || y > BASEMAP_MAX_Y) {
            return false;
        }
        return true;
    }

    hide() {
        if (!this.hidden) {
            this.locationSceneManager.removeObject(this.key);
            this.hidden = true;
        }

    }

    unhide() {
        if (this.hidden) {
            this.locationSceneManager.addObject(this, this.key);
            this.hidden = false;
        }
    }

    alertIfOutsideBoundaries() {
        if (!this._inBoundaries()) {
            alert("Position not shown because it is outside of the boundaries of the map.");
            return true;
        }
        return false;
    }

    moveToLocation(zoomIn, onComplete) {
        if (this.alertIfOutsideBoundaries()) { return }
        var distance = null;
        if (zoomIn) {
            distance = Math.max(4 * this.accuracy, 100);
        }
        return this.cameraManager.zoomToCoordinates(this.position, distance, onComplete);
    }

    /* Stop tracking user location */
    stopLocationTracking() {
        if (this.locationWatchId !== null) {
            navigator.geolocation.clearWatch(this.locationWatchId);
            this.locationWatchId = null;
            console.log("Location tracking stopped");

            // Remove the marker
            this.locationSceneManager.removeObject(this.accuracyObjectKey);
        }
    }

    getSceneObjects() {
        return [this.accuracyWrapperObject, this.positionWrapperObject];
    }

    createMarker() {
        ///// Accuracy circle

        // Main wrapper that gets moved by three.js
        this.accuracyWrapper = document.createElement("div");
        this.accuracyWrapper.className = "location-accuracy-container";

        // Inside wrapper to move the position anchor
        this.accuracyWrapperInner = document.createElement("div");
        this.accuracyWrapperInner.className = "location-accuracy-centered-box";
        this.accuracyWrapperInner.style.transform = `scale(${1 / this.scale})`;
        this.accuracyWrapper.appendChild(this.accuracyWrapperInner);

        this.accuracyCircle = document.createElement('div');
        this.accuracyCircle.className = 'location-accuracy-circle';

        this.accuracyWrapperInner.appendChild(this.accuracyCircle);

        this.accuracyWrapperObject = new CSS3DObject(this.accuracyWrapper);
        this.accuracyWrapperObject.rotation.x = -Math.PI / 2;
        this.accuracyWrapperObject.element.style.pointerEvents = 'none';

        ///// Center dot

        // Main wrapper that gets moved by three.js
        this.positionWrapper = document.createElement("div");
        this.positionWrapper.className = "location-position-container";

        // Inside wrapper to move the position anchor
        this.positionWrapperInner = document.createElement("div");
        this.positionWrapperInner.className = "location-position-centered-box";
        this.positionWrapperInner.style.transform = `scale(${1 / this.scale})`;
        this.positionWrapper.appendChild(this.positionWrapperInner);

        this.positionDisc = document.createElement('div');
        this.positionDisc.className = 'location-position-disc';

        this.positionWrapperInner.appendChild(this.positionDisc);

        this.positionWrapperObject = new CSS3DObject(this.positionWrapper);
        this.positionWrapperObject.rotation.x = -Math.PI / 2;
        this.positionWrapperObject.element.style.pointerEvents = 'none';
        this.locationSceneManager.addObject(this, this.key);

    }

    /**
     * Update objects.
     *
     */
    updateMarker() {
        const scaledAccuracy = this.accuracy * this.scale;

        this.accuracyCircle.style.width = `${2 * scaledAccuracy}px`;
        this.accuracyCircle.style.height = `${2 * scaledAccuracy}px`;
        this.accuracyWrapperObject.position.copy(this.position);

        this.positionWrapperObject.position.copy(this.position);

        console.log(
            `Location marker updated at (${this.position}) with accuracy ${this.accuracy}m`
        );
    }

    /**
     * Set the scale in meters.
     *
     * @param {number} size
     */
    _setScale(size) {
        const scaledSize = size * this.scale;
        this.accuracyCircle.style.borderWidth = `${scaledSize / 5}px`;
        this.positionDisc.style.width = `${scaledSize}px`;
        this.positionDisc.style.height = `${scaledSize}px`;
        this.positionDisc.style.borderWidth = `${scaledSize / 10}px`;
    }

    /**
     * Set the size of the sprite based on the camera position.
     *
     * @param {CamerasControls} cameraManager
     */
    setSizeFromCameraManager(cameraManager) {
        // Compute the distance from the camera to the object position
        var distance;
        if (cameraManager.usesMapCamera() || cameraManager.usesOrbitCamera()) {
            const camToIcon = this.position
                .clone()
                .sub(cameraManager.camera.position);
            const camDirection = new Vector3();
            cameraManager.camera.getWorldDirection(camDirection);
            distance = camToIcon.dot(camDirection);
        } else if (cameraManager.usesOrthographicCamera()) {
            distance = cameraManager.orthographicDistance();
        }

        // Compute the scale based on the distance
        const size = 0.02 * distance;
        this._setScale(size);
    }

}

export class LocationSceneManager {
    /**
     * A class to manage a scene with the localisation stuff.
     *
     * @param {Scene} scene
     * @param {CSS3DRenderer} renderer
     * @param {HTMLElement} locationContainer
     * @param {HTMLElement} mainContainer
     */
    constructor(scene, renderer, locationContainer, mainContainer) {
        this.scene = scene;
        this.renderer = renderer;
        this.locationContainer = locationContainer;
        this.mainContainer = mainContainer;
        this.objects = {};
    }

    addObject(obj, key) {
        this.objects[key] = obj;
        const sceneObjects = obj.getSceneObjects();
        for (const sceneObject of sceneObjects) {
            this.scene.add(sceneObject);
        }
    }

    removeObject(key) {
        const obj = this.objects[key];
        for (const sceneObject of obj.getSceneObjects()) {
            this.scene.remove(sceneObject);
        }
        delete this.objects[key];
    }

    /**
     * Resize the icons based on the camera position.
     * To call before rendering.
     *
     * @param {CamerasControls} cameraManager
     */
    beforeRender(cameraManager) {
        for (const [key, obj] of Object.entries(this.objects)) {
            obj.setSizeFromCameraManager(cameraManager);
        }
    }

    /**
     *
     * @param {number} time
     * @param {CamerasControls} cameraManager
     */
    render(time, cameraManager) {
        this.beforeRender(cameraManager);
        this.renderer.render(this.scene, cameraManager.camera);
    }
}