import type {Matrix4} from 'three';
import type {ColModel} from '../assets/col';
import {requireAsset} from '../assets/binary';
import type {SurfaceInfoRecord} from '../assets/surfaceInfo';
import type {NativePlantSurface} from './nativeVegetation';
import type {PlantPoint} from './nativePlantTriangle';
import {nativePlantCollisionCandidates} from './nativePlantCollision';
import type {NativePlantPool} from './NativePlantPool';

export interface NativePlantEntity {
 identity:string;
 collision:ColModel;
 matrix:Matrix4;
 inCurrentArea:boolean;
 procedural:boolean;
 atomic:boolean;
 plantFriendly:boolean;
 scanCurrent:boolean;
}
type ResolveEntity=(identity:string)=>NativePlantEntity|undefined;

/** PlantMgr's bound-sphere distance expression. Inside the sphere it keeps
 * center distance, rather than clamping distance-to-surface to zero. */
export function nativePlantEntityDistanceSquared(entity:NativePlantEntity,camera:PlantPoint){
 const f=Math.fround,m=entity.matrix.elements.map(f),p=entity.collision.bounds.center.map(f),radius=f(entity.collision.bounds.radius);
 requireAsset(m.every(Number.isFinite)&&m[3]===0&&m[7]===0&&m[11]===0&&m[15]===1,'Invalid plant entity transform.');
 requireAsset(p.every(Number.isFinite)&&Number.isFinite(radius)&&radius>=0&&camera.length===3&&camera.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid plant entity bounds or camera.');
 const delta=[0,1,2].map(i=>f(f(f(f(f(m[i]*p[0])+f(m[i+4]*p[1]))+f(m[i+8]*p[2]))+m[i+12])-f(camera[i])));
 let distance=f(Math.sqrt(f(f(f(delta[0]*delta[0])+f(delta[1]*delta[1]))+f(delta[2]*delta[2]))));
 if(distance>radius)distance=f(distance-radius);
 const squared=f(distance*distance);requireAsset(Number.isFinite(squared),'Plant entity distance exceeds float32 range.');return squared;
}

/** The 40-entry native cache. The caller supplies building-sector scan order
 * and resolves current entity references; cached identities cannot be recycled. */
export class NativePlantEntityCache {
 private entries:{identity:string;triangles:number}[]=[];
 constructor(private readonly pool:NativePlantPool){}
 identities(){return this.entries.map(entry=>entry.identity);}
 update(camera:PlantPoint,fast:boolean,scan:Iterable<NativePlantEntity>,resolve:ResolveEntity){
  for(const entry of [...this.entries]){
   const entity=resolve(entry.identity);
   if(!entity||!fast&&(!entity.inCurrentArea||nativePlantEntityDistanceSquared(entity,camera)>340*340))this.remove(entry.identity);
  }
  if(fast||this.entries.length===40)return;
  for(const entity of scan){
   if(entity.procedural||entity.scanCurrent||!entity.inCurrentArea||!entity.atomic||!entity.plantFriendly)continue;
   if(this.entries.some(entry=>entry.identity===entity.identity))continue;
   if(nativePlantEntityDistanceSquared(entity,camera)>340*340)continue;
   // Native traversal stops when AddEntry fails, including empty collision.
   if(this.entries.length===40||!entity.collision.mesh.materials.length)break;
   requireAsset(!!entity.identity,'Missing plant entity identity.');
   this.entries.unshift({identity:entity.identity,triangles:entity.collision.mesh.materials.length});
  }
 }
 process(camera:PlantPoint,resolve:ResolveEntity,info:ReadonlyMap<number,SurfaceInfoRecord>,plants:ReadonlyMap<number,NativePlantSurface>,phase?:number){
  for(const entry of this.entries){
   const entity=resolve(entry.identity);if(!entity||entity.collision.mesh.materials.length!==entry.triangles)continue;
   this.pool.updateEntity(entry.identity,camera,nativePlantCollisionCandidates(entity.collision,entity.matrix,camera,info,plants,phase),phase);
  }
 }
 remove(identity:string){
  const index=this.entries.findIndex(entry=>entry.identity===identity);if(index<0)return;
  this.pool.releaseEntity(identity);this.entries.splice(index,1);
 }
 clear(){for(const entry of [...this.entries])this.remove(entry.identity);}
}
