import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let data = {}, scene, camera, renderer, controls, model, zones = [];

async function init() {
    // لود دیتا
    const res = await fetch('./regions.json');
    data = await res.json();

    const canvas = document.querySelector('#women-scene');
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    camera = new THREE.PerspectiveCamera(35, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
    camera.position.set(0, 1.5, 5);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // نورپردازی گرم و صورتی
    const ambient = new THREE.AmbientLight(0xffe5ec, 1);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 5, 5);
    scene.add(sun);

    const loader = new GLTFLoader();
    // نکته: اگر فایل female.glb دارید جایگزین کنید، در غیر این صورت از مدل قبلی با رنگ متفاوت استفاده می‌شود
    // این بخش را در فایل women.js جایگزین بخش قبلی کنید
loader.load('./models/woman.glb', (gltf) => {
    model = gltf.scene;
    model.traverse(child => {
        if (child.isMesh) {
            child.material = new THREE.MeshPhysicalMaterial({
                color: 0xffb3c1, roughness: 0.3, transmission: 0.2, transparent: true, opacity: 0.8
            });
        }
    });

    // --- اصلاح موقعیت مدل ---
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // مدل را به مرکز مختصات منتقل می‌کنیم
    model.position.x += (model.position.x - center.x);
    model.position.y += (model.position.y - center.y);
    model.position.z += (model.position.z - center.z);

    // تنظیم مقیاس بر اساس ارتفاع
    model.scale.setScalar(3.5 / size.y);
    
    scene.add(model);

    // تنظیم هدف دوربین روی مرکز مدل
    controls.target.set(0, 0, 0);
    camera.position.set(0, 0, 5); // دوربین مستقیم روبروی مدل
    
    setupWomenZones();
    document.getElementById('loading-women').style.display = 'none';
    animate();
});

// اصلاح تابع resize برای جلوگیری از کشیدگی تصویر
window.addEventListener('resize', () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
});

    setupEvents();
}

function setupWomenZones() {
    const addZ = (id, pos, sz) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...sz), new THREE.MeshBasicMaterial({ visible: false }));
        mesh.position.set(...pos);
        mesh.userData.region = id;
        zones.push(mesh);
        scene.add(mesh);
    };

    // نقاط کلیک مخصوص بانوان
    addZ('breasts', [0, 2.4, 0.3], [1, 0.5, 0.4]);
    addZ('uterus', [0, 1.3, 0.2], [0.5, 0.5, 0.5]);
    addZ('ovaries', [0, 1.4, 0.2], [0.8, 0.3, 0.3]);
    addZ('pelvis', [0, 1.2, 0], [1, 0.6, 0.7]);
}

function showInfo(id) {
    if (!data[id]) return;
    const container = document.getElementById('women-content');

    // هایلایت دکمه
    document.querySelectorAll('.region-btn-list button').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-region="${id}"]`)?.classList.add('active');

    // رندر بیماری ها (نام قرمز، توضیحات مشکی)
    const diseasesHTML = data[id].diseases.map(d => `
        <div class="disease-card">
            <h3>${d.name}</h3>
            <p>${d.desc}</p>
        </div>
    `).join('');

    container.innerHTML = `
        <div style="animation: fadeIn 0.5s;">
            <h2 style="color: #ff4d6d; border-bottom: 2px solid #ffccd5; padding-bottom: 10px;">${data[id].label}</h2>
            <p style="line-height: 1.8; color: #590d22; font-size: 15px; margin-bottom: 20px;">${data[id].info}</p>
            <h4 style="color: #800f2f;">بیماری‌های شایع:</h4>
            ${diseasesHTML}
        </div>
    `;
}

function setupEvents() {
    document.querySelectorAll('.region-btn-list button').forEach(btn => {
        btn.onclick = () => showInfo(btn.dataset.region);
    });

    window.addEventListener('click', (e) => {
        const rect = renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(zones);
        if (hits.length > 0) showInfo(hits[0].object.userData.region);
    });

    window.addEventListener('resize', () => {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    });
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

init();
