import { CamerasControls } from "./camera";
import {
    CSS2DObject,
    CSS2DRenderer,
} from "three/addons/renderers/CSS2DRenderer.js";
import { Scene, Vector3 } from "three";

export class IconSet {
    /**
     * Create a set of icons at the same position.
     *
     * @param {SvgIcon[]} svgIcons
     * @param {TextIcon} textIcon
     * @param {THREE.Vector3} worldPos
     */
    constructor(svgIcons, textIcon, worldPos) {
        this.basePos = worldPos;

        this.svgIcons = [];
        svgIcons.map((svgIcon) => {
            this.svgIcons.push(svgIcon);
        });

        this.textIcon = textIcon;

        // Main wrapper that gets moved by three.js
        this.wrapper = document.createElement("div");

        // Inside wrapper to move the position anchor
        this.wrapperInner = document.createElement("div");
        this.wrapperInner.className = "icons-centered-box";
        this.wrapper.appendChild(this.wrapperInner);

        // Add the text
        if (!(this.textIcon.container instanceof HTMLElement)) {
            throw new Error("text must be a string or HTMLElement");
        }
        this.wrapperInner.appendChild(this.textIcon.container);

        // Build the row of icons
        this.svgIconsRow = document.createElement("div");
        this.svgIconsRow.className = "icons-svg-row";
        this.svgIcons.forEach((svgIcon) => {
            if (!(svgIcon.container instanceof HTMLElement)) {
                throw new Error("Each icon must be an HTMLElement");
            }
            this.svgIconsRow.appendChild(svgIcon.container);
        });

        this.wrapperInner.appendChild(this.svgIconsRow);

        this.wrapperObject = new CSS2DObject(this.wrapper);
    }

    /**
     * Set the scale in screen units.
     *
     * @param {number} scale
     */
    _setScale(scale) {
        const baseOffset = new Vector3(0, (50 * (1 - scale)) / 2, 0);
        this.wrapperInner.style.transform = `scale(${scale}) translate(0, -50%)`;
        this.wrapperObject.position.copy(this.basePos.clone().add(baseOffset));
    }

    /**
     * Set the size of the sprite based on the camera position.
     *
     * @param {CamerasControls} cameraManager
     */
    setSizeFromCameraManager(cameraManager) {
        const thresholdDistance = 1000;

        // Compute the distance from the camera to the object position
        var distance;
        if (cameraManager.usesMapCamera() || cameraManager.usesOrbitCamera()) {
            const camToIcon = this.basePos
                .clone()
                .sub(cameraManager.camera.position);
            const camDirection = new Vector3();
            cameraManager.camera.getWorldDirection(camDirection);
            distance = camToIcon.dot(camDirection);
        } else if (cameraManager.usesOrthographicCamera()) {
            distance = cameraManager.orthographicDistance();
        }

        // Compute the scale based on the distance
        var scale;
        if (distance < thresholdDistance) {
            scale = 1;
        } else {
            scale = (1 * thresholdDistance) / distance;
        }
        this._setScale(scale);
    }
}

export class IconsSceneManager {
    /**
     * A class to manage a scene of icons and its specificities.
     *
     * @param {Scene} scene
     * @param {CSS2DRenderer} renderer
     */
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.iconSets = [];
    }

    /**
     * Add an icon to the scene.
     *
     * @param {IconSet} icon
     */
    addIcon(iconSet) {
        this.iconSets.push(iconSet);
        this.scene.add(iconSet.wrapperObject);
    }

    /**
     * Resize the icons based on the camera position.
     * To call before rendering.
     *
     * @param {CamerasControls} cameraManager
     */
    beforeRender(cameraManager) {
        for (const icon of this.iconSets) {
            icon.setSizeFromCameraManager(cameraManager);
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

export class TextIcon {
    /**
     * A wrapper for text to put in an icon.
     *
     * @param {string} text The text that will be shown inside the icon.
     * @param {Object} [options] Optional configuration.
     * @param {string|null} [options.color=null] Text colour (CSS value). `null` means “inherit”.
     * @param {string|null} [options.bgColor=null] Background colour (CSS value). `null` means “transparent”.
     * @param {string} [options.cssClass=''] Additional CSS class(es) to apply.
     */
    constructor(
        text,
        { color = undefined, bgColor = undefined, cssClass = "" } = {}
    ) {
        // Main container that is moved by three.js
        this.container = document.createElement("div");
        this.container.className = "icon-text-container";

        // Text content
        this.content = document.createElement("div");
        this.content.className = "icon-text-content";
        this.content.textContent = text;

        // Optional colors
        if (color) {
            this.content.style.color = color;
        }
        if (bgColor) {
            this.content.style.background = bgColor;
        }

        // Assemble the hierarchy
        this.container.appendChild(this.content);
    }
}

export class SvgIcon {
    /**
     * A wrapper for a SVG element to put in an icon.
     *
     * @param {SVGElement} svgElement The SVG element that will be shown inside the icon.
     * @param {Object} [options] Optional configuration.
     * @param {string|null} [options.size=null] Icon size (CSS value). `null` means default.
     * @param {string|null} [options.bgColor=null] Background colour (CSS value). `null` means “transparent”.
     * @param {string} [options.cssClass=''] Additional CSS class(es) to apply.
     */
    constructor(
        svgElement,
        { size = null, bgColor = null, cssClass = "" } = {}
    ) {
        // Main container that is placed by three.js
        this.container = document.createElement("div");
        this.container.className = "icon-svg-container";
        if (size) {
            this.container.style.width = size;
            this.container.style.height = size;
        }

        // Background circle with a color
        this.bgCircle = document.createElement("div");
        this.bgCircle.className = "icon-svg-bg";
        if (bgColor) {
            this.bgCircle.style.background = bgColor;
        }

        // Icon content
        // Clone so we don't move the original node out of its source location
        console.log(svgElement);
        this.content = svgElement.cloneNode(true);
        this.content.setAttribute("class", "icon-svg-content");

        // Assemble the hierarchy
        this.bgCircle.appendChild(this.content);
        this.container.appendChild(this.bgCircle);
    }
}

export class SvgLoader {
    constructor() {
        this.urlToSvg = {};
        this.parser = new DOMParser();
    }

    /**
     * Fetch an SVG file and turn it into an SVGElement.
     * Returns a Promise that resolves to the element.
     *
     * @param {string} url The URL (local or on the web) of the SVG file.
     * @returns {SVGElement} The SVG element.
     */
    async getSvg(url) {
        if (!(url in this.urlToSvg)) {
            // Send the request
            const resp = await fetch(url);
            if (!resp.ok)
                throw new Error(`Failed to fetch ${url}: ${resp.status}`);
            const text = await resp.text();

            // Parse the SVG
            const doc = this.parser.parseFromString(text, "image/svg+xml");
            const svg = doc.documentElement;
            if (!(svg instanceof SVGElement)) {
                throw new Error("Fetched file is not a valid SVG");
            }
            this.urlToSvg[url] = svg;
        }

        return this.urlToSvg[url];
    }
}
