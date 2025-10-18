export class ControlsManager {
    /**
     * @param {HTMLElement}     container   the DOM element that receives pointer events
     * @param {CameraManager}   camManager  instance created above
     */
    constructor(container, camManager) {
        this.container = container;
        this.camManager = camManager;
        this.cameraMovedDuringTouch = false;

        // // Expose the active control set for external listeners
        // this.controls = camManager.controls;

        // Forward change events
        this._listenForChanges();
    }

    _listenForChanges() {
        this.camManager.controls.addEventListener("change", () => {
            this.cameraMovedDuringTouch = true;
        });
    }

    /** Called by the app when a pick succeeds → switch to orbit mode */
    activateOrbit() {
        this.camManager.switchToOrbit();
        // this.controls = this.camManager.controls;
        // this._listenForChanges();
    }

    /** Called when a pick fails → fall back to map mode */
    activateMap() {
        this.camManager.switchToMap();
        // this.controls = this.camManager.controls;
        // this._listenForChanges();
    }

    activateOrthographic() {
        this.camManager.switchToOrthographic();
    }

    /** Helper for the UI layer to reset the “drag” flag */
    resetTouchState() {
        this.cameraMovedDuringTouch = false;
        this._listenForChanges();
    }

    // /** Register a callback that runs whenever the active controls fire a change */
    // onChange(cb) {
    //     this.camManager.controls.addEventListener("change", cb);
    // }
}
