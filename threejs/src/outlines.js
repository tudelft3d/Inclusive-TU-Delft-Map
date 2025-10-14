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
        this.outlinePasses = [];
        this.selectedObjects = [];
        this.style = {
            edgeStrength: 5,
            edgeGlow: 0.25,
            edgeThickness: 0.3,
            visibleEdgeColor: '#ffffff',
            hiddenEdgeColor: '#ffffff'
        };
        this._resizeListener = () => this.onResize();
        window.addEventListener('resize', this._resizeListener);
    }

    // post-processing pipeline - deltaTime is for glow/other effects that animate
    // initial renderer only runs once - use composer instead of WebGL's renderer
    render(deltaTime, cameraManager, renderer) {
        var currentIndex = null;
        for (var i = 0; i < this.composers.length; i++) {
            var camera = this.cameras[i];
            if (camera == cameraManager.camera) {
                currentIndex = i;
            }
        }
        if (currentIndex === null) {
            this._create_outline_pass(cameraManager, renderer);
            currentIndex = this.composers.length - 1;
        }
        var composer = this.composers[currentIndex];
        var outlinePass = this.outlinePasses[currentIndex];
        outlinePass.selectedObjects = this.selectedObjects;
        composer.render(deltaTime);
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

        outlinePass.edgeStrength = this.style.edgeStrength;
        outlinePass.edgeGlow = this.style.edgeGlow;
        outlinePass.edgeThickness = this.style.edgeThickness;
        outlinePass.visibleEdgeColor.set(this.style.visibleEdgeColor);
        outlinePass.hiddenEdgeColor.set(this.style.hiddenEdgeColor);

        composer.addPass(outlinePass);

        var gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
        composer.addPass(gammaCorrectionPass);

        this.composers.push(composer);
        this.cameras.push(cameraManager.camera);
        this.outlinePasses.push(outlinePass);
        return composer;
    }

    outlineObjects(objects, code = "default") {
        // console.log(objects);
        if (!Array.isArray(objects)) objects = [objects];
        this.selectedObjects = objects;

        console.log(objects);

    }

    clearOutline() {
        this.selectedObjects = [];
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
