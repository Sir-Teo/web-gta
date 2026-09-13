import * as THREE from 'three';
import {placementFade} from '../../src/render/placementFade';
Object.assign(window,{worldAlphaProbe:()=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(96,16);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;document.body.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0000ff);
 const camera=new THREE.OrthographicCamera(-3,3,1,-1,.1,20);camera.position.z=10;
 const geometry=new THREE.PlaneGeometry(6,2),alphas=[0,100,101,140,141,255],bytes=new Uint8Array(alphas.flatMap(a=>[255,255,255,a]));
 const texture=new THREE.DataTexture(bytes,6,1);texture.needsUpdate=true;
 const material=new THREE.MeshBasicMaterial({map:texture,color:0x00ff00,transparent:true,depthWrite:false,alphaTest:1/255});
 const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
 const behind=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xff0000,transparent:true}));behind.position.z=-1;behind.renderOrder=10;scene.add(behind);
 const sample=(flags=0,alpha=255,interior=0)=>{
  const owner=placementFade(mesh,flags,interior,true);owner.setAlpha(alpha);renderer.render(scene,camera);
  const gl=renderer.getContext(),pixels=alphas.map((_,i)=>{const p=new Uint8Array(4);gl.readPixels(i*16+8,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);});
  const state={depthWrite:mesh.material.depthWrite,alphaTest:mesh.material.alphaTest};owner.dispose();return {pixels,state,restored:mesh.material===material};
 };
 const result={exterior:sample(),drawLast:sample(4),interiorDrawLast:sample(4,255,1),fade:sample(0,128),noDepth:sample(0x40),source:{depthWrite:material.depthWrite,alphaTest:material.alphaTest}};
 material.dispose();behind.material.dispose();geometry.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();return result;
}});
