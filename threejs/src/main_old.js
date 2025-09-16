import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { CamerasControls } from './camera';
import { Vector3 } from 'three';

// Helper to fill the pane with arbitrary key/value pairs
function setInfoContent(data, infoPane) {
    // `data` is an object like { name:'Box', size:'1 m³', material:'Lambert' }
    const rows = Object.entries(data)
        .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
        .join('<br>');
    infoPane.innerHTML = rows;
    infoPane.style.opacity = rows ? '1' : '0';
}

const hoveredObjectColor = 0xFF0000
const pickedObjectColor = 0x00FF00

class PickHelper {
    constructor() {
        this.raycaster = new THREE.Raycaster();
        this.hoveredObject = null;
        this.hoveredObjectSavedColor = null;
        this.pickedObject = null;
        this.pickedObjectSavedColor = null;
        this.pickedOldControls = null;
    }
    hover(normalizedPosition, scene) {
        // Restore the color if there is a hovered object
        if (this.hoveredObject) {
            this.hoveredObject.material.emissive.setHex(this.hoveredObjectSavedColor);
            this.hoveredObjectSavedColor = null;

            this.hoveredObject = null;
        }

        // Cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);
        // Get the list of objects the ray intersected
        const intersectedObjects = this.raycaster.intersectObjects(scene.children);
        if (intersectedObjects.length) {
            // pick the first object. It's the closest one
            const mesh = intersectedObjects[0].object;
            if (mesh == this.pickedObject) {
                return;
            }

            // To skip the background
            if (!mesh.name) { return }

            // To prevent the modification from applyting to all objects
            if (!mesh.userData.hasOwnProperty('materialCloned')) {
                // Clone the material and mark the mesh so we don’t clone again later
                mesh.material = mesh.material.clone();
                mesh.userData.materialCloned = true;
            }
            // save its color
            if (this.hoveredObject == mesh && this.hoveredObject == this.pickedObject) {
                this.hoveredObject.material.emissive.setHex(pickedObjectColor)
            } else {
                this.hoveredObjectSavedColor = mesh.material.emissive.getHex();
            }
            // set its emissive color to red
            mesh.material.emissive.setHex(hoveredObjectColor);

            this.hoveredObject = mesh;
        }
    }
    pick(normalizedPosition, scene, infoPane) {
        // Restore the color if there was a picked object
        if (this.pickedObject) {
            this.pickedObject.material.emissive.setHex(this.pickedObjectSavedColor);
            this.pickedObject = null;
            this.pickedObjectSavedColor = null;
            setInfoContent({}, infoPane);
        }

        // Cast a ray through the frustum
        this.raycaster.setFromCamera(normalizedPosition, camera);
        // Get the list of objects the ray intersected
        const intersectedObjects = this.raycaster.intersectObjects(scene.children);
        if (intersectedObjects.length) {
            // pick the first object. It's the closest one
            const mesh = intersectedObjects[0].object;

            // To skip the background
            if (!mesh.name) { return }

            // To prevent the modification from applyting to all objects
            if (!mesh.userData.hasOwnProperty('materialCloned')) {
                // Clone the material and mark the mesh so we don’t clone again later
                mesh.material = mesh.material.clone();
                mesh.userData.materialCloned = true;
            }
            // save its color
            if (this.hoveredObject == this.pickedObject) {
                this.pickedObjectSavedColor = this.hoveredObjectSavedColor
            } else {
                this.pickedObjectSavedColor = mesh.material.emissive.getHex();
            }
            // set its emissive color to red
            mesh.material.emissive.setHex(pickedObjectColor);

            const info = {
                Name: mesh.name || 'unnamed',
                Type: mesh.geometry?.type || 'unknown',
            };
            setInfoContent(info, infoPane);

            this.pickedObject = mesh;

            // Change the controls to OrbitControls
            setControlsOrbit();

            // Find the center of the mesh
            const box = new THREE.Box3().setFromObject(mesh);
            const center = new THREE.Vector3();
            box.getCenter(center);
            // mesh.localToWorld(center);
            controls.position = otherControls.position;
            controls.target.set(center.x, center.y, center.z);
            controls.update();
        } else {
            setControlsMap();
        }
    }
}

var container;

function main() {
    // Container
    container = document.querySelector('#scene-container');

    // Cameras and controls
    const cameraPosition = Vector3(0, 1000, 0);
    const cameraLookAt = Vector3(0, 0, 0);
    const camerasControls = CamerasControls(container, cameraPosition, cameraLookAt, true)

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('black');

    // Light
    const color = 0xFFFFFF;
    const intensity = 1;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(0, 100, 100);
    light.target.position.set(0, 0, 0);
    scene.add(light);
    scene.add(light.target);
    const light2 = new THREE.DirectionalLight(color, intensity);
    light2.position.set(0, 100, -100);
    light2.target.position.set(0, 0, 0);
    scene.add(light2);
    scene.add(light2.target);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, container });
    const canvas = renderer.domElement;
    renderer.setSize(window.innerWidth, window.innerHeight);
    // renderer.setAnimationLoop(animate);
    container.append(renderer.domElement);

    // Generate a plane
    const planeSizeX = 2000;
    const planeSizeY = 3000;
    const planeGeometry = new THREE.PlaneGeometry(planeSizeX, planeSizeY);
    const planeMaterial = new THREE.MeshPhongMaterial({ emissive: 0xFFFFFF });
    const planeMesh = new THREE.Mesh(planeGeometry, planeMaterial);
    planeMesh.rotateX(-Math.PI / 2);
    planeMesh.position.set(planeSizeX / 2, 0, -planeSizeY / 2);
    scene.add(planeMesh);

    {    // Background texture
        const loader = new THREE.CubeTextureLoader();
        loader.setPath('assets/graphics/');
        const skyboxTexture = loader.load([
            'sky_gradient_sides.png',
            'sky_gradient_sides.png',
            'sky_gradient_upper.png',
            'sky_gradient_lower.png',
            'sky_gradient_sides.png',
            'sky_gradient_sides.png',
        ]);
        scene.background = skyboxTexture;
    }

    // Loader
    function loadGLTF(path, scene) {
        const loader = new GLTFLoader();
        loader.load(path, function (gltf) {
            let objs = gltf.scene
            objs.rotateX(-Math.PI / 2)
            console.log(objs.children[0].children)
            objs.translateX(-84800);
            objs.translateY(-444300);
            scene.add(objs);
            requestAnimationFrame(render);
        }, undefined, function (error) {
            console.error(error);
        });
    };

    // loadGLTF('output/bk/geom/model.gltf', scene)
    loadGLTF('output/campus/geom/model.glb', scene)

    // For the clicks
    const infoPane = document.getElementById('info-pane');
    const pickPosition = { x: 0, y: 0 };
    const pickHelper = new PickHelper();
    clearPickPosition();

    function getCanvasRelativePosition(event) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (event.clientX - rect.left) * canvas.width / rect.width,
            y: (event.clientY - rect.top) * canvas.height / rect.height,
        };
    }

    function setPickPosition(event) {
        const pos = getCanvasRelativePosition(event);
        pickPosition.x = (pos.x / canvas.width) * 2 - 1;
        pickPosition.y = (pos.y / canvas.height) * -2 + 1;  // note we flip Y
    }

    function hoverEvent(event) {
        setPickPosition(event);
        pickHelper.hover(pickPosition, scene);
        render();
    }

    function clickEvent(event) {
        setPickPosition(event);
        pickHelper.pick(pickPosition, scene, infoPane);
        render();
    }

    function clearPickPosition() {
        // unlike the mouse which always has a position
        // if the user stops touching the screen we want
        // to stop picking. For now we just pick a value
        // unlikely to pick something
        pickPosition.x = -100000;
        pickPosition.y = -100000;
    }

    // Mobile controls
    let cameraMovedDuringTouch = false;
    // let activeTouchId = null;

    controls.addEventListener('change', () => {
        cameraMovedDuringTouch = true;
    });


    window.addEventListener('mousemove', hoverEvent);
    // window.addEventListener('mousemove', render);
    window.addEventListener('mousedown', (event) => {
        // prevent the window from scrolling
        cameraMovedDuringTouch = false;
    }, { passive: false });
    window.addEventListener('mouseup', (event) => {
        if (!cameraMovedDuringTouch) {
            clickEvent(event);
        } else {
            clearPickPosition();
        }
    }, { passive: false });
    // window.addEventListener('click', render);
    // window.addEventListener('mouseout', clearPickPosition);
    // window.addEventListener('mouseleave', clearPickPosition);


    window.addEventListener('touchstart', (event) => {
        // prevent the window from scrolling
        cameraMovedDuringTouch = false;
    }, { passive: false });

    // window.addEventListener('touchmove', (event) => {
    //     if (event.touches.length === 1) {
    //         setPickPosition(event.touches[0]);
    //     }
    // });
    // window.addEventListener('touchend', setClickPosition);
    window.addEventListener('touchend', (event) => {
        // const endedTouch = Array.from(evt.changedTouches).find(t => t.identifier === activeTouchId);
        // if (!endedTouch) {
        //     // The finger that started the tap is not the one that ended → ignore.
        //     // This can happen when the user adds a second finger mid‑gesture.
        //     activeTouchId = null;
        //     return;
        // }

        if (!cameraMovedDuringTouch) {
            const touch = event.changedTouches[0];
            clickEvent(touch);
            // clearPickPosition(); // optional – clears hover after click
        } else {
            // No remaining touches (e.g., a cancelled gesture)
            clearPickPosition();
        }
    }, { passive: false });
    // window.addEventListener('touchcancel', clearPickPosition, { passive: false });

    // Display resizer
    function resizeRendererToDisplaySize(renderer) {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if (needResize) {

            renderer.setSize(width, height, false);

        }

        return needResize;

    }

    function render() {

        if (resizeRendererToDisplaySize(renderer)) {

            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();

        }

        renderer.render(scene, camera);
        // requestAnimationFrame(render);
    }

    requestAnimationFrame(render);

    // Conditions to render
    controls.addEventListener('change', render);
    window.addEventListener('resize', render);

};

main();