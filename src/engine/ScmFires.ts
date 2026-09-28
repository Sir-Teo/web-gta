import {requireAsset} from '../assets/binary';
/* CFireManager and the script half of CFire, pinned gta-reversed ead3051 (`FireManager.cpp` and `Fire.cpp`,
 * both reversed): the fires a script starts and asks after. The spreading, burning down and particle work of
 * `CFire::ProcessFire` belongs to a host that draws them; this is the pool, the slots and what the script can
 * set or read. Native axes. */
/** CFireManager::MAX_NUM_FIRES. */
export const MAX_NUM_FIRES=60;
/** CFireManager::Init leaves the generation cap one short of a million. */
export const MAX_FIRE_GENERATIONS=999999;
/** CFire::Initialise defaults. */
export const FIRE_REMOVAL_DISTANCE=60,FIRE_DEFAULT_GENERATIONS=100;
export interface ScmFire {
 active:boolean;createdByScript:boolean;makesNoise:boolean;beingExtinguished:boolean;firstGeneration:boolean;
 position:{x:number;y:number;z:number};
 /** m_ScriptReferenceIndex, the counter the handle's high half carries. */
 referenceIndex:number;
 timeToBurn:number;strength:number;generationsAllowed:number;removalDistance:number;
}
function initialised():ScmFire{
 return {active:false,createdByScript:false,makesNoise:true,beingExtinguished:false,firstGeneration:true,
  position:{x:0,y:0,z:0},referenceIndex:1,timeToBurn:0,strength:1,generationsAllowed:FIRE_DEFAULT_GENERATIONS,removalDistance:FIRE_REMOVAL_DISTANCE};
}
/** CTheScripts::GetNewUniqueScriptThingIndex: the counter moves on, then the handle carries it above the slot. */
export function scriptThingHandle(index:number,referenceIndex:number){
 const next=referenceIndex===-1||referenceIndex===-2?1:referenceIndex+1;
 return {handle:(next<<16|index)|0,referenceIndex:next};
}
export class ScmFires {
 readonly fires:ScmFire[]=Array.from({length:MAX_NUM_FIRES},()=>initialised());
 /** SET_MAX_FIRE_GENERATIONS, which CFireManager::Init starts at 999,999. */
 maxGenerations=MAX_FIRE_GENERATIONS;
 /** The slot a handle names: its low half. */
 static indexOf(handle:number){return handle&0xffff;}
 private slot(handle:number){
  const index=ScmFires.indexOf(handle);
  requireAsset(Number.isInteger(index)&&index>=0&&index<MAX_NUM_FIRES,'Fire handle out of range.');
  return this.fires[index];
 }
 get active(){return this.fires.filter(f=>f.active).length;}
 /** CFireManager::GetNumOfNonScriptFires. */
 get nonScript(){return this.fires.filter(f=>f.active&&!f.createdByScript).length;}
 /** CFireManager::PlentyFiresAvailable: six free slots is plenty. */
 plentyAvailable(){return this.fires.filter(f=>!f.active).length>=6;}
 /** CFireManager::GetNextFreeFire (0x539E50): a slot that is neither burning nor the script's, else, when the
  * caller allows it, the first script or first-generation fire, put out to make room. */
 private nextFree(mayExtinguish:boolean){
  const free=this.fires.find(f=>!f.active&&!f.createdByScript);
  if(free)return free;
  if(!mayExtinguish)return undefined;
  const taken=this.fires.find(f=>f.firstGeneration||f.createdByScript);
  if(!taken)return undefined;
  taken.createdByScript=false;this.extinguish(taken);return taken;
 }
 /** The world put a script fire out (water, an extinguisher): it stays the script's, extinguished. */
 putOut(index:number){const fire=this.fires[index];if(fire)this.extinguish(fire);}
 /** CFire::Extinguish (0x53A0C0 region): the fire goes out and its burn clock clears. */
 private extinguish(fire:ScmFire){
  if(!fire.active)return;
  fire.timeToBurn=0;fire.active=false;fire.beingExtinguished=false;fire.firstGeneration=true;
 }
 /** CFireManager::StartScriptFire (0x53A270) with CFire::Start (0x53A150): the script's fire takes a free slot,
  * its strength is the size the command asks for, and its generations are capped by the manager's own limit.
  * The handle is the script thing index, or -1 when every slot is burning. */
 startScriptFire(position:{x:number;y:number;z:number},strength:number,generations:number){
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid fire position.');
  requireAsset(Number.isFinite(strength),'Invalid fire strength.');
  const fire=this.nextFree(true);
  if(!fire)return -1;
  fire.active=true;fire.createdByScript=true;fire.makesNoise=true;fire.beingExtinguished=false;fire.firstGeneration=true;
  fire.generationsAllowed=Math.min(this.maxGenerations,generations)&255;
  fire.strength=strength;fire.position={...position};
  const {handle,referenceIndex}=scriptThingHandle(this.fires.indexOf(fire),fire.referenceIndex);
  fire.referenceIndex=referenceIndex;
  return handle;
 }
 /** CFireManager::IsScriptFireExtinguished (0x5396E0). */
 isExtinguished(handle:number){return !this.slot(handle).active;}
 /** DOES_SCRIPT_FIRE_EXIST: the slot the handle names is still the script's and still burning. */
 exists(handle:number){const fire=this.slot(handle);return fire.active&&fire.createdByScript;}
 /** CFireManager::RemoveScriptFire (0x539700): only a fire the script owns. */
 removeScriptFire(handle:number){
  const fire=this.slot(handle);
  if(!fire.createdByScript)return;
  fire.createdByScript=false;this.extinguish(fire);
 }
 /** CFireManager::RemoveAllScriptFires (0x539720). */
 removeAllScriptFires(){for(const fire of this.fires)if(fire.createdByScript){fire.createdByScript=false;this.extinguish(fire);}}
 /** CFireManager::ClearAllScriptFireFlags (0x5397A0): the fires keep burning, the script just lets go of them. */
 clearAllScriptFireFlags(){for(const fire of this.fires)fire.createdByScript=false;}
 /** CFireManager::SetScriptFireAudio (0x5397B0). */
 setAudio(handle:number,makesNoise:boolean){this.slot(handle).makesNoise=makesNoise;}
 /** CFireManager::GetScriptFireCoords (0x5397E0). */
 coords(handle:number){return {...this.slot(handle).position};}
 /** CFireManager::ExtinguishPoint (0x539450): every fire within the radius, in three dimensions. */
 extinguishPoint(point:{x:number;y:number;z:number},radius:number){
  for(const fire of this.fires){
   if(!fire.active)continue;
   const dx=fire.position.x-point.x,dy=fire.position.y-point.y,dz=fire.position.z-point.z;
   if(dx*dx+dy*dy+dz*dz>radius*radius)continue;
   fire.createdByScript=false;this.extinguish(fire);
  }
 }
 /** CFireManager::GetNumFiresInRange (0x5397F0): the script's own fires do not count, and the range is flat. */
 numFiresInRange(point:{x:number;y:number},radius:number){
  return this.fires.filter(f=>f.active&&!f.createdByScript&&Math.hypot(f.position.x-point.x,f.position.y-point.y)<=radius).length;
 }
 /** CFireManager::GetNumFiresInArea (0x539860): a box, and again only the fires the script does not own. */
 numFiresInArea(min:{x:number;y:number;z:number},max:{x:number;y:number;z:number}){
  const within=(value:number,low:number,high:number)=>value>=Math.min(low,high)&&value<=Math.max(low,high);
  return this.fires.filter(f=>f.active&&!f.createdByScript&&within(f.position.x,min.x,max.x)&&within(f.position.y,min.y,max.y)&&within(f.position.z,min.z,max.z)).length;
 }
}
