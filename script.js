import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let data = {}, active = null, scene, camera, renderer, controls, zones = [];

async function init() {
    // 1. Load JSON
    try {
        const res = await fetch('./regions.json');
        data = await res.json();
    } catch (e) {
        document.getElementById('status').innerText = "خطا در بارگذاری JSON!";
        return;
    }

    // 2. Setup Three.js
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

    // 3. Load Model
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

        // Scale & Position
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        model.position.y = -0.5;
        model.scale.setScalar(4 / size.y);
        scene.add(model);

        // Click Zones
        setupZones();
        document.getElementById('loading').classList.add('hide');
        animate();
    }, undefined, (err) => {
        document.getElementById('status').innerText = "خطا: مدل (human.glb) یافت نشد!";
    });

    setupUI();
}

function setupZones() {
    const addZone = (id, pos, sz) => {
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(...sz),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        mesh.position.set(...pos);
        mesh.userData.region = id;
        zones.push(mesh);
        scene.add(mesh);
    };

    addZone('head', [0, 3.4, 0], [0.8, 0.7, 0.7]);
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

    // Raycaster for 3D clicks
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    window.addEventListener('click', (e) => {
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(zones);
        if (hits.length > 0) select(hits[0].object.userData.region);
    });

    // Navigation
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
// --- متغیرهای جدید کوییز ---
let isQuizMode = false;
let quizScore = 0;
let targetId = "";
const quizList = []; // لیست اعضایی که در کوییز شرکت داده می‌شوند

// تابع شروع کوییز
function startQuiz() {
    isQuizMode = true;
    quizScore = 0;
    document.getElementById('current-score').innerText = "0";
    document.getElementById('quiz-start-screen').classList.add('hidden');
    document.getElementById('quiz-game-screen').classList.remove('hidden');
    
    // پر کردن لیست کوییز از دیتای لود شده (فقط اعضایی که لیبل دارند)
    Object.keys(data).forEach(key => {
        if(data[key].label) quizList.push({id: key, name: data[key].label});
    });
    
    nextQuestion();
}

// انتخاب سوال بعدی
function nextQuestion() {
    if (quizList.length === 0) {
        showQuizResult();
        return;
    }
    const randomIndex = Math.floor(Math.random() * quizList.length);
    const target = quizList.splice(randomIndex, 1)[0];
    targetId = target.id;
    document.getElementById('target-organ').innerText = target.name;
    
    // مخفی کردن پنل اطلاعات در حین کوییز
    document.getElementById('panel').hidden = true;
}

// بررسی پاسخ کاربر (این بخش را به تابع کلیک روی مدل یا دکمه‌ها اضافه کنید)
function checkQuizAnswer(clickedId) {
    if (!isQuizMode) return;

    if (clickedId === targetId) {
        // پاسخ صحیح
        quizScore += 10;
        document.getElementById('current-score').innerText = quizScore;
        alert("آفرین! درست بود ✅");
        nextQuestion();
    } else {
        // پاسخ غلط
        alert("اشتباه بود! دوباره تلاش کن ❌");
    }
}

// پایان کوییز
function showQuizResult() {
    isQuizMode = false;
    document.getElementById('quiz-game-screen').classList.add('hidden');
    document.getElementById('quiz-result-screen').classList.remove('hidden');
    document.getElementById('final-score').innerText = quizScore;
}

// --- مدیریت ناوبری (آپدیت شده) ---
const navQuiz = document.getElementById('nav-quiz');
const viewQuiz = document.getElementById('view-quiz');
const view3d = document.getElementById('view-3d');
const viewEncy = document.getElementById('view-encyclopedia');

navQuiz.onclick = () => {
    // برای کوییز، مدل سه بعدی باید در پس زمینه باشد
    view3d.classList.remove('hidden');
    viewEncy.classList.add('hidden');
    viewQuiz.classList.remove('hidden');
    
    // فعال کردن دکمه منو
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    navQuiz.classList.add('active');
};

// به تابع select(id) یا رویداد کلیک مدل سه‌بعدی این خط را اضافه کنید:
// if (isQuizMode) { checkQuizAnswer(id); return; }

document.getElementById('start-quiz-btn').onclick = startQuiz;

// اصلاح تابع کلیک روی مدل در انتهای script.js برای پشتیبانی از کوییز:
renderer.domElement.addEventListener('click', e => {
    const ray = new THREE.Raycaster(), pointer = new THREE.Vector2();
    pointer.x = (e.clientX / innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / innerHeight) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const hit = ray.intersectObjects(zones)[0];
    
    if (hit) {
        const id = hit.object.userData.region;
        if (isQuizMode) {
            checkQuizAnswer(id);
        } else {
            select(id);
        }
    }
});
