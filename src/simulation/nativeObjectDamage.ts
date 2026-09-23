import {requireAsset} from '../assets/binary';

/* CObject::ObjectDamage (Entity/Object/Object.cpp) and the static-object branch
 * of CPhysical::ApplyCollision (Entity/Physical.cpp), pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166. Native units throughout: mass in
 * handling units, velocities in units per 1/50 s frame, so an intensity is
 * an impulse in mass x units/frame. */

/** eObjectColDamageEffect (OBJECT.DAT column 9). */
export const COL_DAMAGE_EFFECT={none:0,changeModel:1,splitModel:2,smashCompletely:20,changeThenSmash:21,breakable:200,breakableRemoved:202} as const;
/** CObject's constructor health. */
export const OBJECT_START_HEALTH=1000;
/** ApplyCollision only calls ObjectDamage above this object damage. */
export const OBJECT_DAMAGE_GATE=20;
/** ObjectDamage applies the damage effect above this scaled damage (or at zero health). */
export const OBJECT_EFFECT_THRESHOLD=150;
/** CAutomobile and CBike constructors. */
export const VEHICLE_ELASTICITY=.05;

/** CObject health, m_bRenderDamaged, the collision-off state and objectFlags.bIsExploded. */
export interface NativeObjectState {health:number;renderDamaged:boolean;destroyed:boolean;exploded:boolean}
export const newObjectState=():NativeObjectState=>({health:OBJECT_START_HEALTH,renderDamaged:false,destroyed:false,exploded:false});

/** Result of one ObjectDamage call. `removed` means collision and visibility were
 * turned off; `destroyed` is bWasDestroyed, which also covers the first model swap
 * and drives TryToExplode, the destruction sound and the destroyed FX. */
export interface ObjectDamageResult {removed:boolean;changedModel:boolean;destroyed:boolean}

/** CObject::ObjectDamage for an ordinary object. Invulnerability, the crack
 * palace wall, forklifts, explosions and break-piece spawning are outside it. */
export function objectDamage(state:NativeObjectState,damage:number,effect:number,colDamageMultiplier:number):ObjectDamageResult{
 requireAsset([damage,effect,colDamageMultiplier].every(Number.isFinite),'Invalid object damage input.');
 const out={removed:false,changedModel:false,destroyed:false};
 if(state.destroyed)return out;
 const scaled=damage*colDamageMultiplier;
 state.health=Math.max(0,state.health-scaled);
 if(!effect)return out;
 if(!(scaled>OBJECT_EFFECT_THRESHOLD||state.health===0))return out;
 switch(effect){
  case COL_DAMAGE_EFFECT.changeModel:
   if(!state.renderDamaged)out.changedModel=out.destroyed=true;
   state.renderDamaged=true;break;
  case COL_DAMAGE_EFFECT.smashCompletely:
   out.removed=true;break;
  case COL_DAMAGE_EFFECT.changeThenSmash:
   if(state.renderDamaged)out.removed=true;else{state.renderDamaged=true;out.changedModel=true;}
   break;
  case COL_DAMAGE_EFFECT.breakable:case COL_DAMAGE_EFFECT.breakableRemoved:
   out.removed=true;break;
 }
 if(out.removed){out.destroyed=true;state.destroyed=true;state.health=0;}
 return out;
}

/** eObjectFxType (OBJECT.DAT column 12). */
export const OBJECT_FX={none:0,playOnHit:1,playOnDestroyed:2,playOnHitDestroyed:3} as const;
/** The particle tail of CObject::ObjectDamage: whether the object's FX system
 * plays for this damage. An object that exploded plays the explosion instead. */
export function objectDamagePlaysFx(fxType:number,damage:number,destroyed:boolean,exploded:boolean){
 if(destroyed&&exploded)return false;
 switch(fxType){
  case OBJECT_FX.playOnHitDestroyed:return true;
  case OBJECT_FX.playOnDestroyed:return destroyed;
  case OBJECT_FX.playOnHit:return damage>30;
  default:return false;
 }
}

type V3={x:number;y:number;z:number};
const dot=(a:V3,b:V3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:V3,b:V3):V3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});

export interface VehicleObjectImpact {
 /** Handling mass and turn mass. */
 mass:number;turnMass:number;
 /** Contact point relative to the centre of mass, units. */
 offset:V3;
 /** Contact normal pointing from the object towards the vehicle, unit length. */
 normal:V3;
 /** Pre-impact linear (units/frame) and angular (radians/frame) velocity. */
 moveSpeed:V3;turnSpeed:V3;
 /** CVehicle::IsSubBike: bikes deal triple object damage. */
 bike?:boolean;
 /** CPhysical::GetHasHitWall: no elasticity term after a wall hit. */
 hitWall?:boolean;
}
export interface VehicleObjectOutcome {
 /** The vehicle is not closing on the object: no collision response. */
 separating:boolean;
 /** thisDamageIntensity in mass x units/frame. */
 intensity:number;
 /** ObjectDamage ran (object damage above 20 with a damage effect). */
 damaged:boolean;
 /** The damage passed to ObjectDamage: intensity, tripled for bikes. */
 objectDamage?:number;
 damage?:ObjectDamageResult;
 /** When the object was removed, the only impulse the vehicle receives, applied at `offset`. */
 impulse?:V3;
 /** The prop stays and resolves as a wall: impact at or below its uproot limit. */
 wall:boolean;
 /** The impact exceeded the uproot limit and would unfreeze the object. */
 uprooted:boolean;
}

/** The static-object branch of CPhysical::ApplyCollision for a vehicle hitting
 * an OBJECT.DAT prop. */
export function vehicleHitsObject(impact:VehicleObjectImpact,state:NativeObjectState,object:{effect:number;colDamageMultiplier:number;uprootLimit:number;mass?:number}):VehicleObjectOutcome{
 const {mass,turnMass,offset,normal,moveSpeed,turnSpeed}=impact;
 requireAsset(mass>0&&turnMass>0,'Vehicle mass and turn mass must be positive.');
 const pointSpeed={x:moveSpeed.x+turnSpeed.y*offset.z-turnSpeed.z*offset.y,y:moveSpeed.y+turnSpeed.z*offset.x-turnSpeed.x*offset.z,z:moveSpeed.z+turnSpeed.x*offset.y-turnSpeed.y*offset.x};
 const closing=dot(pointSpeed,normal);
 if(closing>=0)return {separating:true,intensity:0,damaged:false,wall:false,uprooted:false};
 const arm=cross(offset,normal),collisionMass=1/(dot(arm,arm)/turnMass+1/mass);
 const intensity=impact.hitWall?-collisionMass*closing:-(VEHICLE_ELASTICITY+1)*collisionMass*closing;
 const damageMultiplier=impact.bike?3:1,objectHit=damageMultiplier*intensity;
 let damaged=false,damage:ObjectDamageResult|undefined;
 if(object.effect&&objectHit>OBJECT_DAMAGE_GATE){
  damaged=true;damage=objectDamage(state,objectHit,object.effect,object.colDamageMultiplier);
  if(damage.removed){
   // ApplyForce(normal * intensity / (2 * multiplier)) replaces the collision response.
   const share=intensity/(2*object.colDamageMultiplier);
   return {separating:false,intensity,damaged,objectDamage:objectHit,damage,impulse:{x:normal.x*share,y:normal.y*share,z:normal.z*share},wall:false,uprooted:false};
  }
 }
 // CObjectData::SetObjectData: a mass of 99998 or more sets bDisableCollisionForce.
 const wall=(object.mass??0)>=99998||object.uprootLimit>=9999||intensity<=object.uprootLimit;
 return {separating:false,intensity,damaged,objectDamage:damaged?objectHit:undefined,damage,wall,uprooted:!wall};
}

/** One body in the general branch of CPhysical::ApplyCollision. Native units;
 * `offset` is the contact point relative to the centre of mass. */
export interface CollisionBody {mass:number;turnMass:number;elasticity:number;offset:V3;moveSpeed:V3;turnSpeed:V3;hitWall?:boolean}
const pointSpeed=(b:CollisionBody):V3=>({x:b.moveSpeed.x+b.turnSpeed.y*b.offset.z-b.turnSpeed.z*b.offset.y,y:b.moveSpeed.y+b.turnSpeed.z*b.offset.x-b.turnSpeed.x*b.offset.z,z:b.moveSpeed.z+b.turnSpeed.x*b.offset.y-b.turnSpeed.y*b.offset.x});
const collisionMass=(b:CollisionBody,normal:V3)=>{const arm=cross(b.offset,normal);return 1/(dot(arm,arm)/b.turnMass+1/b.mass);};
/** The general two-body branch of CPhysical::ApplyCollision with both turn forces
 * enabled and mass factors of one. `normal` points from `entity` towards `self`.
 * Returns the impulses ApplyForce gives each body, or undefined when they separate.
 * The vehicle adjustments are left to the caller. */
export function twoBodyCollision(self:CollisionBody,entity:CollisionBody,normal:V3){
 const vA=dot(pointSpeed(self),normal),vB=dot(pointSpeed(entity),normal),mA=collisionMass(self,normal),mB=collisionMass(entity,normal);
 const common=(mB*vB+mA*vA)/(mB+mA);
 if(vA-common>=0)return undefined;
 const e=(entity.elasticity+self.elasticity)*.5;
 const afterA=self.hitWall?common:common-e*(vA-common),afterB=entity.hitWall?common:common-(vB-common)*e;
 const intensityA=(afterA-vA)*mA,intensityB=-((afterB-vB)*mB);
 return {intensityA,intensityB,self:{x:normal.x*intensityA,y:normal.y*intensityA,z:normal.z*intensityA},entity:{x:-normal.x*intensityB,y:-normal.y*intensityB,z:-normal.z*intensityB}};
}

/** A vehicle uprooting a static OBJECT.DAT prop: the static branch unfreezes the
 * object, pushes the vehicle back by 0.2 x intensity when the uproot limit is
 * above 200, and the same collision then resolves through the general branch.
 * `car.offset` is relative to its centre of mass; `armFromPosition` and `com`
 * give the vehicle's contact point and centre of mass relative to its position,
 * because the player's vehicle applies its force at 0.8 of that point. */
export function vehicleUprootsObject(car:CollisionBody&{player?:boolean;armFromPosition:V3;com:V3},object:CollisionBody,normal:V3,intensity:number,uprootLimit:number){
 let move={...car.moveSpeed},turn={...car.turnSpeed};
 const apply=(force:V3,arm:V3)=>{const dv=impulseVelocityChange(force,arm,car.mass,car.turnMass);move={x:move.x+dv.move.x,y:move.y+dv.move.y,z:move.z+dv.move.z};turn={x:turn.x+dv.turn.x,y:turn.y+dv.turn.y,z:turn.z+dv.turn.z};};
 if(uprootLimit>200){const f=.2*intensity;apply({x:normal.x*f,y:normal.y*f,z:normal.z*f},car.offset);}
 const hit=twoBodyCollision({...car,moveSpeed:move,turnSpeed:turn},object,normal);
 if(hit){
  const force={...hit.self};
  if(!car.hitWall){
   if(normal.z<.7)force.z*=.3;
   // !GetStatus(): STATUS_PLAYER scales the lever arm from the vehicle position.
   const arm=car.player?{x:car.armFromPosition.x*.8-car.com.x,y:car.armFromPosition.y*.8-car.com.y,z:car.armFromPosition.z*.8-car.com.z}:car.offset;
   apply(force,arm);
  }else apply(force,car.offset);
 }
 const objectDv=hit?impulseVelocityChange(hit.entity,object.offset,object.mass,object.turnMass):{move:{x:0,y:0,z:0},turn:{x:0,y:0,z:0}};
 return {car:{move,turn},object:{move:{x:object.moveSpeed.x+objectDv.move.x,y:object.moveSpeed.y+objectDv.move.y,z:object.moveSpeed.z+objectDv.move.z},turn:{x:object.turnSpeed.x+objectDv.turn.x,y:object.turnSpeed.y+objectDv.turn.y,z:object.turnSpeed.z+objectDv.turn.z}}};
}

/** Velocity change for an impulse applied at `offset`, with SA's scalar turn mass. Native units. */
export function impulseVelocityChange(impulse:V3,offset:V3,mass:number,turnMass:number){
 const torque=cross(offset,impulse);
 return {move:{x:impulse.x/mass,y:impulse.y/mass,z:impulse.z/mass},turn:{x:torque.x/turnMass,y:torque.y/turnMass,z:torque.z/turnMass}};
}

/** The object branch of CWeapon::DoBulletImpact (Weapon.cpp). Props below the
 * breakable effects are pushed: a static prop with no uproot limit unfreezes, and a
 * moving one takes ApplyForce(normal x -2) at the hit point, a fifth of that for
 * shotgun pellets. Breakables take ObjectDamage by OBJECT.DAT gun-break mode:
 * 50, 151, or 151 x smash multiplier. */
export function bulletHitsObject(object:{effect:number;colDamageMultiplier:number;uprootLimit:number;mass?:number;gunBreakMode?:number;smashMultiplier?:number},isStatic:boolean,incremental:boolean):{damage?:number;unfreeze:boolean;force?:number}{
 if(object.effect<COL_DAMAGE_EFFECT.breakable){
  // bDisableCollisionForce comes with an OBJECT.DAT mass of 99998 or more.
  if((object.mass??0)>=99998||object.colDamageMultiplier>=99.9)return {unfreeze:false};
  const unfreeze=isStatic&&object.uprootLimit<=0;
  return {unfreeze,force:!isStatic||unfreeze?(incremental?-2*.2:-2):undefined};
 }
 const mode=object.gunBreakMode??0;
 return {unfreeze:false,damage:mode===1?151:mode===2?151*(object.smashMultiplier??1):50};
}

/** CBulletInfo::Update on an OBJECT.DAT prop (the sniper's bullet): a non-breakable prop is unfrozen as for an
 * instant hit and pushed by ApplyMoveForce(normal x -7.5), with no turn; a breakable one takes its gun-break
 * damage; and every prop then takes ObjectDamage(50). */
export function sniperHitsObject(object:{effect:number;colDamageMultiplier:number;uprootLimit:number;mass?:number;gunBreakMode?:number;smashMultiplier?:number},isStatic:boolean):{damages:number[];unfreeze:boolean;moveForce?:number}{
 if(object.effect<COL_DAMAGE_EFFECT.breakable){
  if((object.mass??0)>=99998||object.colDamageMultiplier>=99.9)return {damages:[50],unfreeze:false};
  const unfreeze=isStatic&&object.uprootLimit<=0;
  return {damages:[50],unfreeze,moveForce:!isStatic||unfreeze?-7.5:undefined};
 }
 const mode=object.gunBreakMode??0;
 return {damages:[...(mode===1?[151]:mode===2?[151*(object.smashMultiplier??1)]:[]),50],unfreeze:false};
}
/** A ped (bDisableTurnForce) walking into an OBJECT.DAT prop, CPhysical::ApplyCollision.
 * `closing` is the ped's speed along the normal from the prop to the ped (negative when
 * closing), in units per frame. A static prop unfreezes when 70 x the closing speed beats
 * its uproot limit; a moving prop counts ten times its mass (fEntityMassFactor) and takes
 * the returned speed change along the ped's push, in units per frame. */
export function pedHitsObject(o:{closing:number;objectSpeed?:number;mass:number;elasticity:number;uprootLimit:number;isStatic:boolean;pedMass?:number;pedElasticity?:number}){
 const pedMass=o.pedMass??70;
 if(o.closing>=0)return {unfreeze:false};
 let unfreeze=false;
 if(o.isStatic){
  const intensity=-(o.closing*pedMass);
  if(o.mass>=99998||o.uprootLimit>=9999||intensity<=o.uprootLimit)return {unfreeze:false};
  unfreeze=true;
 }
 const objectMass=10*o.mass,vObject=o.objectSpeed??0;
 const common=(objectMass*vObject+pedMass*o.closing)/(objectMass+pedMass);
 if(o.closing-common>=0)return {unfreeze};
 const e=(o.elasticity+(o.pedElasticity??.05))*.5,after=common-(vObject-common)*e;
 const intensity=-((after-vObject)*objectMass);
 // ApplyForce(-normal x intensity / 10) on the object: a speed change away from the ped.
 return {unfreeze,push:intensity/10/o.mass};
}
