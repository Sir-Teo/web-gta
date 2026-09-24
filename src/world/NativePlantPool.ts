import {requireAsset} from '../assets/binary';
import type {NativePlantCandidate} from './nativePlantCollision';
import type {PlantPoint} from './nativePlantTriangle';

export interface AllocatedPlantTriangle {
 readonly id:number;
 readonly entity:string;
 readonly candidate:NativePlantCandidate;
 readonly seeds:readonly number[];
 createdObjects:boolean;
}
export interface NativePlantPoolHooks {
 /** Called exactly three times for each newly allocated grass triangle. */
 randomSample():number;
 /** True means the procedural manager reported a nonzero addition count. */
 addObjects(triangle:AllocatedPlantTriangle):boolean;
 removeObjects(triangle:AllocatedPlantTriangle):void;
}

/** PlantMgr's shared triangle lifetime. Entity traversal/cache selection and
 * tick scheduling are supplied by the caller, not approximated here. */
export class NativePlantPool {
 private free=Array.from({length:256},(_,i)=>i);
 private entities=new Map<string,Map<number,AllocatedPlantTriangle>>();
 private lists:AllocatedPlantTriangle[][]=[[],[],[],[]];
 constructor(private readonly hooks:NativePlantPoolHooks){}
 get size(){return 256-this.free.length;}
 /** Snapshot in native render order: slot order, most recently added first. */
 triangles(){return this.lists.flat();}

 updateEntity(entity:string,camera:PlantPoint,candidates:Iterable<NativePlantCandidate>,phase?:number){
  requireAsset(!!entity,'Missing plant entity identity.');
  requireAsset(phase===undefined||Number.isInteger(phase)&&phase>-8&&phase<8,'Invalid plant triangle phase.');
  requireAsset(camera.length===3&&camera.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7),'Invalid plant camera position.');
  let entries=this.entities.get(entity);
  if(!entries){entries=new Map();this.entities.set(entity,entries);}
  // Native removal walks source triangle indices, independently of face groups.
  for(const [index,entry] of [...entries].sort((a,b)=>a[0]-b[0])){
   if(entry.candidate.createsObjects&&!entry.createdObjects&&this.hooks.addObjects(entry))entry.createdObjects=true;
   if((phase===undefined||index%8===phase)&&!entry.candidate.triangle.retainedNear(camera))this.release(entry,entries);
  }
  // Candidate iteration preserves source face-group order. Repeated indices
  // and already allocated triangles must not consume seeds again.
  for(const candidate of candidates){
   if(!this.free.length)break;
   if(entries.has(candidate.index)||(phase!==undefined&&candidate.index%8!==phase))continue;
   requireAsset(Number.isInteger(candidate.index)&&candidate.index>=0&&Number.isInteger(candidate.slot)&&candidate.slot>=0&&candidate.slot<4,'Invalid plant candidate identity.');
   if(!candidate.triangle.near(camera))continue;
   if(!candidate.createsPlants&&!candidate.createsObjects)continue;
   const seeds=candidate.createsPlants?Array.from({length:3},()=>{
    const value=this.hooks.randomSample();requireAsset(Number.isFinite(value)&&value>=0&&value<=1,'Invalid plant random sample.');return Math.fround(value);
   }):[];
   const entry:AllocatedPlantTriangle={id:this.free.shift()!,entity,candidate,seeds,createdObjects:false};
   entries.set(candidate.index,entry);this.lists[candidate.slot].unshift(entry);
   if(candidate.createsObjects){
    entry.createdObjects=this.hooks.addObjects(entry);
    if(!entry.createdObjects&&!candidate.createsPlants)this.release(entry,entries);
   }
  }
  if(!entries.size)this.entities.delete(entity);
 }

 releaseEntity(entity:string){
  const entries=this.entities.get(entity);if(!entries)return;
  for(const [,entry] of [...entries].sort((a,b)=>a[0]-b[0]))this.release(entry,entries);
  this.entities.delete(entity);
 }
 private release(entry:AllocatedPlantTriangle,entries:Map<number,AllocatedPlantTriangle>){
  if(entry.createdObjects)this.hooks.removeObjects(entry);
  entries.delete(entry.candidate.index);
  const list=this.lists[entry.candidate.slot];list.splice(list.indexOf(entry),1);
  this.free.unshift(entry.id);
 }
}
