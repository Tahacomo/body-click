import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let data = {}, active = null, scene, camera, renderer, controls, zones = [];

async function init() {
    // 1. بارگذاری داده‌های JSON
    try {
        const response = await fetch('./regions.json');
        data = await response.json();
    } catch (e) {
        document.getElementById('load-status').textContent = "خطا در بارگذاری داده‌های JSON!";
        return;
    }

    // 2. تنظیمات Three.js
    const canvas = document.querySelector('#scene');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

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
    controls.autoRotateSpeed = 0.6;

    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);

    // 3. بارگذاری مدل سه‌بعدی
    const loader = new GLTFLoader();
    try {
        const gltf = await loader.loadAsync('./models/human.glb');
        const model = gltf.scene;
        
        model.traverse(child => {
            if (child.isMesh) {
                child.material = new THREE.MeshPhysicalMaterial({
                    color: 0x0062ff, roughness: 0.2, transmission: 0.5, transparent: true, opacity: 0.35
                });
            }
        });

        // تنظیم اندازه و موقعیت مدل
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.position.y = -0.5;
        model.scale.setScalar(4 / size.y);
        bodyGroup.add(model);

        // ساخت مناطق کلیک (Hit Zones)
        const addZone = (id, pos, sz) => {
            const geo = new THREE.BoxGeometry(...sz);
            const mat = new THREE.MeshBasicMaterial({ visible: false });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(...pos);
            mesh.userData.region = id;
            zones.push(mesh);
            bodyGroup.add(mesh);
        };

        addZone('head', [0, 3.4, 0], [0.8, 0.7, 0.7]);
        addZone('chest', [0, 2.5, 0], [1.2, 0.9, 0.7]);
        addZone('abdomen', [0, 1.8, 0], [1, 0.6, 0.7]);
        addZone('pelvis', [0, 1.2, 0], [1, 0.5, 0.7]);
        addZone('armLeft', [-0.65, 2.3, 0], [0.5, 1.4, 0.5]);
        addZone('armRight', [0.65, 2.3, 0], [0.5, 1.4, 0.5]);
        addZone('legLeft', [-0.28, 0.2, 0], [0.5, 1.8, 0.6]);
        addZone('legRight', [0.28, 0.2, 0], [0.5, 1.8, 0.6]);

        document.getElementById('loading').classList.add('hide');
        animate();
    } catch (err) {
        console.error(err);
        document.getElementById('load-status').textContent = "خطا: فایل مدل (human.glb) یافت نشد!";
    }

    // 4. رویدادها
    setupUI();
}

function setupUI() {
    const select = (id) => {
        if (!data[id]) return;
        active = id;
        document.querySelectorAll('[data-region]').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-region="${id}"]`)?.classList.add('active');
        
        document.getElementById('title').textContent = data[id].label;
        const diseases = data[id].diseases;
        document.getElementById('content').innerHTML = Array.isArray(diseases) 
            ? diseases.map(d => `<div><h3>${d.name}</h3><p>${d.desc}</p></div>`).join('')
            : `<p>${diseases}</p>`;
        
        document.getElementById('panel').hidden = false;
        controls.autoRotate = false;
    };

    // کلیک روی دکمه‌های راهنما
    document.querySelectorAll('[data-region]').forEach(btn => {
        btn.onclick = () => select(btn.dataset.region);
    });

    // بستن پنل
    document.getElementById('close').onclick = () => {
        document.getElementById('panel').hidden = true;
        controls.autoRotate = true;
        active = null;
    };

    // کلیک روی مدل سه‌بعدی
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    window.addEventListener('click', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(zones);
        if (hits.length > 0) select(hits[0].object.userData.region);
    });

    // ناوبری
    const btn3d = document.getElementById('nav-3d');
    const btnEncy = document.getElementById('nav-encyclopedia');
    const v3d = document.getElementById('view-3d');
    const vEncy = document.getElementById('view-encyclopedia');

    btn3d.onclick = () => {
        btn3d.classList.add('active'); btnEncy.classList.remove('active');
        v3d.classList.remove('hidden'); vEncy.classList.add('hidden');
    };
    btnEncy.onclick = () => {
        btnEncy.classList.add('active'); btn3d.classList.remove('active');
        vEncy.classList.remove('hidden'); v3d.classList.add('hidden');
        renderEncyclopedia();
    };

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

function renderEncyclopedia() {
    const grid = document.getElementById('organ-grid');
    grid.innerHTML = Object.keys(data).map(key => {
        const item = data[key];
        return item.label ? `
            <div class="organ-card">
                <img src="${item.image || 'https://via.placeholder.com/400x250?text='+item.label}" alt="${item.label}">
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
