import * as THREE from 'three';
import {CharacterSilhouette} from '../../src/render/CharacterSilhouette';
import {configureNativeShadowCamera} from '../../src/render/nativeShadowCamera';
import {nativeShadowOrientation} from '../../src/render/nativeShadowOrientation';
Object.assign(window,{silhouetteProbe:()=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,64);document.body.append(renderer.domElement);
 const scene=new THREE.Scene(),parent=new THREE.Group(),actor=new THREE.Group();scene.add(parent);parent.add(actor);parent.position.x=-.25;
 const geometry=new THREE.PlaneGeometry(.25,.5),count=geometry.getAttribute('position').count;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const original=new THREE.MeshBasicMaterial({color:0xff0000}),mesh=new THREE.SkinnedMesh(geometry,original),bone=new THREE.Bone();mesh.add(bone);mesh.bind(new THREE.Skeleton([bone]));actor.add(mesh);
 const sibling=new THREE.Mesh(new THREE.PlaneGeometry(2,2),original);scene.add(sibling);
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.quaternion.copy(nativeShadowOrientation({x:0,y:1,z:1}).rotation);configureNativeShadowCamera(camera,{x:0,y:0,z:0},1);
 const silhouette=new CharacterSilhouette(128),previous=new THREE.WebGLRenderTarget(16,16);renderer.setRenderTarget(previous);renderer.setViewport(1,2,10,11);renderer.setScissor(2,3,7,8);renderer.setScissorTest(true);renderer.setClearColor(0x123456,.4);renderer.autoClear=false;renderer.shadowMap.needsUpdate=true;
 const state=()=>({target:renderer.getRenderTarget()===previous,viewport:renderer.getViewport(new THREE.Vector4()).toArray(),scissor:renderer.getScissor(new THREE.Vector4()).toArray(),scissorTest:renderer.getScissorTest(),clear:renderer.getClearColor(new THREE.Color()).getHex(),alpha:renderer.getClearAlpha(),autoClear:renderer.autoClear,shadows:renderer.shadowMap.autoUpdate,shadowPending:renderer.shadowMap.needsUpdate,xr:renderer.xr.enabled,material:mesh.material===original,frustum:mesh.frustumCulled,parent:actor.parent===parent});
 const before=state();
 const capture=()=>{
  silhouette.update(renderer,actor,camera);const bytes=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(silhouette.target,0,0,128,128,bytes);
  let pixels=0,xSum=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++){const i=(y*128+x)*4;if(bytes[i]>128){pixels++;xSum+=x;}}
  return {pixels,center:pixels?xSum/pixels:0};
 };
 const initial=capture();bone.position.x=.5;const moved=capture(),after=state();
 actor.visible=false;const hidden=capture();actor.visible=true;
 mesh.onBeforeRender=()=>{throw new Error('Injected silhouette render failure');};let failed=false;try{capture();}catch{failed=true;}const restored=state();mesh.onBeforeRender=()=>{};
 const recovered=capture();
 const result={initial,moved,hidden,before,after,failed,restored,recovered};
 silhouette.dispose();previous.dispose();geometry.dispose();sibling.geometry.dispose();original.dispose();mesh.skeleton.dispose();renderer.dispose();renderer.domElement.remove();return result;
}});
