import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

let data={},active=null;
const canvas=document.querySelector('#scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;

const scene=new THREE.Scene();scene.background=new THREE.Color(0x03070c);
const pmrem=new THREE.PMREMGenerator(renderer), env=new RoomEnvironment(renderer);
scene.environment=pmrem.fromScene(env,.04).texture;env.dispose();pmrem.dispose();

const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,100);
camera.position.set(0,1.9,6);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableDamping=true;controls.dampingFactor=.07;controls.target.set(0,1.8,0);
controls.minDistance=2.4;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.93;
controls.enablePan=false;controls.autoRotate=true;controls.autoRotateSpeed=.3;

scene.add(new THREE.HemisphereLight(0xcfe8ff,0x071019,2));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(4,7,5);scene.add(key);
const fill=new THREE.DirectionalLight(0x79bfff,1.5);fill.position.set(-5,4,2);scene.add(fill);
const rim=new THREE.PointLight(0x31e8ff,8,14);rim.position.set(-3,3,-4);scene.add(rim);

const body=new THREE.Group();scene.add(body);
const regions={};
const zones=[];
const baseMat=()=>new THREE.MeshPhysicalMaterial({color:0xeaf8ff,roughness:.035,transmission:1,thickness:.5,ior:1.45,transparent:true,opacity:.9,depthWrite:false,clearcoat:1,clearcoatRoughness:.04,envMapIntensity:2.5,attenuationColor:new THREE.Color(0x8edbff),attenuationDistance:1.6});
const redMat=()=>new THREE.MeshPhysicalMaterial({color:0xff2f26,emissive:0xff1008,emissiveIntensity:1.3,roughness:.08,transmission:.25,thickness:.35,transparent:true,opacity:.97,clearcoat:1,envMapIntensity:2});

function addZone(id,pos,size){
 const m=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}));
 m.position.set(...pos);m.userData.region=id;zones.push(m);body.add(m);
}
function zonesForHuman(){
 addZone('head',[0,3.43,0],[.8,.75,.7]);addZone('chest',[0,2.5,0],[1.25,.9,.75]);
 addZone('abdomen',[0,1.82,0],[1.05,.65,.7]);addZone('pelvis',[0,1.25,0],[1.05,.55,.75]);
 addZone('armLeft',[-.62,2.35,0],[.5,1.45,.55]);addZone('armRight',[.62,2.35,0],[.5,1.45,.55]);
 addZone('legLeft',[-.25,.25,0],[.5,1.8,.6]);addZone('legRight',[.25,.25,0],[.5,1.8,.6]);
}

let model;
async function load(){
 const gltf=await new GLTFLoader().loadAsync('./models/human.glb');model=gltf.scene;
 model.traverse(o=>{if(o.isMesh){o.material=baseMat();o.userData.original=baseMat();}});
 const box=new THREE.Box3().setFromObject(model),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 model.position.sub(center);model.position.y=size.y/2-1;model.scale.setScalar(4.2/size.y);body.add(model);
 zonesForHuman();
}

function highlightRegion(id,on){
 // The supplied GLB is one continuous surface. We therefore use a precise
 // anatomical overlay/highlight zone rather than falsely claiming individual
 // mesh separation.
 const zone=zones.find(z=>z.userData.region===id);
 if(zone){
   zone.material=on?new THREE.MeshBasicMaterial({color:0xff2018,transparent:true,opacity:.12,depthWrite:false}):new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
 }
 // Add a localized red glow using a transparent sphere/box overlay.
}

function select(id){
 if(!data[id])return;
 if(active){highlightRegion(active,false);document.querySelector(`[data-region="${active}"]`)?.classList.remove('active')}
 active=id;highlightRegion(id,true);document.querySelector(`[data-region="${id}"]`)?.classList.add('active');
 document.querySelector('#title').textContent=data[id].label;
 document.querySelector('#content').innerHTML=data[id].diseases.map(x=>`<h3>${x.name}</h3><p>${x.desc}</p>`).join('');
 document.querySelector('#panel').hidden=false;controls.autoRotate=false;
}
document.querySelector('#close').onclick=()=>{document.querySelector('#panel').hidden=true;if(active){highlightRegion(active,false);document.querySelector(`[data-region="${active}"]`)?.classList.remove('active')}active=null;controls.autoRotate=true};
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>select(b.dataset.region));

const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down=null;
renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{
 if(!down)return;if(Math.hypot(e.clientX-down[0],e.clientY-down[1])>6){down=null;return}
 pointer.x=e.clientX/innerWidth*2-1;pointer.y=-(e.clientY/innerHeight)*2+1;ray.setFromCamera(pointer,camera);
 const hit=ray.intersectObjects(zones,false)[0];if(hit)select(hit.object.userData.region);down=null;
});

async function boot(){
 try{data=await (await fetch('./regions.json')).json();await load()}
 catch(e){console.error(e);document.querySelector('#loading b').textContent='خطا در بارگذاری پروژه؛ آن را با Local Server اجرا کنید.'}
 document.querySelector('#loading').classList.add('hide');
}
boot();

addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
function animate(){requestAnimationFrame(animate);controls.update();renderer.render(scene,camera)}animate();
