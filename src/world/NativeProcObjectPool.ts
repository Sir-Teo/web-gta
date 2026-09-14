import {requireAsset} from '../assets/binary';

export interface ProcObjectCounts {temporaryObjects:number}
interface Entry<T> {slot:number;triangle:object;kind:'building'|'object';aligned:boolean;value:T}

/** Ownership portion of ProcSurfaceInfo::AddObject / ProcessTriangleRemoved.
 * Rule indices retain file order. A failed native allocation detaches its slot;
 * it is not quietly returned to the free list. Rendering/physics stay external. */
export class NativeProcObjectPool<T> {
 private readonly free=Array.from({length:512},(_,i)=>i);
 private readonly lists:Entry<T>[][];
 private matrices=0;
 private detached=0;
 constructor(private readonly surfaces:readonly number[],private readonly counts:ProcObjectCounts,private readonly destroy:(value:T)=>void){
  requireAsset(surfaces.length<=128&&surfaces.every(id=>Number.isInteger(id)&&id>0&&id<178),'Invalid procedural pool surfaces.');
  this.surfaces=[...surfaces];this.lists=surfaces.map(()=>[]);this.validateCounts();
 }
 private validateCounts(){requireAsset(Number.isInteger(this.counts.temporaryObjects)&&this.counts.temporaryObjects>=0,'Invalid temporary object count.');}
 allocate(ruleIndex:number,triangle:object,kind:'building'|'object',aligned:boolean,create:(slot:number)=>T|null):boolean{
  requireAsset(Number.isInteger(ruleIndex)&&ruleIndex>=0&&ruleIndex<this.lists.length,'Invalid procedural rule index.');
  requireAsset(triangle!==null&&typeof triangle==='object'&&(kind==='building'||kind==='object')&&typeof aligned==='boolean','Invalid procedural ownership.');
  this.validateCounts();
  const slot=this.free.pop();if(slot===undefined)return false;
  // Source ordering matters: these failures have already removed the head.
  this.detached++;
  if(aligned&&this.matrices>=200||kind==='object'&&this.counts.temporaryObjects>=150)return false;
  const value=create(slot);if(value===null)return false;
  this.detached--;
  if(kind==='object')this.counts.temporaryObjects++;
  if(aligned)this.matrices++;
  this.lists[ruleIndex].unshift({slot,triangle,kind,aligned,value});return true;
 }
 /** Matching surface rules, then each rule's head-to-tail list. Identity is the
  * retained triangle object, not a vertex hash that could alias another owner. */
 removeTriangle(triangle:object,surface:number){
  this.validateCounts();let removed=0;const errors:unknown[]=[];
  this.lists.forEach((list,index)=>{
   if(this.surfaces[index]!==surface)return;
   for(let i=0;i<list.length;){
    const entry=list[i];if(entry.triangle!==triangle){i++;continue;}
    if(entry.kind==='object')this.counts.temporaryObjects--;
    list.splice(i,1);this.free.push(entry.slot);
    try{this.destroy(entry.value);}catch(error){errors.push(error);}
    finally{if(entry.aligned)this.matrices--;removed++;}
   }
  });
  if(errors.length)throw new AggregateError(errors,'Procedural object cleanup failed.');
  return removed;
 }
 snapshot(){return {free:this.free.length,active:this.lists.reduce((n,l)=>n+l.length,0),detached:this.detached,matrices:this.matrices,temporaryObjects:this.counts.temporaryObjects};}
}
