import * as THREE from 'three';
import {WorldLighting} from '../../src/render/WorldLighting';
import {LocalTimecycle} from '../../src/world/LocalTimecycle';
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation} from '../../src/simulation/Simulation';
import {textureFixture,txdFixture} from './native-assets';

Object.assign(window,{sunProbe:async()=>{
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,64);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(20,1,.08,650);
  const lighting=new WorldLighting(scene,[],[]),local=new LocalTimecycle();lighting.nativeTimecycle=m=>local.sample(m);
  const table=(colored:boolean,size=.2)=>Array.from({length:184},()=>{const values=Array(52).fill(0);values[15]=colored?255:0;values[20]=colored?255:0;values[21]=size;values[27]=120;values[28]=20;return values.join(' ');}).join('\n');
  const sample=(minutes:number,target:readonly number[])=>{
    camera.lookAt(new THREE.Vector3(target[0],target[1],target[2]));
    const read=(colored:boolean)=>{
      local.load(table(colored),'sun.dat');for(let i=0;i<20;i++)lighting.update(minutes,{x:0,y:0,z:0},camera,.02);renderer.render(scene,camera);
      const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel].slice(0,3);
    };
    const baseline=read(false),colored=read(true);return colored.map((v,i)=>v-baseline[i]);
  };
  const result={noon:sample(720,[.7,1.2,.7]),morning:sample(360,[1.7,.2,.7]),dawn:sample(300,[1.665925826,-.058819045,.7]),midnight:sample(0,[.7,-.8,.7])};
  camera.lookAt(.7,1.2,.7);local.load(table(true),'sun.dat');const fade:number[]=[];
  for(let i=0;i<19;i++){lighting.update(720,{x:0,y:0,z:0},camera,.02);renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);fade.push(pixel[0]);}
  for(let i=0;i<20;i++)lighting.update(0,{x:0,y:0,z:0},camera,.02);
  const lookFade:number[]=[];
  for(const mask of [0,0,4]){lighting.update(720,{x:0,y:0,z:0},camera,.02,mask);renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);lookFade.push(pixel[0]);}
  await RAPIER.init();const sim=new Simulation(true),wallPosition=camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(57);
  const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,2,2).setTranslation(wallPosition.x,wallPosition.y,wallPosition.z));sim.world.step();
  lighting.sunObstructed=(sun,view)=>sim.sunObstructed(sun,view);
  const obstructionPixel=()=>{for(let i=0;i<20;i++)lighting.update(720,{x:0,y:0,z:0},camera,.02,4);renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(32,32,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel].slice(0,3);};
  const blocked=obstructionPixel();sim.world.removeCollider(wall,true);sim.world.step();const unblocked=obstructionPixel();sim.dispose();
  lighting.sunObstructed=undefined;
  await lighting.sunTexture.load(new File([txdFixture(textureFixture({name:'coronastar',width:1,height:1,mips:[new Uint8Array([128,128,128,0])]})) as BlobPart],'particle.txd'));
  const textured=obstructionPixel();local.load(table(true,0),'zero-size.dat');const zeroSize=obstructionPixel();local.load(table(true),'sun.dat');
  const blocker=new THREE.Mesh(new THREE.PlaneGeometry(30,30),new THREE.MeshBasicMaterial({color:0}));blocker.position.copy(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(57));blocker.quaternion.copy(camera.quaternion);scene.add(blocker);
  const occluded=obstructionPixel();blocker.removeFromParent();blocker.geometry.dispose();blocker.material.dispose();
  lighting.sunTexture.clear();const restored=obstructionPixel();
  lighting.area=5;const indoorProcedural=obstructionPixel();
  await lighting.sunTexture.load(new File([txdFixture(textureFixture({name:'coronastar',width:1,height:1,mips:[new Uint8Array([128,128,128,0])]})) as BlobPart],'particle.txd'));
  const indoorTextured=obstructionPixel();lighting.area=0;const exteriorAgain=obstructionPixel();
  lighting.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of [object.material].flat())material.dispose();}});renderer.dispose();renderer.forceContextLoss();return {...result,fade,lookFade,blocked,unblocked,textured,zeroSize,occluded,restored,indoorProcedural,indoorTextured,exteriorAgain};
}});
