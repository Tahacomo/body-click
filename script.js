import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let regionData = {};
let activeId = null;

const regionMeshes = {};
const raycastable = [];

const canvas = document.getElementById('scene');

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080d);

const pmrem = new THREE.PMREMGenerator(renderer);
const environment = new RoomEnvironment(renderer);
scene.environment = pmrem.fromScene(environment, 0.04).texture;
environment.dispose();
pmrem.dispose();

const camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(0, 1.9, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.075;
controls.target.set(0, 1.8, 0);
controls.minDistance = 2.5;
controls.maxDistance = 8;
controls.maxPolarAngle = Math.PI * 0.92;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.update();

scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x10151d, 2.0));

const key = new THREE.DirectionalLight(0xffffff, 3.0);
key.position.set(4, 7, 5);
scene.add(key);

const fill = new THREE.DirectionalLight(0x8bbcff, 1.5);
fill.position.set(-5, 4, 2);
scene.add(fill);

const rim = new THREE.PointLight(0x38e8ff, 8, 15);
rim.position.set(-3, 3, -4);
scene.add(rim);

const rim2 = new THREE.PointLight(0x6b7cff, 5, 12);
rim2.position.set(3, 2, -3);
scene.add(rim2);

const floor = new THREE.Mesh(
    new THREE.CircleGeometry(4, 64),
    new THREE.MeshStandardMaterial({
        color: 0x071019,
        roughness: 0.65,
        metalness: 0.15
    })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.02;
scene.add(floor);

const grid = new THREE.GridHelper(8, 32, 0x183047, 0x0d1925);
grid.position.y = -1;
scene.add(grid);

const body = new THREE.Group();
scene.add(body);

const BASE_COLOR = 0xeaf7ff;

function createGlassMaterial() {
    return new THREE.MeshPhysicalMaterial({
        color: BASE_COLOR,
        metalness: 0,
        roughness: 0.06,
        transmission: 1,
        thickness: 0.65,
        ior: 1.45,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 2.2,
        attenuationColor: new THREE.Color(0x9bdcff),
        attenuationDistance: 1.8
    });
}

function createHighlightMaterial() {
    return new THREE.MeshPhysicalMaterial({
        color: 0xff392f,
        emissive: 0xff160f,
        emissiveIntensity: 1,
        metalness: 0,
        roughness: 0.08,
        transmission: 0.35,
        thickness: 0.4,
        ior: 1.45,
        transparent: true,
        opacity: 0.95,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 2
    });
}

function registerMesh(region, mesh) {
    mesh.userData.region = region;
    if (!regionMeshes[region]) regionMeshes[region] = [];
    regionMeshes[region].push(mesh);
    raycastable.push(mesh);
}

function createProceduralFallback() {
    const material = createGlassMaterial();

    function addMesh(id, geometry, position, rotation = [0, 0, 0]) {
        const mesh = new THREE.Mesh(geometry, material.clone());
        mesh.position.set(...position);
        mesh.rotation.set(...rotation);
        registerMesh(id, mesh);
        body.add(mesh);
    }

    addMesh('head', new THREE.SphereGeometry(.34, 48, 32), [0, 3.5, 0]);
    addMesh('neck', new THREE.CylinderGeometry(.12, .15, .25, 32), [0, 3.15, 0]);
    addMesh('chest', new THREE.CapsuleGeometry(.52, .7, 12, 32), [0, 2.55, 0]);
    addMesh('abdomen', new THREE.CapsuleGeometry(.42, .5, 12, 32), [0, 1.85, 0]);
    addMesh('pelvis', new THREE.SphereGeometry(.45, 32, 24), [0, 1.25, 0]);

    [-1, 1].forEach(side => {
        const id = side < 0 ? 'armLeft' : 'armRight';
        addMesh(
            id,
            new THREE.CapsuleGeometry(.13, 1.1, 8, 24),
            [side * .72, 2.35, 0],
            [0, 0, side * .15]
        );
    });

    [-1, 1].forEach(side => {
        const id = side < 0 ? 'legLeft' : 'legRight';
        addMesh(
            id,
            new THREE.CapsuleGeometry(.18, 1.45, 8, 24),
            [side * .25, .35, 0]
        );
    });
}

async function loadHumanModel() {
    try {
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync('./models/human.glb');
        const model = gltf.scene;

        model.traverse(object => {
            if (!object.isMesh) return;

            object.castShadow = true;
            object.receiveShadow = true;
            object.material = createGlassMaterial();

            const name = object.name.toLowerCase();

            let region = null;

            if (name.includes('head') || name.includes('skull')) region = 'head';
            else if (name.includes('neck')) region = 'neck';
            else if (name.includes('chest') || name.includes('thorax')) region = 'chest';
            else if (name.includes('abdomen') || name.includes('stomach')) region = 'abdomen';
            else if (name.includes('pelvis') || name.includes('hip')) region = 'pelvis';
            else if (name.includes('leftarm') || name.includes('left_arm')) region = 'armLeft';
            else if (name.includes('rightarm') || name.includes('right_arm')) region = 'armRight';
            else if (name.includes('leftleg') || name.includes('left_leg')) region = 'legLeft';
            else if (name.includes('rightleg') || name.includes('right_leg')) region = 'legRight';

            if (region) registerMesh(region, object);
        });

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());

        model.position.sub(center);
        model.position.y = size.y / 2 - 1;

        const desiredHeight = 4.2;
        model.scale.setScalar(desiredHeight / size.y);

        body.add(model);
        console.log('human.glb loaded successfully');
    } catch (error) {
        console.warn('human.glb not found; using procedural fallback.', error);
        createProceduralFallback();
    }
}

function setHighlight(id, enabled) {
    const meshes = regionMeshes[id];
    if (!meshes) return;

    meshes.forEach(mesh => {
        mesh.material = enabled
            ? createHighlightMaterial()
            : createGlassMaterial();
    });
}

const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panelTitle');
const panelList = document.getElementById('panelList');
const chipNav = document.getElementById('regionNav');
const chipEls = {};

document.getElementById('panelClose').addEventListener('click', closePanel);

function buildChips() {
    Object.keys(regionMeshes).forEach(id => {
        const info = regionData[id];
        if (!info || chipEls[id]) return;

        const chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = info.label;
        chip.addEventListener('click', () => selectRegion(id));

        chipNav.appendChild(chip);
        chipEls[id] = chip;
    });
}

function selectRegion(id) {
    const info = regionData[id];
    if (!info) return;

    if (activeId) {
        setHighlight(activeId, false);
        chipEls[activeId]?.classList.remove('active');
    }

    activeId = id;
    setHighlight(id, true);
    chipEls[id]?.classList.add('active');

    panelTitle.textContent = info.label;
    panelList.innerHTML = '';

    info.diseases.forEach(disease => {
        const li = document.createElement('li');

        const title = document.createElement('h3');
        title.textContent = disease.name;

        const description = document.createElement('p');
        description.textContent = disease.desc;

        li.appendChild(title);
        li.appendChild(description);
        panelList.appendChild(li);
    });

    panel.hidden = false;
    controls.autoRotate = false;
}

function closePanel() {
    panel.hidden = true;

    if (activeId) {
        setHighlight(activeId, false);
        chipEls[activeId]?.classList.remove('active');
    }

    activeId = null;
    controls.autoRotate = true;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPosition = null;

renderer.domElement.addEventListener('pointerdown', event => {
    downPosition = [event.clientX, event.clientY];
});

renderer.domElement.addEventListener('pointerup', event => {
    if (!downPosition) return;

    const dx = event.clientX - downPosition[0];
    const dy = event.clientY - downPosition[1];

    if (Math.hypot(dx, dy) > 6) {
        downPosition = null;
        return;
    }

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(raycastable, true);

    if (hits.length) {
        const region = hits[0].object.userData.region;
        if (region) selectRegion(region);
    }

    downPosition = null;
});

async function loadRegions() {
    try {
        const response = await fetch('./regions.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        regionData = await response.json();
    } catch (error) {
        console.error('regions.json could not be loaded:', error);
    }
}

async function boot() {
    await loadRegions();
    await loadHumanModel();
    buildChips();

    document.getElementById('loadingScreen').classList.add('hidden');
}

boot();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

animate();
