import {Frustum,Matrix4,Sphere,Vector3,type PerspectiveCamera} from 'three';
import type {ScenePart} from '../assets/scene';
import {readNativeVegetationFolder,validateNativeVegetationFiles} from '../assets/nativeVegetationFolder';
import {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import {nativeScenePlantEntities} from './nativeScenePlants';
import {NativeVegetationScene} from './NativeVegetationScene';
import {nativeGrassWind,type NativeGrassWindState} from './nativeGrassWind';
import {windowsCrtGrassSamples} from './windowsCrtGrassSamples';
export type WalkingVegetationPackage=Awaited<ReturnType<typeof readNativeVegetationFolder>>;
export async function readSceneVegetation(environment:unknown):Promise<WalkingVegetationPackage|undefined>{
 if(!environment||typeof environment!=='object'||!('vegetation' in environment)||environment.vegetation===undefined)return;
 validateNativeVegetationFiles(environment.vegetation);return readNativeVegetationFolder(environment.vegetation);
}

/** Current PC compatibility policy, not a retail-state reconstruction: seeded
 * CRT samples, cyclic eight-phase updates, full cache scan every 32 view updates,
 * high grass quality; caller supplies the explicit wind/timer policy. */
export class WalkingVegetation {
 private owner:NativeVegetationScene;
 private updates=0;
 private windState:NativeGrassWindState={milliseconds:0,wind:0,seed:0};
 private bending=0;
 private frustum=new Frustum();private projection=new Matrix4();private position=new Vector3();private sphere=new Sphere();
 constructor(parts:ScenePart[],data:WalkingVegetationPackage,area:number){
  const random=new WindowsCrtRandom(1);
  this.owner=new NativeVegetationScene(nativeScenePlantEntities(parts,data.surfaceInfo,data.objects,area),data.grass,data.surfaces,data.surfaceInfo,{randomSample:()=>random.nextUnit(),addObjects:()=>false,removeObjects:()=>{}},(triangle,cover,index)=>windowsCrtGrassSamples(triangle.seeds[cover],index));
 }
 get root(){return this.owner.root;}
 update(camera:PerspectiveCamera,night:number,windState:NativeGrassWindState={milliseconds:0,wind:0,seed:0}){
  const bending=nativeGrassWind(windState.milliseconds,windState.wind,windState.seed);
  camera.getWorldPosition(this.position);const position=[this.position.x,-this.position.z,this.position.y] as const;
  if(this.updates===0)this.owner.simulate(position);
  else this.owner.simulate(position,this.updates%32!==0,(this.updates-1)%8);
  this.updates++;
  this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  this.owner.render({camera:position,night,wind:bending,quality:'high',visible:triangle=>{
   const [x,y,z]=triangle.candidate.triangle.center;this.sphere.center.set(x,z,-y);this.sphere.radius=triangle.candidate.triangle.radius;return this.frustum.intersectsSphere(this.sphere);
  }});
  this.windState={...windState};this.bending=bending;
 }
 snapshot(){return {wind:{...this.windState,bending:this.bending},entities:this.owner.entityCount,cached:this.owner.cachedEntityCount,triangles:this.owner.allocations().length,batches:this.root.children.filter(child=>child.visible).length};}
 dispose(){this.owner.dispose();}
}
