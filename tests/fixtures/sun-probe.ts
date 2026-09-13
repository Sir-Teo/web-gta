import * as THREE from 'three';
import {WorldLighting} from '../../src/render/WorldLighting';
import {LocalTimecycle} from '../../src/world/LocalTimecycle';

Object.assign(window,{sunProbe:()=>{
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,64);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(20,1,.08,650);
  const lighting=new WorldLighting(scene,[],[]),local=new LocalTimecycle();lighting.nativeTimecycle=m=>local.sample(m);
  const table=(colored:boolean)=>Array.from({length:184},()=>{const values=Array(52).fill(0);values[15]=colored?255:0;values[20]=colored?255:0;values[27]=120;values[28]=20;return values.join(' ');}).join('\n');
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
  lighting.dispose();scene.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();for(const material of [object.material].flat())material.dispose();}});renderer.dispose();renderer.forceContextLoss();return {...result,fade,lookFade};
}});
