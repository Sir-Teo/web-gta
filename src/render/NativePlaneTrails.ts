import * as THREE from 'three';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';

type Point={position:readonly [number,number,number];alpha:number};
/** Three trails of fifteen segments. */
const CAPACITY=3*15*2;
/** CPlaneTrail::Render's line lists: white with vertex alpha (SRCALPHA, INVSRCALPHA), untextured, drawn in RenderScene
 * before the clouds while depth testing and writing are off, so the world covers them. */
export class NativePlaneTrailsMesh {
 private lines:THREE.LineSegments<THREE.BufferGeometry,THREE.LineBasicMaterial>;
 private position=new Float32Array(CAPACITY*3);private color=new Float32Array(CAPACITY*4);
 drawn=0;
 constructor(scene:THREE.Scene){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(this.color,4).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  this.lines=new THREE.LineSegments(geometry,nativeRasterOutput(new THREE.LineBasicMaterial({vertexColors:true,transparent:true,depthTest:false,depthWrite:false,fog:false})));
  // After the sky polys (-10), before the stars and clouds.
  this.lines.name='Native plane trails';this.lines.frustumCulled=false;this.lines.visible=false;this.lines.renderOrder=-9.5;
  scene.add(this.lines);
 }
 frame(segments:readonly {from:Point;to:Point}[]){
  const vertices=Math.min(segments.length*2,CAPACITY);
  this.drawn=vertices/2;this.lines.visible=vertices>0;this.lines.geometry.setDrawRange(0,vertices);
  if(!vertices)return;
  segments.slice(0,vertices/2).forEach((s,i)=>{
   for(const [k,p] of [[0,s.from],[1,s.to]] as const){
    // Native (x, y, z) is the renderer's (x, z, -y).
    this.position.set([p.position[0],p.position[2],-p.position[1]],(i*2+k)*3);this.color.set([1,1,1,p.alpha/255],(i*2+k)*4);
   }
  });
  for(const name of ['position','color'])this.lines.geometry.getAttribute(name).needsUpdate=true;
 }
 dispose(){this.lines.removeFromParent();this.lines.geometry.dispose();this.lines.material.dispose();}
}
