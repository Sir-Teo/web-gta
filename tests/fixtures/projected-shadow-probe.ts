import * as THREE from 'three';
import {ProjectedShadow} from '../../src/render/ProjectedShadow';
import {nativeShadowStrength} from '../../src/render/nativeShadowIntensity';
import {projectShadowReceiver} from '../../src/render/projectShadowReceiver';
Object.assign(window,{projectedShadowProbe:()=>{
 const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(64,64);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
 document.body.append(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(1,1,1);
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.set(0,5,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({color:0xffffff}));floor.rotation.x=-Math.PI/2;scene.add(floor);
 const texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1);texture.needsUpdate=true;
 const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);black.needsUpdate=true;
 const shadow=new ProjectedShadow(100);scene.add(shadow.mesh);
 const source={positions:new Float32Array([-2,0,-2,2,0,-2,0,0,2]),indices:new Uint32Array([0,2,1]),materials:new Uint8Array([1]),lights:new Uint8Array([255])};
 function render(light:number,strength:number,night:number,map:THREE.Texture|null=texture,projection?:THREE.Matrix4){
  source.lights[0]=light;
  const receiver=projectShadowReceiver(source,new THREE.Matrix4(),{center:{x:0,y:1,z:0},side:{x:.5,z:0},front:{x:0,z:.5},depth:4},65535,projection);
  shadow.update([receiver],map??undefined,strength,night);renderer.render(scene,camera);
  const read=(x:number,y:number)=>{const pixel=new Uint8Array(4),gl=renderer.getContext();gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel];};
  return {center:read(32,32),outside:read(4,4)};
 }
 const result:any={distanceFade:render(255,nativeShadowStrength(244,10,61),0),day:render(255,255,0),night:render(255,255,1),unlit:render(0,255,0),half:render(255,128,0),black:render(255,255,0,black),zero:render(255,0,0),missing:render(255,255,0,null)};
 const projection=new THREE.Matrix4().set(1,0,0,.5,0,0,1,.5,0,1,0,-.1,0,0,0,1);
 result.behind=render(255,255,0,texture,projection);
 projection.elements[14]=0;result.depthBoundary=render(255,255,0,texture,projection);
 projection.elements[14]=2;result.beyondUnitDepth=render(255,255,0,texture,projection);
 projection.elements[14]=0;projection.elements[2]=1;result.crossingDepth=render(255,255,0,texture,projection);
 // Clearing also releases the borrowed raster reference.
 shadow.update([],undefined,255,0);renderer.render(scene,camera);result.cleared=!shadow.mesh.visible&&shadow.mesh.geometry.drawRange.count===0;
 floor.material.color.setRGB(.8,.4,.2);result.colored=render(255,255,0);floor.material.color.setRGB(1,1,1);
 const blocker=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),new THREE.MeshBasicMaterial({color:0xff0000}));blocker.position.y=.25;scene.add(blocker);result.occluded=render(255,255,0);
 shadow.dispose();blocker.geometry.dispose();(blocker.material as THREE.Material).dispose();texture.dispose();black.dispose();floor.geometry.dispose();floor.material.dispose();renderer.dispose();renderer.domElement.remove();return result;
}});
