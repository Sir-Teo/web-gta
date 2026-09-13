import * as THREE from 'three';
import {readDff} from '../../src/assets/dff';
import {readIfp} from '../../src/assets/ifp';
import {modelObject} from '../../src/assets/ModelObjects';
import {bindAnimation} from '../../src/animation/bind';
import {CharacterSilhouette} from '../../src/render/CharacterSilhouette';
import {ShadowRasterFilter} from '../../src/render/ShadowRasterFilter';
import {nativeShadowOrientation} from '../../src/render/nativeShadowOrientation';
import {configureNativeShadowCamera} from '../../src/render/nativeShadowCamera';
import {viceCityShadowProjection} from '../../src/render/relatedShadowProjection';
import {projectShadowReceiver} from '../../src/render/projectShadowReceiver';
import {ProjectedShadow} from '../../src/render/ProjectedShadow';
Object.assign(window,{nativeShadowProbe:(input:{dff:number[];ifp:number[];wall?:boolean})=>{
 const model=readDff(new Uint8Array(input.dff)),animations=readIfp(new Uint8Array(input.ifp)).animations,clip=animations.find(c=>c.name==='FatWalk')!;
 const owner=modelObject(model),actor=new THREE.Group();actor.add(owner.root);actor.position.y=1;actor.rotation.y=Math.PI;actor.updateMatrixWorld(true);
 const binding=bindAnimation(model,owner.root,clip,{track:0}),sphere=model.geometries[0].morphBounds![0];
 const center=new THREE.Vector3(...sphere.center).applyMatrix4(owner.root.matrixWorld);
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(256,256);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;document.body.append(renderer.domElement);
 const capture=new CharacterSilhouette(),filter=new ShadowRasterFilter(),camera=new THREE.OrthographicCamera();
 const captureBytes=()=>{const bytes=new Uint8Array(128*128*4);renderer.readRenderTargetPixels(capture.target,0,0,128,128,bytes);return bytes;};
 const samples:{clip:string;scale:number;azimuth:number;phase:number;pixels:number;border:number;outsideVertices:number}[]=[];
 for(const name of ['FatIdle','FatWalk','FatRun']){
 const current=animations.find(c=>c.name===name)!,pose=bindAnimation(model,owner.root,current,name==='FatIdle'?undefined:{track:0});
 for(const scale of [1,1.1])for(let azimuth=0;azimuth<4;azimuth++)for(let phase=0;phase<8;phase++){
  const angle=azimuth*Math.PI/2;camera.quaternion.copy(nativeShadowOrientation({x:Math.sin(angle),y:1,z:Math.cos(angle)}).rotation);configureNativeShadowCamera(camera,center,sphere.radius*scale);
  pose.sample(current.duration*phase/8);capture.update(renderer,actor,camera);const bytes=captureBytes();let pixels=0,border=0,outsideVertices=0;
  for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(bytes[(y*128+x)*4]>128){pixels++;if(x===0||y===0||x===127||y===127)border++;}
  actor.traverse(object=>{if(object instanceof THREE.SkinnedMesh){for(let i=0;i<object.geometry.getAttribute('position').count;i++){const point=object.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(object.matrixWorld).project(camera);if(Math.max(Math.abs(point.x),Math.abs(point.y),Math.abs(point.z))>1)outsideVertices++;}}});
  samples.push({clip:name,scale,azimuth,phase,pixels,border,outsideVertices});
 }
 }
 const scene=new THREE.Scene();scene.background=new THREE.Color(1,1,1);
 const terrainGeometry=new THREE.PlaneGeometry(8,8),terrainMaterial=new THREE.MeshBasicMaterial({color:0xffffff}),terrain=new THREE.Mesh(terrainGeometry,terrainMaterial);terrain.rotation.x=-Math.PI/2;scene.add(terrain);
 const view=new THREE.OrthographicCamera(-2,2,2,-2,.1,20);view.position.set(0,10,-1.5);view.up.set(0,0,-1);view.lookAt(0,0,-1.5);
 camera.quaternion.copy(nativeShadowOrientation({x:0,y:1,z:1}).rotation);configureNativeShadowCamera(camera,center,sphere.radius*1.1);
 const source={positions:new Float32Array([-10,0,-10,10,0,-10,0,0,20]),indices:new Uint32Array([0,2,1]),lights:new Uint8Array([255]),materials:new Uint8Array([0])};
 if(input.wall){
  terrain.rotation.x=0;terrain.position.set(0,4,-.6);
  view.position.set(0,1,5);view.up.set(0,1,0);view.lookAt(0,1,-.6);
  source.positions.set([-10,0,-.6,10,0,-.6,0,20,-.6]);
 }
 const receiver=projectShadowReceiver(source,new THREE.Matrix4(),{center:{x:0,y:2,z:-1.5},side:{x:2,z:0},front:{x:0,z:2},depth:4},65535,viceCityShadowProjection(camera));
 const shadow=new ProjectedShadow();scene.add(shadow.mesh);
 const render=(phase:number)=>{
  binding.sample(phase*clip.duration);capture.update(renderer,actor,camera);filter.update(renderer,capture.texture,4,true);shadow.update([receiver],filter.texture,255,0);renderer.render(scene,view);
  const bytes=new Uint8Array(256*256*4),gl=renderer.getContext();gl.readPixels(0,0,256,256,gl.RGBA,gl.UNSIGNED_BYTE,bytes);return bytes;
 };
 const first=render(0),second=render(.25);actor.visible=false;const hidden=render(.25);actor.visible=true;const repeat=render(0);
 const mass=(bytes:Uint8Array)=>bytes.reduce((sum,value,i)=>sum+(i%4===0?255-value:0),0);
 const changed=(a:Uint8Array,b:Uint8Array)=>a.reduce((sum,value,i)=>sum+(i%4===0&&value!==b[i]?1:0),0);
 const result={tracks:binding.trackCount,radius:sphere.radius,center:center.toArray(),samples,firstMass:mass(first),secondMass:mass(second),hiddenMass:mass(hidden),changedPixels:changed(first,second),repeatChangedPixels:changed(first,repeat)};
 shadow.dispose();terrainGeometry.dispose();terrainMaterial.dispose();filter.dispose();capture.dispose();owner.dispose();renderer.dispose();return result;
}});
