// outlineManager.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

export class OutlineManager {

    constructor(scene) {
        this.scene = scene;
        this.composers = [];
        this.cameras = [];
        this.selectedObjects = [];
        this._resizeListener = () => this.onResize();
        window.addEventListener('resize', this._resizeListener);
    }

    // post-processing pipeline - deltaTime is for glow/other effects that animate
    // initial renderer only runs once - use composer instead of WebGL's renderer
    render(deltaTime, cameraManager, renderer) {
        var currentComposer = null;
        for (var i = 0; i < this.composers.length; i++) {
            var composer = this.composers[i];
            var camera = this.cameras[i];
            if (camera == cameraManager.camera) {
                currentComposer = composer;
            }
        }
        if (!currentComposer && (this.composers.length < 3)) {
            currentComposer = this._create_outline_pass(cameraManager, renderer);
        }
        currentComposer.render(deltaTime);
    }

    _create_outline_pass(cameraManager, renderer) {
        var composer = new EffectComposer(renderer);
        var renderPass = new RenderPass(this.scene, cameraManager.camera);
        composer.addPass(renderPass);

        var outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            this.scene,
            cameraManager.camera
        );

        // Default styling
        outlinePass.edgeStrength = 5;
        outlinePass.edgeGlow = 0.25;
        outlinePass.edgeThickness = 0.3;
        outlinePass.visibleEdgeColor.set('#ffffff');
        outlinePass.hiddenEdgeColor.set('#ffffff');

        composer.addPass(outlinePass);

        var gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
        composer.addPass(gammaCorrectionPass);

        this.composers.push(composer);
        this.cameras.push(cameraManager.camera);
        return composer;
    }

    outlineObjects(objects) {
        console.log(objects);
        if (!Array.isArray(objects)) objects = [objects];
        this.selectedObjects = objects;
        this.outlinePass.selectedObjects = objects;
    }

    clearOutline() {
        this.selectedObjects = [];
        this.outlinePass.selectedObjects = [];
    }

    // below two functions are necessary when browser window is resized
    onResize() {
        this.composer.setSize(window.innerWidth, window.innerHeight);
        this.outlinePass.setSize(window.innerWidth, window.innerHeight);
    }

    dispose() {
        window.removeEventListener('resize', this._resizeListener);
    }
}
