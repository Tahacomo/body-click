import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let regionData = {};
let activeId = null;
const regionMeshes = {}; // id -> [mesh, mesh, ...]
const raycastable = [];  // flat list of meshes used for picking

/* ------------------------------------------------------------------ */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, window.innerWidth/window.innerHeight, 0.1, 100);
camera.position.set(0, 2.0, 6.2);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.9, 0);
controls.minDistance = 3.0;
controls.maxDistance = 9;
controls.maxPolarAngle = Math.PI * 0.85;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;
controls.update();

scene.add(new THREE.AmbientLight(0x2a3b52, 1.2));
const key = new THREE.DirectionalLight(0xdfe9f5, 1.1);
key.position.set(3, 6, 4);
scene.add(key);
const rim = new THREE.PointLight(0x34e7c0, 5, 12);
rim.position.set(-2, 3, -3);
scene.add(rim);

const gridHelper = new THREE.GridHelper(6, 24, 0x1b2a3f, 0x1b2a3f);
gridHelper.position.y = 0.01;
scene.add(gridHelper);

/* ------------------------------------------------------------------ */
/* Body construction — every part is an independently pickable mesh   */
/* ------------------------------------------------------------------ */
const body = new THREE.Group();
scene.add(body);

const BASE_COLOR = 0x9db3c9;
const BASE_OPACITY = 0.17;

function makeMaterial(){
  return new THREE.MeshPhysicalMaterial({
    color: BASE_COLOR, transparent:true, opacity: BASE_OPACITY,
    roughness:0.25, metalness:0, transmission:0.5, thickness:0.6,
    emissive:0x000000, emissiveIntensity:0, depthWrite:false,
  });
}

function addRegionMesh(id, geo, x, y, z, rx=0, ry=0, rz=0){
  const mesh = new THREE.Mesh(geo, makeMaterial());
  mesh.position.set(x,y,z);
  mesh.rotation.set(rx,ry,rz);
  mesh.userData.id = id;
  body.add(mesh);
  raycastable.push(mesh);
  (regionMeshes[id] ??= []).push(mesh);
}

// head / neck
addRegionMesh('head', new THREE.SphereGeometry(0.42, 24, 24), 0, 3.55, 0);
addRegionMesh('neck', new THREE.CylinderGeometry(0.14,0.16,0.22,16), 0, 3.16, 0);

// chest / abdomen (front torso split into two)
addRegionMesh('chest',   new THREE.CapsuleGeometry(0.50, 0.55, 6, 16), 0, 2.45, 0);
addRegionMesh('abdomen', new THREE.CapsuleGeometry(0.48, 0.35, 6, 16), 0, 1.80, 0);

// back (thin curved slab behind torso, pickable when rotated around)
addRegionMesh('back', new THREE.BoxGeometry(0.95, 1.55, 0.18, 1, 1, 1), 0, 2.05, -0.42);

// pelvis / hips
addRegionMesh('pelvis', new THREE.SphereGeometry(0.46, 20, 16), 0, 1.28, 0);

// arms (shoulder-to-wrist capsule + hand)
[-1,1].forEach(side=>{
  const id = side < 0 ? 'armLeft' : 'armRight';
  addRegionMesh(id, new THREE.CapsuleGeometry(0.13, 1.15, 6, 12), side*0.72, 2.15, 0, 0, 0, side*0.06);
  addRegionMesh(id, new THREE.SphereGeometry(0.11, 14, 14), side*0.78, 1.42, 0);
});

// legs (thigh-to-ankle capsule + foot)
[-1,1].forEach(side=>{
  const id = side < 0 ? 'legLeft' : 'legRight';
  addRegionMesh(id, new THREE.CapsuleGeometry(0.19, 1.5, 6, 14), side*0.26, 0.35, 0);
  addRegionMesh(id, new THREE.BoxGeometry(0.18,0.12,0.32), side*0.26, -0.46, 0.08);
});

/* ------------------------------------------------------------------ */
/* Highlight logic                                                     */
/* ------------------------------------------------------------------ */
function setHighlight(id, on){
  const meshes = regionMeshes[id];
  if(!meshes) return;
  meshes.forEach(m=>{
    const mat = m.material;
    if(on){
      mat.color.set(0xff4438);
      mat.opacity = 0.55;
      mat.emissive.set(0xff2318);
      mat.emissiveIntensity = 0.7;
    }else{
      mat.color.set(BASE_COLOR);
      mat.opacity = BASE_OPACITY;
      mat.emissive.set(0x000000);
      mat.emissiveIntensity = 0;
    }
  });
}

/* ------------------------------------------------------------------ */
/* Panel + chip nav                                                    */
/* ------------------------------------------------------------------ */
const panel = document.getElementById('panel');
const panelTitle = document.getElementById('panelTitle');
const panelList = document.getElementById('panelList');
document.getElementById('panelClose').addEventListener('click', closePanel);

const chipNav = document.getElementById('regionNav');
const chipEls = {};

function buildChips(){
  Object.keys(regionMeshes).forEach(id=>{
    const info = regionData[id];
    if(!info || chipEls[id]) return;
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = info.label;
    chip.addEventListener('click', ()=> selectRegion(id));
    chipNav.appendChild(chip);
    chipEls[id] = chip;
  });
}

function selectRegion(id){
  const info = regionData[id];
  if(!info) return;

  if(activeId) { setHighlight(activeId, false); chipEls[activeId]?.classList.remove('active'); }
  activeId = id;
  setHighlight(id, true);
  chipEls[id]?.classList.add('active');

  panelTitle.textContent = info.label;
  panelList.innerHTML = '';
  info.diseases.forEach(d=>{
    const li = document.createElement('li');
    const h3 = document.createElement('h3'); h3.textContent = d.name;
    const p = document.createElement('p'); p.textContent = d.desc;
    li.appendChild(h3); li.appendChild(p);
    panelList.appendChild(li);
  });
  panel.hidden = false;
  controls.autoRotate = false;
}

function closePanel(){
  panel.hidden = true;
  if(activeId){ setHighlight(activeId, false); chipEls[activeId]?.classList.remove('active'); }
  activeId = null;
}

/* ------------------------------------------------------------------ */
/* Pointer picking                                                     */
/* ------------------------------------------------------------------ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let downPos = null;

renderer.domElement.addEventListener('pointerdown', (e)=>{ downPos = [e.clientX, e.clientY]; });
renderer.domElement.addEventListener('pointerup', (e)=>{
  if(!downPos) return;
  const dx = e.clientX - downPos[0], dy = e.clientY - downPos[1];
  if(Math.sqrt(dx*dx + dy*dy) > 6) return; // it was a drag, not a click

  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(raycastable, false);
  if(hits.length){
    selectRegion(hits[0].object.userData.id);
  }
});

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */
async function boot(){
  try{
    const res = await fetch('regions.json');
    regionData = await res.json();
  }catch(e){
    console.error('نتونستم regions.json رو بخونم — از طریق یه سرور محلی (نه file://) باز کن.', e);
  }
  buildChips();
  document.getElementById('loadingScreen').classList.add('hidden');
}
boot();

/* ------------------------------------------------------------------ */
window.addEventListener('resize', ()=>{
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate(){
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
