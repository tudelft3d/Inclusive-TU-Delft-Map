// outlineManager.js
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { GammaCorrectionShader } from 'three/examples/jsm/shaders/GammaCorrectionShader.js';

export class OutlineManager {
 
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;

        this.composer = new EffectComposer(renderer);

        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);

        this.outlinePass = new OutlinePass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            scene,
            camera
        );

        // default styling
        this.outlinePass.edgeStrength = 5;
        this.outlinePass.edgeGlow = 0.25;
        this.outlinePass.edgeThickness = 0.3;
        this.outlinePass.visibleEdgeColor.set('#ffffffff');
        this.outlinePass.hiddenEdgeColor.set('#ffffffff');

        this.composer.addPass(this.outlinePass);

        this.gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
        this.composer.addPass(this.gammaCorrectionPass);

        this.selectedObjects = [];
        this._resizeListener = () => this.onResize();
        window.addEventListener('resize', this._resizeListener);
    }

    // post-processing pipeline - deltaTime is for glow/other effects that animate
    // initial renderer only runs once - use composer instead of WebGL's renderer
    render(deltaTime) {
        this.composer.render(deltaTime);
    }

    outlineObjects(objects) {
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
