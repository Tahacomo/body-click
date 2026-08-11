import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

let data = {}, active = null;
const canvas = document.querySelector('#scene');
const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf4f9ff);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 1.9, 6);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.8, 0);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

const body = new THREE.Group();
scene.add(body);
const zones = [];

const baseMat = () => new THREE.MeshPhysicalMaterial({
    color: 0x0062ff, roughness: 0.1, transmission: 0.5, 
    thickness: 1, transparent: true, opacity: 0.3, clearcoat: 1
});

const highlightMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.3 });

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
    const gltf = await new GLTFLoader().loadAsync('./models/human.glb');
    const model = gltf.scene;
    model.traverse(o => { if(o.isMesh) o.material = baseMat(); });
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.y = -0.5;
    model.scale.setScalar(4 / size.y);
    body.add(model);
    zonesForHuman();
}

function select(id) {
    if (!data[id]) return;
    document.querySelectorAll('[data-region]').forEach(b => b.classList.remove('active'));
    zones.forEach(z => z.material = new THREE.MeshBasicMaterial({transparent: true, opacity: 0}));

    active = id;
    const btn = document.querySelector(`[data-region="${id}"]`);
    if(btn) btn.classList.add('active');

    const zone = zones.find(z => z.userData.region === id);
    if(zone) zone.material = highlightMat;
    
    document.querySelector('#title').textContent = data[id].label;
    document.querySelector('#content').innerHTML = data[id].diseases
        .map(x => `<div><h3>${x.name}</h3><p>${x.desc}</p></div>`).join('');
    
    document.querySelector('#panel').hidden = false;
    controls.autoRotate = false;
}

window.selectFromSearch = (id) => { select(id); document.querySelector('#panel').scrollTop = 0; };

function normalizePersian(text) {
    if (!text) return "";
    return text.replace(/ی/g, "ي").replace(/ک/g, "ك").replace(/آ/g, "ا").toLowerCase().trim();
}

function performSearch() {
    const term = normalizePersian(document.querySelector('#searchInput').value);
    const panel = document.querySelector('#panel');
    const content = document.querySelector('#content');
    const title = document.querySelector('#title');

    if (term.length < 2) { if (active) select(active); else panel.hidden = true; return; }

    let results = [];
    for (let key in data) {
        data[key].diseases.forEach(d => {
            if (normalizePersian(d.name).includes(term) || normalizePersian(d.desc).includes(term)) {
                results.push({ ...d, regionId: key, regionName: data[key].label });
            }
        });
    }

    title.textContent = 'نتایج جستجو';
    content.innerHTML = results.length > 0 ? results.map(x => `
        <div style="cursor:pointer; border-bottom:1px solid #eef4fb; padding:15px 0;" onclick="window.selectFromSearch('${x.regionId}')">
            <small style="color:var(--primary-blue); font-weight:bold">${x.regionName}</small>
            <h3 style="margin:5px 0">${x.name}</h3><p style="font-size:12px">${x.desc}</p>
        </div>`).join('') : '<p style="text-align:center; padding:20px;">موردی یافت نشد.</p>';
    panel.hidden = false;
    controls.autoRotate = false;
}

document.querySelector('#searchInput').addEventListener('input', performSearch);
document.querySelector('#searchBtn').addEventListener('click', performSearch);
document.querySelector('#searchInput').addEventListener('keypress', (e) => { if(e.key === 'Enter') performSearch(); });

document.querySelector('#close').onclick = () => {
    document.querySelector('#panel').hidden = true;
    document.querySelectorAll('[data-region]').forEach(b => b.classList.remove('active'));
    zones.forEach(z => z.material = new THREE.MeshBasicMaterial({transparent: true, opacity: 0}));
    active = null; controls.autoRotate = true; document.querySelector('#searchInput').value = '';
};

document.querySelectorAll('[data-region]').forEach(b => b.addEventListener('click', () => select(b.dataset.region)));

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
        data = await (await fetch('./regions.json')).json();
        await load();
    } catch(e) { console.error(e); }
    document.querySelector('#loading').classList.add('hide');
}
boot();

window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
});

function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); }
animate();
