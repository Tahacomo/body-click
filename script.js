import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

let data = {}, active = null;
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf0f7ff); // پس‌زمینه روشن

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.9, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.8, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

// نورپردازی برای تم روشن
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(5, 10, 7);
scene.add(light);

const body = new THREE.Group();
scene.add(body);
const zones = [];

const baseMat = () => new THREE.MeshPhysicalMaterial({
    color: 0x3a99ff, roughness: 0.2, transmission: 0.7, thickness: 1, 
    transparent: true, opacity: 0.4, clearcoat: 1
});

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

async function load() {
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
    } catch(e) { console.error("Model load error", e); }
}

function select(id) {
    if (!data[id]) return;
    if (active) document.querySelector(`[data-region="${active}"]`)?.classList.remove('active');
    active = id;
    document.querySelector(`[data-region="${id}"]`)?.classList.add('active');
    
    document.querySelector('#title').textContent = data[id].label;
    document.querySelector('#content').innerHTML = data[id].diseases
        .map(x => `<div><h3>${x.name}</h3><p>${x.desc}</p></div>`).join('');
    
    document.querySelector('#panel').hidden = false;
    controls.autoRotate = false;
}

// قابلیت جستجو
document.querySelector('#searchInput').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    const panel = document.querySelector('#panel');
    const content = document.querySelector('#content');
    const title = document.querySelector('#title');

    if (term.length < 2) {
        if(active) select(active);
        else panel.hidden = true;
        return;
    }

    let results = [];
    for (let key in data) {
        data[key].diseases.forEach(d => {
            if (d.name.toLowerCase().includes(term) || d.desc.toLowerCase().includes(term)) {
                results.push({ ...d, regionName: data[key].label, regionId: key });
            }
        });
    }

    title.textContent = `نتایج جستجو برای: ${term}`;
    content.innerHTML = results.length > 0 
        ? results.map(x => `<div class="search-item" style="cursor:pointer; border-bottom:1px solid #eee; padding-bottom:10px" onclick="window.highlightAndSelect('${x.regionId}')">
            <small style="color:#007bff">${x.regionName}</small>
            <h3>${x.name}</h3><p>${x.desc}</p>
          </div>`).join('')
        : '<p>نتیجه‌ای یافت نشد.</p>';
    
    panel.hidden = false;
    controls.autoRotate = false;
});

// تابعی برای انتخاب از طریق نتایج جستجو
window.highlightAndSelect = (id) => {
    select(id);
};

document.querySelector('#close').onclick = () => {
    document.querySelector('#panel').hidden = true;
    if(active) document.querySelector(`[data-region="${active}"]`)?.classList.remove('active');
    active = null;
    controls.autoRotate = true;
    document.querySelector('#searchInput').value = '';
};

document.querySelectorAll('[data-region]').forEach(b => b.onclick = () => select(b.dataset.region));

// Raycaster برای کلیک روی مدل
const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
renderer.domElement.addEventListener('click', e => {
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(zones)[0];
    if (hit) select(hit.object.userData.region);
});

async function boot() {
    try {
        const res = await fetch('./regions.json');
        data = await res.json();
        await load();
    } catch(e) { 
        document.querySelector('#loading b').textContent = 'خطا در بارگذاری داده‌ها';
    }
    document.querySelector('#loading').classList.add('hide');
}

boot();
window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();
