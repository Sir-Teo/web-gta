import * as THREE from 'three';
import {CharacterSilhouette} from '../../src/render/CharacterSilhouette';
import {configureNativeShadowCamera} from '../../src/render/nativeShadowCamera';
import {nativeShadowOrientation} from '../../src/render/nativeShadowOrientation';
import {ShadowRasterFilter} from '../../src/render/ShadowRasterFilter';
import {viceCityShadowProjection} from '../../src/render/relatedShadowProjection';
import {projectShadowReceiver} from '../../src/render/projectShadowReceiver';
import {ProjectedShadow} from '../../src/render/ProjectedShadow';
type Input={positions:number[];indices:number[];lights:number[]};
Object.assign(window,{shadowProjectionProbe:(input?:Input)=>{
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;document.body.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(1,1,1);
 const view=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);view.position.set(0,10,-1.5);view.up.set(0,0,-1);view.lookAt(0,0,-1.5);
 const source=input??{positions:[-10,0,-10,10,0,-10,0,0,20],indices:[0,2,1],lights:[255]};
 const mesh={positions:new Float32Array(source.positions),indices:new Uint32Array(source.indices),lights:new Uint8Array(source.lights),materials:new Uint8Array(source.lights.length)};
 const terrainGeometry=new THREE.BufferGeometry();terrainGeometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));terrainGeometry.setIndex(new THREE.BufferAttribute(mesh.indices,1));
 const terrainMaterial=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide});scene.add(new THREE.Mesh(terrainGeometry,terrainMaterial));
 const actor=new THREE.Group(),geometry=new THREE.PlaneGeometry(.25,.5),count=geometry.getAttribute('position').count;
 geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(new Uint16Array(count*4),4));const weights=new Float32Array(count*4);for(let i=0;i<count;i++)weights[i*4]=1;geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
 const material=new THREE.MeshBasicMaterial(),body=new THREE.SkinnedMesh(geometry,material),bone=new THREE.Bone();body.add(bone);body.bind(new THREE.Skeleton([bone]));actor.add(body);actor.position.y=1;
 const captureCamera=new THREE.OrthographicCamera();captureCamera.quaternion.copy(nativeShadowOrientation({x:0,y:1,z:1}).rotation);configureNativeShadowCamera(captureCamera,{x:0,y:1,z:0},1);
 const receiver=projectShadowReceiver(mesh,new THREE.Matrix4(),{center:{x:0,y:2,z:-1.5},side:{x:2,z:0},front:{x:0,z:2},depth:4},65535,viceCityShadowProjection(captureCamera));
 const capture=new CharacterSilhouette(),filter=new ShadowRasterFilter(),shadow=new ProjectedShadow();scene.add(shadow.mesh);
 const measure=()=>{
  const pixels=new Uint8Array(256*256*4),gl=renderer.getContext();gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
  let mass=0,xSum=0,ySum=0,count=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const dark=255-pixels[(y*256+x)*4];mass+=dark;xSum+=dark*x;ySum+=dark*y;if(dark>1)count++;}
  return {mass,pixels:count,x:mass?xSum/mass:0,y:mass?ySum/mass:0};
 };
 const render=()=>{capture.update(renderer,actor,captureCamera);filter.update(renderer,capture.texture,4,true);shadow.update([receiver],filter.texture,255,0);renderer.render(scene,view);return measure();};
 const initial=render();bone.position.x=.4;const moved=render();actor.visible=false;const hidden=render();actor.visible=true;
 // A fully white raster exposes texture-edge stretching outside the projection.
 const white=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);white.needsUpdate=true;shadow.update([receiver],white,255,0);renderer.render(scene,view);
 const gl=renderer.getContext(),outside=new Uint8Array(4);gl.readPixels(4,128,1,1,gl.RGBA,gl.UNSIGNED_BYTE,outside);
 bone.position.x=0;render();
 const result={initial,moved,hidden,outside:[...outside],vertices:receiver.faces.length};
 white.dispose();shadow.dispose();filter.dispose();capture.dispose();body.skeleton.dispose();geometry.dispose();material.dispose();terrainGeometry.dispose();terrainMaterial.dispose();renderer.dispose();return result;
}});
