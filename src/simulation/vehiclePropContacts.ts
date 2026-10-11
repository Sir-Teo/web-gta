import type RAPIER from '@dimforge/rapier3d-compat';
import {OBJECT_DAMAGE_GATE,VEHICLE_ELASTICITY,impulseVelocityChange,objectDamage,vehicleHitsObject,vehicleUprootsObject,type NativeObjectState,type ObjectDamageResult} from './nativeObjectDamage';
/** An OBJECT.DAT prop a vehicle can damage: the prop's data and live state, and the owner's callbacks. */
export type VehicleProp={effect:number;colDamageMultiplier:number;uprootLimit:number;mass:number;state:NativeObjectState;
  /** Called for every ObjectDamage the car deals; the owner removes the prop when `result.removed`. Point and normal are world (y-up). */
  damaged:(hit:{result:ObjectDamageResult;damage:number;point:{x:number;y:number;z:number};normal:{x:number;y:number;z:number}})=>void;
  /** OBJECT.DAT turn mass and elasticity for the two-body response after an uproot. */
  turnMass:number;elasticity:number;
  /** Unfreezes the prop with the given velocity (m/s) and spin (rad/s); false when it could not. */
  uproot:(linvel:{x:number;y:number;z:number},angvel:{x:number;y:number;z:number},cause?:'collision'|'explosion')=>boolean;
  /** CObject::TryToExplode: a causes-explosion prop blows up once; false when it cannot or already has. */
  tryToExplode?:()=>boolean;
  /** CObject's bIsLampPost: a vehicle's collision normal against it is flattened. */
  lampPost?:boolean;
  /** The collision model's bounding-box size (max − min, native model space), which the crush test transforms as a point. */
  boundsSize?:readonly [number,number,number]};
/** The vehicle side of a step's prop contacts: its body, the motion it had before the step (m/s, rad/s), OBJECT.DAT
 * lookups and whether it is a bike (CVehicle::IsSubBike: triple object damage). */
export interface VehiclePropContacts {world:RAPIER.World;body:RAPIER.RigidBody;playerColliderHandle:number;pre?:{x:number;y:number;z:number};preTurn?:{x:number;y:number;z:number};
 mass:number;turnMass:number;occupied:boolean;wrecked:boolean;bike?:boolean;propFor?:(other:RAPIER.Collider)=>VehicleProp|undefined;
 /** The vehicle's collider pairs in contact this step (World.contactPairsWith), when it has read them already. */
 pairs?:readonly (readonly [RAPIER.Collider,RAPIER.Collider])[]}
type V3={x:number;y:number;z:number};
const rotateV=(q:{x:number;y:number;z:number;w:number},v:V3):V3=>{const {x,y,z,w}=q;const ix=w*v.x+y*v.z-z*v.y,iy=w*v.y+z*v.x-x*v.z,iz=w*v.z+x*v.y-y*v.x,iw=-x*v.x-y*v.y-z*v.z;
 return {x:ix*w+iw*-x+iy*-z-iz*-y,y:iy*w+iw*-y+iz*-x-ix*-z,z:iz*w+iw*-z+ix*-y-iy*-x};};
/** COL_DAMAGE_EFFECT_SMASH_COMPLETELY: from here up CObject::CanBeSmashed. */
export const COL_DAMAGE_EFFECT_SMASH_COMPLETELY=20;
/** The point the original tests a prop by: its matrix applied to the bounding box's size (max − min), a size taken as
 * a point. Browser frame; `size` is native model space. */
export function propSizePoint(propPosition:V3,propRotation:{x:number;y:number;z:number;w:number},size:readonly [number,number,number]):V3{
 const r=rotateV(propRotation,{x:size[0],y:size[2],z:-size[1]});return {x:propPosition.x+r.x,y:propPosition.y+r.y,z:propPosition.z+r.z};
}
/** Whether a vehicle is over a prop's size point: the vehicle's origin is above it, or the point lies below the
 * vehicle's plane in the vehicle's own frame (CPhysical::ProcessCollisionSectorList's bObjectDamage and
 * CVehicle::SpecialEntityPreCollisionStuff's bCollidedEntityCollisionIgnored share the test). */
export function vehicleOverPoint(vehiclePosition:V3,vehicleRotation:{x:number;y:number;z:number;w:number},point:V3){
 if(vehiclePosition.y>point.y)return true;
 const q=vehicleRotation,local=rotateV({x:-q.x,y:-q.y,z:-q.z,w:q.w},{x:point.x-vehiclePosition.x,y:point.y-vehiclePosition.y,z:point.z-vehiclePosition.z});
 return local.y<0;
}
/** CVehicle::SpecialEntityPreCollisionStuff for a loose object (not static, temporary or exploded) that cannot be
 * smashed and whose bounds max is under a unit on every axis: a car (not a bike) over its size point ignores the
 * collision. `boundsMax` and `boundsSize` are native model space. */
export function carRollsOverProp(car:{position:V3;rotation:{x:number;y:number;z:number;w:number};bike?:boolean},prop:{position:V3;rotation:{x:number;y:number;z:number;w:number};effect:number;boundsMax:readonly [number,number,number];boundsSize:readonly [number,number,number]}){
 if(car.bike||prop.effect>=COL_DAMAGE_EFFECT_SMASH_COMPLETELY)return false;
 if(!(prop.boundsMax[0]<1&&prop.boundsMax[1]<1&&prop.boundsMax[2]<1))return false;
 return vehicleOverPoint(car.position,car.rotation,propSizePoint(prop.position,prop.rotation,prop.boundsSize));
}
/** CPhysical::ApplyCollision's static-object branch for OBJECT.DAT props. The
 * browser resolves the prop as a fixed body during the step. When the impact
 * destroys it, the native response is only intensity / (2 x multiplier) along
 * the normal; when it exceeds the uproot limit, the prop turns dynamic and the
 * same impact resolves through the general two-body branch. In both cases the
 * pre-step motion is restored and the native impulses applied instead. Props
 * that hold keep the fixed-body wall response. Velocities are native units per
 * 1/50 s frame; the browser's y-up frame is a proper rotation of the native one,
 * so dot and cross products carry over, and vectors are converted only where
 * the native code reads a Z component. Returns the props smashed and uprooted. */
export function resolveVehicleProps(o:VehiclePropContacts){
 let smashed=0,uprooted=0;
  const body=o.body,pre=o.pre,preTurn=o.preTurn;
  if(!o.propFor||!pre||!preTurn||!body.isEnabled()||o.wrecked)return {smashed,uprooted};
  const handled=new Set<number>(),com=body.worldCom(),position=body.translation();
  let move={x:pre.x/50,y:pre.y/50,z:pre.z/50},turn={x:preTurn.x/50,y:preTurn.y/50,z:preTurn.z/50},changed=0,otherImpact=false;
  type V={x:number;y:number;z:number};
  const toNative=(v:V):V=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:V):V=>({x:v.x,y:v.z,z:-v.y});
  // ProcessCollisionSectorList's flat 50 for a smashable prop the vehicle is over (its origin above the prop's size
  // point, or that point under the vehicle's plane) when the impact itself did not pass the 20 gate.
  const rotation=body.rotation();
  const crush=(prop:VehicleProp,owner:RAPIER.RigidBody,point:{x:number;y:number;z:number},normal:V)=>{
   if(prop.effect<COL_DAMAGE_EFFECT_SMASH_COMPLETELY||!prop.boundsSize||prop.state.destroyed)return;
   if(!vehicleOverPoint(position,rotation,propSizePoint(owner.translation(),owner.rotation(),prop.boundsSize)))return;
   prop.damaged({result:objectDamage(prop.state,50,prop.effect,prop.colDamageMultiplier),damage:50,point:{x:point.x,y:point.y,z:point.z},normal});
  };
  // A contact with no prop (the road, a building, another car) can only mark another impact, and that matters only
  // once a prop has been smashed or uprooted this step: its manifolds are read then, rather than every terrain
  // triangle's on every step (half of a car's calls into Rapier, and their garbage).
  let others:[RAPIER.Collider,RAPIER.Collider][]|undefined;
  const visit=(collider:RAPIER.Collider,other:RAPIER.Collider)=>{
   const owner=other.parent();if(!owner||other.isSensor()||owner.handle===body.handle||other.handle===o.playerColliderHandle)return;
   if(!o.propFor!(other)){(others??=[]).push([collider,other]);return;}
   o.world.contactPair(collider,other,(manifold,flipped)=>{
    if(!manifold.numSolverContacts())return;
    const n=manifold.normal(),normal=flipped?{x:n.x,y:n.y,z:n.z}:{x:-n.x,y:-n.y,z:-n.z},point=manifold.solverContactPoint(0);
    if(!point)return;
    const closing=pre.x*normal.x+pre.y*normal.y+pre.z*normal.z<-1;
    const prop=o.propFor!(other);
    // One ApplyCollision per prop, even when several car colliders touch it.
    if(prop&&handled.has(owner.handle))return;
    // Uprooted props are ordinary moving bodies to the solver.
    // A prop already loose meets the vehicle in the general branch, which the solver resolves. After it,
    // CPhysical::ProcessCollisionSectorList damages the object when a vehicle hit it with more than 20 of the
    // entity's damage intensity (ObjectDamage with that intensity); the flat 50 for a smashable prop the vehicle rides
    // over needs the prop's bounds, which the port does not carry here.
    if(prop&&!prop.state.destroyed&&owner.isDynamic()){
     if(closing)otherImpact=true;
     if(prop.effect&&!handled.has(owner.handle)){
      handled.add(owner.handle);
      // The solver already resolved this general-branch collision during the step, so its contact impulse is the
      // damage intensity: kg·m/s over 50 is the native mass times units a frame.
      let impulse=0;for(let c=0;c<manifold.numContacts();c++)impulse+=manifold.contactImpulse(c);
      const intensity=impulse/50;
      if(intensity>OBJECT_DAMAGE_GATE)prop.damaged({result:objectDamage(prop.state,intensity,prop.effect,prop.colDamageMultiplier),damage:intensity,point:{x:point.x,y:point.y,z:point.z},normal});
      else crush(prop,owner,point,normal);
     }
     return;
    }
    if(!prop||prop.state.destroyed){if(closing)otherImpact=true;return;}
    handled.add(owner.handle);
    // CPhysical::ProcessEntityCollision: against a lamp post the normal's up component is zeroed, not renormalised.
    if(prop.lampPost)normal.y=0;
    // CObjectData::SetObjectData: a mass of 99998 or more makes the prop bCollidable, so ProcessCollisionSectorList
    // resolves it with ApplyCollisionAlt (the car keeps a wall's response) and then damages it once with the greatest
    // intensity over 20, with no bike multiplier.
    if(prop.mass>=99998){
     const held=vehicleHitsObject({mass:o.mass,turnMass:o.turnMass,offset:{x:point.x-com.x,y:point.y-com.y,z:point.z-com.z},normal,moveSpeed:move,turnSpeed:turn},prop.state,{...prop,effect:0});
     if(!held.separating&&prop.effect&&held.intensity>OBJECT_DAMAGE_GATE)prop.damaged({result:objectDamage(prop.state,held.intensity,prop.effect,prop.colDamageMultiplier),damage:held.intensity,point:{x:point.x,y:point.y,z:point.z},normal});
     else if(!held.separating)crush(prop,owner,point,normal);
     if(closing)otherImpact=true;return;
    }
    const offset={x:point.x-com.x,y:point.y-com.y,z:point.z-com.z};
    // Each ApplyCollision reads the move and turn speed left by the previous one's ApplyForce.
    const outcome=vehicleHitsObject({mass:o.mass,turnMass:o.turnMass,offset,normal,moveSpeed:move,turnSpeed:turn,bike:o.bike},prop.state,prop);
    if(outcome.separating)return;
    if(outcome.damage)prop.damaged({result:outcome.damage,damage:outcome.objectDamage!,point:{x:point.x,y:point.y,z:point.z},normal});
    // When the prop holds or comes loose, ApplyCollision returns true and ProcessCollisionSectorList damages the object
    // again with the entity's intensity over 20.
    if(!outcome.damage?.removed&&prop.effect&&!prop.state.destroyed&&outcome.intensity>OBJECT_DAMAGE_GATE)
     prop.damaged({result:objectDamage(prop.state,outcome.intensity,prop.effect,prop.colDamageMultiplier),damage:outcome.intensity,point:{x:point.x,y:point.y,z:point.z},normal});
    else if(!outcome.damage?.removed)crush(prop,owner,point,normal);
    if(outcome.damage?.removed){
     changed++;smashed++;
     const dv=impulseVelocityChange(outcome.impulse!,offset,o.mass,o.turnMass);
     move={x:move.x+dv.move.x,y:move.y+dv.move.y,z:move.z+dv.move.z};turn={x:turn.x+dv.turn.x,y:turn.y+dv.turn.y,z:turn.z+dv.turn.z};
     return;
    }
    if(!outcome.uprooted){if(closing)otherImpact=true;return;}
    const objectAt=owner.translation(),zero={x:0,y:0,z:0};
    const result=vehicleUprootsObject(
     {mass:o.mass,turnMass:o.turnMass,elasticity:VEHICLE_ELASTICITY,offset:toNative(offset),moveSpeed:toNative(move),turnSpeed:toNative(turn),player:o.occupied,
      armFromPosition:toNative({x:point.x-position.x,y:point.y-position.y,z:point.z-position.z}),com:toNative({x:com.x-position.x,y:com.y-position.y,z:com.z-position.z})},
     {mass:prop.mass,turnMass:prop.turnMass,elasticity:prop.elasticity,offset:toNative({x:point.x-objectAt.x,y:point.y-objectAt.y,z:point.z-objectAt.z}),moveSpeed:zero,turnSpeed:zero},
     toNative(normal),outcome.intensity,prop.uprootLimit);
    const objectMove=fromNative(result.object.move),objectTurn=fromNative(result.object.turn);
    if(!prop.uproot({x:objectMove.x*50,y:objectMove.y*50,z:objectMove.z*50},{x:objectTurn.x*50,y:objectTurn.y*50,z:objectTurn.z*50}))return;
    changed++;uprooted++;
    move=fromNative(result.car.move);turn=fromNative(result.car.turn);
   });
  };
  // The step's pairs when the vehicle has read them already (a car reads them once for this and its collisions).
  if(o.pairs){for(const [collider,other] of o.pairs)if(!(other as {removed?:boolean}).removed)visit(collider,other);}
  else for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);o.world.contactPairsWith(collider,other=>visit(collider,other));}
  if(changed&&!otherImpact&&others)for(const [collider,other] of others){
   o.world.contactPair(collider,other,(manifold,flipped)=>{
    if(otherImpact||!manifold.numSolverContacts())return;
    const n=manifold.normal(),normal=flipped?{x:n.x,y:n.y,z:n.z}:{x:-n.x,y:-n.y,z:-n.z};
    if(manifold.solverContactPoint(0)&&pre.x*normal.x+pre.y*normal.y+pre.z*normal.z<-1)otherImpact=true;
   });
   if(otherImpact)break;
  }
  // A simultaneous wall or car impact keeps the solver's response this step.
  if(!changed||otherImpact)return {smashed,uprooted};
  // Collision damage below then measures only the native impulse, as natively.
  body.setLinvel({x:move.x*50,y:move.y*50,z:move.z*50},true);body.setAngvel({x:turn.x*50,y:turn.y*50,z:turn.z*50},true);
  return {smashed,uprooted};
}
