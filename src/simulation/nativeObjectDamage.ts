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

/** Velocity change for an impulse applied at `offset`, with SA's scalar turn mass. Native units. */
export function impulseVelocityChange(impulse:V3,offset:V3,mass:number,turnMass:number){
 const torque=cross(offset,impulse);
 return {move:{x:impulse.x/mass,y:impulse.y/mass,z:impulse.z/mass},turn:{x:torque.x/turnMass,y:torque.y/turnMass,z:torque.z/turnMass}};
}
