import * as THREE from 'three';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';

/** RwIm3D triangle lists as CSpecialFX draws them (CBulletTraces, CMotionBlurStreaks): untextured, vertex-coloured with
 * vertex alpha (SRCALPHA, INVSRCALPHA), unculled and without depth writes. Positions are renderer space, colours bytes. */
export class NativeImmediateTriangles {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private position:Float32Array;private color:Float32Array;
 /** Vertices drawn last frame. */
 drawn=0;
 constructor(scene:THREE.Scene,private capacity:number,name:string,renderOrder:number,fog:boolean){
  this.position=new Float32Array(capacity*3);this.color=new Float32Array(capacity*4);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(this.color,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  this.mesh=new THREE.Mesh(geometry,nativeRasterOutput(new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog})));
  this.mesh.name=name;this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=renderOrder;
  scene.add(this.mesh);
 }
 frame(buffer:{positions:readonly number[];colors:readonly number[]}){
  const vertices=Math.min(buffer.positions.length/3,this.capacity);
  this.drawn=vertices;this.mesh.visible=vertices>0;this.mesh.geometry.setDrawRange(0,vertices);
  if(!vertices)return;
  for(let i=0;i<vertices*3;i++)this.position[i]=buffer.positions[i];
  for(let i=0;i<vertices*4;i++)this.color[i]=buffer.colors[i]/255;
  for(const name of ['position','color'])this.mesh.geometry.getAttribute(name).needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
