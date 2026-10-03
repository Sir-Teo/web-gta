import * as THREE from 'three';
import {nativeRasterOutput} from '../assets/nativeRasterOutput';
import type {ShinyQuad} from '../world/nativeShinyTexts';
/** CShinyTexts::Render: the frame's registered quads drawn additively (ONE, ONE) with the `handman` raster and their
 * vertex colours, unculled and without depth writes. Positions arrive in native space and are converted here. */
const STAND_IN=new THREE.DataTexture(new Uint8Array(4),1,1);
export class NativeShinyTexts {
 private mesh:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>;
 private position:Float32Array;private uv:Float32Array;private color:Float32Array;
 /** Quads drawn last frame. */
 drawn=0;
 constructor(scene:THREE.Scene,private capacity:number){
  this.position=new Float32Array(capacity*6*3);this.uv=new Float32Array(capacity*6*2);this.color=new Float32Array(capacity*6*3);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(this.position,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv',new THREE.BufferAttribute(this.uv,2).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('color',new THREE.BufferAttribute(this.color,3).setUsage(THREE.DynamicDrawUsage));
  geometry.setDrawRange(0,0);
  // A stand-in raster until `handman` arrives (nothing draws without it): the program warmed as the mesh is added is
  // then the one it draws with, rather than one without a texture, made again at the first sign's draw.
  this.mesh=new THREE.Mesh(geometry,nativeRasterOutput(new THREE.MeshBasicMaterial({map:STAND_IN,vertexColors:true,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,
   // CShinyTexts::Render blends ONE / ONE, so the texture's alpha does not scale the colour.
   blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation})));
  this.mesh.name='Native shiny texts';this.mesh.frustumCulled=false;this.mesh.visible=false;this.mesh.renderOrder=6.2;
  scene.add(this.mesh);
 }
 frame(quads:readonly ShinyQuad[],texture:THREE.Texture|undefined){
  const count=Math.min(quads.length,this.capacity);
  this.drawn=texture?count:0;this.mesh.visible=this.drawn>0;this.mesh.geometry.setDrawRange(0,this.drawn*6);
  if(!this.drawn)return;
  if(this.mesh.material.map!==texture){this.mesh.material.map=texture!;this.mesh.material.needsUpdate=true;}
  // Two triangles per quad (0,1,2)(2,1,3), as CShinyTexts indexes them.
  const order=[0,1,2,2,1,3];
  for(let q=0;q<count;q++){
   const quad=quads[q];
   for(let v=0;v<6;v++){
    const i=order[v],c=quad.corners[i],base=(q*6+v);
    this.position[base*3]=c[0];this.position[base*3+1]=c[2];this.position[base*3+2]=-c[1];
    this.uv[base*2]=quad.uv[i*2];this.uv[base*2+1]=1-quad.uv[i*2+1];
    this.color[base*3]=quad.colour[0]/255;this.color[base*3+1]=quad.colour[1]/255;this.color[base*3+2]=quad.colour[2]/255;
   }
  }
  for(const name of ['position','uv','color'])this.mesh.geometry.getAttribute(name).needsUpdate=true;
 }
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
