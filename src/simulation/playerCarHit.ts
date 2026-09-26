import RAPIER from '@dimforge/rapier3d-compat';
import {PED_MASS,PLAYER_CAR_DAMAGE,PLAYER_CAR_HURT_INTENSITY,PLAYER_CAR_PUSH_BACK,carHitsPed,playerVehicleCollision,type PlayerCarResponse} from '../combat/nativeCarPedHit';
import {WEAPON} from '../combat/nativeDamageAnim';
import {VEHICLE_ELASTICITY} from './nativeObjectDamage';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';

/* Vehicles striking the player on foot: the ped branch of CPhysical::ApplyCollision
 * (carHitsPed) and the player's answer to CEventVehicleCollision (playerVehicleCollision).
 * Car and player colliders sit in solver groups that skip each other, so a car no longer
 * meets the kinematic player as an immovable wall. The browser y-up frame maps native
 * (x, y, z) to (x, z, -y). */

/** The pedestrian vehicle probe, a little wider than the player's capsule. */
const PROBE=new RAPIER.Capsule(.6,.42);
type V={x:number;y:number;z:number};
const toNative=(v:V):V=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:V):V=>({x:v.x,y:v.z,z:-v.y});

export interface PlayerCarHitHooks {
 /** Unarmed, brass knuckles, golf club or knife: the weapons CTaskSimpleShakeFist allows. */
 fistWeapon():boolean;
 /** CTaskSimpleShakeFist. */
 shakeFist?():void;
 /** A car the player is getting into or out of. */
 excluded?:WorldCar;
}
export interface PlayerCarHit {car:WorldCar;response:PlayerCarResponse;hurt:boolean}

/** One fixed step, before the world step: every enabled car touching the player. */
export function carsStrikePlayer(sim:Simulation,cars:Iterable<WorldCar>,hooks:PlayerCarHitHooks){
 const hits:PlayerCarHit[]=[];
 if(!sim.playerBody.isEnabled()||!sim.playerCollider.isEnabled()||sim.player.health<=0||sim.player.swimming)return hits;
 const at=sim.playerBody.translation(),rotation=sim.playerBody.rotation();
 for(const car of cars){
  const body=car.car.body;
  if(car===hooks.excluded||car.occupied||!body.isEnabled())continue;
  const c=body.translation(),reach=(car.boundRadius??Infinity)+1.2;if((c.x-at.x)**2+(c.z-at.z)**2>reach*reach)continue;
  let touching=false;
  for(let i=0;i<body.numColliders()&&!touching;i++){const c=body.collider(i);touching=!c.isSensor()&&c.isEnabled()&&c.intersectsShape(PROBE,at,rotation);}
  if(!touching)continue;
  const hit=strike(sim,car,at,hooks);if(hit){hits.push(hit);sim.pushingBodies.add(body.handle);}
 }
 return hits;
}

function strike(sim:Simulation,car:WorldCar,at:V,hooks:PlayerCarHitHooks):PlayerCarHit|undefined{
 const body=car.car.body,com=body.worldCom(),linvel=body.linvel(),angvel=body.angvel(),physics=car.nativeBody;
 const flat={x:com.x-at.x,z:com.z-at.z},reach=Math.hypot(flat.x,flat.z);if(reach<1e-4)return undefined;
 // As for pedestrians: the normal runs from the player's centre to the car's centre of mass.
 const normal={x:flat.x/reach,y:0,z:flat.z/reach};
 const own=sim.lastMove.velocity,pedVelocity={x:own.x+sim.collisionPush.x,y:0,z:own.z+sim.collisionPush.z};
 const impact=carHitsPed({mass:physics.mass,turnMass:physics.turnMass,elasticity:VEHICLE_ELASTICITY,offset:toNative({x:at.x-com.x,y:at.y-com.y,z:at.z-com.z}),
  moveSpeed:toNative({x:linvel.x/50,y:linvel.y/50,z:linvel.z/50}),turnSpeed:toNative({x:angvel.x/50,y:angvel.y/50,z:angvel.z/50})},
  toNative({x:pedVelocity.x/50,y:0,z:pedVelocity.z/50}),toNative(normal));
 if(!impact)return undefined;
 const addCarForce=(force:V)=>{const dv=fromNative(force),v=body.linvel();body.setLinvel({x:v.x+dv.x/physics.mass*50,y:v.y+dv.y/physics.mass*50,z:v.z+dv.z/physics.mass*50},true);};
 addCarForce(impact.vehicleForce);
 // The car's collision and the player's capsule share no solver, so nothing else separates them: the part of the
 // capsule inside the car is carried out along the contact normal, flat on the ground (CPhysical::ProcessCollision
 // moves colliding entities apart before it applies their impulses).
 let depth=0,out={x:0,z:0};
 for(let i=0;i<body.numColliders();i++){const c=body.collider(i);if(c.isSensor()||!c.isEnabled())continue;
  const k=c.contactShape(sim.playerCollider.shape,at,sim.playerBody.rotation(),0);
  if(k&&k.distance<depth){const l=Math.hypot(k.normal1.x,k.normal1.z);if(l>1e-3){depth=k.distance;out={x:k.normal1.x/l,z:k.normal1.z/l};}}}
 if(depth<0){sim.collisionShift.x+=out.x*-depth;sim.collisionShift.z+=out.z*-depth;}
 // The impulse stays in the move speed. The player's own walk comes from its animation and is set
 // again next frame, so only what the car adds beyond stopping that walk carries on.
 const change=fromNative(impact.pedForce),walkIn=Math.max(0,own.x*normal.x+own.z*normal.z);
 sim.collisionPush.x+=change.x/PED_MASS*50+walkIn*normal.x;sim.collisionPush.z+=change.z/PED_MASS*50+walkIn*normal.z;
 const heading=sim.player.heading,forward={x:Math.sin(heading),z:Math.cos(heading)};
 const response=playerVehicleCollision({
  carSpeedSq:(linvel.x**2+linvel.y**2+linvel.z**2)/2500,intensity:impact.pedIntensity,stuck:sim.playerStuck,
  standing:sim.player.grounded,inAir:!sim.player.grounded,
  // The impact normal faces away from the car; the animation's forward shift is the run speed per frame.
  forwardImpactDot:-(forward.x*normal.x+forward.z*normal.z)*sim.player.speed/50,
  moveBlendRatio:sim.player.moveBlend,hasDriver:!!car.autopilot&&!car.driverless,fistWeapon:hooks.fistWeapon(),
 });
 const intensity=response.event.kind==='hit'?response.event.intensity:0;
 const hurt=sim.knockdown===0&&(Math.max(response.killWithCar??0,intensity)>PLAYER_CAR_HURT_INTENSITY);
 if(hurt){
  const from={x:at.x-linvel.x,z:at.z-linvel.z};
  sim.damagePlayer(PLAYER_CAR_DAMAGE,false,{weapon:WEAPON.rammedByCar,from,fall:true});
  if(response.killWithCar!==undefined&&response.killWithCar>PLAYER_CAR_HURT_INTENSITY){
   // KillPedWithCar's non-lethal branch: the ped takes 0.75 of the car's speed unless it hit a
   // wall, and the car is pushed back along the line between them.
   if(!sim.playerStuck){sim.collisionPush.x=linvel.x*.75;sim.collisionPush.z=linvel.z*.75;}
   const d={x:at.x-body.translation().x,z:at.z-body.translation().z},l=Math.hypot(d.x,d.z)||1,k=-PLAYER_CAR_PUSH_BACK*Math.min(1,physics.mass/1400)/l;
   addCarForce(toNative({x:d.x*k,y:0,z:d.z*k}));
  }
 }else if(response.event.kind==='shakeFist')hooks.shakeFist?.();
 return {car,response,hurt};
}
