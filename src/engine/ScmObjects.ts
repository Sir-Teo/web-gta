import {requireAsset} from '../assets/binary';
/* The script's own CObjects, pinned gta-reversed ead3051 (`ObjectCommands.cpp`'s Object namespace, which is
 * reversed, over `CObject::Create` and the CEntity/CPhysical fields each command reaches). The table stands in
 * for CPools' object pool: it holds what the script can read back, so a host can mirror each record into the
 * world it draws. Positions are native (x east, y north, z up) and headings are radians, as CEntity keeps them. */
/** CObject::m_nObjectType: a script that runs as a mission creates OBJECT_MISSION, an external one OBJECT_MISSION2. */
export const OBJECT_MISSION=2,OBJECT_MISSION2=3;
/** CPools' object pool holds this many; the script never comes close. */
export const MAX_SCRIPT_OBJECTS=350;
/** eObjectColDamageEffect: nothing happens on a collision, the default a new object takes. */
export const COL_DAMAGE_EFFECT_NONE=0,COL_DAMAGE_EFFECT_SMASH_COMPLETELY=4;
export interface ScmObject {
 handle:number;model:number|string;
 position:{x:number;y:number;z:number};
 /** CEntity heading, radians, and the full orientation SET_OBJECT_ROTATION gives it. */
 heading:number;rotation:{x:number;y:number;z:number};
 /** CPhysical::m_vecMoveSpeed, native units per frame. */
 velocity:{x:number;y:number;z:number};
 scale:number;usesCollision:boolean;objectType:number;
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
 private readonly objects=new Map<number,ScmObject>();
 private nextHandle=1;
 get count(){return this.objects.size;}
 get handles(){return [...this.objects.keys()];}
 /** CreateObject: the script's object at a position. CREATE_OBJECT drops the point to the ground and lifts the
  * object by the distance from its centre of mass to the base of its model; CREATE_OBJECT_NO_OFFSET does
  * neither, so the host's ground and base-offset lookups are only needed by the first. */
 create(model:number|string,position:{x:number;y:number;z:number},options:{external:boolean;missionCleanup:boolean}){
  requireAsset(this.objects.size<MAX_SCRIPT_OBJECTS,'Script object pool is full.');
  requireAsset(Number.isFinite(position.x)&&Number.isFinite(position.y)&&Number.isFinite(position.z),'Invalid script object position.');
  const handle=this.nextHandle++;
  const object:ScmObject={handle,model,position:{...position},heading:0,rotation:{x:0,y:0,z:0},velocity:{x:0,y:0,z:0},scale:1,usesCollision:true,
   objectType:options.external?OBJECT_MISSION2:OBJECT_MISSION,areaCode:0,colDamageEffect:COL_DAMAGE_EFFECT_NONE,dontApplySpeed:false,isStatic:true,
   proofs:{bullet:false,fire:false,explosion:false,collision:false,melee:false},missionCleanup:options.missionCleanup};
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
 /** MarkObjectNoLongerNeeded / DoNotRemoveObject: both take the object off the mission cleanup list; the first
  * also hands it to CTheScripts::CleanUpThisObject, which leaves it in the world for the streamer to reclaim. */
 releaseFromCleanup(handle:number){if(this.objects.has(handle))this.at(handle).missionCleanup=false;}
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
