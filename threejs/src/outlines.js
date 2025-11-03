// outlineManager.js
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { FXAAPass } from "three/examples/jsm/postprocessing/FXAAPass.js";
import { GammaCorrectionShader } from "three/examples/jsm/shaders/GammaCorrectionShader.js";
import { LocationSceneManager } from "./location";

export class OutlineManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.composers = [];
        this.cameras = [];
        this.outlinePasses = [];
        this.selectedObjects = [];
        this.style = {
            edgeStrength: 5,
            edgeGlow: 0.25,
            edgeThickness: 0.3,
            visibleEdgeColor: new THREE.Color("#ffffff"),
            hiddenEdgeColor: new THREE.Color("#ffffff"),
        };
        this._resizeListener = () => this.onResize();
        window.addEventListener("resize", this._resizeListener);
    }

    // post-processing pipeline - deltaTime is for glow/other effects that animate
    // initial renderer only runs once - use composer instead of WebGL's renderer
    render(deltaTime, cameraManager) {
        var currentIndex = null;
        for (var i = 0; i < this.composers.length; i++) {
            var camera = this.cameras[i];
            if (camera == cameraManager.camera) {
                currentIndex = i;
            }
        }
        if (currentIndex === null) {
            this._create_outline_pass(cameraManager);
            currentIndex = this.composers.length - 1;
        }

        // // Update the size of the icons
        // this.iconsSceneManager.beforeRender(cameraManager);

        var composer = this.composers[currentIndex];
        var outlinePass = this.outlinePasses[currentIndex];
        outlinePass.selectedObjects = this.selectedObjects;

        composer.render(deltaTime);
    }

    _create_outline_pass(cameraManager) {
        const composer = new EffectComposer(this.renderer);

        // First pass for the 3D objects
        const renderPass = new RenderPass(this.scene, cameraManager.camera);
        composer.addPass(renderPass);

        // Second pass for the outline of the 3D objects
        const outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.scene,
            cameraManager.camera
        );

        // Outline settings
        outlinePass.edgeStrength = this.style.edgeStrength;
        outlinePass.edgeGlow = this.style.edgeGlow;
        outlinePass.edgeThickness = this.style.edgeThickness;
        outlinePass.visibleEdgeColor.set(this.style.visibleEdgeColor);
        outlinePass.hiddenEdgeColor.set(this.style.hiddenEdgeColor);

        composer.addPass(outlinePass);

        // // Third pass for the icons
        // var iconsRenderPass = new RenderPass(this.iconsSceneManager.scene, cameraManager.camera);
        // iconsRenderPass.clear = false; // To avoid replacing everything on the screen
        // iconsRenderPass.clearDepth = true;
        // composer.addPass(iconsRenderPass);

        // Fourth pass to make everything appear
        const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
        composer.addPass(gammaCorrectionPass);

        // // Fifth pass for antialiasing
        // const fxaaPass = new FXAAPass();
        // composer.addPass(fxaaPass);

        // Store all the objects
        this.composers.push(composer);
        this.cameras.push(cameraManager.camera);
        this.outlinePasses.push(outlinePass);
        return composer;
    }
    setStyle(code = "default") {
        for (const composer of this.composers) {
            const outline = composer.passes[1];
            if (code == "default") {
                outline.edgeStrength = 5;
                outline.edgeGlow = 0.25;
                outline.edgeThickness = 0.3;
                outline.visibleEdgeColor.set("#ffffff");
                outline.hiddenEdgeColor.set("#ffffff");
            }
            if (code == "single") {
                outline.edgeStrength = 5;
                outline.edgeGlow = 0.25;
                outline.edgeThickness = 0.3;
                outline.visibleEdgeColor.set("#d9ff00");
                outline.hiddenEdgeColor.set("#d9ff00");
            }
            if (code == "hover") {
                outline.edgeStrength = 5;
                outline.edgeGlow = 0.25;
                outline.edgeThickness = 0.3;
                outline.visibleEdgeColor.set("#0bff02");
                outline.hiddenEdgeColor.set("#0bff02");
            }
        }
    }

    setOutline(objectList, lod = 'lod_2', style) {

        const outlineObjects = [];
        for (const obj of objectList) {
            let target;
            if (obj.includes('lod_')) {
                target = this.scene.getObjectByName(obj);
            }
            else target = this.scene.getObjectByName(`${obj}-${lod}`);
            if (target) outlineObjects.push(target);
        }

        this.outlineObjects(outlineObjects, style);
    }


    outlineObjects(objects, code = "default") {
        this.setStyle(code);
        if (!Array.isArray(objects)) objects = [objects];
        this.selectedObjects = objects;
    }

    clearOutline() {
        this.selectedObjects = [];
    }

    // below two functions are necessary when browser window is resized
    onResize() {
        for (var i = 0; i < this.composers.length; i++) {
            this.composers[i].setSize(window.innerWidth, window.innerHeight);
            this.outlinePasses[i].setSize(
                window.innerWidth,
                window.innerHeight
            );
        }
    }

    dispose() {
        window.removeEventListener("resize", this._resizeListener);
    }
}
