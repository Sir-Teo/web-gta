import * as THREE from 'three';
import {LocalSunTexture} from '../../src/render/LocalSunTexture';
import {textureFixture,txdFixture} from './native-assets';
Object.assign(window,{sunTextureProbe:async()=>{
  const owner=new LocalSunTexture(),renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(8,8);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;
  const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.MeshBasicMaterial();scene.add(new THREE.Mesh(geometry,material));
  const file=(blue:boolean)=>new File([txdFixture(textureFixture({name:'coronastar',width:1,height:1,mips:[new Uint8Array(blue?[255,0,0,255]:[0,0,255,255])]})) as BlobPart],'particle.txd');
  const read=()=>{material.map=owner.texture??null;material.needsUpdate=true;renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(4,4,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];};
  await owner.load(file(false));const red=read(),first=owner.texture;let error='';
  try{await owner.load(new File(['bad'],'bad.txd'));}catch(e){error=(e as Error).message;}
  const retained=owner.texture===first&&owner.name==='particle.txd',afterError=read();
  await owner.load(file(true));const blue=read(),allocated=renderer.info.memory.textures;
  const canceled=owner.load(file(false));owner.clear();const cancellation=await canceled;read();const released=renderer.info.memory.textures;
  owner.dispose();material.dispose();geometry.dispose();renderer.dispose();renderer.forceContextLoss();
  return {red,blue,afterError,retained,error,allocated,released,cancellation};
}});
