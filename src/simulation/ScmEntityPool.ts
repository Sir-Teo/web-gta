import {requireAsset} from '../assets/binary';
/* Handles for things a script makes that the browser cannot make at once.
 *
 * The original's creating commands are synchronous: CPopulation::AddPed and CCarCtrl::CreateCarForScript hand
 * back an entity the script uses on its very next instruction, because the model is already in memory. The
 * browser has to stream the model first, so a handle is allocated here at once and the entity arrives later.
 * Everything the script does to it in between is kept as an action against the handle and run, in order, when
 * the entity turns up. An entity the script deleted before it arrived is removed the moment it does, so it is
 * never seen; one whose making produced nothing stops existing, which is the answer the original gives for an
 * entity it could not make. */
interface PooledEntity<Entity>{
 handle:number;entity?:Entity;
 settled:boolean;failed:boolean;deleted:boolean;noLongerNeeded:boolean;
 /** The making now under way, which settles when it does. */
 making?:Promise<void>;
 pending:((entity:Entity)=>void)[];
}
export interface ScmEntityPoolHost<Entity>{
 /** Whether the browser still holds it, and how to let it go. */
 aliveOf(entity:Entity):boolean;
 remove(entity:Entity):void;
}
export class ScmEntityPool<Entity>{
 private readonly records=new Map<number,PooledEntity<Entity>>();
 private next:number;
 /** `first` keeps a pool's handles clear of the ones the browser hands out for the player and his car, which
  * the script addresses by the same commands. */
 constructor(private readonly host:ScmEntityPoolHost<Entity>,first=1){this.next=first;}
 get count(){return this.records.size;}
 get handles():readonly number[]{return [...this.records.keys()];}
 /** A handle now, and the entity when the browser has it. */
 create(spawn:()=>Promise<Entity|undefined>){
  const handle=this.next++;
  const record:PooledEntity<Entity>={handle,settled:false,failed:false,deleted:false,noLongerNeeded:false,pending:[]};
  this.records.set(handle,record);
  this.settleInto(record,spawn);
  return handle;
 }
 /** A handle for something the browser already holds, which the original's pool hands out the moment it is asked
  * for a reference to it (GetRef of a carriage the train made). */
 adopt(entity:Entity){
  const handle=this.next++;
  this.records.set(handle,{handle,entity,settled:true,failed:false,deleted:false,noLongerNeeded:false,pending:[]});
  return handle;
 }
 /** Swap what a handle names for something else the browser makes, which is what a ped changing from walking
  * to riding does: the old entity goes, the handle stays, and the new one arrives the same way the first did. */
 replace(handle:number,spawn:()=>Promise<Entity|undefined>){
  const record=this.records.get(handle);if(!record||record.deleted)return;
  if(record.entity){this.host.remove(record.entity);record.entity=undefined;}
  record.settled=false;record.failed=false;record.pending.length=0;
  this.settleInto(record,spawn);
 }
 private settleInto(record:PooledEntity<Entity>,spawn:()=>Promise<Entity|undefined>){
  record.making=spawn().then(entity=>{
   record.settled=true;
   if(!entity){record.failed=true;return;}
   if(record.deleted){this.host.remove(entity);return;}
   record.entity=entity;
   for(const action of record.pending)action(entity);
   record.pending.length=0;
  }).catch(()=>{record.settled=true;record.failed=true;});
 }
 /** The entity once its making has settled: at once for one already made, nothing for one that failed or has gone. */
 async whenSettled(handle:number):Promise<Entity|undefined>{
  const record=this.records.get(handle);if(!record)return undefined;
  if(!record.settled)await record.making;
  return record.deleted?undefined:record.entity;
 }
 /** The browser's own entity, once it has one. */
 entity(handle:number){return this.records.get(handle)?.entity;}
 /** The handle that names this entity, or nothing when no handle does. The script's pools hold a few at a
  * time, so the search is a walk rather than a second index to keep in step. */
 handleOf(entity:Entity){for(const record of this.records.values())if(record.entity===entity)return record.handle;return undefined;}
 /** Whether the entity has finished being made, whether or not it succeeded. */
 settled(handle:number){return this.records.get(handle)?.settled??true;}
 /** A handle the script still holds whose entity has not failed and has not gone. */
 exists(handle:number){
  const record=this.records.get(handle);
  if(!record||record.deleted||record.failed)return false;
  return record.entity?this.host.aliveOf(record.entity):true;
 }
 /** Do this to the entity: now if it is here, and on arrival if it is not. */
 apply(handle:number,action:(entity:Entity)=>void){
  const record=this.records.get(handle);if(!record||record.deleted)return;
  if(record.entity){action(record.entity);return;}
  if(!record.failed)record.pending.push(action);
 }
 /** Read the entity if it is here, and fall back to what the script itself last said if it is not. */
 read<Value>(handle:number,of:(entity:Entity)=>Value,fallback:()=>Value){
  const record=this.records.get(handle);
  requireAsset(record,'Script entity handle names nothing.');
  return record!.entity?of(record!.entity):fallback();
 }
 /** The entity goes now if it is here, and is refused on arrival if it is not. */
 /** Drop a handle's record and leave its entity alone: for a handle naming something the script never made, once
  * that is gone. */
 forget(handle:number){this.records.delete(handle);}
 delete(handle:number){
  const record=this.records.get(handle);if(!record)return;
  record.deleted=true;record.pending.length=0;
  if(record.entity){this.host.remove(record.entity);record.entity=undefined;}
  this.records.delete(handle);
 }
 /** The entity stays in the world for the streamer to reclaim, and the script stops being able to address it. */
 markNoLongerNeeded(handle:number){
  const record=this.records.get(handle);if(!record)return;
  record.noLongerNeeded=true;
  // What the script said before letting go still applies when the entity arrives — the handing back most of
  // all, which is what stops the population manager treating it as the script's for ever.
  this.records.delete(handle);
 }
}
