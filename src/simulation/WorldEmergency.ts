import RAPIER from '@dimforge/rapier3d-compat';
import {pedEnteredVehicleLeaveDelay} from './nativePedEnteredVehicle';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {worldPaths} from '../assets/worldPaths';
import {worldLevelAt,type WorldZones} from '../assets/worldZones';
import {VEHICLE_ANIM,VEHICLE_ANIM_SPECIAL,nativeDoorAnimRatio} from '../assets/vehicleAnimGroups';
import type {VehicleAnimationLibrary} from '../assets/vehicleAnimations';
import type {NativeAnimation} from '../assets/ifp';
import {NativeAccidentManager,type Accident,type AccidentPed} from '../ped/nativeAccidents';
import {clipRootEnd,nativeDoorPoint} from './CarEntry';
import {DOOR,sitClip} from './nativeDoor';
import {generateCarCreationCoors2,newCarCreationCache} from './nativeCarCreationCoors';
import type {ScriptedPedOrder} from './nativeScriptedPedTasks';
import {DRIVINGSTYLE,type ScriptCarMissions} from './ScriptCarMissions';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';
import type {WorldFleet} from './WorldFleet';

/* The emergency services that answer the dead in the street: CCarCtrl::GenerateEmergencyServicesCar's ambulance, with
 * AddAmbulanceOccupants' two medics on CTaskComplexMedicTreatInjuredPed.
 *
 * CCarCtrl::GenerateEmergencyServicesCar (0x42F9C0) and GenerateOneEmergencyServicesCar (0x42B7D0) are raw calls in
 * the reference; the dispatch is read from the iOS executable (0x10018fe74), which GenerateRandomCars runs whenever the
 * game clock crosses a 4096 ms boundary. Nothing is sent while SWITCH_EMERGENCY_SERVICES has it off, while CJ is
 * wasted or busted or a trip skip runs, above three stars, indoors, in the countryside (whose level has no ambulance,
 * medic, fire engine or fireman) or with the car count at its cap. With no ambulance on duty, two free accidents bring
 * one to the nearest of them, wherever it lies, 30 s after the last; with no fire engine on duty, three burning fires
 * not the script's bring one to the nearest fire, 35 s after the last. The car is made where a road crosses the
 * 160-unit circle round CJ (GenerateOneEmergencyServicesCar, see emergencyPlacement) and told to go there with its
 * siren on. CStreaming's default ambulance, medic, fire engine and fireman by level are the
 * executable's tables (0x100592cc0 to 0x100592d14).
 *
 * What the medics do is reversed (CarAI.cpp's AddAmbulanceOccupants, TaskComplexMedicTreatInjuredPed.cpp,
 * TaskComplexTreatAccident.cpp, TaskSimpleGiveCPR.cpp, EventHandler.cpp's ComputeReviveResponse):
 * - the driver drives to the accident at 30 under AVOID_CARS and, inside 10 units, both get out (the passenger when
 *   his partner has an accident within 10 units of the van);
 * - each runs to the next free accident (the driver to his own), walking inside 5 units, marks it treated, and within
 *   1 unit (2 up and down) turns to the body and gives CPR (MEDIC CPR); the body's death clock is reset as he starts,
 *   so it does not fade from under him;
 * - the clip's end revives the ped (health 100, CTaskComplexGetUpAndStandStill, then his own wander);
 * - with no free accident left a medic goes back to his seat (the passenger first stands for 10 s if he never had
 *   one), and with both aboard the van wanders at 30 under AVOID_CARS, turning for any new accident it hears of.
 * The browser's own: the van stops before the crew gets out (CTaskComplexLeaveCar's wait for the car to slow), the
 * accident's point is the body's origin (the thighs' midpoint is not read), and the siren goes off once the crew is
 * back aboard. */

export const MODEL_AMBULAN=416;
/** CStreaming::ms_aDefaultMedicModel by m_CurrLevel (countryside, Los Santos, San Fierro, Las Venturas), exe data the
 * reference only points at (0x8A5AC4; iOS 0x100592cc0: -1, 274, 276, 275). The countryside has none: the dispatch
 * sends nobody there. A script's car there (CREATE_EMERGENCY_SERVICES_CAR) takes Los Santos's crew, the browser's
 * own choice. */
export const DEFAULT_MEDIC_MODEL=[undefined,'laemt1','sfemt1','lvemt1'] as const;
/** CStreaming::ms_aDefaultAmbulanceModel by level (iOS 0x100592cd0: -1, 416, 416, 416). */
export const DEFAULT_AMBULANCE_MODEL=[undefined,416,416,416] as const;
/** CTaskComplexMedicTreatInjuredPed's distances: the van stops for the accident and the passenger joins inside 10
 * units (100 squared), the run turns to a walk inside 5 (25 squared), and treatment starts within 1 across and 2 up. */
export const MEDIC_LEAVE_CAR_DISTANCE=10,MEDIC_WALK_DISTANCE=5,MEDIC_TREAT_RADIUS=1,MEDIC_TREAT_HEIGHT=2;
/** CTaskSimpleStandStill(10000) for a passenger with nothing to treat. */
export const MEDIC_STAND_SECONDS=10;
/** CTaskComplexDriveToPoint and CTaskComplexCarDriveWander's cruise speed and style. */
export const MEDIC_CRUISE=30;
/** CCarCtrl::GenerateRandomCars (iOS 0x10018df80) runs the dispatch when (now ^ previous) >= 0x1000: the game clock has
 * crossed a 4096 ms boundary since the last frame. */
export function emergencyDispatchTick(previousMs:number,nowMs:number){return Math.floor(nowMs/4096)!==Math.floor(previousMs/4096);}
export const EMERGENCY_MAX_WANTED=3,AMBULANCE_MIN_FREE_ACCIDENTS=2,AMBULANCE_INTERVAL_MS=30000;
/** GenerateEmergencyServicesCar's opening gate (iOS 0x10018fe88 to 0x10018ff28), both halves behind it:
 * CCarCtrl::bAllowEmergencyServicesToBeCreated (SWITCH_EMERGENCY_SERVICES); 0x1001b2558, read as CGameLogic's GameState not
 * PLAYING or its SkipState SKIP_IN_PROGRESS (from the stores to the two words); CWanted's level no more than 3; CGame::currArea 0; CGame::currLevel not the countryside.
 * The car count against MaxNumberOfCarsInUse is the caller's (the browser's own budget). */
export function emergencyDispatchOpen(o:{enabled:boolean;gameLogicBusy:boolean;wanted:number;interior:boolean;level:number}){
 return o.enabled&&!o.gameLogicBusy&&o.wanted<=EMERGENCY_MAX_WANTED&&!o.interior&&o.level!==0;
}
/** The ambulance half: none on duty (CCarCtrl::NumAmbulancesOnDuty), at least two free accidents
 * (GetNumberOfFreeAccidents), a nearest free one to CJ (GetNearestFreeAccident(FindPlayerCoors, false), no reach), and
 * the clock past LastTimeAmbulanceCreated + 30 s. */
export function ambulanceDue(o:{onDuty:number;freeAccidents:number;nearest:boolean;nowMs:number;lastCreatedMs:number}){
 return o.onDuty===0&&o.freeAccidents>=AMBULANCE_MIN_FREE_ACCIDENTS&&o.nearest&&o.nowMs>o.lastCreatedMs+AMBULANCE_INTERVAL_MS;
}
/** CTaskComplexMedicTreatInjuredPed::CreateNextSubTask after TASK_COMPLEX_GO_TO_POINT_AND_STAND_STILL: close enough
 * to treat. */
export function medicCanTreat(medic:{x:number;y:number;z:number},target:{x:number;y:number;z:number}){
 return Math.hypot(medic.x-target.x,medic.y-target.y)<=MEDIC_TREAT_RADIUS&&Math.abs(medic.z-target.z)<=MEDIC_TREAT_HEIGHT;
}

export const MODEL_FIRETRUK=407;
/** CStreaming::ms_aDefaultFiremanModel by level (0x8A5AE4; iOS 0x100592ce0: -1, 277, 279, 278), like the medics'. */
export const DEFAULT_FIREMAN_MODEL=[undefined,'lafd1','sffd1','lvfd1'] as const;
/** CStreaming::ms_aDefaultFireEngineModel by level (iOS 0x100592d08: -1, 407, 407, 407). */
export const DEFAULT_FIRE_ENGINE_MODEL=[undefined,407,407,407] as const;
/** The fire engine half: three fires burning that are not the script's (CFireManager::GetNumOfNonScriptFires, iOS
 * 0x10023bf88), a nearest one (FindNearestFire(FindPlayerCoors, true, true), no reach), and 35 s since the last. */
export const FIRETRUCK_MIN_FIRES=3,FIRETRUCK_INTERVAL_MS=35000;
/** CTaskComplexDriveFireTruck's CTaskComplexDriveToPoint: 30 under AVOID_CARS, done within 25 units, where the cannon
 * takes over; its wander is 10 under STOP_FOR_CARS. */
export const FIRETRUCK_CRUISE=30,FIRETRUCK_TARGET_RADIUS=25,FIRETRUCK_WANDER_CRUISE=10;
export function fireTruckDue(o:{onDuty:number;nonScriptFires:number;nearest:boolean;nowMs:number;lastCreatedMs:number}){
 return o.onDuty===0&&o.nonScriptFires>=FIRETRUCK_MIN_FIRES&&o.nearest&&o.nowMs>o.lastCreatedMs+FIRETRUCK_INTERVAL_MS;
}
/** A fire as the fire engines see it (CFire): native position. */
export interface EmergencyFire {readonly active:boolean;readonly script:boolean;readonly beingExtinguished:boolean;readonly position:{x:number;y:number;z:number};readonly target?:{kind:string}}
/** CFireManager::FindNearestFire (0x538F40) with both checks, as CTaskComplexDriveFireTruck asks: active, not the
 * script's, not being put out, not on a ped; nearest in 2D. */
export function findNearestFire(fires:readonly EmergencyFire[],point:{x:number;y:number}){
 let best:EmergencyFire|undefined,min=Number.MAX_VALUE;
 for(const f of fires){
  if(!f.active||f.script||f.beingExtinguished||f.target&&(f.target.kind==='ped'||f.target.kind==='player'))continue;
  const d=(f.position.x-point.x)**2+(f.position.y-point.y)**2;if(d<min){min=d;best=f;}
 }
 return best;
}
/** CAutomobile::FireTruckControl's branch for a truck the player is not driving (0x729B60, reversed): the nozzle's yaw
 * (m_fDoomVerticalRotation) turns at a hundredth of a time step toward the fire's bearing less the heading, both kept
 * within half a turn, and its pitch (m_fDoomHorizontalRotation) sways ±0.15 over 4096 ms. GetHeading is
 * atan2(−forward.x, forward.y). Native x, y. */
export function fireTruckAim(aim:{yaw:number;pitch:number},o:{fire:{x:number;y:number};car:{x:number;y:number};heading:number;timeStep:number;timeMs:number}){
 let shoot=Math.atan2(-(o.fire.x-o.car.x),o.fire.y-o.car.y);
 if(shoot>o.heading+Math.PI)shoot-=2*Math.PI;else if(shoot<o.heading-Math.PI)shoot+=2*Math.PI;
 let target=shoot-o.heading;
 if(target>aim.yaw+Math.PI)target-=2*Math.PI;else if(target<aim.yaw-Math.PI)target+=2*Math.PI;
 const diff=target-aim.yaw,step=o.timeStep/100;let yaw=aim.yaw;
 if(Math.abs(diff)>=step)yaw+=diff<=0?-step:step;
 return {yaw,pitch:Math.sin((o.timeMs%4096)*2*Math.PI/4096)*.15};
}
interface Truck {
 car:WorldCar;model:string;
 /** CTaskComplexDriveFireTruck's subtask: driving to a fire, its cannon on it, or wandering; or, made for a script,
  * driving to the script's point first. */
 mission:'toFire'|'cannon'|'wander'|'toPoint';
 fire?:EmergencyFire;aim:{yaw:number;pitch:number};goal?:V3;
 /** The player dragged the driver out; the second fireman was dragged out (gone), or is getting out of a truck the
  * player has taken (his exit clip). */
 driverGone?:boolean;passenger?:'gone'|{key:string;animation:NativeAnimation;time:number};
 taken?:boolean;
}

type V3={x:number;y:number;z:number};
/** A dead ped as the accident manager holds it: the crowd's id and the questions CAccident asks. */
export interface Casualty extends AccidentPed {readonly id:number}
/** What the street population does for the emergency services. Positions are the renderer's. */
export interface EmergencyCrowd {
 /** The dead in the street now, by id. */
 dead():{id:number;position:V3;mission:boolean;allowMedics:boolean;submerged:boolean;headless:boolean;fading:boolean}[];
 /** Whether a ped is still in the world (alive or dead). */
 exists(id:number):boolean;
 /** A crew member stepping out of his vehicle, kept from the population manager while he belongs to it. */
 spawnCrew(model:string,position:V3,heading:number,crew:{unit:object;seat:number}):Promise<number|false>;
 /** A crew member's tasks, CTaskComplexSequence-style; an empty list leaves him idle. */
 orders(id:number,orders:ScriptedPedOrder[]):void;
 /** A crew member on foot: where he is, whether his tasks are still running, and whether he is alive and up. */
 crewState(id:number):{position:V3;busy:boolean;alive:boolean;down:boolean}|undefined;
 /** m_nDeathTimeMS = now on a body. */
 holdDead(id:number):void;
 /** ComputeReviveResponse on a body; false when it is gone or alive. */
 revive(id:number):boolean;
 /** The crew member reached his door: the street lets him go, the car's entry takes over. */
 board(id:number):boolean;
 /** The unit is gone: its crew on foot are ordinary peds from now on. */
 release(unit:object):void;
}

interface Medic {
 seat:number;
 /** In his seat, in a door clip, on foot, or dead or lost to the street. */
 state:'seated'|'leaving'|'foot'|'entering'|'gone';
 id?:number;
 /** The accident this medic deals with, and where he treats it. */
 accident?:Accident<Casualty>;target?:V3;
 task?:'goTo'|'treat'|'stand'|'return';
 /** Whether the CPR clip was given (its end revives). */
 cpr?:boolean;
 /** Time on the current step, and the best distance to his door with how long it has not improved. */
 time:number;best:number;stall:number;
 clip?:{key:string;animation:NativeAnimation;phase:'getOut'|'align'|'open'|'getIn'|'closeInside';time:number;group:number;
  /** CTaskComplexLeaveCar's delay, seconds still to wait before the door (a passenger the player did not drag out). */
  wait?:number};
 leftOnce:boolean;
}
interface Unit {
 car:WorldCar;model:string;medics:Medic[];
 mission:'toAccident'|'stop'|'crewOut'|'wander'|'toPoint';
 /** The driver's accident while he drives to it. */
 accident?:Accident<Casualty>;goal?:V3;
 /** The player has climbed into the van: the medics aboard get out and nobody boards it again. */
 taken?:boolean;
}

const toNative=(v:V3)=>({x:v.x,y:-v.z,z:v.y});
const toRenderer=(v:V3)=>({x:v.x,y:v.z,z:-v.y});

export class WorldEmergency {
 readonly units:Unit[]=[];
 /** The fire engines on duty (AddFiretruckOccupants' two firemen stay in the cab). */
 readonly trucks:Truck[]=[];
 /** CFireManager's pool. */
 fires?:{readonly fires:readonly EmergencyFire[]};
 /** CCarCtrl::LastTimeFireTruckCreated, 0 at Init. */
 private lastFireTruckMs=0;
 readonly accidents=new NativeAccidentManager<Casualty>();
 private readonly casualties=new Map<number,Casualty>();
 /** This frame's dead, by id. */
 private deadNow=new Map<number,ReturnType<EmergencyCrowd['dead']>[number]>();
 private paths?:ReturnType<typeof worldPaths>;private busy=false;private truckBusy=false;private disposed=false;
 /** The game clock here, and CCarCtrl::LastTimeAmbulanceCreated (0 at Init). */
 private seconds=0;private lastAmbulanceMs=0;
 zones?:WorldZones;
 /** CWanted::m_nWantedLevel. */
 wanted:()=>number=()=>0;
 /** Whether a point's sphere is out of the camera's sight, where a car may be made. */
 canSpawn:(point:V3,radius:number)=>boolean=()=>true;
 /** The peds and the player, renderer positions, for the placement's clearance. */
 peds:()=>readonly V3[]=()=>[this.sim.player.position];
 /** CJ's car when the fleet does not hold it. */
 playerCar:()=>WorldCar|undefined=()=>undefined;
 /** CCarCtrl::GenerateCarCreationCoors2's statics. */
 private readonly creation=newCarCreationCache();
 /** CGame::currArea is 0: no ambulance answers indoors. */
 outside:()=>boolean=()=>true;
 /** CCarCtrl::bAllowEmergencyServicesToBeCreated, which SWITCH_EMERGENCY_SERVICES sets. */
 enabled:()=>boolean=()=>true;
 /** iOS 0x1001b2558, read as CGameLogic's GameState not PLAYING (wasted or busted) or a trip skip in progress. */
 gameLogicBusy:()=>boolean=()=>false;
 crowd?:EmergencyCrowd;
 error?:string;
 constructor(private sim:Simulation,private fleet:WorldFleet,private clips:VehicleAnimationLibrary,private driving:ScriptCarMissions,base:string,private random:()=>number=Math.random){
  void openStaticWorld(base).then(source=>{if(!this.disposed)this.paths=worldPaths(source);}).catch(e=>{this.error=String(e);});
 }
 /** CCarCtrl::NumAmbulancesOnDuty: the units still standing. */
 get ambulancesOnDuty(){return this.units.filter(u=>u.car.modelId===MODEL_AMBULAN&&!u.car.disposed&&!u.car.wrecked).length;}
 private level(){const p=this.sim.player.position;return this.zones?worldLevelAt(this.zones,[p.x,-p.z,p.y]):1;}
 /** ReportAccident for the newly dead and CleanUpOldReference for the bodies gone from the world. */
 private refreshAccidents(){
  const crowd=this.crowd;if(!crowd)return;
  for(const [id,c] of this.casualties)if(!crowd.exists(id)){this.accidents.forget(c);this.casualties.delete(id);}
  this.deadNow=new Map(crowd.dead().map(d=>[d.id,d]));
  for(const d of this.deadNow.values()){
   if(this.casualties.has(d.id))continue;
   // A revived ped keeps his slot (m_bIsRevived) and is not reported again while it holds him.
   const last={...d.position};
   const c:Casualty={id:d.id,mission:d.mission,allowMedics:d.allowMedics,headless:d.headless,
    submerged:()=>this.deadNow.get(d.id)?.submerged??false,
    position:()=>{const at=this.deadNow.get(d.id)?.position;if(at){last.x=at.x;last.y=at.y;last.z=at.z;}return toNative(last);}};
   this.casualties.set(d.id,c);this.accidents.report(c);
  }
 }
 /** bFadeOut on an accident's body. */
 private fading(c:Casualty){return !!this.deadNow.get(c.id)?.fading;}
 update(dt:number){
  if(this.disposed)return;
  const previousMs=this.seconds*1000;this.seconds+=dt;
  for(let i=this.units.length-1;i>=0;i--){const u=this.units[i];if(u.car.disposed||!u.car.car.body.isValid()){this.drop(i);continue;}}
  this.refreshAccidents();
  for(const u of this.units)this.stepUnit(u,dt);
  for(let i=this.trucks.length-1;i>=0;i--){const t=this.trucks[i];if(t.car.disposed||!t.car.car.body.isValid()){this.dropTruck(i);continue;}this.stepTruck(t,dt);}
  this.cull();
  if(emergencyDispatchTick(previousMs,this.seconds*1000))this.generate();
 }
 /** The browser's removal (CCarCtrl::RemoveDistantCars stands behind it): an ambulance out of sight beyond 120 units
  * once it is wandering, 250 while it is on its way to an accident or its crew is out (the road there can lead it
  * round the block first). */
 private cull(){
  const p=this.sim.player.position;
  for(let i=this.units.length-1;i>=0;i--){
   const u=this.units[i],c=u.car.car.body.translation();
   if(u.car.occupied){if(!u.medics.some(m=>m.state==='leaving'))this.drop(i);continue;}
   const reach=u.mission==='wander'?120:250;
   if(Math.hypot(c.x-p.x,c.z-p.z)>reach&&this.canSpawn(c,6)){this.fleet.removeTrafficCar(u.car);this.drop(i);}
  }
  for(let i=this.trucks.length-1;i>=0;i--){
   const t=this.trucks[i],c=t.car.car.body.translation();
   if(t.car.occupied){if(!t.passenger||t.passenger==='gone')this.dropTruck(i);continue;}
   const reach=t.mission==='wander'?120:250;
   if(Math.hypot(c.x-p.x,c.z-p.z)>reach&&this.canSpawn(c,6)){this.fleet.removeTrafficCar(t.car);this.dropTruck(i);}
  }
 }
 private dropTruck(i:number){const t=this.trucks[i];this.trucks.splice(i,1);this.driving.forget(t.car);}
 private drop(i:number){const u=this.units[i];this.units.splice(i,1);this.driving.forget(u.car);this.crowd?.release(u);}
 /** GenerateEmergencyServicesCar's fire engine half (see fireTruckDue). */
 private generateFireTruck(){
  const paths=this.paths,fires=this.fires?.fires;if(!paths||!fires||this.truckBusy)return;
  const player=this.sim.player.position,at=toNative(player),nearest=findNearestFire(fires,at);
  const level=this.level() as 0|1|2|3,fireman=DEFAULT_FIREMAN_MODEL[level],engine=DEFAULT_FIRE_ENGINE_MODEL[level];if(!fireman||!engine)return;
  if(!fireTruckDue({onDuty:this.trucks.filter(t=>!t.car.wrecked).length,nonScriptFires:fires.filter(f=>f.active&&!f.script).length,nearest:!!nearest,nowMs:this.seconds*1000,lastCreatedMs:this.lastFireTruckMs}))return;
  this.truckBusy=true;
  void paths.loadAround(player.x,player.z).then(async()=>{
   if(this.disposed)return;
   const place=this.emergencyPlacement(paths.areas,nearest!.position);if(!place)return;
   const car=await this.fleet.spawnTrafficCar(engine,place.position,place.heading,()=>!this.disposed).catch(()=>undefined);
   if(!car)return;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
   this.lastFireTruckMs=this.seconds*1000;
   // bSirenOrAlarm from the start; the driver's task keeps it on only while there is a fire to go to.
   car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;car.siren=true;
   const truck:Truck={car,model:fireman,mission:'wander',aim:{yaw:0,pitch:0}};
   this.trucks.push(truck);this.truckFindsFire(truck);
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.truckBusy=false;});
 }
 /** CTaskComplexDriveFireTruck::CreateFirstSubTask for the driver: the nearest fire, or the wander. */
 private truckFindsFire(t:Truck){
  const fires=this.fires?.fires??[],c=t.car.car.body.translation(),fire=findNearestFire(fires,toNative(c));
  if(!fire){
   if(t.mission!=='wander'||!this.driving.driving(t.car))this.driving.wander(t.car,{cruise:FIRETRUCK_WANDER_CRUISE,style:DRIVINGSTYLE.stopForCars});
   t.mission='wander';t.fire=undefined;t.car.siren=false;return;
  }
  t.fire=fire;t.mission='toFire';t.car.siren=true;
  this.driving.gotoCoords(t.car,toRenderer(fire.position),{cruise:FIRETRUCK_CRUISE,style:DRIVINGSTYLE.avoidCars});
 }
 private stepTruck(t:Truck,dt:number){
  const car=t.car;if(car.wrecked){car.siren=false;return;}
  // The player dragged the driver out: the truck does no more work.
  if(car.driverOut)t.driverGone=true;
  this.stepTruckPassenger(t,dt);
  if(t.driverGone||t.taken){car.siren=false;return;}
  const fires=this.fires?.fires??[],c=toNative(car.car.body.translation());
  if(t.mission==='wander'){if(findNearestFire(fires,c))this.truckFindsFire(t);return;}
  if(t.mission==='toPoint'){const g=toNative(t.goal!);if(Math.hypot(g.x-c.x,g.y-c.y)<FIRETRUCK_TARGET_RADIUS||!this.driving.driving(car))this.truckFindsFire(t);return;}
  const fire=t.fire;
  if(!fire?.active){this.truckFindsFire(t);return;}
  if(t.mission==='toFire'){
   // ControlSubTask: a fire somebody is already putting out gives way to the nearest one nobody is.
   if(fire.beingExtinguished){
    const next=findNearestFire(fires,c);
    if(!next){this.truckFindsFire(t);return;}
    if(next!==fire){t.fire=next;this.driving.gotoCoords(car,toRenderer(next.position),{cruise:FIRETRUCK_CRUISE,style:DRIVINGSTYLE.avoidCars});}
   }
   const f=t.fire!;
   if(Math.hypot(f.position.x-c.x,f.position.y-c.y)<FIRETRUCK_TARGET_RADIUS){t.mission='cannon';this.driving.clear(car);}
   return;
  }
  // CTaskComplexUseWaterCannon: FireTruckControl every frame while the fire burns and the truck is under physics.
  const q=car.car.body.rotation(),fx=-2*(q.x*q.z+q.y*q.w),fz=-(1-2*(q.x*q.x+q.y*q.y)),forward={x:fx,y:-fz};
  t.aim=fireTruckAim(t.aim,{fire:fire.position,car:c,heading:Math.atan2(-forward.x,forward.y),timeStep:dt*50,timeMs:this.seconds*1000});
 }
 /** The fire engines whose cannon is on (CTaskComplexUseWaterCannon), with FireTruckControl's aim. */
 cannons(){return this.trucks.filter(t=>t.mission==='cannon'&&!t.car.wrecked&&!t.car.disposed&&t.fire?.active).map(t=>({car:t.car,aim:t.aim}));}
 /** CCarCtrl::GenerateEmergencyServicesCar (iOS 0x10018fe74): the gate, then the ambulance half and the fire engine's. */
 private generate(){
  if(!emergencyDispatchOpen({enabled:this.enabled(),gameLogicBusy:this.gameLogicBusy(),wanted:this.wanted(),interior:!this.outside(),level:this.level()}))return;
  // The sum of the car counts against MaxNumberOfCarsInUse: the browser's fleet budget stands in.
  if(this.fleet.cars.size>=12)return;
  this.generateAmbulance();this.generateFireTruck();
 }
 /** GenerateEmergencyServicesCar's ambulance half (see ambulanceDue). */
 private generateAmbulance(){
  const paths=this.paths;if(!paths||this.busy||!this.crowd)return;
  const player=this.sim.player.position,at=toNative(player),nearest=this.accidents.nearestFree(at,false);
  const level=this.level() as 0|1|2|3,medic=DEFAULT_MEDIC_MODEL[level],ambulance=DEFAULT_AMBULANCE_MODEL[level];if(!medic||!ambulance)return;
  if(!ambulanceDue({onDuty:this.ambulancesOnDuty,freeAccidents:this.accidents.numberOfFree(),nearest:!!nearest,nowMs:this.seconds*1000,lastCreatedMs:this.lastAmbulanceMs}))return;
  this.busy=true;
  void paths.loadAround(player.x,player.z).then(async()=>{
   if(this.disposed)return;
   const place=this.emergencyPlacement(paths.areas,nearest!.ped.position());if(!place)return;
   const car=await this.fleet.spawnTrafficCar(ambulance,place.position,place.heading,()=>!this.disposed).catch(()=>undefined);
   if(!car)return;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
   this.lastAmbulanceMs=this.seconds*1000;
   car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;car.siren=true;void this.clips.load(car.animGroup).catch(()=>{});
   // AddAmbulanceOccupants: the driver and passenger seat 1, which is the rear left in this port's seat order.
   const unit:Unit={car,model:medic,mission:'wander',
    medics:[0,2].map(seat=>({seat,state:'seated',time:0,best:Infinity,stall:0,leftOnce:false}))};
   this.units.push(unit);
   this.driverFindsAccident(unit);
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
 /** CCarCtrl::ScriptGenerateOneEmergencyServicesCar (0x42FBC0, reversed) over GenerateOneEmergencyServicesCar, which
  * is unreversed and made here as the dispatch makes its own: a fire engine or an ambulance, crewed, where a road
  * crosses the 160-unit circle round CJ (nothing when every try misses), driving to the script's point (native
  * axes) with its siren on
  * (MISSION_GOTOCOORDINATES). There it takes up its own work: the fires about, or the accidents. Any other model
  * (the police cars DECON asks for as it raises the wanted level) is left to the wanted level's own dispatch. */
 scriptGenerate(modelId:number,goalNative:V3){
  const paths=this.paths;if(!paths||modelId!==MODEL_FIRETRUK&&modelId!==MODEL_AMBULAN)return false;
  const goal=toRenderer(goalNative),player=this.sim.player.position;
  void paths.loadAround(player.x,player.z).then(async()=>{
   if(this.disposed)return;
   const place=this.emergencyPlacement(paths.areas,goalNative);if(!place)return;
   const car=await this.fleet.spawnTrafficCar(modelId,place.position,place.heading,()=>!this.disposed).catch(()=>undefined);
   if(!car)return;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
   car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;car.siren=true;
   const level=Math.max(1,Math.min(3,this.level())) as 1|2|3;
   if(modelId===MODEL_FIRETRUK){
    this.trucks.push({car,model:DEFAULT_FIREMAN_MODEL[level],mission:'toPoint',aim:{yaw:0,pitch:0},goal});
    this.driving.gotoCoords(car,goal,{cruise:FIRETRUCK_CRUISE,style:DRIVINGSTYLE.avoidCars});
   }else{
    void this.clips.load(car.animGroup).catch(()=>{});
    this.units.push({car,model:DEFAULT_MEDIC_MODEL[level],mission:'toPoint',goal,medics:[0,2].map(seat=>({seat,state:'seated',time:0,best:Infinity,stall:0,leftOnce:false}))});
    this.driving.gotoCoords(car,goal,{cruise:MEDIC_CRUISE,style:DRIVINGSTYLE.avoidCars});
   }
  }).catch(e=>{this.error=String(e);});
  return true;
 }
 /** GenerateOneEmergencyServicesCar's placement (iOS 0x1001a1398): GenerateCarCreationCoors2 from CJ for a crossing
  * of the 160-unit circle in any direction (in view or not, the two circles being one), on a land road with no
  * vehicle or ped kinda colliding within 10 units (2D, their bounding spheres), five tries; the executable counts
  * the fifth before it looks, so a place found on it is dropped. The car stands at the nodes' height there, facing
  * the goal across the ground (renderer axes and heading). The browser's ground probe is its own, and finds nothing
  * beyond the collision streamed in round CJ, where the executable would find the ground and the port does not. */
 private emergencyPlacement(areas:ReadonlyMap<number,import('../assets/pathNodes').PathArea>,goal:V3){
  const from=toNative(this.sim.player.position);
  for(let attempt=1;attempt<=5;attempt++){
   const hit=generateCarCreationCoors2(areas,this.creation,{position:from,dirX:.707,dirY:.707,minDot:-1,dotAbove:true,inViewDistance:160,outOfViewDistance:160,
    avoidSwitchedOff:false,noBoats:false},{nowMs:this.seconds*1000,rand:()=>Math.floor(this.random()*0x80000000),sphereVisible:(q,r)=>!this.canSpawn(toRenderer(q),r)});
   if(!hit||hit.node1.water||this.kindaColliding(hit.position,10))continue;
   if(attempt>4)return undefined;
   const z=(1-hit.t)*hit.node1.position[2]+hit.t*hit.node2.position[2];
   // CVector2D's heading of the way to the goal: atan2(-dx, dy).
   return {position:toRenderer({x:hit.position.x,y:hit.position.y,z}),heading:Math.atan2(-(goal.x-hit.position.x),goal.y-hit.position.y)};
  }
  return undefined;
 }
 /** CWorld::FindObjectsKindaColliding(point, radius, 2D, vehicles and peds): a car whose bounding sphere, or a ped
  * (CTempColModels' bounding radius 1), reaches within `radius` of the point across the ground (native point). */
 private kindaColliding(point:V3,radius:number){
  const own=this.playerCar();
  for(const car of own&&!this.fleet.cars.has(own)?[...this.fleet.cars,own]:this.fleet.cars){
   if(car.disposed)continue;
   const b=car.assets.collision.bounds,c=car.worldPoint({x:b.center[0],y:b.center[1],z:b.center[2]});
   if(Math.hypot(c.x-point.x,-c.z-point.y)<b.radius+radius)return true;
  }
  return this.peds().some(p=>Math.hypot(p.x-point.x,-p.z-point.y)<1+radius);
 }
 /** CTaskComplexMedicTreatInjuredPed::ControlSubTask under TASK_COMPLEX_CAR_DRIVE_WANDER: the nearest free accident
  * is taken (treated) and driven to. */
 private driverFindsAccident(u:Unit){
  const driver=u.medics[0];if(driver.state!=='seated')return;
  const c=u.car.car.body.translation(),found=this.accidents.nearestFree(toNative(c),false);
  if(!found){if(u.mission!=='wander'){u.mission='wander';this.driving.wander(u.car,{cruise:MEDIC_CRUISE,style:DRIVINGSTYLE.avoidCars});}else if(!this.driving.driving(u.car))this.driving.wander(u.car,{cruise:MEDIC_CRUISE,style:DRIVINGSTYLE.avoidCars});u.car.siren=false;return;}
  found.treated=true;driver.accident=found;u.accident=found;
  const goal=toRenderer(found.ped.position());u.goal=goal;driver.target=goal;u.mission='toAccident';u.car.siren=true;
  this.driving.gotoCoords(u.car,goal,{cruise:MEDIC_CRUISE,style:DRIVINGSTYLE.avoidCars});
 }
 private stepUnit(u:Unit,dt:number){
  const car=u.car,c=car.car.body.translation();
  if(car.wrecked){car.siren=false;return;}
  // The player dragged the driver out (CreateDragPedOutSubTask): his seat is empty from then on.
  if(car.driverOut&&u.medics[0].state==='seated')u.medics[0].state='gone';
  // A van the player took: only the medics getting out of it go on.
  if(u.taken){car.siren=false;for(const m of u.medics)if(m.state==='leaving')this.stepMedic(u,m,dt);return;}
  const aboard=u.medics.every(m=>m.state==='seated'||m.state==='gone');
  if(u.mission==='toPoint'&&(Math.hypot(u.goal!.x-c.x,u.goal!.z-c.z)<MEDIC_LEAVE_CAR_DISTANCE||!this.driving.driving(car))){u.mission='wander';car.siren=false;}
  if(u.mission==='wander'&&aboard)this.driverFindsAccident(u);
  if(u.mission==='toAccident'){
   const goal=u.goal!;
   // The accident's ped gone (removed): back to wandering.
   if(!u.accident?.ped){u.mission='wander';this.driverFindsAccident(u);}
   else if(Math.hypot(goal.x-c.x,goal.z-c.z,goal.y-c.y)<MEDIC_LEAVE_CAR_DISTANCE){u.mission='stop';this.driving.clear(car);}
  }
  // MISSION_NONE holds the van on half brake and the handbrake (ScriptCarMissions) while the crew is out.
  if(u.mission==='stop'){
   const v=car.car.body.linvel();
   if(Math.hypot(v.x,v.z)<.5){u.mission='crewOut';for(const m of u.medics)if(m.state==='seated')this.beginExit(u,m);}
  }else if(u.mission==='crewOut'&&aboard&&u.medics.some(m=>m.leftOnce)){
   // Everyone back aboard (or gone): the driver wanders on, looking for the next accident.
   if(u.medics[0].state==='gone'){u.mission='crewOut';car.siren=false;}
   else{u.mission='wander';car.siren=false;for(const m of u.medics)m.leftOnce=false;this.driverFindsAccident(u);}
  }
  for(const m of u.medics)this.stepMedic(u,m,dt);
 }
 private exitSlot(seat:number){return [VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS,VEHICLE_ANIM.getoutRearLHS,VEHICLE_ANIM.getoutRearRHS][seat];}
 private door(seat:number){return [DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear][seat];}
 private doorPoint(car:WorldCar,seat:number){
  const getIn=this.clips.slot(car.animGroup,VEHICLE_ANIM.getinLHS),frame=car.car.nativeFramePosition(seat<2?'ped_frontseat':'ped_backseat');if(!getIn||!frame)return undefined;
  return nativeDoorPoint({x:frame.x,y:frame.y,z:frame.z},clipRootEnd(getIn.clip),car.assets.handling.values.seatOffset,seat%2===0?'left':'right',1);
 }
 private beginExit(u:Unit,m:Medic,wait=0){
  const found=this.clips.slot(u.car.animGroup,this.exitSlot(m.seat));
  m.leftOnce=true;
  if(!found){void this.finishExit(u,m);return;}
  m.state='leaving';m.clip={key:found.key,animation:found.clip,phase:'getOut',time:0,group:0,wait};
 }
 private async finishExit(u:Unit,m:Medic){
  m.state='foot';m.clip=undefined;m.time=0;
  const local=this.doorPoint(u.car,m.seat),t=u.car.car.body.translation();
  const world=local?u.car.worldPoint(local):new RAPIER.Vector3(t.x,t.y,t.z);
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:world.x,y:world.y+1,z:world.z},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,u.car.car.body);
  const id=await this.crowd?.spawnCrew(u.model,{x:world.x,y:(hit?world.y+1-hit.timeOfImpact:world.y-1)+.03,z:world.z},u.car.heading(),{unit:u,seat:m.seat});
  if(id===undefined||id===false||this.disposed){m.state='gone';return;}
  m.id=id;
  // Out of a van the player took he is the van's no longer: an ordinary ped from here.
  if(u.taken){m.state='gone';this.crowd?.release(u);return;}
  // CreateNextSubTask after TASK_COMPLEX_LEAVE_CAR.
  if(m.seat===0&&m.accident?.ped&&m.accident.treated)this.goToAccident(m,m.accident);
  else{
   const found=this.accidents.nearestFree(toNative(world),false);
   if(found){found.treated=true;this.goToAccident(m,found);}
   else if(m.seat===0)this.returnToCar(u,m);
   else{m.task='stand';m.time=0;this.crowd?.orders(id,[{kind:'standStill',seconds:MEDIC_STAND_SECONDS}]);}
  }
 }
 /** TASK_COMPLEX_GO_TO_POINT_AND_STAND_STILL to the accident, run, turning to a walk inside 5 units. */
 private goToAccident(m:Medic,a:Accident<Casualty>){
  m.accident=a;m.task='goTo';m.cpr=false;m.time=0;
  const target=toRenderer(a.ped!.position());m.target=target;
  // The task stops 0.125 from the thighs of a body with no collision; a body here keeps its ball, so the medic stops at
  // the treating radius instead.
  if(m.id!==undefined)this.crowd?.orders(m.id,[{kind:'goToPoint',x:target.x,y:-target.z,z:target.y,moveState:6,radius:MEDIC_TREAT_RADIUS*.9,moveStateRadius:MEDIC_WALK_DISTANCE,seconds:Infinity}]);
 }
 /** CreateDealWithNextAccidentTask: the nearest other free accident, or back to the van. */
 private dealWithNext(u:Unit,m:Medic,except?:Accident<Casualty>){
  const s=m.id!==undefined?this.crowd?.crewState(m.id):undefined;if(!s)return;
  const found=this.accidents.nearestFreeExcept(toNative(s.position),except,true);
  if(found?.ped){found.treated=true;this.goToAccident(m,found);}
  else this.returnToCar(u,m);
 }
 /** CTaskComplexEnterCarAsDriver / AsPassenger: run to the seat's door. */
 private returnToCar(u:Unit,m:Medic){
  m.task='return';m.time=0;m.best=Infinity;m.stall=0;m.accident=undefined;
  this.walkToDoor(u,m);
 }
 private walkToDoor(u:Unit,m:Medic){
  const local=this.doorPoint(u.car,m.seat),world=local&&u.car.worldPoint(local);if(!world||m.id===undefined)return;
  this.crowd?.orders(m.id,[{kind:'goToPoint',x:world.x,y:-world.z,z:world.y,moveState:6,radius:.3,moveStateRadius:0,seconds:Infinity}]);
 }
 private stepMedic(u:Unit,m:Medic,dt:number){
  m.time+=dt;
  const car=u.car;
  if(m.clip){
   const c=m.clip;
   if(c.wait&&c.wait>0){c.wait-=dt;return;}
   c.time+=dt;
   const door=this.door(m.seat);
   if(c.phase==='getOut'){const ratio=nativeDoorAnimRatio(car.animGroup,'getOut',c.time,car.doors[door].ratio,0);if(ratio!==undefined&&!car.doorMissing(door))car.openDoor(door,ratio);}
   else if(c.phase==='open'||c.phase==='closeInside'){const ratio=nativeDoorAnimRatio(car.animGroup,c.phase,c.time,car.doors[door].ratio,c.group);if(ratio!==undefined&&!car.doorMissing(door))car.openDoor(door,ratio);}
   if(c.time>=c.animation.duration){
    if(c.phase==='getOut')void this.finishExit(u,m);
    else this.afterEntryPhase(u,m,c.phase);
   }
   return;
  }
  if(m.state!=='foot'||m.id===undefined)return;
  const crowd=this.crowd!,s=crowd.crewState(m.id);
  if(!s||!s.alive){m.state='gone';m.id=undefined;m.accident=undefined;return;}
  if(s.down)return;
  const p=toNative(s.position);
  switch(m.task){
   case 'goTo':{
    const a=m.accident;
    if(!a?.ped||a.revived){this.dealWithNext(u,m);return;}
    // The body moved (it was shoved, or it slid): the point follows it.
    const target=toRenderer(a.ped.position());
    if(Math.hypot(target.x-m.target!.x,target.z-m.target!.z)>.5)this.goToAccident(m,a);
    if(!s.busy){
     if(medicCanTreat(p,a.ped.position()))this.treat(m);
     else this.dealWithNext(u,m,a);
    }
    return;
   }
   case 'treat':{
    const a=m.accident;
    if(!s.busy){
     // CTaskSimpleGiveCPR::ProcessPed at the clip's end: ReviveDeadPed. A medic who was moved off the body (a fright,
     // a shove) did not finish it.
     if(m.cpr&&a?.ped&&!a.ped.headless&&medicCanTreat(p,a.ped.position())&&crowd.revive(a.ped.id))a.revived=true;
     // CreateNextSubTask after TASK_COMPLEX_TREAT_ACCIDENT: FindNearestAccident, or the seat.
     const found=this.accidents.nearestFree(p,true);
     if(found?.ped){found.treated=true;this.goToAccident(m,found);}
     else this.returnToCar(u,m);
    }
    return;
   }
   case 'stand':
    if(!s.busy)this.returnToCar(u,m);
    return;
   case 'return':{
    const local=this.doorPoint(car,m.seat),world=local&&car.worldPoint(local);
    if(!world||car.wrecked||car.disposed){crowd.release(u);m.state='gone';m.id=undefined;return;}
    const distance=Math.hypot(world.x-s.position.x,world.z-s.position.z);
    if(distance<m.best-.05){m.best=distance;m.stall=0;}else m.stall+=dt;
    if((distance<=.5||m.stall>1.2&&distance<1.2)&&crowd.board(m.id)){m.id=undefined;this.enterPhase(u,m,'align');return;}
    if(!s.busy||m.time>1){m.time=0;this.walkToDoor(u,m);}
    return;
   }
  }
 }
 /** CTaskComplexTreatAccident: the body's death clock reset, CTaskSimpleAchieveHeading toward its middle, then
  * CTaskSimpleGiveCPR (MEDIC CPR). */
 private treat(m:Medic){
  const a=m.accident,crowd=this.crowd;if(!a?.ped||m.id===undefined||!crowd)return;
  // CreateFirstSubTask: a body already fading out gets TASK_NONE, which ends the treatment at once.
  m.task='treat';m.cpr=!this.fading(a.ped);m.time=0;
  if(!m.cpr){crowd.orders(m.id,[]);return;}
  crowd.holdDead(a.ped.id);
  const s=crowd.crewState(m.id),body=toRenderer(a.ped.position());if(!s)return;
  const yaw=Math.atan2(body.x-s.position.x,body.z-s.position.z);
  crowd.orders(m.id,[{kind:'achieveHeading',degrees:(yaw-Math.PI)*180/Math.PI},{kind:'playAnim',file:'MEDIC',name:'CPR',loop:false,keepLastFrame:false,seconds:Infinity}]);
 }
 private entrySlot(seat:number,phase:'align'|'open'|'getIn'|'closeInside'){
  const left=seat%2===0,rear=seat>=2;
  switch(phase){
   case 'align':return left?VEHICLE_ANIM.alignLHS:VEHICLE_ANIM.alignRHS;
   case 'open':return rear?left?VEHICLE_ANIM.openRearLHS:VEHICLE_ANIM.openRearRHS:left?VEHICLE_ANIM.openLHS:VEHICLE_ANIM.openRHS;
   case 'getIn':return rear?left?VEHICLE_ANIM.getinRearLHS:VEHICLE_ANIM.getinRearRHS:left?VEHICLE_ANIM.getinLHS:VEHICLE_ANIM.getinRHS;
   case 'closeInside':return rear?left?VEHICLE_ANIM.closedoorRearLHS:VEHICLE_ANIM.closedoorRearRHS:left?VEHICLE_ANIM.closedoorLHS:VEHICLE_ANIM.closedoorRHS;
  }
 }
 private enterPhase(u:Unit,m:Medic,phase:'align'|'open'|'getIn'|'closeInside'){
  m.state='entering';
  const found=this.clips.slot(u.car.animGroup,this.entrySlot(m.seat,phase));
  if(found){m.clip={key:found.key,animation:found.clip,phase,time:0,group:found.group};return;}
  m.clip=undefined;this.afterEntryPhase(u,m,phase);
 }
 /** The CarEntry sequence the police crews use: open unless open or missing, close it from inside unless closed. */
 private afterEntryPhase(u:Unit,m:Medic,phase:'align'|'open'|'getIn'|'closeInside'|'getOut'){
  const car=u.car,door=this.door(m.seat);m.clip=undefined;
  if(phase==='align'){
   if(!car.doorMissing(door)&&!car.doorFullyOpen(door)){
    if(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noOpenDoor){car.setDoorOpen(door);car.openDoor(door,1);}
    else if(this.clips.slot(car.animGroup,this.entrySlot(m.seat,'open'))){this.enterPhase(u,m,'open');return;}
    else car.openDoor(door,1);
   }
   this.enterPhase(u,m,'getIn');return;
  }
  if(phase==='open'){this.enterPhase(u,m,'getIn');return;}
  if(phase==='getIn'&&!car.doorMissing(door)&&!car.doors[door].closed){
   if(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noCloseAfterIn)car.openDoor(door,0);
   else if(this.clips.slot(car.animGroup,this.entrySlot(m.seat,'closeInside'))){this.enterPhase(u,m,'closeInside');return;}
   else car.openDoor(door,0);
  }
  m.state='seated';m.task=undefined;
 }
 /** The medics in their seats, or in their door clips. */
 poses(){
  const out:{car:WorldCar;seat:number;model:string;local:V3;clip:string;seconds:number;animation?:NativeAnimation}[]=[];
  for(const u of this.units){
   if(u.car.wrecked)continue;
   for(const m of u.medics){
    // In a van the player has taken only the medics getting out are drawn.
    if(u.car.occupied&&m.state!=='leaving')continue;
    if(m.clip){const local=this.doorPoint(u.car,m.seat);if(local)out.push({car:u.car,seat:m.seat,model:u.model,local,clip:m.clip.key,seconds:m.clip.time,animation:m.clip.animation});continue;}
    // A driver the player has started to drag out is drawn by the car entry from then on.
    if(m.state!=='seated'||m.seat===0&&u.car.driverOut)continue;
    const frame=u.car.car.nativeFramePosition(m.seat<2?'ped_frontseat':'ped_backseat');if(!frame)continue;
    out.push({car:u.car,seat:m.seat,model:u.model,local:{x:m.seat%2===0?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z},clip:sitClip(u.car.modelFlags,m.seat===0),seconds:0});
   }
  }
  // AddFiretruckOccupants: the driver and the front passenger (seat 0), who stay in the cab.
  for(const t of this.trucks){
   if(t.car.wrecked)continue;
   const p=t.passenger;
   if(p&&p!=='gone'){const local=this.doorPoint(t.car,1);if(local)out.push({car:t.car,seat:1,model:t.model,local,clip:p.key,seconds:p.time,animation:p.animation});}
   if(t.car.occupied)continue;
   const frame=t.car.car.nativeFramePosition('ped_frontseat');if(!frame)continue;
   for(const seat of [0,1])if(seat?!p:!t.car.driverOut&&!t.driverGone)out.push({car:t.car,seat,model:t.model,local:{x:seat===0?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z},clip:sitClip(t.car.modelFlags,seat===0),seconds:0});
  }
  return out;
 }
 covers(car:WorldCar){return this.units.some(u=>u.car===car)||this.trucks.some(t=>t.car===car);}
 /** Whether a unit's driver is in his seat (an ambulance's is out treating a body while its van waits on its
  * brakes); undefined for any other car. */
 driverSeated(car:WorldCar){
  const u=this.units.find(u=>u.car===car);if(u)return u.medics[0].state==='seated';
  const t=this.trucks.find(t=>t.car===car);return t&&!t.driverGone;
 }
 /** The second fireman in a fire engine's cab (AddFiretruckOccupants; an ambulance's second medic rides behind). */
 frontPassengerOf(car:WorldCar){const t=this.trucks.find(t=>t.car===car);return t&&!t.passenger?{model:t.model}:undefined;}
 /** The player is dragging him out: the car entry draws him from now on. */
 dragPassenger(car:WorldCar){const t=this.trucks.find(t=>t.car===car);if(t)t.passenger='gone';}
 /** CCarEnterExit::MakeUndraggedPassengerPedsLeaveCar (iOS 0x1003e9564; see WorldPolice.crewLeave): the crew still
  * aboard but the driver get out by their own doors after the leave task's 300 to 599 ms (the decision maker's choice
  * of leave task AUTHORED as for the police crews); a medic on his way back aboard steps out at the door. */
 crewLeave(car:WorldCar){
  const u=this.units.find(u=>u.car===car);
  if(u){
   u.taken=true;this.driving.forget(car);
   for(const m of u.medics){
    if(m.seat!==0&&m.state==='seated')this.beginExit(u,m,pedEnteredVehicleLeaveDelay(Math.floor(this.random()*65536)));
    else if(m.seat!==0&&m.state==='entering')void this.finishExit(u,m);
    else if(m.state==='foot'){
     // Those on foot are let go with the unit; one on his way back to the van stops there.
     if(m.task==='return'&&m.id!==undefined)this.crowd?.orders(m.id,[]);
     m.state='gone';
    }
   }
   this.crowd?.release(u);return;
  }
  const t=this.trucks.find(t=>t.car===car);if(!t)return;
  t.taken=true;this.driving.forget(car);
  if(!t.passenger){const found=this.clips.slot(car.animGroup,VEHICLE_ANIM.getoutRHS);if(found)t.passenger={key:found.key,animation:found.clip,time:0};else{t.passenger='gone';void this.truckPassengerOut(t);}}
 }
 private stepTruckPassenger(t:Truck,dt:number){
  const p=t.passenger;if(!p||p==='gone')return;
  p.time+=dt;const car=t.car;
  const ratio=nativeDoorAnimRatio(car.animGroup,'getOut',p.time,car.doors[DOOR.rightFront].ratio,0);if(ratio!==undefined&&!car.doorMissing(DOOR.rightFront))car.openDoor(DOOR.rightFront,ratio);
  if(p.time>=p.animation.duration){t.passenger='gone';void this.truckPassengerOut(t);}
 }
 /** CTaskSimpleCarSetPedOut for the second fireman: on foot at his door, an ordinary ped. */
 private async truckPassengerOut(t:Truck){
  const local=this.doorPoint(t.car,1),c=t.car.car.body.translation(),world=local?t.car.worldPoint(local):new RAPIER.Vector3(c.x,c.y,c.z);
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:world.x,y:world.y+1,z:world.z},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,t.car.car.body);
  const id=await this.crowd?.spawnCrew(t.model,{x:world.x,y:(hit?world.y+1-hit.timeOfImpact:world.y-1)+.03,z:world.z},t.car.heading(),{unit:t,seat:1});
  if(id!==undefined&&id!==false)this.crowd?.release(t);
 }
 /** The medic or firefighter at the wheel of a unit's car, for the ped who leaves it or is dragged out. */
 driverOf(car:WorldCar){const model=this.units.find(u=>u.car===car)?.model??this.trucks.find(t=>t.car===car)?.model;return model===undefined?undefined:{model};}
 snapshot(){return {ready:!!this.paths,error:this.error??null,lastAmbulanceMs:this.lastAmbulanceMs,
  accidents:this.accidents.accidents.filter(a=>a.ped).map(a=>({id:a.ped!.id,treated:a.treated,revived:a.revived})),
  units:this.units.map(u=>({handle:u.car.car.body.handle,modelId:u.car.modelId,mission:u.mission,siren:u.car.siren,position:{...u.car.car.body.translation()},
   speed:+Math.hypot(u.car.car.body.linvel().x,u.car.car.body.linvel().z).toFixed(1),goal:u.goal??null,drive:this.driving.mission(u.car)??null,
   link:(r=>r?[r.starting.position,r.current.position].map(q=>[Math.round(q[0]),Math.round(q[1])]):null)(this.driving.routeNodes(u.car)),
   medics:u.medics.map(m=>({seat:m.seat,state:m.state,task:m.task??null,id:m.id??null,accident:m.accident?.ped?.id??null}))})),
  trucks:this.trucks.map(t=>({handle:t.car.car.body.handle,mission:t.mission,siren:t.car.siren,position:{...t.car.car.body.translation()},aim:{yaw:+t.aim.yaw.toFixed(3),pitch:+t.aim.pitch.toFixed(3)},fire:t.fire?{...t.fire.position,active:t.fire.active}:null})),
  seconds:+this.seconds.toFixed(1)};}
 dispose(){this.disposed=true;for(const u of this.units){this.driving.forget(u.car);this.fleet.removeTrafficCar(u.car);}this.units.length=0;for(const t of this.trucks){this.driving.forget(t.car);this.fleet.removeTrafficCar(t.car);}this.trucks.length=0;}
}
