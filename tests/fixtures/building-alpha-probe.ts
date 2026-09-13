import * as THREE from 'three';
import { buildingMaterial,buildingLightingState } from '../../src/assets/buildingMaterial';
import { placementFade } from '../../src/render/placementFade';
Object.assign(window,{buildingAlphaProbe:async()=>{
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,16);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;document.body.append(renderer.domElement);
  const camera=new THREE.OrthographicCamera(-4,4,1,-1,.1,30);camera.position.z=10;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0000ff);
  const geometry=new THREE.PlaneGeometry(8,2),colors=new Uint8Array(geometry.getAttribute('position').count*4).fill(255);
  geometry.setAttribute('nativeDay',new THREE.BufferAttribute(colors,4,true));geometry.setAttribute('nativeNight',new THREE.BufferAttribute(colors,4,true));
  const texture=new THREE.DataTexture(new Uint8Array([255,255,255,0,255,255,255,127,255,255,255,128,255,255,255,255]),4,1);texture.needsUpdate=true;
  const source=new THREE.MeshBasicMaterial({map:texture,color:0x00ff00,alphaTest:1/255});source.userData.nativeTextureAlpha=true;
  const state=buildingLightingState(),material=buildingMaterial(source,0,state,true,false),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
  const behind=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:0xff0000,transparent:true}));behind.position.z=-1;behind.renderOrder=10;
  const pixels=()=>{const gl=renderer.getContext();return [8,24,40,56].map(x=>{const pixel=new Uint8Array(4);gl.readPixels(x,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel].slice(0,3);});};
  renderer.render(scene,camera);const blendOnce=pixels();scene.add(behind);
  const sample=(threshold=128,enabled=true,flags=0,fade=255,back=false)=>{
    state.dualPass.threshold=threshold;state.dualPass.enabled=enabled;mesh.rotation.y=back?Math.PI:0;
    const owner=placementFade(mesh,flags);owner.setAlpha(fade);renderer.render(scene,camera);const result={pixels:pixels(),draws:renderer.info.render.calls};owner.dispose();return result;
  };
  const result={blendOnce,normal:sample(),zero:sample(0),max:sample(255),disabled:sample(128,false),noDepth:sample(128,true,0x40),fade:sample(128,true,0,128),additive:sample(128,true,8,128),back:sample(128,true,0x200000,255,true),restored:sample()};
  const event=(name:string,action:()=>void)=>new Promise<void>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error(`Missing ${name}`)),5000);
    renderer.domElement.addEventListener(name,e=>{e.preventDefault();clearTimeout(timer);resolve();},{once:true});action();
  });
  await event('webglcontextlost',()=>renderer.forceContextLoss());
  await event('webglcontextrestored',()=>{setTimeout(()=>renderer.forceContextRestore(),350);});
  const recovered=sample();
  material.dispose();source.dispose();behind.material.dispose();geometry.dispose();texture.dispose();renderer.dispose();renderer.domElement.remove();return {...result,recovered};
}});
