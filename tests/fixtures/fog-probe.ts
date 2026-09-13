import * as THREE from 'three';
import {installNativeFogCurve} from '../../src/render/nativeFog';
import {buildingMaterial,buildingLightingState} from '../../src/assets/buildingMaterial';
installNativeFogCurve();
Object.assign(window,{fogProbe:()=>{
  const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(16,16);renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x0000ff,10,30);
  const camera=new THREE.OrthographicCamera(-1,1,1,-1,.1,100),geometry=new THREE.PlaneGeometry(2,2);
  const colors=new Uint8Array(16).fill(255);geometry.setAttribute('nativeDay',new THREE.BufferAttribute(colors,4,true));geometry.setAttribute('nativeNight',new THREE.BufferAttribute(colors,4,true));
  const basic=new THREE.MeshBasicMaterial({color:0xff0000}),building=buildingMaterial(basic,0,buildingLightingState(),true,false),mesh=new THREE.Mesh(geometry,basic);scene.add(mesh);
  const sample=()=>[5,10,15,20,25,30,35].map(depth=>{mesh.position.z=-depth;renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(8,8,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);return [...pixel].slice(0,3);});
  const ordinary=sample();mesh.material=building;const native=sample();scene.fog=new THREE.FogExp2(0x0000ff,.05);const exponential=sample();
  geometry.dispose();basic.dispose();building.dispose();renderer.dispose();return {ordinary,native,exponential};
}});
