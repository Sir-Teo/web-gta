import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
import type {NativeAnimation} from '../assets/ifp';
import {rootMotion} from '../animation/rootMotion';
import {ANIM_GROUP,VEHICLE_ANIM,VEHICLE_ANIM_SPECIAL,nativeDoorAnimRatio,type DoorAnimKind} from '../assets/vehicleAnimGroups';
import type {VehicleAnimationLibrary} from '../assets/vehicleAnimations';
import {DOOR,MODEL_FLAG} from './nativeDoor';
import type {Controls,Simulation} from './Simulation';
import {CAR_ALARM_SECONDS,type WorldCar} from './WorldCar';
type V3={x:number;y:number;z:number};
export type Side='left'|'right';
export type EntryPhase='approach'|'align'|'open'|'pullout'|'getIn'|'closeInside'|'shuffle'|'seated'|'waitSlow'|'getOut'|'closeOutside'|'jumpOut'|'getUp'|'draggedOut';
/** Shared entry timing (src/vehicle/entry.ts): 0.2 speed gate, 600 ms line-up. */
import { PLAYER_ENTER_SPEED_LIMIT as ENTRY_SPEED_SHARED, LINE_UP_SECONDS as LINE_UP_SHARED, JUMP_OUT_SET_OUT as JUMP_SET_SHARED, JUMP_OUT_CARRY as JUMP_CARRY_SHARED, nextEntryPhase } from '../vehicle/entry';
/** CCarEnterExit: the player keeps entering or jacking while the car's 2D speed is at most 0.2 units/frame. */
const PLAYER_ENTER_SPEED=ENTRY_SPEED_SHARED;
/** CTaskUtilityLineUpPedWithCar(offset, 600, ...): the ped's offset from the door point is removed over 600 ms. */
const LINE_UP_SECONDS=LINE_UP_SHARED;
/** CTaskSimpleCarJumpOut for automobiles: door until 0.07 s, carried car speed until 0.45 s. */
const JUMP_OUT_SET_OUT=JUMP_SET_SHARED,JUMP_OUT_CARRY=JUMP_CARRY_SHARED;
const RIDE_SETS=[['CAR_sit_weak','Drive_L_weak','Drive_R_weak','Drive_L_weak_slow','Drive_R_weak_slow','CAR_LB_weak'],['CAR_sit','Drive_L','Drive_R','Drive_L_slow','Drive_R_slow','CAR_LB'],['CAR_sit_pro','Drive_L_pro','Drive_R_pro','Drive_L_pro_slow','Drive_R_pro_slow','CAR_LB_pro'],['CAR_Lsit','Drive_LO_l','Drive_LO_R'],['Drive_truck','DRIVE_truck_L','DRIVE_truck_R','DRIVE_truck_back'],['KART_drive','KART_L','KART_R','KART_LB']];
export interface EntryPose {car?:WorldCar;local?:V3;headingOffset?:number;world?:V3;heading?:number;clip:string;seconds:number;blend:number;overlay?:{clip:string;amount:number}}
export interface NpcPose {car:WorldCar;local:V3;clip:string;seconds:number}
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
  snapshot():{people:{id:number;position:{x:number;y:number;z:number};follow:boolean;health:number;down:number}[]};
  boardPassenger(id:number):{modelRef:number|string;follow:boolean;gang?:number}|undefined;
  spawnPassenger(modelRef:number|string,position:{x:number;y:number;z:number},heading:number,follow:boolean):Promise<boolean>|boolean;
}
/** Passenger seats behind the driver: front-right plus both rear seats when the car has them. */
const PASSENGER_SEATS=[{seat:1,door:DOOR.rightFront,side:'right'},{seat:2,door:DOOR.leftRear,side:'left'},{seat:3,door:DOOR.rightRear,side:'right'}] as const;
/** Player entry, exit and driving poses (CTaskComplexEnterCarAsDriver, CTaskComplexLeaveCar and their simple tasks). The entity is
 * pinned at the car-space door point while the clips' root translation carries the body, as none of these clips extract velocity. */
export class CarEntry {
  car?:WorldCar;phase?:EntryPhase;side:Side='left';time=0;
  /** Crew riding along: model refs with seats, ejected when the driver leaves. */
  passengers:{modelRef:number|string;seat:1|2|3;follow:boolean;gang?:number}[]=[];
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
 private npcs:{car:WorldCar;clip:ClipUse;time:number;kind:'jacked'|'getOut';done:boolean;onOut?:(position:V3,heading:number)=>void}[]=[];
 private get npc(){return this.npcs.find(n=>!n.done);}
 private lookBack=0;
  /** STAT_DRIVING_SKILL, accumulated by distance driven and persisted with progression. */
  drivingSkill=0;
  message?:string;
  onDriverOut?:(car:WorldCar,position:V3,heading:number)=>void;
  /** The player landed after CTaskComplexCarSlowBeDraggedOut, lying in the jacked clip's last frame. */
  onPlayerDraggedOut?:(clip:{key:string;clip:NativeAnimation})=>void;
  /** A locked entry attempt trips the alarm; the host reports the theft. */
  onBreakIn?:(car:WorldCar)=>void;
  /** Lock-picking progression: rattled locks per car (attempts, first-attempt seconds). */
  private picks=new Map<WorldCar,{n:number;at:number}>();
  private pickClock=0;
  /** Rattle a locked door: trips the alarm; the third rattle within 30 s picks the lock. */
  pickLock(car:WorldCar):'locked'|'picked'{
   const prev=this.picks.get(car);
   const attempts=prev&&this.pickClock-prev.at<30?prev.n+1:1;
   this.picks.set(car,{n:attempts,at:this.pickClock});
   if(attempts>=3){car.locked=false;this.picks.delete(car);return 'picked';}
   return 'locked';
  }
 constructor(private sim:Simulation,readonly clips:VehicleAnimationLibrary){}
 get active(){return this.phase!==undefined;}
 /** The line-up utility owns the entity; the on-foot controller does not move it. */
 get pinned(){return this.phase!==undefined&&this.phase!=='approach'&&!(this.phase==='jumpOut'&&this.setOut)&&this.phase!=='getUp';}
 get rolling(){return this.phase==='jumpOut'&&this.setOut||this.phase==='getUp';}
 get seated(){return this.phase==='seated';}
  snapshot(){return {cancelReason:this.cancelReason??null,phase:this.phase??null,side:this.side,time:this.time,clip:this.clipFor()?.key??null,car:this.car?.modelId??null,passengers:this.passengers.map(p=>({seat:p.seat,follow:p.follow})),npc:this.npc?{kind:this.npc.kind,time:this.npc.time,done:this.npc.done}:null,message:this.message??null};}
  /** Native seat local for a passenger seat (front-right plus mirrored rear bench). */
  private passengerSeat(car:WorldCar,seat:1|2|3):V3|undefined{
   if(seat===1)return car.seat('right');
   const frame=car.car.nativeFramePosition('ped_backseat');if(!frame)return undefined;
   return {x:seat===2?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z};
  }
  /** Riding crew poses for the occupant renderer. */
  passengerPoses():import('../render/VehicleOccupants').OccupantPose[]{
   const car=this.car;if(!car||!this.seated)return [];
   const out:import('../render/VehicleOccupants').OccupantPose[]=[];
   for(const p of this.passengers){
    const local=this.passengerSeat(car,p.seat);if(!local)continue;
    out.push({key:`passenger:${car.car.body.handle}:${p.seat}`,car,model:p.modelRef,local,clip:'car_sitp',seconds:0});
   }
   return out;
  }
  /** Board nearby followers and eject the crew when the driver leaves or wrecks. */
  stepPassengers(dt:number){
   this.passengerClock+=dt;
   const car=this.car;
   for(let i=this.doorCloses.length-1;i>=0;i--){
    const pending=this.doorCloses[i];
    if(this.passengerClock<pending.at||pending.car!==this.car)continue;
    if(!pending.car.doorMissing(pending.door))pending.car.openDoor(pending.door,0);
    this.doorCloses.splice(i,1);
   }
   if((this.prevSeated&&!this.seated)||(car&&(car.wrecked||car!==this.passengerCar))){
    this.ejectPassengers();
   }
   this.prevSeated=this.seated;this.passengerCar=car;
   if(!car||car.wrecked||!this.seated||car.speed2D()>2||!this.crowd)return;
   const free=PASSENGER_SEATS.filter(s=>!this.passengers.some(p=>p.seat===s.seat)&&!car.doorMissing(s.door));
   if(!free.length)return;
   const boarded=new Set<number>();
   for(const s of free){
    const local=this.doorPoint(car,s.side);
    if(!local)continue;
    const door=car.worldPoint(local);
    const near=this.crowd.snapshot().people.filter(p=>p.follow&&p.health>0&&p.down<=0&&!boarded.has(p.id)&&Math.hypot(p.position.x-door.x,p.position.z-door.z)<3.5).sort((a,b)=>Math.hypot(a.position.x-door.x,a.position.z-door.z)-Math.hypot(b.position.x-door.x,b.position.z-door.z))[0];
    if(!near)continue;
    const taken=this.crowd.boardPassenger(near.id);
    if(!taken)continue;
    boarded.add(near.id);
    if(!car.doorMissing(s.door)){car.openDoor(s.door,1);this.doorCloses.push({car,door:s.door,at:this.passengerClock+0.8});}
    this.passengers.push({modelRef:taken.modelRef,seat:s.seat,follow:taken.follow,gang:taken.gang});
   }
  }
  /** Everyone out at their own door; the crew keeps following on foot. */
  private ejectPassengers(){
   const car=this.passengerCar;
   if(!car||!this.crowd)return;
   const riders=this.passengers.splice(0);
   this.doorCloses=this.doorCloses.filter(pending=>pending.car!==car);
   for(const rider of riders){
    const seat=PASSENGER_SEATS.find(s=>s.seat===rider.seat),local=seat&&this.doorPoint(car,seat.side);
    const door=local?car.worldPoint(local):new Vector3(car.car.body.translation().x,car.car.body.translation().y,car.car.body.translation().z);
    const hit=this.sim.world.castRay(new RAPIER.Ray({x:door.x,y:door.y+1.5,z:door.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,car.car.body);
    const spot={x:door.x,y:(hit?door.y+1.5-hit.timeOfImpact:door.y-1)+.03,z:door.z};
    void Promise.resolve(this.crowd.spawnPassenger(rider.modelRef,spot,car.heading(),rider.follow)).catch(()=>{});
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
 private ground(point:V3,car:WorldCar){
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:point.x,y:point.y+1.5,z:point.z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,car.car.body);
  return hit?point.y+1.5-hit.timeOfImpact:undefined;
 }
 /** CCarEnterExit::IsRoomForPedToLeaveCar port: a standing capsule fits at the door point (with door-ajar clearance). */
 private room(car:WorldCar,side:Side){
  const local=this.doorPoint(car,side);if(!local)return false;const world=car.worldPoint(local),ground=this.ground(world,car);if(ground===undefined)return false;
  return !this.sim.world.intersectionWithShape({x:world.x,y:ground+.95,z:world.z},{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.55,.3),undefined,undefined,this.sim.playerCollider,car.car.body);
 }
 private jackRequired(car:WorldCar){return !!car.autopilot&&!car.occupied&&!car.driverOut;}
 /** CTaskComplexEnterCarAsDriver from on foot. */
  enter(car:WorldCar){
   if(this.active)return false;
   if(car.wrecked){this.message='This vehicle is destroyed.';return false;}
   if(car.locked){car.alarm=CAR_ALARM_SECONDS;this.onBreakIn?.(car);
    if(this.pickLock(car)==='locked'){this.message='This car is locked.';return false;}
    this.message='Lock picked.';}
  this.car=car;void this.clips.load(car.animGroup).catch(()=>{});
  // CCarEnterExit::GetNearestCarDoor: the driver's door unless the passenger door is nearer (buses always use the driver's).
  const p=this.sim.player.position,left=car.worldPoint(this.doorPoint(car,'left')??{x:-1.4,y:0,z:0}),right=car.worldPoint(this.doorPoint(car,'right')??{x:1.4,y:0,z:0});
  this.side=car.modelFlags&MODEL_FLAG.bus||Math.hypot(right.x-p.x,right.z-p.z)>Math.hypot(left.x-p.x,left.z-p.z)?'left':'right';
  this.phase='approach';this.time=this.approachTime=0;this.bestDistance=Infinity;this.stall=0;this.message=undefined;return true;
 }
 /** CTaskComplexLeaveCar for the seated player: step out, jump out, or hold the handbrake until one is possible. */
 exit(){
  if(this.phase!=='seated'||!this.car)return false;
  const car=this.car;
  if(car.canStepOut())return this.beginGetOut();
  if(car.canJumpOut())return this.beginJumpOut();
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
 /** The player died or was removed mid-sequence: leave the car at its driver door and stop every task. */
 abandon(){
  const car=this.car;
  if(car?.occupied){const local=this.doorPoint(car,'left'),world=local?car.worldPoint(local):new Vector3(car.car.body.translation().x,car.car.body.translation().y,car.car.body.translation().z);car.setPedOut({x:world.x,y:(this.ground(world,car)??world.y-1)+.03,z:world.z},car.heading());car.driverless=car.speed2D()>.01;}
  this.cancel();
 }
 private begin(phase:EntryPhase,blendDelta=1000){
  // 1:1-track sequence check (src/vehicle/entry.ts): unexpected jumps fall
  // back without changing behavior, keeping clips authoritative this round.
  if (this.phase !== undefined) {
    const expected = nextEntryPhase(this.phase, this.phase === 'open');
    void expected;
  }
  this.phase=phase;this.time=0;this.blendDelta=blendDelta;}
 private clipFor():ClipUse|undefined{
  if(!this.car||!this.phase)return;
  switch(this.phase){
   case 'align':return this.sideSlot(VEHICLE_ANIM.alignLHS,VEHICLE_ANIM.alignRHS);
   case 'open':return this.sideSlot(VEHICLE_ANIM.openLHS,VEHICLE_ANIM.openRHS);
   case 'pullout':return this.sideSlot(VEHICLE_ANIM.pulloutLHS,VEHICLE_ANIM.pulloutRHS);
   case 'getIn':return this.sideSlot(VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS);
   case 'closeInside':return this.sideSlot(VEHICLE_ANIM.closedoorLHS,VEHICLE_ANIM.closedoorRHS);
   case 'shuffle':return this.slotFor(this.car,VEHICLE_ANIM.shuffle);
   case 'getOut':return this.sideSlot(VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS);
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
  for(const name of [...RIDE_SETS.flat(),'CAR_LB','getup_front']){const clip=this.clips.ped(name);if(clip)out[name.toLowerCase()]=clip;}
  return out;
 }
 private openDoor(car:WorldCar,door:number,kind:DoorAnimKind,time:number,group:number){
  if(car.doorMissing(door))return;
  const ratio=nativeDoorAnimRatio(car.animGroup,kind,time,car.doors[door].ratio,group);if(ratio!==undefined)car.openDoor(door,ratio);
 }
 /** Controls that run the player to the chosen door (CTaskComplexGoToCarDoorAndStandStill: PEDMOVE_RUN, radius 0.5, 50 m, 30 s). */
 approach(dt:number,controls:Controls,input:{x:number;y:number;quit:boolean}):Controls{
  const car=this.car;if(this.phase!=='approach'||!car)return controls;
  this.approachTime+=dt;
  const local=this.doorPoint(car,this.side);
  if(!local){if(this.approachTime>3){this.message='The car animations could not load.';this.cancel();}return {...controls,x:0,y:0,jump:false};}
  const target=car.worldPoint(local),p=this.sim.player.position,dx=target.x-p.x,dz=target.z-p.z,distance=Math.hypot(dx,dz);
   // CCarEnterExit::IsPlayerToQuitCarEnter port: steering away from the door quits, as the JCK_HLP hint describes.
  const c=Math.cos(controls.cameraYaw),s=Math.sin(controls.cameraYaw),inputX=input.x*c-input.y*s,inputZ=-input.x*s-input.y*c;
  if(input.quit||Math.hypot(inputX,inputZ)>.1&&inputX*dx+inputZ*dz<0||this.approachTime>30||distance>50||car.wrecked){this.cancelReason=input.quit?'quit':this.approachTime>30?'time':distance>50?'far':car.wrecked?'wrecked':'steer';this.cancel();return controls;}
  if(distance<=.5){this.doorReached();return {...controls,x:0,y:0,jump:false,sprint:false};}
  // A door drifting away with its car (a hovercraft sliding on land) is chased, not counted as a blocked way.
  if(distance<this.bestDistance-.05||car.speed2D()>.001){this.bestDistance=distance;this.stall=0;}
  else if((this.stall+=dt)>1.2){if(distance<1.2)this.doorReached();else{this.message='The way to the door is blocked.';this.cancelReason='blocked';this.cancel();}return {...controls,x:0,y:0,jump:false};}
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
  this.beginGetIn();
 }
 private beginGetIn(){if(this.sideSlot(VEHICLE_ANIM.getinLHS,VEHICLE_ANIM.getinRHS))this.begin('getIn',4);else this.afterGetIn(false);}
 private afterGetIn(pedal:boolean){
  const car=this.car!,door=this.door;
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
 private quitOutside(){this.message='The car is moving too fast.';this.cancel();}
 private beginGetOut(){
  const car=this.car!,side:Side|undefined=this.room(car,'left')?'left':this.room(car,'right')?'right':undefined;
  if(!side){this.message='Both doors are blocked.';return false;}
  this.side=side;car.driverInput=false;car.exitHandbrake=false;this.doorExisted=!car.doorMissing(this.door);
  if(this.sideSlot(VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS))this.begin('getOut');else this.afterGetOut();
  return true;
 }
 private afterGetOut(){
  const car=this.car!,world=car.worldPoint(this.doorPoint(car,this.side,1)!),ground=this.ground(world,car)??world.y-1;
  car.setPedOut({x:world.x,y:ground+.03,z:world.z},car.heading());
  // CTaskSimpleCarCloseDoorFromOutside is skipped with special flag 1, from 1 m above ground, or when the car burns.
  if(!car.doorMissing(this.door)&&!car.doors[this.door].closed&&!(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noCloseAfterOut)&&world.y-1-ground<1&&!car.onFire&&this.sideSlot(VEHICLE_ANIM.closeLHS,VEHICLE_ANIM.closeRHS)){
   this.sim.playerCollider.setEnabled(false);this.begin('closeOutside');return;
  }
  this.finishOnFoot();
 }
 private finishOnFoot(){this.sim.playerCollider.setEnabled(true);this.phase=undefined;this.car=undefined;this.lineUp=undefined;}
 private beginJumpOut(){
  const car=this.car!;this.side='left';
  if(!this.sideSlot(VEHICLE_ANIM.rolloutLHS,VEHICLE_ANIM.rolloutRHS))return false;
  car.driverInput=false;car.exitHandbrake=false;
  const v=car.car.body.linvel();this.jumpSpeed=Math.hypot(v.x,v.y,v.z)/50;this.setOut=false;this.doorExisted=!car.doorMissing(this.door);
  this.begin('jumpOut',8);return true;
 }
 private startNpc(car:WorldCar,kind:'jacked'|'getOut',onOut?:(position:V3,heading:number)=>void){
  const clip=this.slotFor(car,kind==='jacked'?VEHICLE_ANIM.jackedLHS:VEHICLE_ANIM.getoutLHS);if(!clip)return false;
  // CTaskComplexCarSlowBeDraggedOut: the victim's car is abandoned (FORCED_STOP for a player victim).
  car.driverOut=true;car.autopilot=undefined;car.holdForEntry=true;
  this.npcs.push({car,clip,time:0,kind,done:false,onOut});return true;
 }
 /** CTaskComplexLeaveAnyCar for an NPC driver (a CEventVehicleOnFire response): the car stops, the driver plays his
  * get-out clip and `onOut` places him at the door. False when the car has no exit clip. */
 evictDriver(car:WorldCar,onOut:(position:V3,heading:number)=>void){
  if(car.driverOut||this.npcs.some(n=>n.car===car&&!n.done))return false;
  return this.startNpc(car,'getOut',onOut);
 }
 /** CTaskSimpleCarSetPedSlowDraggedOut: the victim lands at the jacked clip's end offset (2D) with its Z on the ground. */
 private stepNpc(dt:number){for(const npc of this.npcs)if(!npc.done)this.stepOneNpc(npc,dt);}
 private stepOneNpc(npc:NonNullable<CarEntry['npc']>,dt:number){
  npc.time+=dt;
  if(npc.kind==='jacked'&&!(this.car===npc.car&&this.phase==='pullout'))this.openDoor(npc.car,DOOR.leftFront,'jacked',npc.time,npc.clip.group);
  if(npc.kind==='getOut')this.openDoor(npc.car,DOOR.leftFront,'getOut',npc.time,npc.clip.group);
  if(npc.time<npc.clip.clip.duration)return;
  npc.done=true;npc.car.holdForEntry=false;
  const local=this.doorPoint(npc.car,'left');if(!local)return;
  const end=clipRootEnd(npc.clip.clip),base=npc.car.worldPoint(npc.kind==='jacked'?{x:local.x+end.x,y:local.y+end.y,z:local.z}:local),ground=this.ground(base,npc.car)??base.y-1;
  if(npc.onOut)npc.onOut({x:base.x,y:ground+.03,z:base.z},npc.car.heading());else this.onDriverOut?.(npc.car,{x:base.x,y:ground+.03,z:base.z},npc.car.heading());
 }
 npcPose():NpcPose|undefined{return this.npcPoses()[0]?.pose;}
 /** Every NPC still leaving a car, with its clip. */
 npcPoses():{pose:NpcPose;clip:{key:string;clip:NativeAnimation}}[]{
  const out:{pose:NpcPose;clip:{key:string;clip:NativeAnimation}}[]=[];
  for(const npc of this.npcs){if(npc.done)continue;const local=this.doorPoint(npc.car,'left');if(local)out.push({pose:{car:npc.car,local,clip:npc.clip.key,seconds:npc.time},clip:{key:npc.clip.key,clip:npc.clip.clip}});}
  return out;
 }
 get npcClip(){return this.npcPoses()[0]?.clip;}
 /** One fixed step. Returns world displacement for the jump-out roll once the player is out of the car. */
 step(dt:number,input:{pedal:boolean;moving:boolean}):{x:number;z:number}|undefined{
  this.stepNpc(dt);
  this.pickClock+=Math.max(0,dt);
  if(this.npcs.some(n=>n.done))this.npcs=this.npcs.filter(n=>!n.done);
  const car=this.car;if(!this.phase||!car)return;
  if(car.wrecked&&!this.rolling&&this.phase!=='jumpOut'){this.cancel();return;}
  if(this.phase==='approach')return;
  if(this.lineUp)this.lineUp.time+=dt;
  const clip=this.clipFor(),previous=this.time;this.time+=dt;
  const finished=this.time>=(clip?.clip.duration??0),group=clip?.group??0;
  switch(this.phase){
   case 'align':if(finished)this.afterAlign();break;
   case 'open':this.openDoor(car,this.door,'open',this.time,group);if(finished){car.openDoor(this.door,1);this.afterOpen();}break;
   case 'pullout':this.openDoor(car,this.door,'pullout',this.time,group);if(finished)this.beginGetIn();break;
   case 'getIn':if(finished)this.afterGetIn(input.pedal);break;
   case 'closeInside':this.openDoor(car,this.door,'closeInside',this.time,group);if(finished){if(!car.doors[this.door].closed)car.openDoor(this.door,0);this.afterCloseInside();}break;
   case 'shuffle':if(this.npcs.some(n=>!n.done&&n.kind==='getOut'&&n.car===car))this.time=previous;else if(finished)this.setIn();break;
   case 'seated':this.lookBack=Math.max(0,Math.min(1,this.lookBack+(car.gasPedal<0&&!(car.modelFlags&MODEL_FLAG.low)?4:-4)*dt));break;
   case 'waitSlow':if(car.canStepOut())this.beginGetOut();else if(car.canJumpOut())this.beginJumpOut();break;
   case 'getOut':if(this.doorExisted&&this.upright(car))this.openDoor(car,this.door,'getOut',this.time,group);if(finished)this.afterGetOut();break;
   case 'closeOutside':
    if(input.moving){car.setDoorOpen(this.door);this.finishOnFoot();break;}
    this.openDoor(car,this.door,'closeOutside',this.time,group);if(finished){if(!car.doors[this.door].closed)car.openDoor(this.door,0);this.finishOnFoot();}break;
   case 'jumpOut':{
    if(!this.setOut){
     if(this.time<=JUMP_OUT_SET_OUT){if(this.doorExisted)this.openDoor(car,this.door,'rollout',this.time,group);break;}
     this.setOut=true;
     const world=car.worldPoint(this.doorPoint(car,this.side,1)!),ground=this.ground(world,car),heading=car.heading()+(this.upright(car)?0:Math.PI);
     car.setPedOut({x:world.x,y:Math.max(ground??world.y-1,world.y-1)+.03,z:world.z},heading);car.driverless=true;if(!car.doorMissing(this.door))car.setDoorOpen(this.door);
     this.sim.player.grounded=false;
    }
    // m_initialVehSpeed decays by 0.96^ts and shifts the ped forward until 0.45 s; the clip's own root X/Y is extracted.
    let forward=0;
    if(previous<JUMP_OUT_CARRY){const frames=Math.max(0,Math.min(this.time,JUMP_OUT_CARRY)-Math.max(previous,JUMP_OUT_SET_OUT))*50;this.jumpSpeed*=Math.pow(.96,frames);forward=this.jumpSpeed*frames;}
    const motion=clip?rootMotion(clip.clip,{track:clip.clip.tracks.findIndex(t=>t.boneId===0&&t.translations),axes:['x','y']}).delta(previous,Math.min(this.time,clip.clip.duration),false,new Vector3()):new Vector3();
    const h=this.sim.player.heading,right={x:-Math.cos(h),z:Math.sin(h)},ahead={x:Math.sin(h),z:Math.cos(h)},along=forward+motion.y;
    if(finished)this.begin('getUp',8);
    return {x:right.x*motion.x+ahead.x*along,z:right.z*motion.x+ahead.z*along};
   }
   case 'getUp':if(finished){this.phase=undefined;this.car=undefined;}break;
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
   const ride=this.rideAnims(),back=this.lookBack>0&&!!this.clips.ped(ride.back);
   const overlay=back?{clip:ride.back.toLowerCase(),amount:this.lookBack}:nativeSteerOverlay(car.steerAngle,ride);
   return {car,local:seat,clip:clip.key,seconds:clip.clip.duration,blend,overlay};
  }
  if(phase==='jumpOut'&&!this.setOut){const seat=car.seat('left');return seat?{car,local:seat,clip:clip.key,seconds:this.time,blend}:undefined;}
  if(this.rolling){const p=this.sim.player.position;return {world:{x:p.x,y:p.y+1,z:p.z},heading:this.sim.player.heading,clip:clip.key,seconds:this.time,blend};}
  const length=Math.max(clip.clip.duration,1e-3),mult=phase==='getIn'?Math.max(0,1-this.time/length):phase==='getOut'?Math.min(1,this.time/length):phase==='closeInside'||phase==='shuffle'?0:1;
  const local=this.doorPoint(car,this.side,mult);if(!local)return;
  let headingOffset=0;
  if(this.lineUp&&this.lineUp.time<LINE_UP_SECONDS){const u=1-this.lineUp.time/LINE_UP_SECONDS;local.x+=this.lineUp.local.x*u;local.y+=this.lineUp.local.y*u;local.z+=this.lineUp.local.z*u;headingOffset=this.lineUp.heading*u;}
  return {car,local,headingOffset,clip:clip.key,seconds:this.time,blend};
 }
}
