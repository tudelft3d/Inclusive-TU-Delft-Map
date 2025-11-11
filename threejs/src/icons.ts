import { CamerasControls } from "./camera";
import {
    CSS2DObject,
    CSS2DRenderer,
} from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { Scene, Vector3 } from "three";

export class IconSet {
    key: string;
    basePos: Vector3;
    appearanceThreshold: number;
    svgIcons: Record<string, SvgIcon>;
    textIcon: TextIcon | null;
    wrapper: HTMLDivElement;
    subWrapper: HTMLDivElement;
    subSubWrapper: HTMLDivElement;
    iconsArrow: HTMLImageElement;
    svgIconsRow: HTMLDivElement | null;
    wrapperObject: CSS2DObject;
    pointerMoved: boolean;

    /**
     * Create a set of icons at the same position.
     *
     * @param {string} key
     * @param {SvgIcon[]} svgIcons
     * @param {TextIcon | null} textIcon
     * @param {Vector3} worldPos
     * @param {*} onClick
     * @param {number} appearanceThreshold
     */
    constructor(
        key: string,
        svgIcons: SvgIcon[],
        textIcon: TextIcon | null,
        worldPos: Vector3,
        onClick: (e: PointerEvent) => void,
        appearanceThreshold = Infinity
    ) {
        this.key = key;
        this.basePos = worldPos;
        this.appearanceThreshold = appearanceThreshold;

        this.svgIcons = {};
        svgIcons.map((svgIcon) => {
            const key = svgIcon.key;
            if (key in this.svgIcons) {
                console.error(
                    `There is already a SvgIcon with this key ('${key}')`
                );
            }
            this.svgIcons[key] = svgIcon;
        });

        this.textIcon = textIcon;

        // Main wrapper that gets moved by three.js
        this.wrapper = document.createElement("div");
        this.wrapper.className = "icons-container";

        // Subwrapper
        this.subWrapper = document.createElement("div");
        this.subWrapper.className = "icons-subcontainer";
        this.wrapper.appendChild(this.subWrapper);

        // Subsubwrapper to move the position anchor
        this.subSubWrapper = document.createElement("div");
        this.subSubWrapper.className = "icons-subsubcontainer";
        this.subWrapper.appendChild(this.subSubWrapper);

        // Add the text
        if (this.textIcon) {
            if (!(this.textIcon.container instanceof HTMLElement)) {
                throw new Error("text must be a string or HTMLElement");
            }
            this.subSubWrapper.appendChild(this.textIcon.container);
        }

        // Build the row of icons
        this.svgIconsRow = null;
        this._makeIconsRow();

        // Pointing arrow
        this.iconsArrow = document.createElement("img");
        this.iconsArrow.src =
            "/assets/threejs/graphics/icons/thematic-layers/triangle.svg";
        this.iconsArrow.className = "icons-arrow";
        this.iconsArrow.style.setProperty("--triangle-fill", "white");
        this.subWrapper.appendChild(this.iconsArrow);

        // Make the actual three.js object
        this.wrapperObject = new CSS2DObject(this.wrapper);
        this.pointerMoved = false;
        this.wrapper.addEventListener("pointerdown", (e) => {
            this.pointerMoved = false;
        });
        this.wrapper.addEventListener("pointermove", (e) => {
            this.pointerMoved = true;
        });
        this.wrapper.addEventListener("pointerup", (e) => {
            if (this.pointerMoved) {
                return;
            }
            onClick(e);
        });
    }

    hasText() {
        return !!this.textIcon;
    }

    addSvgIcon(svgIcon: SvgIcon) {
        const key = svgIcon.key;
        if (key in this.svgIcons) {
            console.error(
                `There is already a SvgIcon with this key ('${key}')`
            );
        }
        this.svgIcons[key] = svgIcon;
        this._makeIconsRow();
    }

    removeSvgIcon(key: string) {
        if (!(key in this.svgIcons)) {
            console.error(`There is no SvgIcon with this key ('${key}')`);
            return;
        }

        delete this.svgIcons[key];

        this._makeIconsRow();
    }

    _makeIconsRow() {
        // Remove the previous row
        if (this.svgIconsRow) {
            this.subSubWrapper.removeChild(this.svgIconsRow);
            this.svgIconsRow = null;
        }

        if (Object.keys(this.svgIcons).length === 0) {
            return;
        }

        // Build the row of icons
        this.svgIconsRow = document.createElement("div");
        this.svgIconsRow.className = "icons-svg-row";
        for (const [key, svgIcon] of Object.entries(this.svgIcons)) {
            if (!(svgIcon.container instanceof HTMLElement)) {
                throw new Error("Each icon must be an HTMLElement");
            }
            this.svgIconsRow.appendChild(svgIcon.container);
        }
        this.subSubWrapper.appendChild(this.svgIconsRow);
    }

    /**
     * Set the scale in screen units.
     *
     * @param {number} scale
     */
    _setScale(scale: number) {
        const baseOffset = new Vector3(0, (50 * (1 - scale)) / 2, 0);
        this.subWrapper.style.transform = `scale(${scale}) translate(0, -50%)`;
        this.wrapperObject.position.copy(this.basePos.clone().add(baseOffset));
    }

    /**
     * Set the size of the sprite based on the camera position.
     *
     * @param {CamerasControls} cameraManager
     */
    setSizeFromCameraManager(cameraManager: CamerasControls) {
        // Compute the distance from the camera to the object position
        var distance: number;
        if (cameraManager.usesMapCamera() || cameraManager.usesOrbitCamera()) {
            const camToIcon = this.basePos
                .clone()
                .sub(cameraManager.camera.position);
            const camDirection = new Vector3();
            cameraManager.camera.getWorldDirection(camDirection);
            distance = camToIcon.dot(camDirection);
        } else if (cameraManager.usesOrthographicCamera()) {
            distance = cameraManager.orthographicDistance();
        } else {
            console.error("Unexpected situation.");
            return;
        }

        // Compute the scale based on the distance
        var scale;
        if (distance < this.appearanceThreshold) {
            scale = 1;
        } else {
            // scale = (1 * thresholdDistance) / distance;
            scale = 0;
        }
        this._setScale(scale);
    }
}

export class IconsSceneManager {
    scene: Scene;
    renderer: CSS2DRenderer;
    iconContainer: HTMLDivElement;
    mainContainer: HTMLDivElement;
    iconSets: Record<string, IconSet>;
    movedDuringPointer: boolean;

    /**
     * A class to manage a scene of icons and its specificities.
     *
     * @param {Scene} scene
     * @param {CSS2DRenderer} renderer
     * @param {HTMLDivElement} iconContainer
     * @param {HTMLDivElement} mainContainer
     */
    constructor(
        scene: Scene,
        renderer: CSS2DRenderer,
        iconContainer: HTMLDivElement,
        mainContainer: HTMLDivElement
    ) {
        this.scene = scene;
        this.renderer = renderer;
        this.iconContainer = iconContainer;
        this.mainContainer = mainContainer;
        this.iconSets = {};
        this.movedDuringPointer = false;
        this._setUpEventListeners();
    }

    _setUpEventListeners() {
        this.movedDuringPointer = false;
        this.mainContainer.addEventListener("pointerdown", (e) => {
            const tgt = e.target;
            if (!(tgt instanceof Node) || !this.iconContainer.contains(tgt))
                return;
            this.movedDuringPointer = false;
            if (
                tgt instanceof Element &&
                typeof tgt.setPointerCapture === "function"
            ) {
                tgt.setPointerCapture(e.pointerId);
            }
        });
        this.mainContainer.addEventListener("pointermove", (e) => {
            const tgt = e.target;
            if (!(tgt instanceof Node) || !this.iconContainer.contains(tgt))
                return;
            this.movedDuringPointer = true;
        });
        this.mainContainer.addEventListener("pointerup", (e) => {
            const tgt = e.target;
            if (!(tgt instanceof Node) || !this.iconContainer.contains(tgt))
                return;
            if (this.movedDuringPointer) return;
        });
    }

    /**
     * Add an icon to the scene with an identifier.
     *
     * @param {IconSet} iconSet
     */
    addIconSet(iconSet: IconSet) {
        const key = iconSet.key;
        if (key in this.iconSets) {
            console.error(
                `There is already an IconSet with this key ('${key}')`
            );
        }
        // iconSet.wrapper.
        this.iconSets[key] = iconSet;
        this.scene.add(iconSet.wrapperObject);
    }

    /**
     * Remove an IconSet from the scene based on its identifier.
     *
     * @param {string} key
     */
    removeIconSet(key: string) {
        if (!(key in this.iconSets)) {
            console.error(`There is no IconSet with this key ('${key}')`);
            return;
        }
        const iconSet = this.iconSets[key];
        this.scene.remove(iconSet.wrapperObject);
        delete this.iconSets[key];
    }

    // /**
    //  * Remove all IconSets from the scene.
    //  *
    //  */
    // removeAllIconSets() {
    //     for (const [key, icon] of Object.entries(this.iconSets)) {
    //         this.removeIconSet(key);
    //     }
    // }

    /**
     * Resize the icons based on the camera position.
     * To call before rendering.
     *
     * @param {CamerasControls} cameraManager
     */
    beforeRender(cameraManager: CamerasControls) {
        for (const [key, icon] of Object.entries(this.iconSets)) {
            icon.setSizeFromCameraManager(cameraManager);
        }
    }

    /**
     *
     * @param {number} time
     * @param {CamerasControls} cameraManager
     */
    render(time: number, cameraManager: CamerasControls) {
        this.beforeRender(cameraManager);
        this.renderer.render(this.scene, cameraManager.camera);
    }
}

export interface TextIconOptions {
    /** Text colour (CSS value). `null` means “inherit”. */
    color?: string | null;
    /** Background colour (CSS value). `null` means “transparent”. */
    bgColor?: string | null;
    /** Additional CSS class(es) to apply. */
    cssClass?: string;
}

export class TextIcon {
    container: HTMLDivElement;
    content: HTMLDivElement;

    /**
     * A wrapper for text to put in an icon.
     *
     * @param {string} text The text that will be shown inside the icon.
     * @param {Object} [options] Optional configuration.
     * @param {string|null} [options.color=null] Text colour (CSS value). `null` means “inherit”.
     * @param {string|null} [options.bgColor=null] Background colour (CSS value). `null` means “transparent”.
     * @param {string} [options.cssClass=''] Additional CSS class(es) to apply.
     */
    constructor(text: string, opts: TextIconOptions = {}) {
        const { color = undefined, bgColor = undefined, cssClass = "" } = opts;

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

    // is_populated() {
    //     return !(this.content["innerText"] == "");
    // }
}

export class SvgIcon {
    key: string;
    container: HTMLDivElement;
    bgCircle: HTMLDivElement;
    content: SVGElement;

    /**
     * A wrapper for a SVG element to put in an icon.
     *
     * @param {string} key The unique identifier of this SvgIcon.
     * @param {SVGElement} svgElement The SVG element that will be shown inside the icon.
     * @param {Object} [options] Optional configuration.
     * @param {string|null} [options.size=null] Icon size (CSS value). `null` means default.
     * @param {string|null} [options.bgColor=null] Background colour (CSS value). `null` means “transparent”.
     * @param {string} [options.cssClass=''] Additional CSS class(es) to apply.
     */
    constructor(
        key: string,
        svgElement: SVGElement,
        { size = null, bgColor = null, cssClass = "" } = {}
    ) {
        this.key = key;

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
        this.content = svgElement.cloneNode(true) as SVGElement;
        this.content.setAttribute("class", "icon-svg-content");

        // Assemble the hierarchy
        this.bgCircle.appendChild(this.content);
        this.container.appendChild(this.bgCircle);
    }
}

export class SvgLoader {
    urlToSvg: Record<string, SVGElement>;
    parser: DOMParser;

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
    async getSvg(url: string) {
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
