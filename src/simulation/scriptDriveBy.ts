import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import {stepNpcGun,npcShotEnd,type NpcGunState} from './npcGun';
import {bulletTyreHit,pushShotVehicle} from '../weapons/bulletVehicle';
import type {SeatedShot} from '../vehicle/nativeDieInCar';
import type {NativeWeaponInfo} from '../weapons/weaponData';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';
/* TASK_DRIVE_BY on a script's rider: CTaskSimpleGangDriveBy, which gta-reversed has not reversed. The rider leans
 * out of its window with the drive-by clip and fires at a point, a ped or a car. Built on the ambient gang drive-by's
 * shooter (GangDriveBy): the muzzle a unit out of the window at shoulder height, CWeapon's bursts through
 * stepNpcGun, rays that burst tyres and hurt the player, cars and peds.
 * - The target is engaged within the task's radius and the weapon's range.
 * - `fireRate` (the command's percentage) is taken as the chance each burst is fired.
 * - The rider fires the Micro SMG, which the gang drive-bys carry, whatever weapon the script gave it.
 * Renderer coordinates throughout. */
export type DriveByTarget={kind:'point';x:number;y:number;z:number}|{kind:'ped';handle:number}|{kind:'vehicle';handle:number}
 /** A threat the group picked (a street ped, a rider in another car): its feet where it is now, renderer coordinates. */
 |{kind:'live';position:()=>{x:number;y:number;z:number}|undefined};
export interface ScriptDriveBy {
 target:DriveByTarget;radius:number;fireRate:number;
 /** The window it fires from: the task's right-hand-seat flag, or the side facing the target. */
 side:'left'|'right';gun:NpcGunState;seconds:number;aimPoint?:{x:number;y:number;z:number};shots:number;
 /** Whether the burst the gun is in (or about to start) was taken, by the fire rate. */
 firing:boolean;
}
export interface ScriptDriveByWorld {
 sim:Simulation;cars:()=>Iterable<WorldCar>;
 /** Where a ped or car target is now, renderer coordinates; nothing once it has gone. */
 targetPosition:(target:DriveByTarget)=>{x:number;y:number;z:number}|undefined;
 hitPed:(collider:number,damage:number,weapon:number,direction:{x:number;z:number},end:Vector3,piece?:number,shooter?:NonNullable<Parameters<SeatedShot>[5]>['shooter'])=>boolean;
 bulletLine?:import('../weapons/skinnedPedBulletLine').NpcBulletLine;
 prepareBulletImpact?:import('../weapons/skinnedPedBulletLine').NpcBulletImpact;
 onShot?:(from:Vector3,to:Vector3,weapon:number,hit:boolean)=>void;
 /** CheckForShootingVehicleOccupant for a line whose first hit is `hitBody`: the occupant of that car whose head sphere
  * the line enters within `range`, how far along, and the hit to apply to it. `own` is the shooter's car. */
 seatedShot?:SeatedShot;
 random:()=>number;
}
/** CTaskSimpleGangDriveBy's clip for a bike's pillion (iOS 0x1003b7830): the target's heading against the bike's
 * (CVector::Heading, atan2(-x, y) in the native plane), wrapped, turned an eighth on and cut into quarters, picks
 * BIKE_DBZ's Pass_Driveby_FWD, _LHS, _BWD or _RHS; the angle that lands on a fifth quarter picks none. */
export function pillionDriveByClip(bikeHeading:number,targetHeading:number):'pass_driveby_fwd'|'pass_driveby_lhs'|'pass_driveby_bwd'|'pass_driveby_rhs'|undefined{
 let d=targetHeading-bikeHeading;
 if(d>Math.PI)d-=Math.PI*2;else if(d<-Math.PI)d+=Math.PI*2;
 d+=Math.PI/4;if(d<0)d+=Math.PI*2;
 return (['pass_driveby_fwd','pass_driveby_lhs','pass_driveby_bwd','pass_driveby_rhs'] as const)[Math.trunc(d/(Math.PI/2))];
}
/** The task as given; its magazine fills at the first step, once the weapon is known. */
export function newScriptDriveBy(target:DriveByTarget,radius:number,fireRate:number,rightSide:boolean):ScriptDriveBy{
 return {target,radius,fireRate,side:rightSide?'right':'left',gun:{time:0,rounds:-1,reload:0,active:false},seconds:0,shots:0,firing:false};
}
/** One frame of the drive-by from `car`. */
export function stepScriptDriveBy(d:ScriptDriveBy,car:WorldCar,info:NativeWeaponInfo,reloadSeconds:number,dt:number,world:ScriptDriveByWorld,shooter?:NonNullable<Parameters<SeatedShot>[5]>['shooter']){
 d.seconds+=dt;
 if(d.gun.rounds<0)d.gun.rounds=info.clip;
 const target=world.targetPosition(d.target);if(!target)return;
 const p=car.car.body.translation(),q=car.car.body.rotation();
 const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));
 const right={x:Math.cos(heading),z:-Math.sin(heading)},side=d.side==='right'?1:-1;
 const muzzle=new Vector3(p.x+right.x*side,p.y+.75,p.z+right.z*side);
 // CTaskSimpleGangDriveBy::FireGun (iOS 0x1003b83c4) hands CWeapon::Fire the target entity and, with no offset given,
 // no point: a car is shot at where it is (its matrix's origin), a ped a unit over its feet.
 const aim={x:target.x,y:target.y+(d.target.kind==='point'||d.target.kind==='vehicle'?0:1),z:target.z};
 const toAim=new Vector3(aim.x-muzzle.x,aim.y-muzzle.y,aim.z-muzzle.z),dist=toAim.length();
 const inRange=dist<=Math.min(d.radius,info.weaponRange);
 // A burst starts only when the fire rate lets it.
 if(!d.gun.active&&!d.gun.reload)d.firing=inRange&&world.random()*100<d.fireRate;
 const engaged=inRange&&d.firing;
 if(engaged&&!d.gun.active&&!d.gun.reload)d.aimPoint={...aim};
 const oldTime=d.gun.time;
 const fire=stepNpcGun(d.gun,info,reloadSeconds,dt,engaged);
 if(fire){
  // CWeapon::FireInstantHit for the rider (a ped, accuracy 60): on to the weapon's range, three times it at a car.
  const endPoint=npcShotEnd(muzzle,aim,info,60,{rangeMultiplier:d.target.kind==='vehicle'?3:1});
  const direction=new Vector3(endPoint.x,endPoint.y,endPoint.z).sub(muzzle),lineLength=direction.length();direction.divideScalar(lineLength||1);
  const shot:import('../weapons/skinnedPedBulletLine').PedBulletIntersection|null|undefined=world.bulletLine?world.bulletLine(muzzle,direction,lineLength,car.car.body):world.sim.world.castRayAndGetNormal(new RAPIER.Ray(muzzle,direction),lineLength,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,car.car.body);
  const cars=[...world.cars()].filter(c=>c!==car);
  const reach=shot?.timeOfImpact??lineLength,tyre=bulletTyreHit(cars,muzzle,direction,reach);
  // A line whose first hit is a car may hand the hit on to one of its occupants, along the whole line.
  const seated=world.seatedShot?.(muzzle,direction,lineLength,car,shot?.collider.parent(),{distance:tyre?.t??reach,tyre:!!tyre,shooter});
  if(seated&&seated.t<=lineLength){
   const at=muzzle.clone().addScaledVector(direction,seated.t);d.shots++;world.onShot?.(muzzle,at,info.type,true);seated.hit(info.damage,info.type);
   if(d.gun.active&&d.gun.time<oldTime)d.aimPoint={...aim};
   return;
  }
  const end=muzzle.clone().addScaledVector(direction,tyre?tyre.t:reach);d.shots++;
  world.onShot?.(muzzle,end,info.type,!!shot||!!tyre);
  const finish=shot&&!tyre?world.prepareBulletImpact?.(shot,end,info.type,direction,shooter):undefined;let accepted=false;
  if(tyre)tyre.car.burstTyre(tyre.wheel,true,'ped');
  else if(shot?.collider.handle===world.sim.playerCollider.handle)accepted=world.sim.damagePlayer(info.damage,false,{weapon:info.type,from:{x:muzzle.x,z:muzzle.z},piece:shot.pedPiece});
  else if(shot){
   const hitCar=cars.find(c=>shot.collider.parent()?.handle===c.car.body.handle);
   if(hitCar){pushShotVehicle(hitCar,shot.normal,end,info.type);if(!hitCar.onlyDamagedByPlayer)hitCar.damage(info.damage,undefined,false,undefined,{weapon:info.type});}
   else accepted=world.hitPed(shot.collider.handle,info.damage,info.type,{x:direction.x,z:direction.z},end,shot.pedPiece,shooter);
  }
  finish?.(accepted);
 }
 if(d.gun.active&&d.gun.time<oldTime)d.aimPoint={...aim};
}
