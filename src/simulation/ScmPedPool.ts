import {requireAsset} from '../assets/binary';
import {ScmEntityPool} from './ScmEntityPool';
/* The peds a script creates, held for a browser whose spawning is asynchronous.
 *
 * CPopulation::AddPed builds the ped inside the command, so CREATE_CHAR's very next instruction can set its
 * health, its accuracy and where it stands. The browser has to load the model first, so ScmEntityPool carries
 * the handle across that gap and everything the script says meanwhile is run on the ped when it arrives. What
 * is here is the part that is a ped's: where it stands, which way it faces, how much health it has, and the
 * protections SET_CHAR_PROOFS grants. */
export interface ScmPedProofs{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}
export interface ScmPedPoolHost<Ped>{
 /** Build the ped the script asked for, or nothing when it cannot be made. */
 spawn(pedType:number,model:number|string,position:{x:number;y:number;z:number}):Promise<Ped|undefined>;
 /** CRunningScript::SetCharCoordinates, which also puts the ped on the ground. */
 place(ped:Ped,position:{x:number;y:number;z:number}):void;
 setHeading(ped:Ped,degrees:number):void;
 positionOf(ped:Ped):{x:number;y:number;z:number};
 headingOf(ped:Ped):number;
 healthOf(ped:Ped):number;
 setHealth(ped:Ped,health:number):void;
 kill(ped:Ped):void;
 setAccuracy(ped:Ped,accuracy:number):void;
 setInvulnerable(ped:Ped,enabled:boolean):void;
 setProofs(ped:Ped,proofs:ScmPedProofs):void;
 /** Whether the browser still holds it, and how to let it go. */
 aliveOf(ped:Ped):boolean;
 remove(ped:Ped):void;
 /** CTheScripts::CleanUpThisPed: the ped goes back to being the population manager's to remove. */
 release(ped:Ped):void;
}
/** What the script said about a ped, which answers for it until the browser has built one. */
interface ScriptPed{pedType:number;position:{x:number;y:number;z:number};heading:number;health:number;dead:boolean}
/** ePedType, of which only these two are female. */
const PED_TYPE_CIVFEMALE=5,PED_TYPE_PROSTITUTE=22;
/** CPed's starting health, which SET_CHAR_HEALTH raises the maximum along with. */
const DEFAULT_PED_HEALTH=100;
export class ScmPedPool<Ped>{
 private readonly pool:ScmEntityPool<Ped>;
 private readonly said=new Map<number,ScriptPed>();
 constructor(private readonly host:ScmPedPoolHost<Ped>,first=1){this.pool=new ScmEntityPool(host,first);}
 get count(){return this.pool.count;}
 /** CREATE_CHAR and its random forms: the handle comes back at once and the ped follows. */
 create(pedType:number,model:number|string,position:{x:number;y:number;z:number}){
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid script ped placement.');
  const handle=this.pool.create(()=>this.host.spawn(pedType,model,{...position}));
  this.said.set(handle,{pedType,position:{...position},heading:0,health:DEFAULT_PED_HEALTH,dead:false});
  return handle;
 }
 private word(handle:number){const said=this.said.get(handle);requireAsset(said,'Script ped handle names nothing.');return said!;}
 exists(handle:number){return this.pool.exists(handle);}
 /** The browser's own ped, once it has built one. */
 entity(handle:number){return this.pool.entity(handle);}
 /** Whether the making has finished, whether or not it produced anything. */
 settledFor(handle:number){return this.pool.settled(handle);}
 /** GET_CHAR_PED_TYPE: the ePedType the script asked the ped to be, which is m_nPedType. */
 typeOf(handle:number){return this.word(handle).pedType;}
 /** IS_CHAR_MALE: !IsPedTypeFemale, which is every ePedType but PED_TYPE_CIVFEMALE and PED_TYPE_PROSTITUTE. */
 isMale(handle:number){const type=this.typeOf(handle);return type!==PED_TYPE_CIVFEMALE&&type!==PED_TYPE_PROSTITUTE;}
 /** CPed::IsStateDeadForScript. A handle that names no ped counts as dead. */
 isDead(handle:number){
  const said=this.said.get(handle);
  if(!said||!this.pool.exists(handle))return true;
  return this.pool.read(handle,ped=>this.host.healthOf(ped)<=0,()=>said.dead||said.health<=0);
 }
 /** GET_CHAR_COORDINATES: where the ped is once it exists, and what the script last set until then. */
 positionOf(handle:number){const said=this.word(handle);return this.pool.read(handle,ped=>this.host.positionOf(ped),()=>({...said.position}));}
 headingOf(handle:number){const said=this.word(handle);return this.pool.read(handle,ped=>this.host.headingOf(ped),()=>said.heading);}
 healthOf(handle:number){const said=this.word(handle);return this.pool.read(handle,ped=>this.host.healthOf(ped),()=>said.dead?0:said.health);}
 setPosition(handle:number,position:{x:number;y:number;z:number}){
  const said=this.said.get(handle);if(!said)return;
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid script ped position.');
  said.position={...position};
  this.pool.apply(handle,ped=>{this.host.place(ped,said.position);});
 }
 setHeading(handle:number,degrees:number){
  const said=this.said.get(handle);if(!said)return;
  requireAsset(Number.isFinite(degrees),'Invalid script ped heading.');
  said.heading=degrees;
  this.pool.apply(handle,ped=>{this.host.setHeading(ped,said.heading);});
 }
 /** SET_CHAR_HEALTH: no health kills the ped rather than setting the field. */
 setHealth(handle:number,health:number){
  const said=this.said.get(handle);if(!said)return;
  if(health<=0){this.kill(handle);return;}
  said.health=health;said.dead=false;
  this.pool.apply(handle,ped=>{this.host.setHealth(ped,health);});
 }
 kill(handle:number){
  const said=this.said.get(handle);if(!said)return;
  said.dead=true;said.health=0;
  this.pool.apply(handle,ped=>{this.host.kill(ped);});
 }
 setAccuracy(handle:number,accuracy:number){this.pool.apply(handle,ped=>{this.host.setAccuracy(ped,accuracy);});}
 setInvulnerable(handle:number,enabled:boolean){this.pool.apply(handle,ped=>{this.host.setInvulnerable(ped,enabled);});}
 setProofs(handle:number,proofs:ScmPedProofs){this.pool.apply(handle,ped=>{this.host.setProofs(ped,proofs);});}
 /** DELETE_CHAR: the ped goes now if it is here, and is refused on arrival if it is not. */
 delete(handle:number){this.pool.delete(handle);this.said.delete(handle);}
 /** MARK_CHAR_AS_NO_LONGER_NEEDED: the ped stays for the streamer to reclaim and the script lets go of it. */
 markNoLongerNeeded(handle:number){
  this.pool.apply(handle,ped=>{this.host.release(ped);});
  this.pool.markNoLongerNeeded(handle);this.said.delete(handle);
 }
}
