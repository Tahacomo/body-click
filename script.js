import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

let data = {}, active = null, renderer, scene, camera, controls, body, zones = [];

const canvas = document.querySelector('#scene');

// جلوگیری از ارور اگر کانواس یافت نشد
if (!canvas) {
    console.error("خطا: المان #scene در HTML یافت نشد.");
} else {
    initScene();
}

function initScene() {
    renderer = new THREE.WebGLRenderer({canvas, antialias: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4f9ff);
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
    camera.position.set(0, 1.9, 6);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 1.8, 0);
    controls.autoRotate = true;

    body = new THREE.Group();
    scene.add(body);

    const baseMat = () => new THREE.MeshPhysicalMaterial({
        color: 0x0062ff, roughness: 0.1, transmission: 0.5, transparent: true, opacity: 0.3
    });

    const highlightMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.4 });

    function addZone(id, pos, size) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial({transparent: true, opacity: 0}));
        m.position.set(...pos);
        m.userData.region = id;
        zones.push(m);
        body.add(m);
    }

    function zonesForHuman() {
        addZone('head', [0, 3.43, 0], [0.8, 0.75, 0.7]);
        addZone('chest', [0, 2.5, 0], [1.25, 0.9, 0.75]);
        addZone('abdomen', [0, 1.82, 0], [1.05, 0.65, 0.7]);
        addZone('pelvis', [0, 1.25, 0], [1.05, 0.55, 0.75]);
        addZone('armLeft', [-0.62, 2.35, 0], [0.5, 1.45, 0.5]);
        addZone('armRight', [0.62, 2.35, 0], [0.5, 1.45, 0.5]);
        addZone('legLeft', [-0.25, 0.25, 0], [0.5, 1.8, 0.6]);
        addZone('legRight', [0.25, 0.25, 0], [0.5, 1.8, 0.6]);
    }

    async function loadModel() {
        try {
            const gltf = await new GLTFLoader().loadAsync('./models/human.glb');
            const model = gltf.scene;
            model.traverse(o => { if(o.isMesh) o.material = baseMat(); });
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            model.position.y = -0.5;
            model.scale.setScalar(4 / size.y);
            body.add(model);
            zonesForHuman();
        } catch(e) { console.error("مدل لود نشد:", e); }
    }

    function select(id) {
        if (!data[id]) return;
        document.querySelectorAll('[data-region]').forEach(b => b.classList.remove('active'));
        zones.forEach(z => z.material = new THREE.MeshBasicMaterial({transparent: true, opacity: 0}));
        active = id;
        document.querySelector(`[data-region="${id}"]`)?.classList.add('active');
        const zone = zones.find(z => z.userData.region === id);
        if(zone) zone.material = highlightMat;
        document.querySelector('#title').textContent = data[id].label;
        const diseases = data[id].diseases;
        document.querySelector('#content').innerHTML = Array.isArray(diseases) 
            ? diseases.map(x => `<div><h3>${x.name}</h3><p>${x.desc}</p></div>`).join('') 
            : `<p>${diseases}</p>`;
        document.querySelector('#panel').hidden = false;
        controls.autoRotate = false;
    }

    // ناوبری
    function initNavigation() {
        const btn3d = document.getElementById('nav-3d');
        const btnEncy = document.getElementById('nav-encyclopedia');
        const v3d = document.getElementById('view-3d');
        const vEncy = document.getElementById('view-encyclopedia');

        if (btn3d && btnEncy) {
            btn3d.onclick = () => {
                btn3d.classList.add('active'); btnEncy.classList.remove('active');
                v3d.classList.remove('hidden'); vEncy.classList.add('hidden');
            };
            btnEncy.onclick = () => {
                btnEncy.classList.add('active'); btn3d.classList.remove('active');
                vEncy.classList.remove('hidden'); v3d.classList.add('hidden');
                renderEncyclopedia();
            };
        }
    }

    function renderEncyclopedia() {
        const grid = document.getElementById('organ-grid');
        if (!grid) return;
        grid.innerHTML = Object.keys(data).map(key => {
            const item = data[key];
            return item.label ? `
                <div class="organ-card">
                    <img src="${item.image || 'https://via.placeholder.com/400x250?text='+item.label}" alt="${item.label}">
                    <div class="organ-card-body">
                        <h3>${item.label}</h3>
                        <p>${item.info || 'توضیحاتی ثبت نشده است.'}</p>
                    </div>
                </div>` : '';
        }).join('');
    }

    async function boot() {
        try {
            const res = await fetch('./regions.json');
            data = await res.json();
            await loadModel();
            initNavigation();
        } catch(e) { console.error("دیتا لود نشد:", e); }
        document.querySelector('#loading')?.classList.add('hide');
    }

    boot();

    // هندل کردن بستن پنل
    const closeBtn = document.querySelector('#close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            document.querySelector('#panel').hidden = true;
            active = null; controls.autoRotate = true;
        };
    }

    // کلیک روی دکمه‌های راهنما
    document.querySelectorAll('[data-region]').forEach(b => {
        b.onclick = () => select(b.dataset.region);
    });

    // ری‌کستر برای کلیک روی مدل
    renderer.domElement.addEventListener('click', e => {
        const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
        pointer.x = (e.clientX / innerWidth) * 2 - 1;
        pointer.y = -(e.clientY / innerHeight) * 2 + 1;
        ray.setFromCamera(pointer, camera);
        const hit = ray.intersectObjects(zones)[0];
        if (hit) select(hit.object.userData.region);
    });

    window.addEventListener('resize', () => {
        camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(innerWidth, innerHeight);
    });

    function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
    animate();
}
