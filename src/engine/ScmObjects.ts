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
 /** CPhysical::m_vecTurnSpeed, radians per frame about the native axes. */
 turnSpeed:{x:number;y:number;z:number};
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
 /** CPhysical::m_fTurnMass as SET_OBJECT_TURN_MASS set it; otherwise OBJECT.DAT's (the host's). */
 turnMass?:number;
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
 heldBy?:{ped:number;offset:{x:number;y:number;z:number};node:number;flags:number;rotation:number;
  /** Held by TASK_PICK_UP_SECOND_OBJECT, on the ped's other partial task slot. */
  second?:boolean};
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
 /** SET_OBJECT_AS_STEALABLE: the player may pick it up with the enter/exit button and carry it. */
 stealable?:boolean;
 /** CPhysical::physicalFlags' five proofs, in the order SET_CAR_PROOFS and SET_CHAR_PROOFS take them. */
 proofs:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean};
 /** CTheScripts::MissionCleanUp holds the object while this is set; DONT_REMOVE_OBJECT takes it off the list. */
 missionCleanup:boolean;
 /** physicalFlags.bCanBeCollidedWith, which SET_OBJECT_RECORDS_COLLISIONS sets: whether the object keeps a record
  * of what it touches. */
 recordsCollisions?:boolean;
 /** The CAnimBlendAssociation PLAY_OBJECT_ANIM put on the object's clump, if any. */
 anim?:ScmObjectAnim;
 /** Set on an object that stands for a placement of the map (a dummy the game turns into a CObject as the player
  * nears it), which a script brain was started on: the map draws and collides it, so a host makes it no view. */
 worldPlacement?:string;
}
/** A clump's animation association as the object commands reach it: the hierarchy's name and block, m_CurrentTime
 * and m_Speed (seconds), ANIMATION_LOOPED and ANIMATION_STARTED, whether it fades out once done, and the hierarchy's
 * m_fTotalTime once the host has the clip. `fading` counts down the -4 blend-out that ends in its deletion. */
export interface ScmObjectAnim {name:string;block:string;time:number;speed:number;loop:boolean;fadeOutWhenDone:boolean;running:boolean;length?:number;fading?:number}
/** A finished association that fades out does so at a blend delta of -4: a quarter second. */
const FADE_OUT_SECONDS=.25;
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
 /** Whether the model is a clump (the IDE's anim and hier sections) rather than a single atomic: only a clump takes
  * an animation. Unset, every model does. */
 clumpModel?:(model:number|string)=>boolean;
 private readonly objects=new Map<number,ScmObject>();
 private nextHandle=1;
 /** The objects handed to g_breakMan since the host last looked, each with BreakObject_c::Init's bJustFaces: the
  * host spawns the pieces from the model while it still has it. */
 readonly broken:{handle:number;justFaces:boolean}[]=[];
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
  const object:ScmObject={handle,model,position:{...position},heading:0,rotation:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},turnSpeed:{x:0,y:0,z:0},scale:1,usesCollision:true,
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
 /** A CObject made from a placement of the map, which a script brain runs on: the handle the brain's script holds it
  * by. It is OBJECT_MAP-like: no mission cleanup and no view of its own. `heading` is degrees. */
 adoptWorld(model:number|string,position:{x:number;y:number;z:number},heading:number,placement:string){
  const object=this.create(model,position,{external:true,missionCleanup:false});
  object.objectType=OBJECT_TEMPORARY;object.heading=fixAngleDegrees(heading<0?heading+360:heading)*DEG;object.worldPlacement=placement;
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
  const smash=()=>{object.usesCollision=false;object.visible=false;object.isStatic=true;object.proofs.explosion=true;object.turnSpeed={x:0,y:0,z:0};object.velocity={x:0,y:0,z:0};object.turnSpeed={x:0,y:0,z:0};out.removed=true;out.destroyed=true;};
  switch(object.colDamageEffect){
   case EFFECT_CHANGE_MODEL:if(!object.renderDamaged){out.destroyed=true;out.changedModel=true;}object.renderDamaged=true;break;
   case EFFECT_SMASH_COMPLETELY:smash();break;
   case EFFECT_CHANGE_THEN_SMASH:if(object.renderDamaged)smash();else{object.renderDamaged=true;out.changedModel=true;}break;
   case EFFECT_BREAKABLE:case EFFECT_BREAKABLE_REMOVED:
    out.broken={justFaces:scaled>object.smashMultiplier*150};smash();object.broken=true;this.broken.push({handle,justFaces:out.broken.justFaces});break;
  }
  if(!object.usesCollision&&!object.visible)object.health=0;
  return out;
 }
 /** BREAK_OBJECT: ObjectDamage's breakable branch whatever the model's effect (WUZI5 breaks a padlock and CRASH1 a
  * window whose OBJECT.DAT rows have none, and DECON loops until HAS_OBJECT_BEEN_DAMAGED says it went), with the
  * command's second operand as bJustFaces. The handler is not in the reversed sources; this is what the scripts rely on. An object
  * already broken has no model left to break. */
 breakObject(handle:number,justFaces:boolean){
  const object=this.at(handle);
  if(!object.broken)this.broken.push({handle,justFaces});
  object.usesCollision=false;object.visible=false;object.isStatic=true;object.proofs.explosion=true;object.velocity={x:0,y:0,z:0};
  object.broken=true;object.health=0;
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
 /** CMissionCleanup::Process for objects: every object still on the mission's cleanup list is cleaned up as
  * MARK_OBJECT_AS_NO_LONGER_NEEDED would. */
 cleanUpMissionObjects(){for(const [handle,object] of this.objects)if(object.missionCleanup)this.markNoLongerNeeded(handle);}
 /** SetObjectHeading: the degrees are fixed once into range before they become radians. */
 setHeading(handle:number,degrees:number){const object=this.at(handle);object.heading=fixAngleDegrees(degrees)*DEG;object.matrix=undefined;}
 /** SET_OBJECT_ROTATION: CPlaceable::SetOrientation's three angles, degrees in and radians kept. The turn about the
  * vertical axis is the heading, which carries it (the tilts stay in `rotation`, whose z is left at nothing): keeping
  * it in both drew the object turned twice over. */
 setRotation(handle:number,x:number,y:number,z:number){
  const object=this.at(handle);
  object.rotation={x:x*DEG,y:y*DEG,z:0};object.heading=fixAngleDegrees(z)*DEG;object.matrix=undefined;
 }
 /** GetObjectHeading: radians back to fixed degrees. */
 getHeading(handle:number){return fixAngleDegrees(this.at(handle).heading/DEG);}
 /** SetObjectVelocity: the command's units are per second, the field's per frame at fifty a second. */
 setVelocity(handle:number,velocity:{x:number;y:number;z:number}){
  const object=this.at(handle);object.velocity={x:velocity.x/50,y:velocity.y/50,z:velocity.z/50};
 }
 /** ADD_TO_OBJECT_VELOCITY: the same units per second, added to m_vecMoveSpeed. */
 addToVelocity(handle:number,velocity:{x:number;y:number;z:number}){
  const object=this.at(handle),v=object.velocity;object.velocity={x:v.x+velocity.x/50,y:v.y+velocity.y/50,z:v.z+velocity.z/50};
 }
 getVelocity(handle:number){const v=this.at(handle).velocity;return {x:v.x*50,y:v.y*50,z:v.z*50};}
 /** SET_OBJECT_ROTATION_VELOCITY (CPhysical::SetTurnSpeed, as reVC's handler): radians a second about the native axes,
  * kept per frame at fifty a second. */
 setTurnSpeed(handle:number,speed:{x:number;y:number;z:number}){this.at(handle).turnSpeed={x:speed.x/50,y:speed.y/50,z:speed.z/50};}
 /** ADD_TO_OBJECT_ROTATION_VELOCITY: the same units, added to m_vecTurnSpeed. */
 addToTurnSpeed(handle:number,speed:{x:number;y:number;z:number}){
  const object=this.at(handle),w=object.turnSpeed;object.turnSpeed={x:w.x+speed.x/50,y:w.y+speed.y/50,z:w.z+speed.z/50};
 }
 /** GET_OBJECT_ROTATION_VELOCITY: m_vecTurnSpeed back in radians a second. */
 getTurnSpeed(handle:number){const w=this.at(handle).turnSpeed;return {x:w.x*50,y:w.y*50,z:w.z*50};}
 /** ADD_VELOCITY_RELATIVE_TO_OBJECT_VELOCITY (AUTHORED, the handler is unreversed): the speed given in the frame of the
  * object's own heading of travel on the ground (x to its right, y along it, z up), units a second, added to
  * m_vecMoveSpeed. POOL2 gives the cue ball its side and top spin this way the moment it strikes a ball. An object
  * standing still has no heading of travel and takes the speed in the world's axes. */
 addVelocityRelativeToVelocity(handle:number,speed:{x:number;y:number;z:number}){
  const object=this.at(handle),v=object.velocity,flat=Math.hypot(v.x,v.y);
  const forward=flat>0?{x:v.x/flat,y:v.y/flat}:{x:0,y:1},right={x:forward.y,y:-forward.x};
  object.velocity={x:v.x+(right.x*speed.x+forward.x*speed.y)/50,y:v.y+(right.y*speed.x+forward.y*speed.y)/50,z:v.z+speed.z/50};
 }
 setPosition(handle:number,position:{x:number;y:number;z:number}){this.at(handle).position={...position};}
 setScale(handle:number,scale:number){requireAsset(Number.isFinite(scale),'Invalid object scale.');this.at(handle).scale=scale;}
 /** The object's own rows, which the object-space transform needs: CMatrix::SetRotate (Core/Matrix.cpp 0x59AD20 region,
  * reversed) from its tilts and heading, or the whole matrix when something set one. */
 matrix(handle:number){
  const object=this.at(handle),{x,y}=object.rotation,z=object.heading+object.rotation.z;
  // A whole matrix set some other way (a holding ped's bone, a quaternion) is the object's own.
  if(object.matrix)return {right:{...object.matrix.right},forward:{...object.matrix.forward},up:{...object.matrix.up},position:{...object.position}};
  const sx=Math.sin(x),cx=Math.cos(x),sy=Math.sin(y),cy=Math.cos(y),sz=Math.sin(z),cz=Math.cos(z);
  return {
   right:{x:cz*cy-sz*sx*sy,y:cz*sx*sy+sz*cy,z:-(sy*cx)},
   forward:{x:-(sz*cx),y:cz*cx,z:sx},
   up:{x:cz*sy+sz*sx*cy,y:sz*sy-cz*sx*cy,z:cy*cx},
   position:{...object.position},
  };
 }
 /** GET_OBJECT_QUATERNION: CQuaternion::Set of the object's matrix (native axes; the rotation taking x, y, z to
  * its right, forward and up). */
 getQuaternion(handle:number){
  const m=this.matrix(handle);
  return quaternionFromRows(m.right,m.forward,m.up);
 }
 /** SET_OBJECT_QUATERNION: CQuaternion::Get into the object's matrix, the heading following its forward. */
 setQuaternion(handle:number,q:{x:number;y:number;z:number;w:number}){
  const object=this.at(handle);
  requireAsset([q.x,q.y,q.z,q.w].every(Number.isFinite),'Invalid object quaternion.');
  const l=Math.hypot(q.x,q.y,q.z,q.w)||1,x=q.x/l,y=q.y/l,z=q.z/l,r=q.w/l;
  const x2=x*2,y2=y*2,z2=z*2;
  object.matrix={right:{x:1-(z2*z+y2*y),y:z2*r+y2*x,z:z2*x-y2*r},forward:{x:y2*x-z2*r,y:1-(z2*z+x2*x),z:x2*r+z2*y},up:{x:y2*r+z2*x,y:z2*y-x2*r,z:1-(y2*y+x2*x)}};
  object.heading=Math.atan2(-object.matrix.forward.x,object.matrix.forward.y);
 }
 /** IS_OBJECT_IN_AREA_3D: CEntity::IsWithinArea, the corners taken either way round. */
 isInArea3d(handle:number,a:{x:number;y:number;z:number},b:{x:number;y:number;z:number}){
  const p=this.at(handle).position;
  return p.x>=Math.min(a.x,b.x)&&p.x<=Math.max(a.x,b.x)&&p.y>=Math.min(a.y,b.y)&&p.y<=Math.max(a.y,b.y)&&p.z>=Math.min(a.z,b.z)&&p.z<=Math.max(a.z,b.z);
 }
 /** SET_OBJECT_MASS and SET_OBJECT_TURN_MASS: CPhysical::m_fMass and m_fTurnMass. */
 setMass(handle:number,mass:number){requireAsset(Number.isFinite(mass)&&mass>0,'Invalid object mass.');this.at(handle).mass=mass;}
 setTurnMass(handle:number,turnMass:number){requireAsset(Number.isFinite(turnMass)&&turnMass>0,'Invalid object turn mass.');this.at(handle).turnMass=turnMass;}
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
 /** PLAY_OBJECT_ANIM: CAnimManager::BlendAnimation on the object's clump, whose RwObject must be a clump. The
  * association already playing that hierarchy is kept where it is, started again only once it has run to its end;
  * any other is blended out and goes. The fourth operand (lockF) keeps a finished one-shot on its last frame;
  * without it the association fades out when done, as a ped's does. The blend in itself is not drawn. */
 playAnim(handle:number,name:string,block:string,blendDelta:number,lockF:boolean,loop:boolean){
  const object=this.at(handle);
  requireAsset(!!name&&Number.isFinite(blendDelta),'Invalid object animation.');
  if(this.clumpModel&&!this.clumpModel(object.model))return;
  const found=this.animNamed(object,name);
  if(found){
   found.fading=undefined;
   if(!found.running&&found.length!==undefined&&found.time===found.length){found.time=0;found.running=true;}
   return;
  }
  object.anim={name,block,time:0,speed:1,loop,fadeOutWhenDone:!lockF,running:true};
 }
 /** RpAnimBlendClumpGetAssociation by name: hierarchy names are compared by their upper-case keys. */
 private animNamed(object:ScmObject,name:string){const anim=object.anim;return anim&&anim.name.toUpperCase()===name.toUpperCase()?anim:undefined;}
 /** The host's CAnimBlendHierarchy::m_fTotalTime for the association playing that clip, once it has it. */
 setAnimLength(handle:number,name:string,length:number){
  const anim=this.objects.get(handle)&&this.animNamed(this.at(handle),name);
  if(anim&&Number.isFinite(length)&&length>=0)anim.length=length;
 }
 /** IS_OBJECT_PLAYING_ANIM: the clump has an association under that name, fading or not. */
 isPlayingAnim(handle:number,name:string){return !!this.animNamed(this.at(handle),name);}
 /** SET_OBJECT_ANIM_SPEED: m_Speed. */
 setAnimSpeed(handle:number,name:string,speed:number){const anim=this.animNamed(this.at(handle),name);if(anim)anim.speed=speed;}
 /** GET_OBJECT_ANIM_CURRENT_TIME: m_CurrentTime over the hierarchy's total time; nothing without the association. */
 animProgress(handle:number,name:string){const anim=this.animNamed(this.at(handle),name);return anim?.length?anim.time/anim.length:0;}
 /** SET_OBJECT_ANIM_CURRENT_TIME: CAnimBlendAssociation::SetCurrentTime of m_Speed times the progress, as the object
  * handler has it (the char handler scales by the total time), wrapped for a loop and held at the end otherwise. */
 setAnimProgress(handle:number,name:string,progress:number){
  const anim=this.animNamed(this.at(handle),name);if(!anim)return;
  anim.time=anim.speed*progress;
  const length=anim.length;if(!length)return;
  if(anim.time>=length)anim.time=anim.loop?anim.time%length:length;
 }
 /** CAnimBlendAssociation::UpdateTime and UpdateBlend for each object's association over a step of `seconds`: the
  * time runs at m_Speed; at the end a loop wraps, and a one-shot stops there and, fading out when done, goes a
  * quarter second later. Nothing runs past the end until the host has the clip's length. */
 advanceAnims(seconds:number){
  for(const object of this.objects.values()){
   const anim=object.anim;if(!anim)continue;
   if(anim.fading!==undefined){anim.fading-=seconds;if(anim.fading<=0)object.anim=undefined;continue;}
   if(!anim.running)continue;
   anim.time+=anim.speed*seconds;
   const length=anim.length;if(length===undefined||anim.time<length)continue;
   if(anim.loop)anim.time=length>0?anim.time%length:0;
   else{anim.time=length;anim.running=false;if(anim.fadeOutWhenDone)anim.fading=FADE_OUT_SECONDS;}
  }
 }
 /** SET_OBJECT_PROOFS: the five physicalFlags the reversed SET_CAR_PROOFS and SET_CHAR_PROOFS set. */
 setProofs(handle:number,proofs:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean}){
  this.at(handle).proofs={...proofs};
 }
}
/** The unit quaternion of the rotation whose columns are these three native axes (Shepperd's method). */
export function quaternionFromRows(right:{x:number;y:number;z:number},forward:{x:number;y:number;z:number},up:{x:number;y:number;z:number}){
 const m00=right.x,m10=right.y,m20=right.z,m01=forward.x,m11=forward.y,m21=forward.z,m02=up.x,m12=up.y,m22=up.z,trace=m00+m11+m22;
 let x:number,y:number,z:number,w:number;
 if(trace>0){const s=Math.sqrt(trace+1)*2;w=s/4;x=(m21-m12)/s;y=(m02-m20)/s;z=(m10-m01)/s;}
 else if(m00>m11&&m00>m22){const s=Math.sqrt(1+m00-m11-m22)*2;w=(m21-m12)/s;x=s/4;y=(m01+m10)/s;z=(m02+m20)/s;}
 else if(m11>m22){const s=Math.sqrt(1+m11-m00-m22)*2;w=(m02-m20)/s;x=(m01+m10)/s;y=s/4;z=(m12+m21)/s;}
 else{const s=Math.sqrt(1+m22-m00-m11)*2;w=(m10-m01)/s;x=(m02+m20)/s;y=(m12+m21)/s;z=s/4;}
 return {x,y,z,w};
}
