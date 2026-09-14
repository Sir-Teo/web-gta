import {requireAsset} from '../assets/binary';
import type {WindowsCrtRandom} from '../core/WindowsCrtRandom';
import type {AllocatedPlantTriangle,NativePlantPoolHooks} from './NativePlantPool';
import {NativeProcObjectPool,type ProcObjectCounts} from './NativeProcObjectPool';
import {distributeNativeProcRandom} from './nativeProcDistribution';
import type {NativeProcRule} from './nativeProcRules';
import {nativeProcTransform} from './nativeProcTransform';
import type {PlantPoint} from './nativePlantTriangle';

export interface NativeProcModel {name:string;id:number;minimumZ:number;kind:'building'|'object'}
export interface NativeProcAdapter<T> {
 /** Reserve the native entity before transform samples are drawn. */
 allocate(model:NativeProcModel,slot:number):T|null;
 install(value:T,transform:ReturnType<typeof nativeProcTransform>,triangle:AllocatedPlantTriangle):void;
 destroy(value:T):void;
}

/** Connects PlantLocTri lifetime callbacks to ordered procedural rules and
 * shared allocation limits. Camera and global RNG lifetime belong to caller. */
export class NativeProcPlacementManager<T> implements NativePlantPoolHooks {
 private readonly pool:NativeProcObjectPool<T>;
 private readonly plans:{rule:NativeProcRule;model:NativeProcModel}[];
 constructor(rules:readonly NativeProcRule[],models:readonly NativeProcModel[],private readonly random:WindowsCrtRandom,counts:ProcObjectCounts,private readonly camera:()=>PlantPoint,private readonly adapter:NativeProcAdapter<T>){
  requireAsset(new Set(models.map(model=>model.name)).size===models.length,'Duplicate procedural model metadata.');
  this.plans=rules.map(rule=>{
   const model=models.find(model=>model.name===rule.modelName);
   requireAsset(!!model,`Missing procedural model metadata: ${rule.modelName}.`);
   requireAsset(rule.useGrid===0,'Grid procedural rules require grid traversal.');
   requireAsset(Number.isInteger(model.id)&&model.id>=0&&model.id<=32767&&Number.isFinite(model.minimumZ)&&Math.abs(model.minimumZ)<=1e7&&(model.kind==='object'||model.kind==='building'),'Invalid procedural model metadata.');
   return {rule:{...rule},model:{...model}};
  });
  this.pool=new NativeProcObjectPool(rules.map(rule=>rule.surface),counts,value=>adapter.destroy(value));
 }
 randomSample(){return this.random.nextUnit();}
 addObjects(triangle:AllocatedPlantTriangle){
  const camera=this.camera();let added=0;
  try{this.plans.forEach(({rule,model},index)=>{
   if(rule.surface!==triangle.candidate.surface)return;
   added+=distributeNativeProcRandom(triangle.candidate.triangle.vertices,rule,model.id,camera,this.random,(position,normal,rng)=>
    this.pool.allocate(index,triangle,model.kind,rule.align&&normal[2]<Math.fround(.95),slot=>{
     const value=this.adapter.allocate(model,slot);if(value===null)return null;
     try{
      const transform=nativeProcTransform(rule,position,normal,model.minimumZ,model.kind,[rng.nextUnit(),rng.nextUnit(),rng.nextUnit(),rng.nextUnit()]);
      this.adapter.install(value,transform,triangle);return value;
     }catch(error){this.adapter.destroy(value);throw error;}
    })
   ).added;
  });}catch(error){
   try{this.removeObjects(triangle);}catch(cleanup){throw new AggregateError([error,cleanup],'Procedural triangle installation failed.');}
   throw error;
  }
  return added!==0;
 }
 removeObjects(triangle:AllocatedPlantTriangle){this.pool.removeTriangle(triangle,triangle.candidate.surface);}
 snapshot(){return this.pool.snapshot();}
}
