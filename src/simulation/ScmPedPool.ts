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
 /** CPopulation::AddPedInCar: the ped is made in a seat of a car rather than on the ground, so it never walks
  * and answers for where it is from the car it rides. */
 spawnInCar(pedType:number,model:number|string,vehicle:number,seat:number|'driver'):Promise<Ped|undefined>;
 /** The same, with the occupation the game would have chosen for that car, which is what the random forms ask. */
 spawnRandomInCar(vehicle:number,seat:number|'driver'):Promise<Ped|undefined>;
 /** CPed::AttachPedToEntity: the ped rides on the car at an offset in the car's own axes rather than in a seat. */
 spawnOnCar(pedType:number,model:number|string,vehicle:number,offset:{x:number;y:number;z:number}):Promise<Ped|undefined>;
 /** CRunningScript::SetCharCoordinates, which also puts the ped on the ground. */
 place(ped:Ped,position:{x:number;y:number;z:number}):void;
 setHeading(ped:Ped,degrees:number):void;
 positionOf(ped:Ped):{x:number;y:number;z:number};
 headingOf(ped:Ped):number;
 healthOf(ped:Ped):number;
 setHealth(ped:Ped,health:number):void;
 kill(ped:Ped):void;
 setAccuracy(ped:Ped,accuracy:number):void;
 /** CPed::m_nWeaponShootingRate. */
 setShootingRate?(ped:Ped,rate:number):void;
 setInvulnerable(ped:Ped,enabled:boolean):void;
 /** CPed::m_nAnimGroup and SetMoveAnim (SET_ANIM_GROUP_FOR_CHAR): the named walkcycle's moves; false for a name the
  * browser has no walkcycle for. */
 setAnimGroup?(ped:Ped,group:string):boolean;
 setProofs(ped:Ped,proofs:ScmPedProofs):void;
 /** Whether the browser still holds it, and how to let it go. */
 aliveOf(ped:Ped):boolean;
 remove(ped:Ped):void;
 /** CTheScripts::CleanUpThisPed: the ped goes back to being the population manager's to remove. */
 release(ped:Ped,keepTask?:boolean):void;
}
/** What the script said about a ped, which answers for it until the browser has built one. */
interface ScriptPed{pedType:number;model?:number|string;position:{x:number;y:number;z:number};heading:number;health:number;maxHealth:number;dead:boolean;
 /** The car the ped rides in, once a script has put it in one. */
 ride?:{vehicle:number;seat:number|'driver';offset?:{x:number;y:number;z:number}};
 /** CPed::m_fArmour, which ADD_ARMOUR_TO_CHAR raises. */
 armour?:number;
 /** The anim group SET_ANIM_GROUP_FOR_CHAR named, which the ped keeps when it is built again (out of a car). */
 animGroup?:string;
 /** CPed::bKeepTasksAfterCleanUp (SET_CHAR_KEEP_TASK). */
 keepTask?:boolean}
/** ePedType, of which only these two are female. */
const PED_TYPE_CIVMALE=4,PED_TYPE_CIVFEMALE=5,PED_TYPE_PROSTITUTE=22;
/** CPed's starting health, which SET_CHAR_HEALTH raises the maximum along with. */
const DEFAULT_PED_HEALTH=100;
export class ScmPedPool<Ped>{
 private readonly pool:ScmEntityPool<Ped>;
 private readonly said=new Map<number,ScriptPed>();
 constructor(private readonly host:ScmPedPoolHost<Ped>,first=1){this.pool=new ScmEntityPool(host,first);}
 get count(){return this.pool.count;}
 /** The handles the script holds, in the order it was given them. */
 get handles(){return this.pool.handles;}
 /** CREATE_CHAR and its random forms: the handle comes back at once and the ped follows. */
 create(pedType:number,model:number|string,position:{x:number;y:number;z:number}){
  requireAsset([position.x,position.y,position.z].every(Number.isFinite),'Invalid script ped placement.');
  const handle=this.pool.create(()=>this.host.spawn(pedType,model,{...position}));
  this.said.set(handle,{pedType,model,position:{...position},heading:0,health:DEFAULT_PED_HEALTH,maxHealth:DEFAULT_PED_HEALTH,dead:false});
  return handle;
 }
 /** CREATE_CHAR_INSIDE_CAR and its random forms: a handle for a ped that starts in a seat. */
 createInCar(pedType:number,model:number|string,vehicle:number,seat:number|'driver'){
  const handle=this.pool.create(()=>this.host.spawnInCar(pedType,model,vehicle,seat));
  this.said.set(handle,{pedType,model,position:{x:0,y:0,z:0},heading:0,health:DEFAULT_PED_HEALTH,
   maxHealth:DEFAULT_PED_HEALTH,dead:false,ride:{vehicle,seat}});
  return handle;
 }
 /** CREATE_RANDOM_CHAR_AS_DRIVER and AS_PASSENGER: the game picks the occupation. */
 createRandomInCar(vehicle:number,seat:number|'driver'){
  const handle=this.pool.create(()=>this.host.spawnRandomInCar(vehicle,seat));
  this.said.set(handle,{pedType:PED_TYPE_CIVMALE,position:{x:0,y:0,z:0},heading:0,health:DEFAULT_PED_HEALTH,
   maxHealth:DEFAULT_PED_HEALTH,dead:false,ride:{vehicle,seat}});
  return handle;
 }
 /** TASK_WARP_CHAR_INTO_CAR: the ped stops walking and rides, keeping the handle the script already holds. */
 warpIntoCar(handle:number,vehicle:number,seat:number|'driver'){
  const said=this.said.get(handle);if(!said)return;
  said.ride={vehicle,seat};
  this.pool.replace(handle,()=>this.host.spawnInCar(said.pedType,said.model??PED_TYPE_CIVMALE,vehicle,seat));
 }
 /** ATTACH_PED_TO_CAR: the ped leaves the ground and rides on the car at the offset the script names. */
 attachToCar(handle:number,vehicle:number,offset:{x:number;y:number;z:number}){
  const said=this.said.get(handle);if(!said)return;
  requireAsset([offset.x,offset.y,offset.z].every(Number.isFinite),'Invalid script ped attachment.');
  said.ride={vehicle,seat:0,offset:{...offset}};
  this.pool.replace(handle,()=>this.host.spawnOnCar(said.pedType,said.model??PED_TYPE_CIVMALE,vehicle,{...offset}));
 }
 /** DETACH_PED_FROM_CAR: the ped is back on the ground where the car had it, and walks again. */
 detachFromCar(handle:number,at:{x:number;y:number;z:number}){
  const said=this.said.get(handle);if(!said||!said.ride)return;
  said.ride=undefined;said.position={...at};
  this.pool.replace(handle,()=>this.host.spawn(said.pedType,said.model??PED_TYPE_CIVMALE,{...at}).then(ped=>{if(ped!==undefined&&said.animGroup)this.host.setAnimGroup?.(ped,said.animGroup);return ped;}));
 }
 /** The car a ped rides in, or nothing while it is on foot. */
 rideOf(handle:number){return this.said.get(handle)?.ride;}
 /** Whether a live script ped sits in a car's seat (a number, or the driver's). */
 seatTaken(vehicle:number,seat:number|'driver'){
  for(const [handle,said] of this.said)if(said.ride&&!said.ride.offset&&said.ride.vehicle===vehicle&&said.ride.seat===seat&&this.pool.exists(handle)&&!said.dead)return true;
  return false;
 }
 /** CVehicle::m_pDriver among the script's peds: the live one in the car's driving seat. */
 driverOf(vehicle:number){return this.occupantOf(vehicle,'driver');}
 /** The live script ped in a seat of a car: the driver's, or a passenger seat (0 front right, 1 and 2 the rear). */
 occupantOf(vehicle:number,seat:number|'driver'){
  for(const [handle,said] of this.said)if(said.ride&&!said.ride.offset&&said.ride.vehicle===vehicle&&said.ride.seat===seat&&this.pool.exists(handle)&&!said.dead)return handle;
  return undefined;
 }
 /** The live script peds in a car's passenger seats. */
 passengersOf(vehicle:number){
  let count=0;
  for(const [handle,said] of this.said)if(said.ride&&!said.ride.offset&&said.ride.vehicle===vehicle&&said.ride.seat!=='driver'&&this.pool.exists(handle)&&!said.dead)count++;
  return count;
 }
 /** CPed::m_fArmour of a script ped: 0 until a script gives it some. */
 armourOf(handle:number){return this.word(handle).armour??0;}
 setArmour(handle:number,armour:number){this.word(handle).armour=armour;}
 private word(handle:number){const said=this.said.get(handle);requireAsset(said,'Script ped handle names nothing.');return said!;}
 exists(handle:number){return this.pool.exists(handle);}
 /** The browser's own ped, once it has built one. */
 entity(handle:number){return this.pool.entity(handle);}
 /** The handle that names that entity, or nothing when no handle does. */
 handleOf(entity:unknown){return this.pool.handleOf(entity as never);}
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
 /** SET_CHAR_MAX_HEALTH: m_fMaxHealth, which the health command reads before it raises its own. */
 setMaxHealth(handle:number,health:number){const said=this.said.get(handle);if(said)said.maxHealth=health;}
 maxHealthOf(handle:number){return this.word(handle).maxHealth;}
 /** SET_CHAR_HEALTH: no health kills the ped rather than setting the field, and a ped still carrying the
  * default maximum of a hundred takes the new health as its maximum along with it. */
 setHealth(handle:number,health:number){
  const said=this.said.get(handle);if(!said)return;
  if(health<=0){this.kill(handle);return;}
  said.health=health;said.dead=false;
  if(said.maxHealth===DEFAULT_PED_HEALTH)said.maxHealth=health;
  this.pool.apply(handle,ped=>{this.host.setHealth(ped,health);});
 }
 kill(handle:number){
  const said=this.said.get(handle);if(!said)return;
  said.dead=true;said.health=0;
  this.pool.apply(handle,ped=>{this.host.kill(ped);});
 }
 setAccuracy(handle:number,accuracy:number){this.pool.apply(handle,ped=>{this.host.setAccuracy(ped,accuracy);});}
 /** SET_CHAR_SHOOT_RATE: the rate is a byte (m_nWeaponShootingRate is a uint8). */
 setShootingRate(handle:number,rate:number){this.pool.apply(handle,ped=>{this.host.setShootingRate?.(ped,rate&0xff);});}
 setInvulnerable(handle:number,enabled:boolean){this.pool.apply(handle,ped=>{this.host.setInvulnerable(ped,enabled);});}
 /** SET_CHAR_KEEP_TASK: whether the ped keeps its task when the script lets it go. */
 setKeepTask(handle:number,keep:boolean){const said=this.said.get(handle);if(said)said.keepTask=keep;}
 /** SET_ANIM_GROUP_FOR_CHAR, now or once the ped is built. */
 setAnimGroup(handle:number,group:string){
  const said=this.said.get(handle);if(said)said.animGroup=group;
  this.pool.apply(handle,ped=>{this.host.setAnimGroup?.(ped,group);});
 }
 setProofs(handle:number,proofs:ScmPedProofs){this.pool.apply(handle,ped=>{this.host.setProofs(ped,proofs);});}
 /** DELETE_CHAR: the ped goes now if it is here, and is refused on arrival if it is not. */
 delete(handle:number){this.pool.delete(handle);this.said.delete(handle);}
 /** MARK_CHAR_AS_NO_LONGER_NEEDED: the ped stays for the streamer to reclaim and the script lets go of it. */
 markNoLongerNeeded(handle:number){
  const keepTask=!!this.said.get(handle)?.keepTask;
  this.pool.apply(handle,ped=>{this.host.release(ped,keepTask);});
  this.pool.markNoLongerNeeded(handle);this.said.delete(handle);
 }
}
