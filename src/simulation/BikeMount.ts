import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import type {NativeAnimation} from '../assets/ifp';
import {rootMotion} from '../animation/rootMotion';
import {VEHICLE_ANIM} from '../assets/vehicleAnimGroups';
import type {VehicleAnimationLibrary} from '../assets/vehicleAnimations';
import {clipRootEnd} from './CarEntry';
import type {Simulation} from './Simulation';
import type {WorldBike} from './WorldBike';
type V3={x:number;y:number;z:number};
export type BikeSide='left'|'right';
export type BikeMountPhase='mount'|'getOff'|'waitSlow'|'jumpOff';
/** CTaskSimpleCarJumpOut for bikes: the ped is set out at 0.35 s and carried by the bike's speed until 0.7333 s. */
export const BIKE_JUMP_SET_OUT=.35,BIKE_JUMP_CARRY=.7333;
/** CVehicle::CanPedStepOutCar (0x6D1F30), the base rule bikes use: |v2D| ≤ 0.01, |vz| ≤ 0.05 units/frame, |ω|² ≤ 0.0004. */
export function bikeCanStepOut(v:V3,w:V3){const s=1/50;return Math.hypot(v.x,v.z)*s<=.01&&Math.abs(v.y)*s<=.05&&(w.x*w.x+w.y*w.y+w.z*w.z)*s*s<=.0004;}
/** CVehicle::CanPedJumpOutCar (0x6D2030) for bikes: v2D² ≥ 0.07 units/frame (13.2 m/s), for the rider only while no
 * pillion sits behind him. */
export function bikeCanJumpOut(v:V3,pillion:boolean){const s=1/50;return !pillion&&(v.x*v.x+v.z*v.z)*s*s>=.07;}
interface ClipUse{key:string;clip:NativeAnimation}
/** The player's bike mount and dismount (CTaskComplexEnterCarAsDriver and CTaskComplexLeaveCar through the bike's
 * animation group): the side's jump-on clip onto the saddle, the get-off clip down beside it, or, at speed, the
 * get-off-back tumble. Like the car clips, jump-on starts at its origin (the side point) and ends at the seat, and
 * get-off runs the other way, so the entity is pinned at the side point while the clip's root carries the body. */
/** TaskComplexEnterCar's give-up speed for the player: the vehicle's 2D move speed over 0.2 units a frame. */
export function bikeTooFastToBoard(bike:{body:{linvel():{x:number;y:number;z:number}}}){const v=bike.body.linvel();return Math.hypot(v.x,v.z)/50>.2;}
export class BikeMount {
 bike?:WorldBike;phase?:BikeMountPhase;side:BikeSide='left';time=0;message?:string;
 private setOut=false;private jumpSpeed=0;
 constructor(private sim:Simulation,readonly clips:VehicleAnimationLibrary){}
 get active(){return this.phase!==undefined;}
 /** The mount task owns the entity: the on-foot controller does not move it. */
 get pinned(){return this.phase==='mount'||this.phase==='getOff'||this.phase==='jumpOff'&&!this.setOut;}
 get rolling(){return this.phase==='jumpOff'&&this.setOut;}
 /** Loads the bike's clips; false (and the old instant boarding) until they are there. */
 ready(bike:WorldBike){const group=bike.assets.animGroup;if(!group)return false;if(this.clips.loaded(group))return true;void this.clips.load(group).catch(()=>{});return false;}
 private slot(bike:WorldBike,slot:number):ClipUse|undefined{const group=bike.assets.animGroup,found=group&&this.clips.slot(group,slot);return found?{key:found.key,clip:found.clip}:undefined;}
 private sideClip(bike:WorldBike,left:number,right:number,side=this.side){return this.slot(bike,side==='left'?left:right);}
 /** The side point in the bike's native model space: the seat less the jump-on clip's final root key. */
 sidePoint(bike:WorldBike,side:BikeSide):V3|undefined{
  const seat=bike.seat(),on=this.sideClip(bike,VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS,side);if(!seat||!on)return;
  const end=clipRootEnd(on.clip);return {x:seat.x-end.x,y:seat.y-end.y,z:seat.z-end.z};
 }
 worldPoint(bike:WorldBike,local:V3){
  const q=bike.body.rotation(),p=bike.body.translation(),v=new Vector3(local.x,local.z,-local.y).applyQuaternion(q as unknown as import('three').Quaternion);
  return v.add(new Vector3(p.x,p.y,p.z));
 }
 private ground(point:V3,bike:WorldBike){
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:point.x,y:point.y+1.5,z:point.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,bike.body);
  return hit?point.y+1.5-hit.timeOfImpact:undefined;
 }
 /** Standing room at a side point: ground under it and no overlap for the standing capsule. */
 private room(bike:WorldBike,side:BikeSide){
  const local=this.sidePoint(bike,side);if(!local)return undefined;
  const world=this.worldPoint(bike,local),ground=this.ground(world,bike);if(ground===undefined)return undefined;
  if(this.sim.world.intersectionWithShape({x:world.x,y:ground+.95,z:world.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.55,.3),undefined,undefined,this.sim.playerCollider,bike.body))return undefined;
  return {local,foot:{x:world.x,y:ground+.03,z:world.z}};
 }
 /** Boards from the side nearer the player, or false when neither side has room or the clips are not loaded. */
 mount(bike:WorldBike){
  if(this.phase||!this.ready(bike))return false;
  // CTaskComplexEnterCar gives the player up once the vehicle's 2D speed passes 0.2 units a frame.
  if(bikeTooFastToBoard(bike))return false;
  const p=this.sim.player.position,sides=(['left','right'] as BikeSide[]).map(side=>({side,at:this.room(bike,side)})).filter(s=>s.at&&this.sideClip(bike,VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS,s.side))
   .sort((a,b)=>Math.hypot(a.at!.foot.x-p.x,a.at!.foot.z-p.z)-Math.hypot(b.at!.foot.x-p.x,b.at!.foot.z-p.z));
  const pick=sides[0];if(!pick){this.message='No room beside the bike.';return false;}
  this.bike=bike;this.side=pick.side;this.begin('mount');
  this.sim.playerCollider.setEnabled(false);this.pinTo(bike,pick.at!.local);
  return true;
 }
 /** CTaskComplexLeaveCar for the rider: step off, tumble off the back at speed, or brake until one is possible. */
 dismount(bike:WorldBike){
  if(this.phase||!bike.occupied||!this.ready(bike))return false;
  this.bike=bike;
  const v=bike.body.linvel(),w=bike.body.angvel();
  if(bikeCanStepOut(v,w))return this.beginGetOff(bike);
  if(bikeCanJumpOut(v,!!bike.pillion))return this.beginJumpOff(bike);
  this.begin('waitSlow');return true;
 }
 private begin(phase:BikeMountPhase){this.phase=phase;this.time=0;this.setOut=false;this.message=undefined;}
 private beginGetOff(bike:WorldBike){
  const side=(['left','right'] as BikeSide[]).find(s=>this.room(bike,s)&&this.sideClip(bike,VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS,s));
  if(!side){this.message='No room beside the bike.';this.finish();return false;}
  this.side=side;this.begin('getOff');return true;
 }
 private beginJumpOff(bike:WorldBike){
  if(!this.slot(bike,VEHICLE_ANIM.rolloutLHS))return this.beginGetOff(bike);
  const v=bike.body.linvel();this.jumpSpeed=Math.hypot(v.x,v.y,v.z)/50;this.side='left';this.begin('jumpOff');return true;
 }
 private finish(){this.phase=undefined;this.bike=undefined;this.time=0;this.setOut=false;}
 /** Cancels whatever is running (a death, an arrest): the rider stays wherever the sequence left him. */
 abandon(){if(this.phase==='mount')this.sim.playerCollider.setEnabled(true);this.finish();}
 clipFor():ClipUse|undefined{
  const bike=this.bike;if(!bike||!this.phase)return;
  switch(this.phase){
   case 'mount':return this.sideClip(bike,VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS);
   case 'getOff':return this.sideClip(bike,VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS);
   case 'jumpOff':return this.slot(bike,VEHICLE_ANIM.rolloutLHS);
   case 'waitSlow':return undefined;
  }
 }
 /** Every clip the sequence can play, for the renderer. */
 requiredClips(){
  const bike=this.bike;if(!bike)return {};
  const out:Record<string,NativeAnimation>={};
  for(const slot of [VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS,VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS,VEHICLE_ANIM.rolloutLHS]){const c=this.slot(bike,slot);if(c)out[c.key]=c.clip;}
  return out;
 }
 private pinTo(bike:WorldBike,local:V3){
  const w=this.worldPoint(bike,local),player=this.sim.player,ground=this.ground(w,bike)??w.y-1;
  player.previous={...player.position};player.position={x:w.x,y:ground,z:w.z};player.heading=bike.heading();player.speed=0;player.verticalSpeed=0;player.grounded=true;
  this.sim.playerBody.setTranslation({x:w.x,y:ground+.9,z:w.z},true);this.sim.playerBody.setNextKinematicTranslation({x:w.x,y:ground+.9,z:w.z});
 }
 /** One fixed step. Returns the jump-off tumble's world motion once the rider is set out. */
 step(dt:number):{x:number;z:number}|undefined{
  const bike=this.bike;if(!this.phase||!bike)return;
  // A bike deleted or cleared away under the mount or dismount ends it (its body is gone).
  if(bike.disposed){this.abandon();return;}
  if(bike.wrecked&&this.phase!=='jumpOff'){this.abandon();return;}
  // CTaskComplexLeaveCar::ControlSubTask winds the leave up once the rider is already out (a tip-over or knock-off).
  if(this.phase!=='mount'&&!this.setOut&&!bike.occupied){this.finish();return;}
  const clip=this.clipFor(),previous=this.time;this.time+=dt;
  const finished=!!clip&&this.time>=clip.clip.duration;
  switch(this.phase){
   case 'mount':{
    if(bikeTooFastToBoard(bike)){this.abandon();return;}
    const local=this.sidePoint(bike,this.side);if(local)this.pinTo(bike,local);
    if(finished||!clip){this.finish();bike.finishEnter();}
    return;
   }
   case 'waitSlow':{
    bike.brake=true;bike.throttle=0;
    const v=bike.body.linvel(),w=bike.body.angvel();
    if(bikeCanStepOut(v,w))this.beginGetOff(bike);else if(bikeCanJumpOut(v,!!bike.pillion))this.beginJumpOff(bike);
    return;
   }
   case 'getOff':{
    bike.brake=true;bike.throttle=0;
    if(finished||!clip){const at=this.room(bike,this.side),local=this.sidePoint(bike,this.side),w=local&&this.worldPoint(bike,local);
     this.finish();const message=bike.finishExit(at?.foot??(w?{x:w.x,y:w.y-.9,z:w.z}:undefined));this.sim.player.heading=bike.heading();if(message!=='On foot')this.message=message;}
    return;
   }
   case 'jumpOff':{
    // m_initialVehSpeed decays by 0.96^timeStep from the clip's start; the rider leaves the saddle at 0.35 s.
    if(!this.setOut){
     this.jumpSpeed*=Math.pow(.96,(Math.min(this.time,BIKE_JUMP_SET_OUT)-previous)*50);
     if(this.time<BIKE_JUMP_SET_OUT)return;
     this.setOut=true;
     const seat=bike.seat(),w=seat?this.worldPoint(bike,seat):new Vector3().copy(bike.body.translation() as V3),ground=this.ground(w,bike),v=bike.body.linvel();
     bike.finishExit({x:w.x,y:Math.max(ground??w.y-1,w.y-1),z:w.z});
     this.sim.player.heading=bike.heading();this.sim.player.grounded=false;this.sim.player.verticalSpeed=v.y;
    }
    let forward=0;
    if(previous<BIKE_JUMP_CARRY){const to=Math.min(this.time,BIKE_JUMP_CARRY),from=Math.max(previous,BIKE_JUMP_SET_OUT),frames=Math.max(0,to-from)*50;this.jumpSpeed*=Math.pow(.96,frames);forward=this.jumpSpeed*frames;}
    const motion=clip?rootMotion(clip.clip,{track:clip.clip.tracks.findIndex(t=>t.boneId===0&&t.translations),axes:['x','y']}).delta(previous,Math.min(this.time,clip.clip.duration),false,new Vector3()):new Vector3();
    const h=this.sim.player.heading,right={x:-Math.cos(h),z:Math.sin(h)},ahead={x:Math.sin(h),z:Math.cos(h)},along=forward+motion.y;
    if(finished||!clip)this.finish();
    return {x:right.x*motion.x+ahead.x*along,z:right.z*motion.x+ahead.z*along};
   }
  }
 }
 /** Render pose: bike space at the side point (the clip carries the body), or the world after the jump-off. */
 pose():{bike?:WorldBike;local?:V3;world?:boolean;heading?:number;clip:string;seconds:number}|undefined{
  const bike=this.bike,clip=this.clipFor();if(!bike||!clip)return;
  if(this.rolling)return {world:true,heading:this.sim.player.heading,clip:clip.key,seconds:this.time};
  if(this.phase==='jumpOff'){const seat=bike.seat();return seat?{bike,local:seat,clip:clip.key,seconds:this.time}:undefined;}
  const local=this.sidePoint(bike,this.side);return local?{bike,local,clip:clip.key,seconds:this.time}:undefined;
 }
}
