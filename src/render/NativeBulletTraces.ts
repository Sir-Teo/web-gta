import * as THREE from 'three';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';

/** Sixteen traces of four triangles. */
const CAPACITY=16*12;
/** CBulletTraces::Render's streaks: untextured, vertex-coloured with vertex alpha (SRCALPHA, INVSRCALPHA), unculled,
 * without depth writes, drawn with the special effects after the motion-blur streaks. Positions are renderer space. */
export class NativeBulletTracesMesh {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private position=new Float32Array(CAPACITY*3);private color=new Float32Array(CAPACITY*4);
 drawn=0;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(this.color,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,nativeRasterOutput(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false})));
  this.mesh.name='Native bullet traces';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=6.3;
  scene.add(this.mesh);
 }
 frame(buffer:{positions:readonly number[];colors:readonly number[]}){
  const vertices=Math.min(buffer.positions.length/3,CAPACITY);
  this.drawn=vertices/12;this.mesh.visible=vertices>0;this.mesh.geometry.setDrawRange(0,vertices);
  if(!vertices)return;
  this.position.set(buffer.positions.slice(0,vertices*3));
  for(let i=0;i<vertices*4;i++)this.color[i]=buffer.colors[i]/255;
  for(const name of ['position','color'])this.mesh.geometry.getAttribute(name).needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
