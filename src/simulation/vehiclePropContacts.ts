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
  tryToExplode?:()=>boolean};
/** The vehicle side of a step's prop contacts: its body, the motion it had before the step (m/s, rad/s), OBJECT.DAT
 * lookups and whether it is a bike (CVehicle::IsSubBike: triple object damage). */
export interface VehiclePropContacts {world:RAPIER.World;body:RAPIER.RigidBody;playerColliderHandle:number;pre?:{x:number;y:number;z:number};preTurn?:{x:number;y:number;z:number};
 mass:number;turnMass:number;occupied:boolean;wrecked:boolean;bike?:boolean;propFor?:(other:RAPIER.Collider)=>VehicleProp|undefined}
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
  for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);o.world.contactPairsWith(collider,other=>{
   const owner=other.parent();if(!owner||other.isSensor()||owner.handle===body.handle||other.handle===o.playerColliderHandle)return;
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
     }
     return;
    }
    if(!prop||prop.state.destroyed){if(closing)otherImpact=true;return;}
    handled.add(owner.handle);
    const offset={x:point.x-com.x,y:point.y-com.y,z:point.z-com.z};
    // Each ApplyCollision reads the move and turn speed left by the previous one's ApplyForce.
    const outcome=vehicleHitsObject({mass:o.mass,turnMass:o.turnMass,offset,normal,moveSpeed:move,turnSpeed:turn,bike:o.bike},prop.state,prop);
    if(outcome.separating)return;
    if(outcome.damage)prop.damaged({result:outcome.damage,damage:outcome.objectDamage!,point:{x:point.x,y:point.y,z:point.z},normal});
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
  });}
  // A simultaneous wall or car impact keeps the solver's response this step.
  if(!changed||otherImpact)return {smashed,uprooted};
  // Collision damage below then measures only the native impulse, as natively.
  body.setLinvel({x:move.x*50,y:move.y*50,z:move.z*50},true);body.setAngvel({x:turn.x*50,y:turn.y*50,z:turn.z*50},true);
  return {smashed,uprooted};
}
