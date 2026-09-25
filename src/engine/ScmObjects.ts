import {requireAsset} from '../assets/binary';
import {physicalCanBeDamaged} from '../combat/nativePhysicalProofs';
/* The script's own CObjects, pinned gta-reversed ead3051 (`ObjectCommands.cpp`'s Object namespace, which is
 * reversed, over `CObject::Create` and the CEntity/CPhysical fields each command reaches). The table stands in
 * for CPools' object pool: it holds what the script can read back, so a host can mirror each record into the
 * world it draws. Positions are native (x east, y north, z up) and headings are radians, as CEntity keeps them. */
/** eObjectType, CObject::m_nObjectType: a script that runs as a mission creates OBJECT_MISSION, an external one
 * OBJECT_MISSION2; CTheScripts::CleanUpThisObject turns either into OBJECT_TEMPORARY. */
export const OBJECT_MISSION=2,OBJECT_TEMPORARY=3,OBJECT_MISSION2=6;
/** CObject::IsMissionObject. */
export const isMissionObjectType=(type:number)=>type===OBJECT_MISSION||type===OBJECT_MISSION2;
/** CPools' object pool holds this many; the script never comes close. */
export const MAX_SCRIPT_OBJECTS=350;
/** eObjectColDamageEffect: nothing happens on a collision, the default a new object takes. */
export const COL_DAMAGE_EFFECT_NONE=0,COL_DAMAGE_EFFECT_SMASH_COMPLETELY=4;
/** CObject::Init's m_fHealth. */
export const DEFAULT_OBJECT_HEALTH=1000;
/** eObjectColDamageEffect's values ObjectDamage acts on (OBJECT.DAT's column 9). */
const EFFECT_CHANGE_MODEL=1,EFFECT_SMASH_COMPLETELY=20,EFFECT_CHANGE_THEN_SMASH=21,EFFECT_BREAKABLE=200,EFFECT_BREAKABLE_REMOVED=202;
/** What CObjectData::SetObjectData copies from a model's OBJECT.DAT row; a model without one gets the default
 * object info (a multiplier of one, no effect) and 99999 of mass. */
export interface ScmObjectInfo {colDamageEffect:number;colDamageMultiplier:number;smashMultiplier:number;mass:number}
/** Who did the damage, as far as ObjectDamage asks: the player's ped or vehicle pass bInvulnerable. */
export type ScmObjectDamager='player'|'playerVehicle'|'vehicle'|'other'|undefined;
/** What ObjectDamage did: bWasDestroyed, whether the object lost its collision and was hidden, whether its model
 * swapped to the damaged one, and whether it went to the break manager (with bJustFaces). */
export interface ScmObjectDamageResult {destroyed:boolean;removed:boolean;changedModel:boolean;broken?:{justFaces:boolean}}
/** eWeaponType's WEAPON_UNIDENTIFIED and WEAPON_RUNOVERBYCAR. */
const WEAPON_UNIDENTIFIED=55,WEAPON_RUNOVERBYCAR=50;
export interface ScmObject {
 handle:number;model:number|string;
 position:{x:number;y:number;z:number};
 /** CObject::objectFlags.bIsPhotographed, which TakePhotograph sets and HAS_OBJECT_BEEN_PHOTOGRAPHED reads. */
 photographed?:boolean;
 /** CEntity heading, radians, and the full orientation SET_OBJECT_ROTATION gives it. */
 heading:number;rotation:{x:number;y:number;z:number};
 /** CPhysical::m_vecMoveSpeed, native units per frame. */
 velocity:{x:number;y:number;z:number};
 scale:number;usesCollision:boolean;objectType:number;
 /** CObject::m_fHealth, which CObject::Init sets to a thousand, and whether anything has taken any of it. */
 health:number;damaged:boolean;
 /** CObject::m_nLastWeaponDamage: the weapon type of the last ObjectDamage that reached the effect, -1 (255) for none. */
 lastWeaponDamage:number;
 /** CEntity::m_bRenderDamaged: the model has swapped to its damaged atomic. */
 renderDamaged:boolean;
 /** objectFlags.bIsBroken: the break manager took it. */
 broken:boolean;
 /** objectFlags.bIsTargetable, which MAKE_OBJECT_TARGETTABLE sets. */
 targetable:boolean;
 /** physicalFlags.bInvulnerable, which SET_OBJECT_ONLY_DAMAGED_BY_PLAYER sets: only the player's ped or vehicle
  * set off the damage effect (the health still goes down). */
 onlyDamagedByPlayer:boolean;
 /** m_pObjectInfo's m_fColDamageMultiplier and m_fSmashMultiplier, and m_fMass. */
 colDamageMultiplier:number;smashMultiplier:number;mass:number;
 /** CEntity::bIsVisible, which SET_OBJECT_VISIBLE clears. */
 visible:boolean;
 /** CEntity::m_pAttachedTo with its offset and rotation: what the object hangs from and where on it. The
  * offset is in the host's own axes and the rotation is three angles about them, as the commands give them. */
 attachedTo?:{kind:'vehicle'|'ped'|'object';handle:number;offset:{x:number;y:number;z:number};rotation:{x:number;y:number;z:number}};
 /** The whole matrix, native rows, when something other than the heading and three angles sets it: the hand bone
  * of a ped holding the object (CTaskSimpleHoldEntity::SetPedPosition copies the bone's matrix). */
 matrix?:{right:{x:number;y:number;z:number};forward:{x:number;y:number;z:number};up:{x:number;y:number;z:number}};
 /** CTaskSimpleHoldEntity on the ped holding it: the ped's handle (the player's is 1), the offset, the PED_NODE the
  * object follows, the bone flags and m_fRotation (the object's heading less the ped's when it was taken). */
 heldBy?:{ped:number;offset:{x:number;y:number;z:number};node:number;flags:number;rotation:number};
 /** CEntity::m_nAreaCode, which SET_OBJECT_AREA_VISIBLE sets as the char command sets a ped's. */
 areaCode:number;
 /** CEntity::m_pLod, the object this one is the detailed version of, as a handle. */
 lod?:number;
 /** CObject::m_nColDamageEffect: what a collision does to the object; smashing starts at four. */
 colDamageEffect:number;
 /** CPhysical::physicalFlags.bDontApplySpeed, which FREEZE_CHAR_POSITION sets for a ped. */
 dontApplySpeed:boolean;
 /** CEntity::m_bIsStatic, the inverse of what SET_OBJECT_DYNAMIC asks for. */
 isStatic:boolean;
 /** CPhysical::physicalFlags' five proofs, in the order SET_CAR_PROOFS and SET_CHAR_PROOFS take them. */
 proofs:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean};
 /** CTheScripts::MissionCleanUp holds the object while this is set; DONT_REMOVE_OBJECT takes it off the list. */
 missionCleanup:boolean;
}
/** FixAngleDegrees (Scripts/CommandParser/Utility.hpp): one step either way, not a modulo. */
export function fixAngleDegrees(degrees:number){
 if(degrees<0)return degrees+360;
 if(degrees>360)return degrees-360;
 return degrees;
}
const DEG=Math.PI/180;
/** The script's objects. Handles are never reused while an object lives, as a pool handle carries a slot and a
 * reuse counter; a deleted object's handle stops existing, which is what DOES_OBJECT_EXIST reports. */
export class ScmObjects {
 /** CObjectData::SetObjectData's lookup, which the host fills from OBJECT.DAT once it is read. */
 objectInfo?:(model:number|string)=>ScmObjectInfo|undefined;
 private readonly objects=new Map<number,ScmObject>();
 private nextHandle=1;
 get count(){return this.objects.size;}
 get handles(){return [...this.objects.keys()];}
 /** Every record, for a host mirroring them into the world it draws. */
 get all():readonly ScmObject[]{return [...this.objects.values()];}
 /** CreateObject: the script's object at a position. CREATE_OBJECT drops the point to the ground and lifts the
  * object by the distance from its centre of mass to the base of its model; CREATE_OBJECT_NO_OFFSET does
  * neither, so the host's ground and base-offset lookups are only needed by the first. */
 create(model:number|string,position:{x:number;y:number;z:number},options:{external:boolean;missionCleanup:boolean}){
  requireAsset(this.objects.size<MAX_SCRIPT_OBJECTS,'Script object pool is full.');
  requireAsset(Number.isFinite(position.x)&&Number.isFinite(position.y)&&Number.isFinite(position.z),'Invalid script object position.');
  const handle=this.nextHandle++;
  const object:ScmObject={handle,model,position:{...position},heading:0,rotation:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},scale:1,usesCollision:true,
   objectType:options.external?OBJECT_MISSION2:OBJECT_MISSION,areaCode:0,colDamageEffect:COL_DAMAGE_EFFECT_NONE,dontApplySpeed:false,isStatic:true,
   health:DEFAULT_OBJECT_HEALTH,damaged:false,visible:true,lastWeaponDamage:-1,renderDamaged:false,broken:false,targetable:false,onlyDamagedByPlayer:false,
   colDamageMultiplier:1,smashMultiplier:1,mass:99999,
   proofs:{bullet:false,fire:false,explosion:false,collision:false,melee:false},missionCleanup:options.missionCleanup};
  // CObject::Init -> CObjectData::SetObjectData. A model with a heavy row (99998 or more) and no effect is explosion
  // proof, as one without a row is.
  if(this.objectInfo){
   const info=this.objectInfo(model);
   if(info){
    object.colDamageEffect=info.colDamageEffect;object.colDamageMultiplier=info.colDamageMultiplier;object.smashMultiplier=info.smashMultiplier;object.mass=info.mass;
    if(info.mass>=99998&&!info.colDamageEffect)object.proofs.explosion=true;
   }else object.proofs.explosion=true;
  }
  this.objects.set(handle,object);
  return object;
 }
 /** DoesObjectExists: a handle the script still holds after its object went is simply not there. */
 exists(handle:number){return this.objects.has(handle);}
 at(handle:number){
  const object=this.objects.get(handle);
  requireAsset(object,`No script object with handle ${handle}.`);
  return object!;
 }
 /** RemoveObject: CWorld::Remove and the deletion, plus the cleanup-list entry. */
 remove(handle:number){this.objects.delete(handle);}
 /** SET_OBJECT_HEALTH: CObject keeps its health at nothing or above, and anything taken counts as damage. */
 setHealth(handle:number,health:number){
  const object=this.at(handle);
  if(health<object.health)object.damaged=true;
  object.health=Math.max(0,health);
 }
 /** CObject::ObjectDamage (0x5A0D90, reversed) on a script object. Not here: the crack palace wall's SWAT van
  * rule and the forklift's exemption (a host passes neither), and what the destruction sets off (TryToExplode,
  * the sound, the FX), which the host runs from the result. */
 damage(handle:number,damage:number,weaponType:number,damager:ScmObjectDamager):ScmObjectDamageResult{
  const object=this.at(handle),out:ScmObjectDamageResult={destroyed:false,removed:false,changedModel:false};
  requireAsset(Number.isFinite(damage)&&Number.isInteger(weaponType),'Invalid object damage.');
  if(!object.usesCollision)return out;
  if(weaponType===WEAPON_UNIDENTIFIED&&(damager==='vehicle'||damager==='playerVehicle'))weaponType=WEAPON_RUNOVERBYCAR;
  if(!physicalCanBeDamaged(object.proofs,weaponType))return out;
  const scaled=damage*object.colDamageMultiplier;
  object.health=Math.max(0,object.health-scaled);
  if(scaled>0)object.damaged=true;
  if(!object.colDamageEffect||object.onlyDamagedByPlayer&&damager!=='player'&&damager!=='playerVehicle')return out;
  object.lastWeaponDamage=weaponType;
  if(!(scaled>150||object.health===0))return out;
  const smash=()=>{object.usesCollision=false;object.visible=false;object.isStatic=true;object.proofs.explosion=true;object.velocity={x:0,y:0,z:0};out.removed=true;out.destroyed=true;};
  switch(object.colDamageEffect){
   case EFFECT_CHANGE_MODEL:if(!object.renderDamaged){out.destroyed=true;out.changedModel=true;}object.renderDamaged=true;break;
   case EFFECT_SMASH_COMPLETELY:smash();break;
   case EFFECT_CHANGE_THEN_SMASH:if(object.renderDamaged)smash();else{object.renderDamaged=true;out.changedModel=true;}break;
   case EFFECT_BREAKABLE:case EFFECT_BREAKABLE_REMOVED:
    out.broken={justFaces:scaled>object.smashMultiplier*150};smash();object.broken=true;break;
  }
  if(!object.usesCollision&&!object.visible)object.health=0;
  return out;
 }
 /** HAS_OBJECT_BEEN_DAMAGED, as reVC's CRunningScript reads it: the damaged model shows, or the object is hidden. */
 hasBeenDamaged(handle:number){const object=this.at(handle);return object.renderDamaged||!object.visible;}
 /** CLEAR_OBJECT_LAST_WEAPON_DAMAGE. */
 clearLastWeaponDamage(handle:number){this.at(handle).lastWeaponDamage=-1;}
 /** ATTACH_OBJECT_TO_CAR, _TO_CHAR and _TO_OBJECT: the object hangs from that entity at an offset. */
 attach(handle:number,kind:'vehicle'|'ped'|'object',other:number,offset:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number}){
  const object=this.at(handle);
  requireAsset([offset.x,offset.y,offset.z,rotation.x,rotation.y,rotation.z].every(Number.isFinite),'Invalid script object attachment.');
  object.attachedTo={kind,handle:other,offset:{...offset},rotation:{...rotation}};
 }
 /** DETACH_OBJECT: the object stops hanging and stays where it had got to. */
 detach(handle:number){this.at(handle).attachedTo=undefined;}
 isAttached(handle:number){return this.at(handle).attachedTo!==undefined;}
 /** GET_OBJECT_SPEED: m_vecMoveSpeed's magnitude times fifty, as the car command reads its own. */
 speed(handle:number){const v=this.at(handle).velocity;return Math.hypot(v.x,v.y,v.z)*50;}
 /** DoNotRemoveObject: the object comes off the mission cleanup list. */
 releaseFromCleanup(handle:number){if(this.objects.has(handle))this.at(handle).missionCleanup=false;}
 /** MarkObjectNoLongerNeeded: CTheScripts::CleanUpThisObject leaves a mission object in the world as OBJECT_TEMPORARY
  * (its m_nRemovalTime twenty thousand seconds on, which the game never reaches), no longer the mission's, and it
  * comes off the cleanup list as DoNotRemoveObject takes it. */
 markNoLongerNeeded(handle:number){
  if(!this.objects.has(handle))return;
  const object=this.at(handle);
  if(isMissionObjectType(object.objectType))object.objectType=OBJECT_TEMPORARY;
  object.missionCleanup=false;
 }
 /** SetObjectHeading: the degrees are fixed once into range before they become radians. */
 setHeading(handle:number,degrees:number){this.at(handle).heading=fixAngleDegrees(degrees)*DEG;}
 /** SET_OBJECT_ROTATION: CPlaceable::SetOrientation's three angles, degrees in and radians kept, with the
  * heading following the one about the vertical axis. */
 setRotation(handle:number,x:number,y:number,z:number){
  const object=this.at(handle);
  object.rotation={x:x*DEG,y:y*DEG,z:z*DEG};object.heading=fixAngleDegrees(z)*DEG;
 }
 /** GetObjectHeading: radians back to fixed degrees. */
 getHeading(handle:number){return fixAngleDegrees(this.at(handle).heading/DEG);}
 /** SetObjectVelocity: the command's units are per second, the field's per frame at fifty a second. */
 setVelocity(handle:number,velocity:{x:number;y:number;z:number}){
  const object=this.at(handle);object.velocity={x:velocity.x/50,y:velocity.y/50,z:velocity.z/50};
 }
 getVelocity(handle:number){const v=this.at(handle).velocity;return {x:v.x*50,y:v.y*50,z:v.z*50};}
 setPosition(handle:number,position:{x:number;y:number;z:number}){this.at(handle).position={...position};}
 setScale(handle:number,scale:number){requireAsset(Number.isFinite(scale),'Invalid object scale.');this.at(handle).scale=scale;}
 /** CMatrix::SetRotate (Core/Matrix.cpp 0x59AD20 region, reversed): the object's own rows from its three
  * angles, which the object-space transform needs. */
 matrix(handle:number){
  const object=this.at(handle),{x,y,z}=object.rotation;
  const sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
  return {
   right:{x:cz*cy-sz*sx*sy,y:cz*sx*sy+sz*cy,z:-(sy*cx)},
   forward:{x:-(sz*cx),y:cz*cx,z:sx},
   up:{x:cz*sy+sz*sx*cy,y:sz*sy-cz*sx*cy,z:cy*cx},
   position:{...object.position},
  };
 }
 /** CONNECT_LODS: CEntity::SetLod, which points an object at the one it stands in for at a distance. */
 connectLods(handle:number,lodHandle:number){this.at(lodHandle);this.at(handle).lod=lodHandle;}
 /** SET_OBJECT_AREA_VISIBLE: the area the object is drawn in, the same field the ped command sets. */
 setAreaVisible(handle:number,area:number){this.at(handle).areaCode=area;}
 setUsesCollision(handle:number,enabled:boolean){this.at(handle).usesCollision=enabled;}
 hasModel(handle:number,model:number|string){return this.at(handle).model===model;}
 /** SET_OBJECT_COLLISION_DAMAGE_EFFECT: CObject::m_nColDamageEffect, a byte. */
 setColDamageEffect(handle:number,effect:number){
  requireAsset(Number.isInteger(effect)&&effect>=0&&effect<=255,'Invalid collision damage effect.');
  this.at(handle).colDamageEffect=effect;
 }
 /** FREEZE_OBJECT_POSITION: bDontApplySpeed, as the reversed FREEZE_CHAR_POSITION sets it for a ped. */
 freezePosition(handle:number,frozen:boolean){this.at(handle).dontApplySpeed=frozen;}
 /** SET_OBJECT_DYNAMIC: CEntity::SetIsStatic with the opposite of what the script asks for. */
 setDynamic(handle:number,dynamic:boolean){this.at(handle).isStatic=!dynamic;}
 /** SET_OBJECT_PROOFS: the five physicalFlags the reversed SET_CAR_PROOFS and SET_CHAR_PROOFS set. */
 setProofs(handle:number,proofs:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}){
  this.at(handle).proofs={...proofs};
 }
}
