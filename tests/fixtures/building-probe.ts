import {SunCoronas} from '../../src/render/SunCoronas';
import * as THREE from 'three';
import { readDff } from '../../src/assets/dff';
import { modelObject } from '../../src/assets/ModelObjects';
import { buildingLightingState, BUILDING_PIPELINE } from '../../src/assets/buildingMaterial';
import { placementFade } from '../../src/render/placementFade';
const bytes = new Uint8Array(await (await fetch('/tests/fixtures/walk-floor-building.dff')).arrayBuffer());
Object.assign(window,{ buildingProbe: () => {
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,64);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;document.body.append(renderer.domElement);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-4,4,4,-4,.1,30);camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
  function sample(day:number,night:number,balance:number,_unused=0,dayAlpha=255,nightAlpha=255,ambient=0,materialColor=255,coefficient=1,single=false,textured=false,fadeAlpha=255,lightMultiplier=1) {
    const model=readDff(bytes),state=buildingLightingState();state.night.value=balance;state.ambient.value.setScalar(ambient/255*lightMultiplier);
    if(single)model.atomics.forEach(a=>a.pipeline=BUILDING_PIPELINE);
    model.geometries.forEach(g=>{g.flags|=64;const count=g.positions.length/3;g.colors=new Uint8Array(count*4);g.nightColors=new Uint8Array(count*4);
      for(let i=0;i<count*4;i++){g.colors[i]=i%4===3?dayAlpha:day;g.nightColors[i]=i%4===3?nightAlpha:night;}
      if(single)g.nightColors=undefined;
      g.materials.forEach(m=>{m.color=[materialColor,materialColor,materialColor,255];m.surface[0]=coefficient;m.texture=textured?'test':'';});if(textured)g.uvs=[new Float32Array(count*2)];
    });
    const textures=textured?[{name:'test',filter:1,addressU:1,addressV:1,hasAlpha:false,mips:[{width:1,height:1,data:new Uint8ClampedArray([128,128,128,255])}]}]:[];
    const object=modelObject(model,textures,undefined,undefined,{buildingLighting:state});scene.add(object.root);
    const fade=placementFade(object.root);fade.setAlpha(fadeAlpha);
    renderer.render(scene,camera);const pixel=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    scene.remove(object.root);fade.dispose();object.dispose();return [...pixel];
  }
  const sunCamera=new THREE.PerspectiveCamera(55,1,.08,650),sunState=new SunCoronas();
  sunCamera.lookAt(.7,1.2,.7);sunCamera.updateMatrixWorld(true);
  const sunAmbient=()=>sample(0,0,0,0,255,255,128,255,1,false,false,255,sunState.lightMultiplier);
  const clearAmbient=sunAmbient();
  for(let i=0;i<20;i++)sunState.update(720,sunCamera,[1,1,1],[1,1,1],.02);
  const facingSunAmbient=sunAmbient();
  for(let i=0;i<20;i++)sunState.update(720,sunCamera,[1,1,1],[1,1,1],.02,0,()=>true);
  const blockedSunAmbient=sunAmbient();
  const result={clearAmbient,facingSunAmbient,blockedSunAmbient,day:sample(51,153,0),night:sample(51,153,1),midpoint:sample(51,153,.5),ambientAfterModulation:sample(102,102,0,0,255,255,51,128),ambientCoefficient:sample(0,0,0,0,255,255,128,255,.5),single:sample(51,153,1,0,255,255,0,255,1,true),dayAlpha:sample(255,255,0,0,64,192),nightAlpha:sample(255,255,1,0,64,192),midAlpha:sample(255,255,.5,0,64,192),texturedAmbient:sample(0,0,0,0,255,255,64,255,1,false,true),fade:sample(128,128,0,0,255,255,0,255,1,false,false,128)};
  // Two native meshes share one material: the translucent left draw must not remove right-side depth writes.
  const model=readDff(bytes),g=model.geometries[0];
  g.positions=new Float32Array([-4,-4,0, 0,-4,0, -2,4,0, 0,-4,0, 4,-4,0, 2,4,0]);
  g.meshes=[{start:0,count:3,material:0,min:0,max:2},{start:3,count:3,material:0,min:3,max:5}];
  g.normals=undefined;g.uvs=[];g.indices=new Uint32Array([0,1,2,3,4,5]);g.materialIds=new Uint16Array([0,0]);
  g.materials=[g.materials[0]];g.flags|=64;
  g.materials.forEach(m=>{m.texture='';m.color=[0,255,0,255];});
  g.colors=new Uint8Array(24).fill(255);g.nightColors=g.colors.slice();g.nightColors[3]=128;
  const object=modelObject(model,[],undefined,undefined,{buildingLighting:buildingLightingState()});scene.add(object.root);
  const behind=new THREE.Mesh(new THREE.PlaneGeometry(8,8),new THREE.MeshBasicMaterial({color:0xff0000,transparent:true}));
  behind.rotation.x=-Math.PI/2;behind.position.y=-1;behind.renderOrder=10;scene.add(behind);
  renderer.render(scene,camera);const materialDepth=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(48,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,materialDepth);
  scene.remove(object.root,behind);object.dispose();behind.geometry.dispose();behind.material.dispose();
  renderer.dispose();renderer.domElement.remove();return {...result,materialDepth:[...materialDepth]};
} });
