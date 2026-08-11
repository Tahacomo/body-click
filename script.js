import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let data = {}, active = null, scene, camera, renderer, controls, zones = [];

async function init() {
    try {
        const res = await fetch('./regions.json');
        data = await res.json();
    } catch (e) {
        document.getElementById('status').innerText = "خطا در بارگذاری داده‌ها!";
        return;
    }

    const canvas = document.querySelector('#scene');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fbff);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 1.8, 6);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.5, 0);
    controls.autoRotate = true;

    const loader = new GLTFLoader();
    loader.load('./models/human.glb', (gltf) => {
        const model = gltf.scene;
        model.traverse(child => {
            if (child.isMesh) {
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0x0062ff, roughness: 0.1, transmission: 0.5, transparent: true, opacity: 0.3
                });
            }
        });
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.position.y = -0.5;
        model.scale.setScalar(4 / size.y);
        scene.add(model);

        setupZones();
        document.getElementById('loading').classList.add('hide');
        animate();
    });

    setupUI();
}

function setupZones() {
    const addZone = (id, pos, sz) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...sz), new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(...pos);
        mesh.userData.region = id;
        zones.push(mesh);
        scene.add(mesh);
    };

    // مختصات نواحی و اندام‌ها
    addZone('head', [0, 3.4, 0], [0.8, 0.7, 0.7]);
    addZone('heart', [0, 2.6, 0.2], [0.4, 0.4, 0.4]);
    addZone('lungs', [0, 2.5, 0.1], [1, 0.8, 0.5]);
    addZone('liver', [-0.2, 1.95, 0.2], [0.5, 0.4, 0.4]);
    addZone('stomach', [0.2, 1.95, 0.2], [0.4, 0.4, 0.4]);
    addZone('kidneys', [0, 1.7, -0.2], [0.8, 0.4, 0.3]);
    addZone('chest', [0, 2.5, 0], [1.2, 0.9, 0.7]);
    addZone('abdomen', [0, 1.8, 0], [1, 0.6, 0.7]);
    addZone('pelvis', [0, 1.2, 0], [1, 0.5, 0.7]);
    addZone('armLeft', [-0.65, 2.3, 0], [0.5, 1.4, 0.5]);
    addZone('armRight', [0.65, 2.3, 0], [0.5, 1.4, 0.5]);
    addZone('legLeft', [-0.28, 0.2, 0], [0.5, 1.8, 0.6]);
    addZone('legRight', [0.28, 0.2, 0], [0.5, 1.8, 0.6]);
}

function select(id) {
    if (!data[id]) return;
    active = id;
    document.querySelectorAll('[data-region]').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-region="${id}"]`)?.classList.add('active');
    document.getElementById('title').innerText = data[id].label;
    const diseases = data[id].diseases;
    document.getElementById('content').innerHTML = Array.isArray(diseases)
        ? diseases.map(d => `<h3>${d.name}</h3><p>${d.desc}</p>`).join('')
        : `<p>${diseases}</p>`;
    document.getElementById('panel').hidden = false;
    controls.autoRotate = false;
}

function setupUI() {
    document.querySelectorAll('[data-region]').forEach(btn => {
        btn.onclick = () => select(btn.dataset.region);
    });
    document.getElementById('close').onclick = () => {
        document.getElementById('panel').hidden = true;
        controls.autoRotate = true;
    };
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    window.addEventListener('click', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(zones);
        if (hits.length > 0) select(hits[0].object.userData.region);
    });
    const nav3d = document.getElementById('nav-3d');
    const navEncy = document.getElementById('nav-encyclopedia');
    const v3d = document.getElementById('view-3d');
    const vEncy = document.getElementById('view-encyclopedia');
    nav3d.onclick = () => {
        nav3d.classList.add('active'); navEncy.classList.remove('active');
        v3d.classList.remove('hidden'); vEncy.classList.add('hidden');
    };
    navEncy.onclick = () => {
        navEncy.classList.add('active'); nav3d.classList.remove('active');
        vEncy.classList.remove('hidden'); v3d.classList.add('hidden');
        renderEncyclopedia();
    };
}

function renderEncyclopedia() {
    const grid = document.getElementById('organ-grid');
    grid.innerHTML = Object.keys(data).map(key => {
        const item = data[key];
        return item.label ? `
            <div class="organ-card">
                <img src="${item.image || 'https://via.placeholder.com/400x250'}" alt="${item.label}">
                <div class="organ-card-body">
                    <h3>${item.label}</h3>
                    <p>${item.info || 'توضیحات موجود نیست.'}</p>
                </div>
            </div>` : '';
    }).join('');
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
init();
