import * as THREE from 'three';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';
import {MAX_NUM_BRIGHTLIGHTS} from '../world/nativeBrightLights';

/** Hexagons take 12 vertices and octagons 18. */
const CAPACITY=MAX_NUM_BRIGHTLIGHTS*18;
/** CBrightLights::Render's triangles: untextured, vertex-coloured with vertex alpha (SRCALPHA, INVSRCALPHA), unculled,
 * writing depth, drawn with the special effects before the 3D markers. */
export class NativeBrightLightsMesh {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private position=new Float32Array(CAPACITY*3);private color=new Float32Array(CAPACITY*4);
 drawn=0;
 /** The NDC centre of the first light's first triangle last frame. */
 firstCenter:[number,number]|null=null;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(this.color,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,nativeRasterOutput(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:true,side:THREE.DoubleSide,fog:false})));
  this.mesh.name='Native bright lights';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=6.4;
  scene.add(this.mesh);
 }
 frame(buffer:{positions:readonly number[];colors:readonly number[]},camera:THREE.Camera){
  const vertices=Math.min(buffer.positions.length/3,CAPACITY);
  this.drawn=vertices;this.mesh.visible=vertices>0;this.mesh.geometry.setDrawRange(0,vertices);
  this.firstCenter=null;
  if(!vertices)return;
  const p=buffer.positions,c=new THREE.Vector3((p[0]+p[3]+p[6])/3,(p[2]+p[5]+p[8])/3,-(p[1]+p[4]+p[7])/3).project(camera);
  if(c.z<1)this.firstCenter=[c.x,c.y];
  // Native (x, y, z) is the renderer's (x, z, -y).
  for(let v=0;v<vertices;v++){
   this.position[v*3]=buffer.positions[v*3];this.position[v*3+1]=buffer.positions[v*3+2];this.position[v*3+2]=-buffer.positions[v*3+1];
   for(let k=0;k<4;k++)this.color[v*4+k]=buffer.colors[v*4+k]/255;
  }
  for(const name of ['position','color'])this.mesh.geometry.getAttribute(name).needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
