import * as THREE from 'three';
import {nativePlayerMaterial} from '../../src/render/nativePlayerMaterial';
import {nativeAmbientState,nativeLitMaterial} from '../../src/assets/nativeMaterial';
Object.assign(window,{playerAlphaProbe:()=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(80,16);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;document.body.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x0000ff);
 const camera=new THREE.OrthographicCamera(-3,3,1,-1,.1,20);camera.position.z=10;
 const geometry=new THREE.PlaneGeometry(6,2),alphas=[0,1,2,128,255];
 const texture=new THREE.DataTexture(new Uint8Array(alphas.flatMap(a=>[255,255,255,a])),5,1);texture.needsUpdate=true;
 const ambient=nativeAmbientState();ambient.enabled.value=true;ambient.color.value.set(1,1,1);
 const parameters={map:texture,color:0x00ff00,transparent:true,depthWrite:false,alphaTest:1/255};
 const materials=[new THREE.MeshBasicMaterial(parameters),nativeLitMaterial(parameters,[1,0,1],ambient)];
 const mesh=new THREE.Mesh(geometry,materials[0]);scene.add(mesh);
 const behind=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xff0000,transparent:true}));behind.position.z=-1;behind.renderOrder=10;scene.add(behind);
 const results=materials.map(material=>{
  nativePlayerMaterial(material);mesh.material=material;renderer.render(scene,camera);
  const gl=renderer.getContext();return {depthWrite:material.depthWrite,pixels:alphas.map((_,i)=>{const p=new Uint8Array(4);gl.readPixels(i*16+8,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p].slice(0,3);})};
 });
 materials.forEach(m=>m.dispose());behind.material.dispose();geometry.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();return results;
}});
