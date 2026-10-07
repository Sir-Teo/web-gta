import RAPIER from '@dimforge/rapier3d-compat';
import {NativeDrivingAnims} from './nativeDrivingAnims';
import {Vector3} from 'three';
import type {NativeAnimation} from '../assets/ifp';
import {rootMotion} from '../animation/rootMotion';
import {ANIM_GROUP,VEHICLE_ANIM,VEHICLE_ANIM_SPECIAL,nativeDoorAnimRatio,type DoorAnimKind} from '../assets/vehicleAnimGroups';
import type {VehicleAnimationLibrary} from '../assets/vehicleAnimations';
import {DOOR,MODEL_FLAG,sitClip} from './nativeDoor';
import type {Controls,Simulation} from './Simulation';
import {CAR_ALARM_SECONDS,type WorldCar} from './WorldCar';
type V3={x:number;y:number;z:number};
export type Side='left'|'right';
/** The longest a dragged-out driver is drawn waiting for his ped. */
const HELD_SECONDS=2;
export type EntryPhase='approach'|'align'|'locked'|'open'|'pullout'|'getIn'|'closeInside'|'shuffle'|'seated'|'waitSlow'|'getOut'|'closeOutside'|'jumpOut'|'getUp'|'draggedOut'|'crawlOut';
/** Shared entry timing (src/vehicle/entry.ts): 0.2 speed gate, 600 ms line-up. */
import { PLAYER_ENTER_SPEED_LIMIT as ENTRY_SPEED_SHARED, LINE_UP_SECONDS as LINE_UP_SHARED, JUMP_OUT_SET_OUT as JUMP_SET_SHARED, JUMP_OUT_CARRY as JUMP_CARRY_SHARED, approachStall, nextEntryPhase } from '../vehicle/entry';
/** CCarEnterExit: the player keeps entering or jacking while the car's 2D speed is at most 0.2 units/frame. */
const PLAYER_ENTER_SPEED=ENTRY_SPEED_SHARED;
/** An AI car at or below this 2D speed (units a frame: 5 m/s) waits for the player from his press of the enter button. */
const HOLD_FROM_PRESS_SPEED=.1;
/** How fast a car being got into loses its ground speed, per second (authored). */
const ENTRY_SETTLE_RATE=10;
/** CTaskUtilityLineUpPedWithCar(offset, 600, ...): the ped's offset from the door point is removed over 600 ms. */
const LINE_UP_SECONDS=LINE_UP_SHARED;
/** CTaskSimpleCarJumpOut for automobiles: door until 0.07 s, carried car speed until 0.45 s. */
const JUMP_OUT_SET_OUT=JUMP_SET_SHARED,JUMP_OUT_CARRY=JUMP_CARRY_SHARED;
const RIDE_SETS=[['CAR_sit_weak','Drive_L_weak','Drive_R_weak','Drive_L_weak_slow','Drive_R_weak_slow','CAR_LB_weak'],['CAR_sit','Drive_L','Drive_R','Drive_L_slow','Drive_R_slow','CAR_LB'],['CAR_sit_pro','Drive_L_pro','Drive_R_pro','Drive_L_pro_slow','Drive_R_pro_slow','CAR_LB_pro'],['CAR_Lsit','Drive_LO_l','Drive_LO_R'],['Drive_truck','DRIVE_truck_L','DRIVE_truck_R','DRIVE_truck_back'],['KART_drive','KART_L','KART_R','KART_LB']];
export interface EntryPose {car?:WorldCar;local?:V3;headingOffset?:number;world?:V3;heading?:number;clip:string;seconds:number;blend:number;overlay?:{clip:string;amount:number};
 /** Partial clips laid over the idle in turn, each at its own time (the steering and look-back). */
 overlays?:{clip:string;amount:number;seconds:number}[]}
export interface NpcPose {car:WorldCar;seat:0|1;local:V3;clip:string;seconds:number;who?:LeavingDriver}
/** The ped in a car's driver's seat as he leaves it, which the host draws on his clip and sets on the street after: the
 * model he was drawn with in the seat, and an officer's gun (a unit's cop stays a cop, CCopPed, once out). */
export interface LeavingDriver {model:number|string;officer?:{weapon:number;accuracy:number};dead?:boolean}
interface ClipUse {key:string;clip:NativeAnimation;group:number}
/** CVehicle::ProcessDrivingAnims set selection (RideAnims.h), shared by cars and aircraft: low, kart, truck, else driving skill with
 * `_slow` at |m_vecMoveSpeed| ≤ 0.4 (`speed` in metres per second). */
export function nativeRideAnims(o:{low:boolean;kart:boolean;truck:boolean;drivingSkill:number;speed:number}){
 const [idle,left,right,back]=o.low?[...RIDE_SETS[3],'CAR_LB']:o.kart?RIDE_SETS[5]:o.truck?RIDE_SETS[4]:(()=>{
  const set=RIDE_SETS[o.drivingSkill<50?0:o.drivingSkill<100?1:2];
  return o.speed/50<=.4?[set[0],set[3],set[4],set[5]]:[set[0],set[1],set[2],set[5]];
 })();
 return {idle,left,right,back};
}
/** ProcessDrivingAnims' look-left/right blend: |m_fSteerAngle / 0.61| clamped to 1, the right clip for negative (rightward) steering. */
export function nativeSteerOverlay(steerAngle:number,ride:{left:string;right:string}){
 return steerAngle===0?undefined:{clip:(steerAngle<0?ride.right:ride.left).toLowerCase(),amount:Math.min(1,Math.abs(steerAngle/.61))};
}
/** The last root translation key (ComputeAnimDoorOffsets reads the final frame of the first sequence). */
export function clipRootEnd(clip:NativeAnimation){const root=clip.tracks.find(t=>t.boneId===0&&t.translations);if(!root)return {x:0,y:0,z:0};const i=root.times.length-1,t=root.translations!;return {x:t[i*3],y:t[i*3+1],z:t[i*3+2]};}
/** GetPositionToOpenCarDoor in native car space (GTA III/VC lineage with SA
 * inputs): the seat pushed out by the handling seat offset × `mult`, minus
 * the ENTER_FRONT offset — the get-in clip's final root key, mirrored for
 * right doors — plus clearance outside a door already swung open. */
export function nativeDoorPoint(seat:V3,getInEnd:V3,seatOffset:number,side:Side,mult=1,openAngle=0){
 const sign=side==='left'?-1:1;
 const ajar=Math.sin(Math.min(Math.abs(openAngle),1.1))*1.1;
 return {x:sign*(Math.abs(seat.x)+seatOffset*mult+getInEnd.x+ajar),y:seat.y-getInEnd.y,z:seat.z-getInEnd.z};
}
/** Street population surface for passenger boarding and ejection. */
export interface PassengerCrowd {
  /** The player's group members still standing: the only peds that can take a seat. */
  followers():readonly {id:number;position:{x:number;y:number;z:number};health:number;down:number;slot?:number}[];
  /** Sends a follower running to the door of the seat it was given (`point`), or lets it follow again. */
  sendToSeat?(id:number,point?:{x:number;z:number}):void;
  /** `keep`: what the ped takes into the car and out again (his weapon, health and gang), opaque to the car. */
  boardPassenger(id:number):{modelRef:number|string;follow:boolean;gang?:number;keep?:unknown}|undefined;
  spawnPassenger(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,follow:boolean,keep?:unknown,rollout?:{velocity:{x:number;z:number};clip:'car_rollout_lhs'|'car_rollout_rhs'}):Promise<boolean>|boolean;
  /** A rider of a car that blew up: CAutomobile::BlowUpCar's KillPedsInVehicle leaves him dead. */
  spawnDead?(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,gang?:number,recruit?:boolean):unknown;
}
/** CTaskSimpleCarGetOut's upside-down clip, ANIM_ID_DEFAULT_CAR_CRAWLOUTRHS_0 and _1. */
const CRAWL_OUT='CAR_crawloutRHS';
/** Passenger seats behind the driver: front-right plus both rear seats when the car has them. */
const PASSENGER_SEATS=[{seat:1,door:DOOR.rightFront,side:'right'},{seat:2,door:DOOR.leftRear,side:'left'},{seat:3,door:DOOR.rightRear,side:'right'}] as const;
/** Player entry, exit and driving poses (CTaskComplexEnterCarAsDriver, CTaskComplexLeaveCar and their simple tasks). The entity is
 * pinned at the car-space door point while the clips' root translation carries the body, as none of these clips extract velocity. */
export class CarEntry {
  car?:WorldCar;phase?:EntryPhase;side:Side='left';time=0;
  /** Crew riding along: model refs with seats, ejected when the driver leaves. */
  passengers:{modelRef:number|string;seat:1|2|3;follow:boolean;gang?:number;keep?:unknown;
   /** The group's drive-by on a threat (CTaskAllocatorKillThreatsDriveby), and on whom. */
   driveBy?:import('./scriptDriveBy').ScriptDriveBy;groupDriveBy?:string}[]=[];
  /** Street population for boarding and ejection (wired by the host). */
  crowd?:PassengerCrowd;
  private prevSeated=false;
  private passengerClock=0;
  private doorCloses:{car:WorldCar;door:number;at:number}[]=[];
 private lineUp?:{local:V3;heading:number;time:number};
 private blendDelta=1000;
 private approachTime=0;private bestDistance=Infinity;private stall=0;
 /** Dev: why the last approach quit silently (CCarEnterExit::IsPlayerToQuitCarEnter terms). */
 cancelReason?:string;
 private jumpSpeed=0;private setOut=false;private doorExisted=true;
 /** NPC drivers leaving their cars: the jacked victim, and drivers evicted by events (a burning car). */
 private npcs:{car:WorldCar;clip:ClipUse;time:number;kind:'jacked'|'getOut';done:boolean;onOut?:(position:V3,heading:number)=>void;who?:LeavingDriver;
  /** The driver (0, the left front door) or the front passenger (1, dragged out by the right front door). */
  seat:0|1;
  /** Seconds he sits on before his get-out starts (ComputePedEnteredVehicleResponse's wait), on the clip's first
   * frame with the door shut. */
  wait?:number;
  /** A dragged-out driver drawn on his clip's last frame until the ped who replaces him exists (releaseDragged), so a
   * model still loading leaves no gap where he vanishes; at most HELD_SECONDS. */
  held?:number}[]=[];
 /** Lets go of the drawn victim of `car` (its driver, or the front passenger) once his ped is on the street. */
 releaseDragged(car:WorldCar,seat:0|1=0){for(const npc of this.npcs)if(npc.car===car&&npc.seat===seat)npc.held=undefined;}
 private get npc(){return this.npcs.find(n=>!n.done);}
 /** The steering and look-back clips' blends (ProcessDrivingAnims). */
 private readonly driving=new NativeDrivingAnims();
  /** STAT_DRIVING_SKILL, accumulated by distance driven and persisted with progression. */
  drivingSkill=0;
  message?:string;
  /** A failure the player is told about: the entry clips never loaded. (The refusals in `message` are silent, as in
   * the original: a locked door, a blocked way, a car moving too fast or no room to get out show no text.) */
  error?:string;
  onDriverOut?:(car:WorldCar,position:V3,heading:number,lying?:{key:string;clip:NativeAnimation},who?:LeavingDriver,seat?:0|1)=>void;
  /** A driver starts being dragged out of `car` (his clip runs for the next second or two). */
  onJackStart?:(car:WorldCar,who?:LeavingDriver)=>void;
  /** Who sits at the wheel of `car`, asked the moment he starts to leave it: the unit that drew him clears his seat on
   * its next step, so the ped is taken from it then, not when he lands. */
  driverOf?:(car:WorldCar)=>LeavingDriver|undefined;
  /** CCarEnterExit::ComputeSlowJackedPed for the right front door: the ped in the front passenger seat
   * (m_apPassengers[0]), dragged out there before CJ climbs in (IsCarSlowJackRequired); none, and CJ gets in. */
  frontPassengerOf?:(car:WorldCar)=>LeavingDriver|undefined;
  /** The front passenger starts being dragged out: his seat is his unit's no longer. */
  onPassengerDragged?:(car:WorldCar)=>void;
  /** CTaskComplexEnterCar after TASK_SIMPLE_CAR_GET_IN: CCarEnterExit::MakeUndraggedPassengerPedsLeaveCar, the crew
   * CJ did not drag out leaving the car he has climbed into. */
  onGotIn?:(car:WorldCar)=>void;
  /** The player landed after CTaskComplexCarSlowBeDraggedOut, lying in the jacked clip's last frame. */
  onPlayerDraggedOut?:(clip:{key:string;clip:NativeAnimation})=>void;
 constructor(private sim:Simulation,readonly clips:VehicleAnimationLibrary){}
 get active(){return this.phase!==undefined;}
 /** The line-up utility owns the entity; the on-foot controller does not move it. */
 get pinned(){return this.phase!==undefined&&this.phase!=='approach'&&!(this.phase==='jumpOut'&&this.setOut)&&this.phase!=='getUp';}
 get rolling(){return this.phase==='jumpOut'&&this.setOut||this.phase==='getUp';}
 get seated(){return this.phase==='seated';}
  snapshot(){return {cancelReason:this.cancelReason??null,phase:this.phase??null,side:this.side,time:this.time,clip:this.clipFor()?.key??null,car:this.car?.modelId??null,passengers:this.passengers.map(p=>({seat:p.seat,follow:p.follow})),npc:this.npc?{kind:this.npc.kind,time:this.npc.time,done:this.npc.done}:null,message:this.message??null};}
  /** Native seat local for a passenger seat (front-right plus mirrored rear bench). */
  passengerSeat(car:WorldCar,seat:1|2|3):V3|undefined{
   if(seat===1)return car.seat('right');
   const frame=car.car.nativeFramePosition('ped_backseat');if(!frame)return undefined;
   return {x:seat===2?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z};
  }
  /** Riding crew poses for the occupant renderer. */
  passengerPoses(driveByPose?:(d:import('./scriptDriveBy').ScriptDriveBy)=>Partial<import('../render/VehicleOccupants').OccupantPose>|undefined):import('../render/VehicleOccupants').OccupantPose[]{
   const car=this.car;if(!car||!this.seated)return [];
   const out:import('../render/VehicleOccupants').OccupantPose[]=[];
   for(const p of this.passengers){
    const local=this.passengerSeat(car,p.seat);if(!local)continue;
    // A rider on the group's drive-by leans out with its clip and gun.
    const leaning=p.driveBy?driveByPose?.(p.driveBy):undefined;
    out.push({key:`passenger:${car.car.body.handle}:${p.seat}`,car,model:p.modelRef,local,clip:sitClip(car.modelFlags,false),seconds:0,...leaning});
   }
   return out;
  }
  /** Riders waiting their turn to get out, still in their seats. */
  private leaving:{rider:CarEntry['passengers'][number];car:WorldCar;at:number}[]=[];
  leavingPoses():import('../render/VehicleOccupants').OccupantPose[]{
   const out:import('../render/VehicleOccupants').OccupantPose[]=[];
   for(const {rider,car} of this.leaving){const local=this.passengerSeat(car,rider.seat);if(local&&!car.disposed)out.push({key:`passenger:${car.car.body.handle}:${rider.seat}`,car,model:rider.modelRef,local,clip:sitClip(car.modelFlags,false),seconds:0});}
   return out;
  }
  /** Board nearby followers and eject the crew when the driver leaves or wrecks. */
  stepPassengers(dt:number){
   this.passengerClock+=dt;
   const car=this.car;
   for(let i=this.leaving.length-1;i>=0;i--){const l=this.leaving[i];if(this.passengerClock>=l.at){this.leaving.splice(i,1);this.passengerOut(l.car,l.rider);}}
   for(let i=this.doorCloses.length-1;i>=0;i--){
    const pending=this.doorCloses[i];
    if(this.passengerClock<pending.at||pending.car!==this.car)continue;
    if(!pending.car.doorMissing(pending.door))pending.car.openDoor(pending.door,0);
    this.doorCloses.splice(i,1);
   }
   // The crew leaves once the driver does: waiting for the car to slow down still has him in his seat.
   const inside=this.seated||this.phase==='waitSlow';
   if((this.prevSeated&&!inside)||(car&&(car.wrecked||car!==this.passengerCar))){
    this.ejectPassengers();
   }
   this.prevSeated=inside;this.passengerCar=car;
   const crew=this.crowd?this.crowd.followers().filter(p=>p.health>0&&p.down<=0):[];
   // CTaskComplexEnterCar gives a non-player ped up (a fall) once the car moves over 0.1 units a frame.
   if(!car||car.wrecked||!this.seated||car.speed2D()>.1||!this.crowd){for(const p of crew)this.crowd?.sendToSeat?.(p.id);return;}
   // CVehicle::m_nMaxPassengers (GetMaximumNumberOfPassengersFromNumberOfDoors) bounds the seats; a door knocked off
   // keeps nobody out of its seat (the door just does not open).
   const free=PASSENGER_SEATS.slice(0,car.maximumPassengers).filter(s=>!this.passengers.some(p=>p.seat===s.seat));
   if(!crew.length)return;
   // ComputeResponseLeaderEnteredCar (iOS 0x10034cbe0): every follower, in member-slot order, runs to a seat
   // (CTaskComplexEnterCarAsPassengerWait, RUN) wherever it is, the seats taken in turn (the front one first, which a
   // lone follower always gets); those beyond the seats stay out (CTaskComplexLeaveAnyCar).
   const order=[...crew].sort((a,b)=>(a.slot??99)-(b.slot??99));
   for(const [i,p] of order.entries())if(i>=free.length)this.crowd.sendToSeat?.(p.id);
   for(const [i,s] of free.entries()){
    const p=order[i];if(!p)break;
    // CCarEnterExit::GetPositionToOpenCarDoor for the seat's own door (a rear seat from ped_backseat).
    const local=this.seatDoorPoint(car,s.seat-1);
    if(!local){this.crowd.sendToSeat?.(p.id);continue;}
    const door=car.worldPoint(local);
    if(Math.hypot(p.position.x-door.x,p.position.z-door.z)>=3.5){this.crowd.sendToSeat?.(p.id,{x:door.x,z:door.z});continue;}
    this.crowd.sendToSeat?.(p.id);
    const taken=this.crowd.boardPassenger(p.id);
    if(!taken)continue;
    if(!car.doorMissing(s.door)){car.openDoor(s.door,1);this.doorCloses.push({car,door:s.door,at:this.passengerClock+0.8});}
    this.passengers.push({modelRef:taken.modelRef,seat:s.seat,follow:taken.follow,gang:taken.gang,keep:taken.keep});
   }
  }
  /** CGroupEventHandler::ComputeResponseLeaderExitedCar: the follower in member slot k leaves its seat 250 + 500 k ms
   * after the leader and up to 500 more, each at its own door; the crew keeps following on foot. */
  private ejectPassengers(){
   const car=this.passengerCar;
   if(!car||!this.crowd)return;
   const riders=this.passengers.splice(0);
   this.doorCloses=this.doorCloses.filter(pending=>pending.car!==car);
   // CVehicle::KillPedsInVehicle kills everyone aboard a car that blew up at once; only living riders leave one by one
   // (ComputeResponseLeaderExitedCar, iOS 0x10034d564): the follower in member slot k after 250 + 500 × k ms and up to
   // 500 more. A rider with no slot takes its place in the riders' order.
   riders.forEach((rider,i)=>{const slot=(rider.keep as {slot?:number}|undefined)?.slot??i;this.leaving.push({rider,car,at:this.passengerClock+(car.wrecked?0:(250+500*slot+Math.random()*500)/1000)});});
  }
  private passengerOut(car:WorldCar,rider:CarEntry['passengers'][number]){
   if(!this.crowd||car.disposed)return;
   {
    // ComputeTargetDoorToExit: each passenger leaves by his own seat's door.
    const local=this.seatDoorPoint(car,rider.seat-1);
    const door=local?car.worldPoint(local):new Vector3(car.car.body.translation().x,car.car.body.translation().y,car.car.body.translation().z);
    const hit=this.sim.world.castRay(new RAPIER.Ray({x:door.x,y:door.y+1.5,z:door.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,car.car.body);
    const spot={x:door.x,y:(hit?door.y+1.5-hit.timeOfImpact:door.y-1)+.03,z:door.z};
    // A car that blew up killed everyone aboard (CVehicle::KillPedsInVehicle, CEventVehicleDied for each rider).
    if(car.wrecked&&this.crowd.spawnDead){void Promise.resolve(this.crowd.spawnDead(rider.modelRef,spot,car.heading(),rider.gang,!!rider.follow)).catch(()=>{});return;}
    // ComputeResponseLeaderExitedCar gives followers CTaskComplexLeaveCar with bSensibleLeaveCar off: nobody waits for
    // the car to slow (GroupEventHandler.cpp:344-349). One still too fast to step out of is rolled out of
    // (CTaskSimpleCarJumpOut) with its move speed, by the seat's side.
    const v=car.car.body.linvel(),rollout=car.canStepOut()?undefined:{velocity:{x:v.x,z:v.z},clip:(rider.seat===2?'car_rollout_lhs':'car_rollout_rhs') as 'car_rollout_lhs'|'car_rollout_rhs'};
    void Promise.resolve(this.crowd.spawnPassenger(rider.modelRef,spot,car.heading(),rider.follow,rider.keep,rollout)).catch(()=>{});
   }
  }
  private passengerCar?:WorldCar;
 private slotFor(car:WorldCar,slot:number):ClipUse|undefined{const found=this.clips.slot(car.animGroup,slot);return found?{key:found.key,clip:found.clip,group:found.group}:undefined;}
 private sideSlot(left:number,right:number){return this.car&&this.slotFor(this.car,this.side==='left'?left:right);}
 private get door(){return this.side==='left'?DOOR.leftFront:DOOR.rightFront;}
 doorPoint(car:WorldCar,side:Side,mult=1):V3|undefined{
  const seat=car.seat(side),getIn=this.slotFor(car,VEHICLE_ANIM.getinLHS);if(!seat||!getIn)return;
  const door=car.doors[this.doorFor(side)] as {angle:number}|undefined;
  return nativeDoorPoint(seat,clipRootEnd(getIn.clip),car.assets.handling.values.seatOffset,side,mult,door?.angle??0);
 }
 private doorFor(side:Side){return side==='left'?DOOR.leftFront:DOOR.rightFront;}
 /** GetPositionToOpenCarDoor for a script's seat: the driver's door, or passenger seat 0 (front right), 1 (rear left)
  * or 2 (rear right), front seats from ped_frontseat and rear ones from ped_backseat, in native car space. Without
  * the car's get-in clip yet the seat is pushed out by its handling seat offset alone. Nothing for a rear seat the
  * model has no ped_backseat for. */
 seatDoorPoint(car:WorldCar,seat:'driver'|number):V3|undefined{
  const rear=seat!=='driver'&&seat>=1,side:Side=seat==='driver'||seat===1?'left':'right';
  const frame=car.car.nativeFramePosition(rear?'ped_backseat':'ped_frontseat');if(!frame)return undefined;
  const getIn=this.slotFor(car,VEHICLE_ANIM.getinLHS);
  const door=car.doors[rear?(side==='left'?DOOR.leftRear:DOOR.rightRear):this.doorFor(side)] as {angle:number}|undefined;
  return nativeDoorPoint({x:frame.x,y:frame.y,z:frame.z},getIn?clipRootEnd(getIn.clip):{x:0,y:0,z:0},car.assets.handling.values.seatOffset,side,1,door?.angle??0);
 }
 private ground(point:V3,car:WorldCar){
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:point.x,y:point.y+1.5,z:point.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,car.car.body);
  return hit?point.y+1.5-hit.timeOfImpact:undefined;
 }
 /** CCarEnterExit::IsRoomForPedToLeaveCar port: a standing capsule fits at the door point (with door-ajar clearance). */
 private room(car:WorldCar,side:Side,overAir=false){
  const local=this.doorPoint(car,side);if(!local)return false;const world=car.worldPoint(local),ground=this.ground(world,car);if(ground===undefined&&!overAir)return false;
  // A roll-out at speed may leave over open air (a car off a ramp or a pier): the capsule stands at the door point.
  return !this.sim.world.intersectionWithShape({x:world.x,y:(ground??world.y-1)+.95,z:world.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.55,.3),undefined,undefined,this.sim.playerCollider,car.car.body);
 }
 /** CCarEnterExit::IsCarSlowJackRequired for the driver's door: m_pDriver is set. A car a unit drives (police,
  * emergency, drive-by) says whether its driver is in the seat (a roadblock's crew stand at the block, an ambulance's
  * are treating a body, its van held on its brakes all the while); any other car has a driver while it is driven. */
 private jackRequired(car:WorldCar){return !car.occupied&&!car.driverOut&&(this.driverSeated?.(car)??!!car.autopilot);}
 /** Whether a unit's car has its driver in his seat; undefined for a car no unit drives. */
 driverSeated?:(car:WorldCar)=>boolean|undefined;
 /** CTaskComplexEnterCarAsDriver from on foot. */
  enter(car:WorldCar){
   if(this.active)return false;
   if(car.wrecked){this.message='This vehicle is destroyed.';return false;}
   // CTaskComplexEnterCar ends at once for a car with a CFire on it (m_pFire: a molotov's, a flamethrower's or a
   // script's). The engine fire under 250 health (ProcessCarOnFireAndExplode) is only a particle and bars nothing:
   // CJ may get into a burning car before it blows. No entity fire is kept on the browser's cars.
  this.car=car;void this.clips.load(car.animGroup).catch(()=>{});
  // CCarEnterExit::GetNearestCarDoor: the driver's door unless the passenger door is nearer (buses always use the
  // driver's), each only with room at it (IsRoomForPedToLeaveCar), else the other; with room at neither, no entry.
  const p=this.sim.player.position,left=car.worldPoint(this.doorPoint(car,'left')??{x:-1.4,y:0,z:0}),right=car.worldPoint(this.doorPoint(car,'right')??{x:1.4,y:0,z:0});
  const preferred:Side=car.modelFlags&MODEL_FLAG.bus||Math.hypot(right.x-p.x,right.z-p.z)>Math.hypot(left.x-p.x,left.z-p.z)?'left':'right';
  const other:Side=preferred==='left'?'right':'left';
  // A door whose stand point cannot be worked out is not tested.
  const clear=(side:Side)=>!this.doorPoint(car,side)||this.room(car,side);
  if(clear(preferred))this.side=preferred;
  else if(clear(other))this.side=other;
  else{this.car=undefined;this.message='The way to the door is blocked.';return false;}
  // PrepareVehicleForPedEnter stops an AI driver only once the player has reached the door. A car that has stopped
  // for him in the road (or at a light) then pulls away as soon as he steps out of its path to go round to the door,
  // and the entry fails as "moving too fast". A driver nearly at rest is therefore held from the button press on
  // (authored); a car still going faster than that is left to drive on, as before.
  if(!car.occupied&&!car.driverOut&&car.autopilot&&car.speed2D()<=HOLD_FROM_PRESS_SPEED)car.holdForEntry=true;
  this.phase='approach';this.time=this.approachTime=0;this.bestDistance=Infinity;this.stall=0;this.message=undefined;this.quitAfterDoor=false;return true;
 }
 /** CTaskComplexLeaveCar for the seated player: step out, jump out, or hold the handbrake until one is possible. */
 exit(){
  if(this.phase!=='seated'||!this.car)return false;
  const car=this.car;
  if(car.canStepOut())return this.beginGetOut();
  if(car.canJumpOut()&&this.beginJumpOut())return true;
  this.phase='waitSlow';this.time=0;car.exitHandbrake=true;car.driverInput=false;return true;
 }
 /** CTaskComplexCarSlowBeDraggedOut on the seated player (a cop holding the driver's door): CAR_jackedLHS
  * through the driver's door, then CTaskSimpleCarSetPedSlowDraggedOut sets the player out at the clip's end
  * offset, on the ground, where the fall-and-get-up that follows lets a cop arrest him. */
 dragOut(){
  if(this.phase!=='seated'||!this.car)return false;
  const car=this.car;this.side='left';
  if(!this.sideSlot(VEHICLE_ANIM.jackedLHS,VEHICLE_ANIM.jackedRHS))return this.exit();
  car.driverInput=false;car.exitHandbrake=true;this.doorExisted=!car.doorMissing(this.door);this.begin('draggedOut',8);return true;
 }
 /** CTaskSimpleCarSetPedInAsDriver without its entry tasks. */
 warpIn(car:WorldCar){this.car=car;this.side='left';void this.clips.load(car.animGroup).catch(()=>{});car.setPedInAsDriver();this.begin('seated');}
 cancel(){if(this.car){this.car.holdForEntry=false;if(!this.car.occupied)this.sim.playerCollider.setEnabled(true);}this.phase=undefined;this.car=undefined;this.lineUp=undefined;}
 /** The player died or was removed mid-sequence: leave the car at its driver door and stop every task. The car is
  * abandoned however fast it is going, as CVehicle::RemoveDriver sets STATUS_ABANDONED unconditionally. */
 abandon(){
  const car=this.car;
  if(car?.occupied){const local=this.doorPoint(car,'left'),world=local?car.worldPoint(local):new Vector3(car.car.body.translation().x,car.car.body.translation().y,car.car.body.translation().z);car.setPedOut({x:world.x,y:(this.ground(world,car)??world.y-1)+.03,z:world.z},car.heading());}
  this.cancel();
 }
 private begin(phase:EntryPhase,blendDelta=1000){
  // 1:1-track sequence check (src/vehicle/entry.ts): unexpected jumps fall
  // back without changing behavior, keeping clips authoritative this round.
  if (this.phase !== undefined) {
    const expected = nextEntryPhase(this.phase, this.phase === 'open');
    void expected;
  }
  // A fresh seat starts with no steering or look-back clip running.
  if(phase==='seated'&&this.phase!=='seated'&&this.phase!=='waitSlow')this.driving.reset();
  this.phase=phase;this.time=0;this.blendDelta=blendDelta;}
 private clipFor():ClipUse|undefined{
  if(!this.car||!this.phase)return;
  switch(this.phase){
   case 'align':return this.sideSlot(VEHICLE_ANIM.alignLHS,VEHICLE_ANIM.alignRHS);
   case 'open':return this.sideSlot(VEHICLE_ANIM.openLHS,VEHICLE_ANIM.openRHS);
   case 'locked':return this.sideSlot(VEHICLE_ANIM.doorlockedLHS,VEHICLE_ANIM.doorlockedRHS);
   case 'pullout':return this.sideSlot(VEHICLE_ANIM.pulloutLHS,VEHICLE_ANIM.pulloutRHS);
   case 'getIn':return this.sideSlot(VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS);
   case 'closeInside':return this.sideSlot(VEHICLE_ANIM.closedoorLHS,VEHICLE_ANIM.closedoorRHS);
   case 'shuffle':return this.slotFor(this.car,VEHICLE_ANIM.shuffle);
   case 'getOut':return this.sideSlot(VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS);
   case 'crawlOut':{const clip=this.clips.ped(CRAWL_OUT);return clip?{key:CRAWL_OUT.toLowerCase(),clip,group:0}:undefined;}
   case 'closeOutside':return this.sideSlot(VEHICLE_ANIM.closeLHS,VEHICLE_ANIM.closeRHS);
   case 'jumpOut':return this.sideSlot(VEHICLE_ANIM.rolloutLHS,VEHICLE_ANIM.rolloutRHS);
   case 'draggedOut':return this.sideSlot(VEHICLE_ANIM.jackedLHS,VEHICLE_ANIM.jackedRHS);
   case 'getUp':{const clip=this.clips.ped('getup_front');return clip?{key:'getup_front',clip,group:0}:undefined;}
   case 'seated':case 'waitSlow':{const idle=this.rideAnims().idle,clip=this.clips.ped(idle)??this.clips.ped('CAR_sit');return clip?{key:clip.name.toLowerCase(),clip,group:0}:undefined;}
  }
 }
 /** CVehicle::ProcessDrivingAnims set selection for the entered car. */
 rideAnims(){
  const car=this.car,v=car?car.car.body.linvel():{x:0,y:0,z:0};
  return nativeRideAnims({low:!!car&&!!(car.modelFlags&MODEL_FLAG.low),kart:!!car&&!!(car.animGroup.special&VEHICLE_ANIM_SPECIAL.kart),truck:!!car&&!!(car.animGroup.special&VEHICLE_ANIM_SPECIAL.truckDrive),drivingSkill:this.drivingSkill,speed:Math.hypot(v.x,v.y,v.z)});
 }
 /** Every clip this car's sequence can play, for binding on the player model; undefined until the IFP blocks load. */
 requiredClips(){
  const car=this.car;if(!car||!this.clips.loaded(car.animGroup))return undefined;
  const out:Record<string,NativeAnimation>={};
  for(const slot of Object.values(VEHICLE_ANIM)){const found=this.slotFor(car,slot);if(found)out[found.key]=found.clip;}
  for(const name of [...RIDE_SETS.flat(),'CAR_LB','getup_front',CRAWL_OUT]){const clip=this.clips.ped(name);if(clip)out[name.toLowerCase()]=clip;}
  return out;
 }
 private openDoor(car:WorldCar,door:number,kind:DoorAnimKind,time:number,group:number){
  if(car.doorMissing(door))return;
  const ratio=nativeDoorAnimRatio(car.animGroup,kind,time,car.doors[door].ratio,group);if(ratio!==undefined)car.openDoor(door,ratio);
 }
 /** Controls that run the player to the chosen door (CTaskComplexGoToCarDoorAndStandStill: PEDMOVE_RUN, radius 0.5, 50 m, 30 s). */
 approach(dt:number,controls:Controls,input:{x:number;y:number;quit:boolean}):Controls{
  const car=this.car;if(this.phase!=='approach'||!car)return controls;
  if(car.disposed){this.cancel();return controls;}
  // A knockdown's fall and get-up runs in the event-response slot, above the primary enter-car task, which waits
  // unprocessed (no steering check, no clock) and goes to the door once the player is back on his feet.
  if(this.sim.knockdown>0)return {...controls,x:0,y:0,jump:false,sprint:false};
  this.approachTime+=dt;
  const local=this.doorPoint(car,this.side);
  if(!local){if(this.approachTime>3){this.message=this.error='The car animations could not load.';this.cancel();}return {...controls,x:0,y:0,jump:false};}
  const target=car.worldPoint(local),p=this.sim.player.position,dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
   // CCarEnterExit::IsPlayerToQuitCarEnter port: steering away from the door quits, as the JCK_HLP hint describes.
   // Away from the car as well: standing closer to the car than the door's stand point (an open door's point lies
   // out past its swing), pushing toward the car is not backing off.
  const c=Math.cos(controls.cameraYaw),s=Math.sin(controls.cameraYaw),inputX=input.x*c-input.y*s,inputZ=-input.x*s-input.y*c;
  const centre=car.car.body.translation(),awayFromCar=inputX*(centre.x-p.x)+inputZ*(centre.z-p.z)<0;
  if(input.quit||Math.hypot(inputX,inputZ)>.1&&inputX*dx+inputZ*dz<0&&awayFromCar||this.approachTime>30||distance>50||car.wrecked){this.cancelReason=input.quit?'quit':this.approachTime>30?'time':distance>50?'far':car.wrecked?'wrecked':'steer';this.cancel();return controls;}
  // CTaskComplexEnterCar: a door another ped is using (a driver still climbing out) is waited for at the door
  // (TASK_SIMPLE_CAR_WAIT_FOR_DOOR_NOT_TO_BE_IN_USE). An NPC leaves by his own seat's door.
  const doorBusy=this.npcs.some(n=>n.car===car&&!n.done&&(n.seat?'right':'left')===this.side);
  if(distance<=.5){if(!doorBusy)this.doorReached();return {...controls,x:0,y:0,jump:false,sprint:false};}
  // A door drifting away with its car (a hovercraft sliding on land) is chased, not counted as a blocked way.
  if(distance<this.bestDistance-.05||car.speed2D()>.001){this.bestDistance=distance;this.stall=0;}
  // The stall clock waits while CJ is off the ground: a press that came mid-jump, or a kerb on the way, is not a blocked door.
  else if(!doorBusy&&(this.stall=approachStall(this.stall,dt,this.sim.player.grounded))>1.2){if(distance<1.2)this.doorReached();else{this.message='The way to the door is blocked.';this.cancelReason='blocked';this.cancel();}return {...controls,x:0,y:0,jump:false};}
  let aim={x:dx,z:dz};
  // ComputeRouteToDoor: walk around the car's collision bounds instead of into them.
  const b=car.assets.collision.bounds,center=car.car.body.translation(),h=car.heading(),sin=Math.sin(h),cos=Math.cos(h);
  const toLocal=(x:number,z:number)=>({x:-(x-center.x)*cos+(z-center.z)*sin,y:(x-center.x)*sin+(z-center.z)*cos});
  const toWorld=(q:{x:number;y:number})=>({x:center.x-q.x*cos+q.y*sin,z:center.z+q.x*sin+q.y*cos});
  const from=toLocal(p.x,p.z),to=toLocal(target.x,target.z),m=.45,minX=b.min[0]-m,maxX=b.max[0]+m,minY=b.min[1]-m,maxY=b.max[1]+m;
  const inside=(q:{x:number;y:number})=>q.x>minX&&q.x<maxX&&q.y>minY&&q.y<maxY;
  if(!inside(from)&&Array.from({length:9},(_,i)=>(i+1)/10).some(u=>inside({x:from.x+(to.x-from.x)*u,y:from.y+(to.y-from.y)*u}))){
   const corners=[{x:minX,y:minY},{x:minX,y:maxY},{x:maxX,y:minY},{x:maxX,y:maxY}],cost=(q:{x:number;y:number})=>Math.hypot(q.x-from.x,q.y-from.y)+Math.hypot(q.x-to.x,q.y-to.y);
   const corner=corners.filter(q=>Math.sign(q.x)===Math.sign(to.x)).sort((a,z)=>cost(a)-cost(z))[0];
   if(corner&&Math.hypot(corner.x-from.x,corner.y-from.y)>.3){const w=toWorld(corner);aim={x:w.x-p.x,z:w.z-p.z};}
  }
  const length=Math.hypot(aim.x,aim.z)||1,ax=aim.x/length,az=aim.z/length;
  return {...controls,x:ax*c-az*s,y:-ax*s-az*c,walk:distance<1,sprint:false,jump:false,facing:undefined};
 }
 private doorReached(){
  const car=this.car!;
  if(car.speed2D()>PLAYER_ENTER_SPEED){this.message='The car is moving too fast.';this.cancelReason='fast';this.cancel();return;}
  // PrepareVehicleForPedEnter: an NPC driver's cruise speed drops to zero while the player lines up.
  car.holdForEntry=true;
  const world=car.worldPoint(this.doorPoint(car,this.side)!),p=this.sim.player.position,h=car.heading(),sin=Math.sin(h),cos=Math.cos(h);
  const offset={x:p.x-world.x,y:p.y+1-world.y,z:p.z-world.z};
  this.lineUp={local:{x:-offset.x*cos+offset.z*sin,y:offset.x*sin+offset.z*cos,z:offset.y},heading:Math.atan2(Math.sin(this.sim.player.heading-h),Math.cos(this.sim.player.heading-h)),time:0};
  this.sim.setCrouched(false);this.sim.playerCollider.setEnabled(false);
  if(this.sideSlot(VEHICLE_ANIM.alignLHS,VEHICLE_ANIM.alignRHS))this.begin('align',4);else this.afterAlign();
 }
 private afterAlign(){
  const car=this.car!,door=this.door;
  if(car.speed2D()>PLAYER_ENTER_SPEED){this.quitOutside();return;}
  if(!car.doorMissing(door)&&!car.doorFullyOpen(door)){
   // CTaskComplexEnterCar: a door to open that is locked (CarHasOpenableDoor false) gets CTaskSimpleCarOpenLockedDoorFromOutside,
   // CAR_doorlocked_LHS/RHS, then the player stands and the task ends.
   if(car.locked){if(this.sideSlot(VEHICLE_ANIM.doorlockedLHS,VEHICLE_ANIM.doorlockedRHS))this.begin('locked',4);else{this.message='This car is locked.';this.cancel();}return;}
   if(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noOpenDoor){car.setDoorOpen(door);car.openDoor(door,1);}
   else if(car.assets.handling.values.animationGroup===ANIM_GROUP.conv&&this.side==='left'&&!this.jackRequired(car)){this.beginGetIn();return;}
   else if(this.sideSlot(VEHICLE_ANIM.openLHS,VEHICLE_ANIM.openRHS)){this.begin('open',4);return;}
   else car.openDoor(door,1);
  }
  this.afterOpen();
 }
 private afterOpen(){
  const car=this.car!;
  if(car.speed2D()>PLAYER_ENTER_SPEED){this.quitOutside();return;}
  if(this.side==='left'&&this.jackRequired(car)&&this.sideSlot(VEHICLE_ANIM.pulloutLHS,VEHICLE_ANIM.pulloutRHS)){this.begin('pullout');this.startNpc(car,'jacked');return;}
  // The passenger's door with someone in his seat: CAR_pulloutL_RHS on CJ and CAR_jackedRHS on him (a tandem-seat
  // vehicle's right door is the rear seat's, never jacked here).
  if(this.side==='right'&&!(car.modelFlags&MODEL_FLAG.tandemSeats)&&this.frontPassengerOf?.(car)&&this.sideSlot(VEHICLE_ANIM.pulloutLHS,VEHICLE_ANIM.pulloutRHS)&&this.startNpc(car,'jacked',undefined,1)){this.begin('pullout');return;}
  if(this.quitAfterDoor){this.quit();return;}
  this.beginGetIn();
 }
 /** CTaskComplexEnterCar::ControlSubTask asks CCarEnterExit::IsPlayerToQuitCarEnter each frame and latches the answer
  * (m_bQuitAfterDraggingPedOut); the subtask after the door opens, or after the driver is dragged out, then finishes
  * the entry with the door left open ("To stop Carl from entering a car once he has opened the door or dragged out a
  * driver or passenger, use the movement controls or press PED_FIREWEAPON"). The test itself is unreversed: as on the
  * way to the door, the stick pushed away from the car, or the fire button. */
 private quitAfterDoor=false;
 private playerQuits(car:WorldCar,input:{steer?:{x:number;y:number;cameraYaw:number};fire?:boolean}){
  if(input.fire)return true;
  const steer=input.steer;if(!steer)return false;
  const c=Math.cos(steer.cameraYaw),s=Math.sin(steer.cameraYaw),x=steer.x*c-steer.y*s,z=-steer.x*s-steer.y*c;
  const center=car.car.body.translation(),p=this.sim.player.position;
  return Math.hypot(x,z)>.1&&x*(center.x-p.x)+z*(center.z-p.z)<0;
 }
 private quit(){this.cancelReason='quit';this.cancel();}
 private beginGetIn(){if(this.sideSlot(VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS))this.begin('getIn',4);else this.afterGetIn(false);}
 private afterGetIn(pedal:boolean){
  const car=this.car!,door=this.door;
  this.onGotIn?.(car);
  let close=!car.doorMissing(door)&&!car.doors[door].closed;
  // A player driver holding accelerate or brake drives off with the door left swinging.
  if(pedal){if(close)car.setDoorOpen(door);close=false;}
  if(close){
   if(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noCloseAfterIn)car.openDoor(door,0);
   else if(this.sideSlot(VEHICLE_ANIM.closedoorLHS,VEHICLE_ANIM.closedoorRHS)){this.begin('closeInside');return;}
   else car.openDoor(door,0);
  }
  this.afterCloseInside();
 }
 private afterCloseInside(){
  const car=this.car!;
  if(this.side==='right'&&!(car.modelFlags&MODEL_FLAG.tandemSeats)){
   // Entering the passenger door of an occupied car sends CEventDraggedOutCar: the driver leaves by the driver's door.
   if(this.jackRequired(car))this.startNpc(car,'getOut');
   if(this.slotFor(car,VEHICLE_ANIM.shuffle)){this.begin('shuffle');return;}
  }
  this.setIn();
 }
 private setIn(){const car=this.car!;car.holdForEntry=false;car.setPedInAsDriver();this.side='left';this.lineUp=undefined;this.begin('seated',4);}
 private backToSeat(car:WorldCar){car.exitHandbrake=false;car.driverInput=true;this.phase='seated';this.time=0;}
 private quitOutside(){this.message='The car is moving too fast.';this.cancel();}
 /** CUpsideDownCarCheck::IsCarUpsideDown (0x463830): up.z below 0.3 with fewer than four wheels on the ground, or
  * below zero. (The leave task that sets CTaskSimpleCarGetOut's flag is not reversed; the geometric test is.) */
 private upsideDown(car:WorldCar){return car.upsideDownForCheck();}
 /** CTaskSimpleCarGetOut::ComputeAnimID's upside-down doors: the driver's while right.z ≥ −0.5, the passenger's
  * while right.z ≤ 0.5, and CAR_crawloutRHS for either (ped.ifp carries only the one clip). */
 private beginCrawlOut(car:WorldCar){
  const q=car.car.body.rotation(),rightY=2*(q.x*q.y+q.w*q.z);
  const sides=(['left','right'] as Side[]).filter(side=>(side==='left'?rightY>=-.5:rightY<=.5)&&this.room(car,side));
  const side=sides[0],clip=this.clips.ped(CRAWL_OUT);if(!side||!clip)return false;
  // The clip ends standing at its origin and starts 1.27 m to the ped's left, lying in the car: pin him upright at the
  // door point on the ground, turned so the car is on his left.
  const world=car.worldPoint(this.doorPoint(car,side,1)!),ground=this.ground(world,car)??world.y-1,c=car.car.body.translation();
  const toCar={x:c.x-world.x,z:c.z-world.z},l=Math.hypot(toCar.x,toCar.z)||1,heading=Math.atan2(-toCar.z/l,toCar.x/l);
  this.side=side;car.driverInput=false;car.exitHandbrake=false;
  car.setPedOut({x:world.x,y:ground+.03,z:world.z},heading);this.sim.playerCollider.setEnabled(false);
  this.begin('crawlOut',1000);return true;
 }
 private beginGetOut(){
  if(this.upsideDown(this.car!)&&this.beginCrawlOut(this.car!))return true;
  const car=this.car!,side:Side|undefined=this.room(car,'left')?'left':this.room(car,'right')?'right':undefined;
  if(!side){
   // No ground at either door because the car floats or has sunk: out into the water, where swimming takes over
   // (EVENT_IN_WATER in the original; WorldBoat sets its skipper over the side the same way).
   for(const s of ['left','right'] as Side[]){
    const local=this.doorPoint(car,s,1);if(!local)continue;
    const w=car.worldPoint(local),level=car.waterLevel?.(w.x,-w.z),ground=this.ground(w,car);
    if(level===undefined||ground!==undefined&&ground>level-.5)continue;
    this.side=s;car.setPedOut({x:w.x,y:level-.8,z:w.z},car.heading());this.sim.player.grounded=false;this.finishOnFoot();return true;
   }
   this.message='Both doors are blocked.';return false;
  }
  // The exit press left ProcessControlInputs' automatic handbrake on (gas 0, full brake), and the driver's
  // PEDSTATE_EXIT_CAR stops the inputs being read again until he is out: the car holds still through the getout.
  this.side=side;car.driverInput=false;car.exitHandbrake=true;this.doorExisted=!car.doorMissing(this.door);
  if(this.sideSlot(VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS))this.begin('getOut');else this.afterGetOut();
  return true;
 }
 private afterGetOut(moving=false){
  const car=this.car!,world=car.worldPoint(this.doorPoint(car,this.side,1)!),ground=this.ground(world,car)??world.y-1;
  car.setPedOut({x:world.x,y:ground+.03,z:world.z},car.heading());
  // CTaskSimpleCarCloseDoorFromOutside::StartAnim decides once: no close with special flag 1, from 1 m above ground,
  // when the car burns, or while the player aims or moves the stick (the engine-damage ≥ 225 test awaits engine status).
  if(!moving&&!car.doorMissing(this.door)&&!car.doors[this.door].closed&&!(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noCloseAfterOut)&&world.y-1-ground<1&&!car.onFire&&this.sideSlot(VEHICLE_ANIM.closeLHS,VEHICLE_ANIM.closeRHS)){
   this.sim.playerCollider.setEnabled(false);this.begin('closeOutside');return;
  }
  this.finishOnFoot();
 }
 private finishOnFoot(){this.sim.playerCollider.setEnabled(true);this.phase=undefined;this.car=undefined;this.lineUp=undefined;}
 private beginJumpOut(){
  // IsRoomForPedToLeaveCar gates the roll-out as it does the get-out: the driver's door, else the passenger's, else
  // CTaskSimpleCarWaitToSlowDown keeps him in until a door clears or the car can be stepped out of.
  const car=this.car!,side:Side|undefined=this.room(car,'left',true)?'left':this.room(car,'right',true)?'right':undefined;
  if(!side)return false;this.side=side;
  if(!this.sideSlot(VEHICLE_ANIM.rolloutLHS,VEHICLE_ANIM.rolloutRHS))return false;
  car.driverInput=false;car.exitHandbrake=false;
  const v=car.car.body.linvel();this.jumpSpeed=Math.hypot(v.x,v.y,v.z)/50;this.setOut=false;this.doorExisted=!car.doorMissing(this.door);
  this.begin('jumpOut',8);return true;
 }
 private startNpc(car:WorldCar,kind:'jacked'|'getOut',onOut?:(position:V3,heading:number)=>void,seat:0|1=0,leaving?:LeavingDriver,wait=0){
  const clip=this.slotFor(car,kind==='jacked'?(seat?VEHICLE_ANIM.jackedRHS:VEHICLE_ANIM.jackedLHS):seat?VEHICLE_ANIM.getoutRHS:VEHICLE_ANIM.getoutLHS);if(!clip)return false;
  if(seat){
   // The passenger goes; the driver stays at the wheel, held while CJ gets in, and leaves once he is in.
   const who=leaving??this.frontPassengerOf?.(car);if(kind==='jacked')this.onPassengerDragged?.(car);
   this.npcs.push({car,clip,time:0,kind,done:false,who,seat,wait});this.onJackStart?.(car,who);return true;
  }
  const who=this.driverOf?.(car);
  // CTaskComplexCarSlowBeDraggedOut: the victim's car is abandoned (FORCED_STOP for a player victim).
  car.driverOut=true;car.autopilot=undefined;car.holdForEntry=true;car.driverLeaving=kind==='getOut';
  this.npcs.push({car,clip,time:0,kind,done:false,onOut,who,seat});if(kind==='jacked')this.onJackStart?.(car,who);return true;
 }
 /** CTaskComplexLeaveAnyCar for an NPC driver (a CEventVehicleOnFire response): the car stops, the driver plays his
  * get-out clip and `onOut` places him at the door. False when the car has no exit clip. */
 evictDriver(car:WorldCar,onOut:(position:V3,heading:number)=>void){
  if(car.driverOut||this.npcs.some(n=>n.car===car&&!n.done&&!n.seat))return false;
  if(this.startNpc(car,'getOut',onOut))return true;
  // The car's exit clips have not been read yet (a van or bus group nobody has used): ask for them, and set the driver
  // out at his door now rather than leave him in a seat his decision (fire, road rage, flight) has already left.
  void this.clips.load(car.animGroup).catch(()=>{});
  const local=this.doorPoint(car,'left'),bounds=car.assets.collision.bounds;
  const base=car.worldPoint(local??{x:-(Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0]))+.6),y:0,z:0}),ground=this.ground(base,car)??base.y-1;
  car.driverOut=true;car.autopilot=undefined;car.holdForEntry=false;
  onOut({x:base.x,y:ground+.03,z:base.z},car.heading());return true;
 }
 /** CTaskComplexLeaveCar for the front passenger of a car its own unit cannot set down (a drive-by shooter): his
  * get-out clip at the right front door, drawn as `who`, and `onOut` places him at the door. False without the clip
  * or while someone already uses that door. `wait` holds him in his seat that long first. */
 evictPassenger(car:WorldCar,who:LeavingDriver,onOut:(position:V3,heading:number)=>void,wait=0){
  if(this.npcs.some(n=>n.car===car&&!n.done&&n.seat===1))return false;
  if(this.startNpc(car,'getOut',onOut,1,who,wait))return true;
  // The car's exit clips are not read yet: ask for them and set him out at his door now, as evictDriver does.
  void this.clips.load(car.animGroup).catch(()=>{});
  const local=this.doorPoint(car,'right'),bounds=car.assets.collision.bounds;
  const base=car.worldPoint(local??{x:Math.max(Math.abs(bounds.min[0]),Math.abs(bounds.max[0]))+.6,y:0,z:0}),ground=this.ground(base,car)??base.y-1;
  onOut({x:base.x,y:ground+.03,z:base.z},car.heading());return true;
 }
 /** CTaskSimpleCarSetPedSlowDraggedOut: the victim lands at the jacked clip's end offset (2D) with its Z on the ground. */
 private stepNpc(dt:number){for(const npc of this.npcs){if(npc.car.disposed){npc.done=true;npc.held=undefined;}if(npc.held!==undefined&&(npc.held-=dt)<=0)npc.held=undefined;if(npc.done)continue;if(npc.wait&&npc.wait>0){npc.wait-=dt;continue;}this.stepOneNpc(npc,dt);}
  this.npcs=this.npcs.filter(npc=>!npc.done||npc.held!==undefined);}
 private stepOneNpc(npc:NonNullable<CarEntry['npc']>,dt:number){
  npc.time+=dt;
  const door=npc.seat?DOOR.rightFront:DOOR.leftFront;
  if(npc.kind==='jacked'&&!(this.car===npc.car&&this.phase==='pullout'))this.openDoor(npc.car,door,'jacked',npc.time,npc.clip.group);
  if(npc.kind==='getOut')this.openDoor(npc.car,door,'getOut',npc.time,npc.clip.group);
  if(npc.time<npc.clip.clip.duration)return;
  // The car stays held while the player who dragged the driver out is still climbing in.
  npc.done=true;if(npc.kind==='jacked'&&!npc.onOut)npc.held=HELD_SECONDS;if(this.car!==npc.car||!this.phase)npc.car.holdForEntry=false;if(!npc.seat)npc.car.driverLeaving=false;
  const local=this.doorPoint(npc.car,npc.seat?'right':'left');if(!local)return;
  const end=clipRootEnd(npc.clip.clip),base=npc.car.worldPoint(npc.kind==='jacked'?{x:local.x+end.x,y:local.y+end.y,z:local.z}:local),ground=this.ground(base,npc.car)??base.y-1;
  if(npc.onOut)npc.onOut({x:base.x,y:ground+.03,z:base.z},npc.car.heading());else this.onDriverOut?.(npc.car,{x:base.x,y:ground+.03,z:base.z},npc.car.heading(),npc.kind==='jacked'?{key:npc.clip.key,clip:npc.clip.clip}:undefined,npc.who,npc.seat);
 }
 npcPose():NpcPose|undefined{return this.npcPoses()[0]?.pose;}
 /** Every NPC still leaving a car, with its clip. */
 npcPoses():{pose:NpcPose;clip:{key:string;clip:NativeAnimation}}[]{
  const out:{pose:NpcPose;clip:{key:string;clip:NativeAnimation}}[]=[];
  for(const npc of this.npcs){if(npc.done&&npc.held===undefined)continue;const local=this.doorPoint(npc.car,npc.seat?'right':'left');if(local)out.push({pose:{car:npc.car,seat:npc.seat,local,clip:npc.clip.key,seconds:Math.min(npc.time,npc.clip.clip.duration),who:npc.who},clip:{key:npc.clip.key,clip:npc.clip.clip}});}
  return out;
 }
 get npcClip(){return this.npcPoses()[0]?.clip;}
 /** One fixed step. Returns world displacement for the jump-out roll once the player is out of the car. */
 step(dt:number,input:{pedal:boolean;moving:boolean;steer?:{x:number;y:number;cameraYaw:number};fire?:boolean}):{x:number;z:number}|undefined{
  this.stepNpc(dt);
  const car=this.car;if(!this.phase||!car)return;
  // m_Car is a registered reference: a car deleted under the task (a script's DELETE_CAR) ends it.
  if(car.disposed){this.cancel();return;}
  // From the door on, the car settles under the player. Its brakes alone left a car that had been rolling at a few
  // metres a second creeping on through the line-up, the door and the pull-out, dragging CJ along its side
  // (authored: the brakes plus a firm damping of its ground speed).
  if(!car.occupied&&car.holdForEntry&&this.phase!=='approach'){
   const b=car.car.body;
   if(b.isDynamic()){const k=Math.max(0,1-dt*ENTRY_SETTLE_RATE),v=b.linvel(),w=b.angvel();b.setLinvel({x:v.x*k,y:v.y,z:v.z*k},true);b.setAngvel({x:w.x,y:w.y*k,z:w.z},true);}
  }
  if(car.wrecked&&!this.rolling&&this.phase!=='jumpOut'){this.cancel();return;}
  if(this.phase==='approach')return;
  if((this.phase==='align'||this.phase==='open'||this.phase==='pullout')&&this.playerQuits(car,input))this.quitAfterDoor=true;
  if(this.lineUp)this.lineUp.time+=dt;
  const clip=this.clipFor(),previous=this.time;this.time+=dt;
  const finished=this.time>=(clip?.clip.duration??0),group=clip?.group??0;
  switch(this.phase){
   case 'align':if(finished)this.afterAlign();break;
   case 'locked':if(finished){this.message='This car is locked.';this.cancel();}break;
   case 'open':this.openDoor(car,this.door,'open',this.time,group);if(finished){car.openDoor(this.door,1);this.afterOpen();}break;
   case 'pullout':this.openDoor(car,this.door,'pullout',this.time,group);if(finished){if(this.quitAfterDoor)this.quit();else this.beginGetIn();}break;
   case 'getIn':if(finished)this.afterGetIn(input.pedal);break;
   case 'closeInside':this.openDoor(car,this.door,'closeInside',this.time,group);if(finished){if(!car.doors[this.door].closed)car.openDoor(this.door,0);this.afterCloseInside();}break;
   // CTaskComplexEnterCar orders the driver out and starts CTaskSimpleCarShuffle at once: CJ slides across while the
   // driver climbs out, holding the last frame only if he gets there first.
   case 'shuffle':if(finished){if(this.npcs.some(n=>!n.done&&n.kind==='getOut'&&n.car===car))this.time=previous;else this.setIn();}break;
   case 'seated':this.driving.step(dt,{steer:car.steerAngle,reversing:car.gasPedal<0&&!(car.modelFlags&MODEL_FLAG.low),idleFull:this.time*this.blendDelta>=1,ride:this.rideAnims(),duration:name=>this.clips.ped(name)?.duration});break;
   case 'waitSlow':
    // CTaskSimpleCarWaitToSlowDown ends once the car can be left; a get-out with no room then gives the car back
    // (a blocked car must not keep its driver pinned with the handbrake on and no controls).
    if(car.canStepOut()){if(!this.beginGetOut())this.backToSeat(car);}else if(car.canJumpOut(dt))this.beginJumpOut();break;
   case 'getOut':if(this.doorExisted&&this.upright(car))this.openDoor(car,this.door,'getOut',this.time,group);if(finished)this.afterGetOut(input.moving);break;
   case 'closeOutside':
    this.openDoor(car,this.door,'closeOutside',this.time,group);if(finished){if(!car.doors[this.door].closed)car.openDoor(this.door,0);this.finishOnFoot();}break;
   case 'jumpOut':{
    if(!this.setOut){
     // m_initialVehSpeed decays from the clip's start, while the ped is still in the car.
     if(this.time<=JUMP_OUT_SET_OUT){this.jumpSpeed*=Math.pow(.96,(this.time-previous)*50);if(this.doorExisted)this.openDoor(car,this.door,'rollout',this.time,group);break;}
     this.setOut=true;
     const world=car.worldPoint(this.doorPoint(car,this.side,1)!),ground=this.ground(world,car),heading=car.heading()+(this.upright(car)?0:Math.PI);
     car.setPedOut({x:world.x,y:Math.max(ground??world.y-1,world.y-1)+.03,z:world.z},heading);car.driverless=true;car.engineRunning=false;if(!car.doorMissing(this.door))car.setDoorOpen(this.door);
     // CTaskSimpleCarJumpOut::ProcessPed hands the ped the car's whole move speed, the vertical part included.
     this.sim.player.grounded=false;this.sim.player.verticalSpeed=car.car.body.linvel().y;this.sim.exitCarriesSpeed=true;
     // CTaskSimpleCarJumpOut::ProcessPed: m_pEntityIgnoredCollision = the vehicle.
     this.sim.ignoreVehicleOnExit(car.car.body);
    }
    // m_initialVehSpeed decays by 0.96^ts and shifts the ped forward until 0.45 s; the clip's own root X/Y is extracted.
    let forward=0;
    if(previous<JUMP_OUT_CARRY){const to=Math.min(this.time,JUMP_OUT_CARRY),frames=Math.max(0,to-Math.max(previous,JUMP_OUT_SET_OUT))*50;this.jumpSpeed*=Math.pow(.96,(to-previous)*50);forward=this.jumpSpeed*frames;}
    const motion=clip?rootMotion(clip.clip,{track:clip.clip.tracks.findIndex(t=>t.boneId===0&&t.translations),axes:['x','y']}).delta(previous,Math.min(this.time,clip.clip.duration),false,new Vector3()):new Vector3();
    const h=this.sim.player.heading,right={x:-Math.cos(h),z:Math.sin(h)},ahead={x:Math.sin(h),z:Math.cos(h)},along=forward+motion.y;
    if(finished)this.begin('getUp',8);
    return {x:right.x*motion.x+ahead.x*along,z:right.z*motion.x+ahead.z*along};
   }
   case 'getUp':if(finished){this.phase=undefined;this.car=undefined;}break;
   case 'crawlOut':if(finished){car.driverless=true;this.finishOnFoot();}break;
   case 'draggedOut':{
    if(this.doorExisted&&this.upright(car))this.openDoor(car,this.door,'jacked',this.time,group);
    if(!finished||!clip)break;
    const local=this.doorPoint(car,'left');
    const end=clipRootEnd(clip.clip),base=local?car.worldPoint({x:local.x+end.x,y:local.y+end.y,z:local.z}):car.worldPoint({x:-1.4,y:0,z:0}),ground=this.ground(base,car)??base.y-1;
    car.setPedOut({x:base.x,y:ground+.03,z:base.z},car.heading());car.driverless=true;car.exitHandbrake=false;
    this.finishOnFoot();this.onPlayerDraggedOut?.(clip);
    break;
   }
  }
  return undefined;
 }
 private upright(car:WorldCar){const q=car.car.body.rotation();return 1-2*(q.x*q.x+q.z*q.z)>0;}
 /** Keeps the simulation player at the pinned entity so the camera, streaming and pickups follow it. */
 syncPlayer(){
  const car=this.car;if(!car||!this.pinned||this.phase==='seated'||this.phase==='waitSlow')return;
  const pose=this.pose();if(!pose?.local)return;
  const world=car.worldPoint(pose.local),player=this.sim.player;
  player.previous={...player.position};player.position={x:world.x,y:world.y-1,z:world.z};player.heading=car.heading()+(pose.headingOffset??0);player.speed=0;player.grounded=true;
  this.sim.playerBody.setTranslation({x:world.x,y:world.y-.1,z:world.z},true);this.sim.playerBody.setNextKinematicTranslation({x:world.x,y:world.y-.1,z:world.z});
  this.sim.playerCollider.setTranslation({x:world.x,y:world.y-.1,z:world.z});
 }
 /** Render pose for the player, or undefined while the on-foot controller animates it. */
 pose():EntryPose|undefined{
  const car=this.car,phase=this.phase;if(!car||!phase||phase==='approach')return;
  const clip=this.clipFor();if(!clip)return;
  const blend=Math.min(1,this.time*this.blendDelta);
  if(phase==='seated'||phase==='waitSlow'){
   const seat=car.seat('left');if(!seat)return;
   return {car,local:seat,clip:clip.key,seconds:clip.clip.duration,blend,overlays:this.driving.overlays()};
  }
  if(phase==='jumpOut'&&!this.setOut){const seat=car.seat('left');return seat?{car,local:seat,clip:clip.key,seconds:this.time,blend}:undefined;}
  if(this.rolling||phase==='crawlOut'){const p=this.sim.player.position;return {world:{x:p.x,y:p.y+1,z:p.z},heading:this.sim.player.heading,clip:clip.key,seconds:this.time,blend};}
  const length=Math.max(clip.clip.duration,1e-3),mult=phase==='getIn'?Math.max(0,1-this.time/length):phase==='getOut'?Math.min(1,this.time/length):phase==='closeInside'||phase==='shuffle'?0:1;
  const local=this.doorPoint(car,this.side,mult);if(!local)return;
  let headingOffset=0;
  if(this.lineUp&&this.lineUp.time<LINE_UP_SECONDS){const u=1-this.lineUp.time/LINE_UP_SECONDS;local.x+=this.lineUp.local.x*u;local.y+=this.lineUp.local.y*u;local.z+=this.lineUp.local.z*u;headingOffset=this.lineUp.heading*u;}
  return {car,local,headingOffset,clip:clip.key,seconds:this.time,blend};
 }
}
