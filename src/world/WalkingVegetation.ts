import {fxQuality} from '../simulation/fx/fxQuality';
import {lodDistMultiplier} from '../render/lodDistance';
import type {InstalledCollisionSource} from '../simulation/nativeScene';
import type RAPIER from '@dimforge/rapier3d-compat';
import {requireAsset} from '../assets/binary';
import {NativeProcObjects} from '../render/NativeProcObjects';
import {NativeProcPlacementManager} from './NativeProcPlacementManager';
import type {readNativeProcAssets} from '../assets/nativeProcAssets';
import {Group,Frustum,Matrix4,Sphere,Vector3,type PerspectiveCamera} from 'three';
import type {ScenePart} from '../assets/scene';
import {readNativeVegetationFolder,validateNativeVegetationFiles} from '../assets/nativeVegetationFolder';
import {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import {nativeScenePlantEntities} from './nativeScenePlants';
import {NativeVegetationScene} from './NativeVegetationScene';
import {nativeGrassWind,type NativeGrassWindState} from './nativeGrassWind';
import {windowsCrtGrassSamples} from './windowsCrtGrassSamples';
export type WalkingVegetationPackage=Awaited<ReturnType<typeof readNativeVegetationFolder>> & {proceduralAssets?:Awaited<ReturnType<typeof readNativeProcAssets>>};
export async function readSceneVegetation(environment:unknown):Promise<WalkingVegetationPackage|undefined>{
 if(!environment||typeof environment!=='object'||!('vegetation' in environment)||environment.vegetation===undefined)return;
 validateNativeVegetationFiles(environment.vegetation);return readNativeVegetationFolder(environment.vegetation);
}
/** readSceneVegetation for a caller that receives the same package with every streamed window: parses it once
 * (four data files and a CPU-decoded grass dictionary) and hands each window its own shallow copy, since a window
 * sets its procedural assets on the package. A different file set (path, size, date) is read afresh. */
export function sceneVegetationReader(){
 let key:string|undefined,cached:Promise<WalkingVegetationPackage|undefined>|undefined;
 return async(environment:unknown):Promise<WalkingVegetationPackage|undefined>=>{
  if(!environment||typeof environment!=='object'||!('vegetation' in environment)||environment.vegetation===undefined)return;
  const files=environment.vegetation as readonly {path:string;file:File}[];
  const next=Array.isArray(files)?files.map(f=>`${f?.path}:${f?.file?.size}:${f?.file?.lastModified}`).join('|'):undefined;
  if(next===undefined||next!==key||!cached){key=next;cached=readSceneVegetation(environment);cached.catch(()=>{if(key===next)key=cached=undefined;});}
  const data=await cached;return data&&{...data};
 };
}

/** Current PC compatibility policy, not a retail-state reconstruction: seeded
 * CRT samples, cyclic eight-phase updates, full cache scan every 32 view updates,
 * the FX quality's grass (high unless a touch screen's settings lower it); caller supplies the explicit wind/timer policy. */
export class WalkingVegetation {
 private owner:NativeVegetationScene;
 private readonly group=(()=>{const group=new Group();group.matrixAutoUpdate=false;return group;})();
 private procedural?:NativeProcObjects;
 private manager?:NativeProcPlacementManager<ReturnType<NativeProcObjects['allocate']>>;
 private cameraPosition:readonly [number,number,number]=[0,0,0];
 private updates=0;
 private windState:NativeGrassWindState={milliseconds:0,wind:0,seed:0};
 private bending=0;
 private frustum=new Frustum();private projection=new Matrix4();private position=new Vector3();private sphere=new Sphere();
 constructor(parts:ScenePart[],data:WalkingVegetationPackage,area:number,world?:RAPIER.World,sources?:Map<number,InstalledCollisionSource>){
  const random=new WindowsCrtRandom(1),entities=nativeScenePlantEntities(parts,data.surfaceInfo,data.objects,area);
  let hooks={randomSample:()=>random.nextUnit(),addObjects:()=>false,removeObjects:()=>{}} as import('./NativePlantPool').NativePlantPoolHooks;
  try{
   if(data.proceduralAssets){
    requireAsset(!!world,'Procedural vegetation requires a physics world.');
    const surfaces=new Set(entities.flatMap(entity=>[...entity.collision.mesh.materials]));
    const rules=data.proceduralRules.filter(rule=>surfaces.has(rule.surface));
    this.procedural=new NativeProcObjects(world,data.proceduralAssets,sources);
    this.manager=new NativeProcPlacementManager(rules,data.proceduralAssets.map(asset=>({name:asset.name,id:asset.definition.id,minimumZ:asset.collision.bounds.min[2],kind:asset.entityKind})),random,{temporaryObjects:0},()=>this.cameraPosition,this.procedural);
    hooks=this.manager;
   }
   this.owner=new NativeVegetationScene(entities,data.grass,data.surfaces,data.surfaceInfo,hooks,(triangle,cover,index)=>windowsCrtGrassSamples(triangle.seeds[cover],index));
   this.group.add(this.owner.root);if(this.procedural)this.group.add(this.procedural.root);
  }catch(error){this.procedural?.dispose();throw error;}
 }
 setAmbient(rgb:readonly [number,number,number]){this.procedural?.setAmbient(rgb);}

 setEntityLighting(world:readonly [number,number,number],objects:readonly number[]|undefined,sun:number){this.procedural?.setEntityLighting(world,objects,sun);}
 get root(){return this.group;}
 update(camera:PerspectiveCamera,night:number,windState:NativeGrassWindState={milliseconds:0,wind:0,seed:0},simulate=true){
  const bending=nativeGrassWind(windState.milliseconds,windState.wind,windState.seed);
  camera.getWorldPosition(this.position);const position=[this.position.x,-this.position.z,this.position.y] as const;
  this.cameraPosition=position;this.procedural?.setNight(night);
  if(this.updates===0||simulate){
   if(this.updates===0)this.owner.simulate(position);
   // nLocTriSkipCounter is an int8 taken % 8 after the increment: for the half of its cycle it is negative the mask
   // is -7 to 0, and only a 0 matches a triangle's index % 8.
   else this.owner.simulate(position,this.updates%32!==0,((this.updates-1)<<24>>24)%8);
   this.updates++;
  }
  this.frustum.setFromProjectionMatrix(this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  this.owner.render({camera:position,night,wind:bending,quality:fxQuality(),visible:triangle=>{
   const [x,y,z]=triangle.candidate.triangle.center;this.sphere.center.set(x,z,-y);this.sphere.radius=triangle.candidate.triangle.radius;return this.frustum.intersectsSphere(this.sphere);
  }});
  this.procedural?.updateView(camera,lodDistMultiplier());
  this.windState={...windState};this.bending=bending;
 }
 snapshot(){return {wind:{...this.windState,bending:this.bending},entities:this.owner.entityCount,cached:this.owner.cachedEntityCount,triangles:this.owner.allocations().length,batches:this.owner.root.children.filter(child=>child.visible).length,procedural:this.procedural?{...this.procedural.snapshot(),pool:this.manager!.snapshot()}:undefined};}
 dispose(){try{this.owner.dispose();}finally{this.procedural?.dispose();this.group.removeFromParent();this.group.clear();}}
}
