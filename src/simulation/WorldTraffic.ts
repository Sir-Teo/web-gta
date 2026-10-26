import RAPIER from '@dimforge/rapier3d-compat';
import {healthAfterFloat32} from '../ped/damage';
import type {ShotCreator} from '../weapons/WeaponSystem';
import {DIE_IN_CAR_OFFSET_MS,canPedStepOutCar} from '../vehicle/nativeDieInCar';
import {Matrix4,Quaternion,Vector3} from 'three';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {worldPaths} from '../assets/worldPaths';
import {pathDirection} from '../assets/pathDirection';
import {nativeShouldStopForLight} from '../world/nativeSignalStop';
import {trafficLinks,travelLink,type TrafficLink} from './trafficRoute';
import {generateCarCreationCoors2,newCarCreationCache} from './nativeCarCreationCoors';
import {approachesPlayer,clampCreationT,laneCountAllows,nodeSpeedCode,nodeSpeedMultiplier,randomCarCreationBearing,speedMultiplierFromNodes,randomCarCruiseSpeed,spawnProbabilityPasses} from '../vehicle/nativeRandomCarSpawn';
import {GAME_SPEED_TO_CARAI_SPEED,DISTANCE_TO_SCAN_FOR_DANGER,SWIRVE_STOP_WAIT_MS,TRY_NOT_TO_TURN_MODELS,carAIJam,initialLaneChangeCountdown,laneChangeCountdown,lanePoint,makeWayForCarWithSiren,nextLaneOnLink,pickNextNodeRandomly,
 shouldPickNextNode,slowCarDownForCars,slowCarDownForPeds,standoffApplies,steerFollowPath,steerHeadingForTarget,tempActionPedals,type DangerView,type NextCandidate,type TempAction} from '../vehicle/nativeCarCtrl';
import type {Simulation} from './Simulation';
import type {WorldFleet} from './WorldFleet';
import type {WorldCar} from './WorldCar';
import {playCarHorn} from './nativeCarHorn';
import {collisionDamageResponse,damageDriverResponse,gunShotDriverResponse,weaponDamageResponse,FLEE_SCENE_CRUISE_SPEED,RELATIONSHIP} from '../vehicle/nativeCollisionDecision';
import {isKillTaskAppropriate} from '../ped/nativeDecisionMaker';
import {calcCurvePoint,calcSpeedScaleFactor} from '../vehicle/nativeCurves';
import {PED_DANGER_SCAN_DISTANCE} from '../ped/nativeGetRunOver';
/** A cruising car's CAutoPilot: the link it is heading for, the one after, a lane on each, and its cruise speed. */
/** How long a rammed driver's CTaskComplexCarDriveMissionKillPed chase lasts, and how far off the player ends it (authored:
 * the task is not reversed). */
const CHASE_SECONDS=30,CHASE_GIVE_UP_DISTANCE=120;
/** GenerateOneRandomCar's out-of-view circle (38 units) and its kinda-colliding clearance (8, 2D). The browser's own:
 * a hidden circle of 75 (the far edge of the band the port made cars in before) standing in, every other try, for the
 * executable's in-view one (160 × the generation multiplier, kept to 150 to 170 on screen), which is beyond the
 * browser's traffic budget; the tries a check; and the length it clamps by before the model is in. */
const RANDOM_CAR_OUT_OF_VIEW=38,RANDOM_CAR_FAR_HIDDEN=75,RANDOM_CAR_CLEARANCE=8,RANDOM_CAR_TRIES=32,ASSUMED_CAR_LENGTH=5;
/** The BMX-type models (vehicles.ide "bmx"): the BMX, the bike and the mountain bike. */
const BMX_MODELS:ReadonlySet<number>=new Set([481,509,510]);
interface Driver {/** The chase CTaskComplexCarDriveMissionKillPed runs after the player. */chase?:{until:number};/** Road rage waiting for the car to slow before he gets out. */rageWait?:boolean;car:WorldCar;current:TrafficLink;next?:TrafficLink;previous?:TrafficLink;currentLane:number;nextLane:number;cruiseSpeed:number;
 temp?:{action:TempAction;until:number;from:'siren'|'ped'|'jam'|'death'|'flipped'|'node'};
 /** CVehicle::m_nRandomSeed, CAutoPilot's jam timers, and DRIVINGSTYLE_AVOID_CARS once a jam has turned the car. */
 seed:number;timeToStartMission:number;timeSwitchedToRealPhysics:number;avoidCars:boolean;
 /** CAutoPilot's speed code (field_41) from the last node reached, and m_SpeedMult, which glides to its multiplier. */
 speedCode:number;speedMult:number;
 /** CAutoPilot's lane-change countdown (field_50). */
 laneCountdown:number;
 /** CAutoPilot::m_fMaxTrafficSpeed, the limit a car on rails eases towards, refreshed every 4th frame. */
 railsLimit?:number;stopped:string|null;distance:number;last:{x:number;z:number};gone?:boolean;stalledReason?:string|null;stalledAt?:number;fired?:boolean;raged?:boolean;fleeScene?:boolean;fled?:boolean;
 /** CPed health (100) under the player's bullets; CTaskComplexDieInCar's 2000 ms coast after the fatal one, then dead out of the door or in the seat. */
 health:number;dying?:{at:number};dead?:boolean;deadInSeat?:boolean;deathAccounted?:boolean;
 /** STATUS_SIMPLE: m_nTimeEnteredCurve, m_nTimeToSpendOnCurrentCurve and m_fMaxTrafficSpeed, the curve from where the car
  * left physics to its current link (none once it reaches that link), and DragCarToPoint's heights. */
 rails?:Rails}
interface Rails {enteredMs:number;spendMs:number;speed:number;entry?:{from:V2;dir:V2};heightAboveRoad:number;ahead:number;behind:number}
type V2={x:number;y:number};
type V3={x:number;y:number;z:number};
const toNative=(v:V3):V3=>({x:v.x,y:-v.z,z:v.y});
/** CCarCtrl::GetRandomOffsetForVehicle: a small per-car skew of each link's direction on rails. */
const railOffset=(link:TrafficLink,seed:number):V2=>{const k=(link.to.address.node+seed)&7;return {x:(k-3)*.009,y:((k>>3)-3)*.009};};
const unit=(v:V2):V2=>{const l=Math.hypot(v.x,v.y)||1;return {x:v.x/l,y:v.y/l};};
const travel=travelLink;
const lanes=(link:TrafficLink)=>pathDirection(link.from.address,link.to.address,link.navigation);
const sameNode=(a:TrafficLink['to'],b:TrafficLink['to'])=>a.address.area===b.address.area&&a.address.node===b.address.node;
const travelSign=(link:TrafficLink)=>link.dx*link.navigation.direction[0]-link.dz*link.navigation.direction[1]>=0?1:-1;
/** Traffic recovery (authored): terminal stops clear the car so a fresh one spawns
 * elsewhere. Lights and brief obstacle waits never recover; dead ends clear after
 * 8 s and long jams after 20 s. Returns 0 when the car should keep waiting. */
export function recoveryLimit(stopped:string|null){
 if(stopped==='obstacle')return 20;
 if(stopped==='end of route'||stopped==='off route'||stopped==='unloaded road')return 8;
 return 0;
}
/** Small, physics-driven ambient traffic population. No direct pose driving. */
export class WorldTraffic {
 /** STATUS_SIMPLE while a distant driver follows its road curve on rails. */
 isOnRails(car:WorldCar){return this.drivers.some(driver=>driver.car===car&&!!driver.rails);}
  /** How near the player a random car drives under physics (its active radius); beyond, it drives on rails
   * (STATUS_SIMPLE), slowing for the traffic, the peds and the lights ahead. 100 units, or less on a phone, whose CPU
   * pays for each car's suspension, wheels and drive twice a frame: a car 60 units off is a few pixels on its screen. */
  physicsRadius=100;
  private paths?:ReturnType<typeof worldPaths>;
  private drivers:Driver[]=[];
  private nextCheck=0;
  private busy=false;
  private disposed=false;
  private serial=0;
  private elapsed=0;
  /** CCarCtrl::GenerateCarCreationCoors2's statics, and the tries' stand-in for CTimer::m_FrameCounter. */
  private readonly creation=newCarCreationCache();private frameCounter=0;
  /** CTimer::m_FrameCounter for the traffic: one a step. */
  private steps=0;
  /** What GenerateOneRandomCar's bearing reads: TheCamera's forward height and its front across the ground (native),
   * and the player's vehicle's speed across the ground (units a frame) when he drives. */
  creationView:()=>{cameraForwardZ:number;cameraFront:{x:number;y:number};vehicleVelocity?:{x:number;y:number}}=()=>({cameraForwardZ:0,cameraFront:{x:0,y:1}});
  /** FindPlayerSpeed across the ground (native, units a frame). */
  playerVelocity:()=>{x:number;y:number}=()=>({x:0,y:0});
  /** CWorld::FindObjectsKindaColliding(point, radius, 2D, vehicles and peds): a car's bounding sphere or a ped's (radius 1)
   * within `radius` of the point across the ground (native point). */
  private kindaColliding(point:{x:number;y:number},radius:number){
   for(const car of this.fleet.cars){
    if(car.disposed)continue;
    const b=car.assets.collision.bounds,c=car.worldPoint({x:b.center[0],y:b.center[1],z:b.center[2]});
    if(Math.hypot(c.x-point.x,-c.z-point.y)<b.radius+radius)return true;
   }
   return (this.peds?.()??[this.sim.player.position]).some(q=>Math.hypot(q.x-point.x,-q.z-point.y)<1+radius);
  }
  /** The traffic-light timer the cars read (CTimer::m_snTimeInMilliseconds from this system's start). */
  get lightMs(){return this.elapsed*1000;}
  private error?:string;
  /** Cars sounding their siren (police pursuit, the player's siren), with their velocity: CCarAI::MakeWayForCarWithSiren. */
  sirens?:()=>{position:V3;velocity:V3}[];
  /** CCarCtrl::GenerateRandomCars stops while CGangWars::DontCreateCivilians (a war runs). */
  noSpawn:()=>boolean=()=>false;
  /** CEventVehicleOnFire: a cruising car that has just caught fire (health under 250); the host evicts its driver. */
  onFire?:(car:WorldCar)=>void;
  /** CTaskComplexRoadRage: the rammed driver gets out to have it out with the player; the host evicts him. */
  onRoadRage?:(car:WorldCar)=>void;
  /** CEventVehicleDied: the driver died with his car (health 0, CTaskComplexDie by explosion); the host lays him out. */
  onDriverDied?:(car:WorldCar,corpse?:{armour:number;accounted:boolean})=>void;
  /** CTaskComplexLeaveCarAndFlee: the driver leaves at once and runs 60 units from where he was; the host evicts him. */
  onLeaveCarAndFlee?:(car:WorldCar)=>void;
  /** CTaskComplexLeaveCarAndDie: the shot driver's car has come to rest; the host plays his exit and lays him dead. */
  onDriverDiesOut?:(car:WorldCar,corpse?:{armour:number;accounted:boolean})=>void;
  onDriverKilled?:(car:WorldCar,creator:ShotCreator)=>void;
  driverModel?:(car:WorldCar)=>number|string;
  driverStats?:(car:WorldCar)=>{defend:number}|undefined;
  driverOf(car:WorldCar){const d=this.drivers.find(d=>d.car===car&&!d.gone);return d&&{model:this.driverModel?.(car)??'MALE01',dead:d.health<=0||!!d.dead,deathAccounted:!!d.deathAccounted};}
  private driverVehicleDied(driver:Driver,aboard:boolean){
   if(aboard&&!driver.raged&&!driver.fled&&!driver.fired)this.onDriverDied?.(driver.car,{armour:0,accounted:!!driver.deathAccounted});
  }
  /** CEventVehicleOnFire affects a living occupant; a corpse must never take the live flee/exit bridge. */
  private driverVehicleOnFire(driver:Driver){
   const car=driver.car;if(driver.health<=0||driver.dead||driver.dying||driver.fired||car.occupied||car.driverOut||!car.autopilot)return;
   driver.fired=true;this.onFire?.(car);
  }
  /** CTaskSimpleDieInCar: the shot driver dies in his seat (CAR_dead_LHS) because the car is still moving. */
  onDriverDeadInSeat?:(car:WorldCar)=>void;
  /** A bullet through the window (CWorld::ProcessLineOfSight against the seated ped): weapon damage to the driver.
   * Returns how the driver fared, or undefined when the car has no live NPC driver. */
  driverShot(car:WorldCar,damage:number,forceDeath=false,creator:ShotCreator='ped'):'hit'|'killed'|undefined{
   const driver=this.drivers.find(d=>d.car===car&&!d.gone);
   if(!driver||car.occupied||car.driverOut||car.wrecked||!car.autopilot||driver.dead||driver.fled||driver.raged)return undefined;
   if(driver.dying||driver.health<=0)return 'killed';
   const factor=Math.fround(Math.fround(damage)*Math.fround(this.driverStats?.(car)?.defend??1));
   driver.health=forceDeath?0:healthAfterFloat32(driver.health,factor);
   if(driver.health>0){
    // CEventDamage in the car: ComputeDamageResponse sends a weapon hit on a ped in a vehicle straight to the personality
    // response. A driver already answering an event keeps to it.
    if(!driver.fleeScene&&!driver.chase){
     const answer=damageDriverResponse(this.driverDecisionMaker?.(car),RELATIONSHIP.player,this.random);
     if(answer==='fleeScene'){driver.fleeScene=true;driver.cruiseSpeed=FLEE_SCENE_CRUISE_SPEED;driver.avoidCars=true;}
     else if(answer==='killPed'){driver.chase={until:this.elapsed+CHASE_SECONDS};driver.avoidCars=true;}
    }
    return 'hit';
   }
   // PreparePedVehicleForPedDeath: real physics, cruise speed zero, no mission, and TEMPACT_HANDBRAKESTRAIGHT for 2000 ms.
   driver.dying={at:this.elapsed*1000};driver.cruiseSpeed=0;driver.temp={action:'handbrakeStraight',until:this.elapsed*1000+2000,from:'death'};
   // His health is gone from the shot on: dragged out before CTaskComplexDieInCar has run its 2000 ms, he comes out a
   // corpse, not a live ped who runs or comes back for the car.
   car.driverDead=true;
   driver.deathAccounted=true;this.onDriverKilled?.(car,creator);
   return 'killed';
  }
  /** The driver's pedstats decision maker (0 gang member, 1 cop, 2 normal, 3 tough, 4 weak) for the collision decision. */
  driverDecisionMaker?:(car:WorldCar)=>number|undefined;
  /** The decision draw (CDecision::MakeDecision's random). */
  random:()=>number=Math.random;
  /** Pedestrians and the player on foot, for SlowCarDownForPedsSectorList. */
  peds?:()=>V3[];
  /** The standoff's pointer comparison: an order for each vehicle, by when the traffic first saw it. */
  private carOrder=new WeakMap<WorldCar,number>();private carOrderNext=0;
  /** A vehicle no traffic driver owns: when the traffic first saw it, for its CAutoPilot clock (set as it is made). */
  private carFirstSeen=new WeakMap<WorldCar,number>();
  /** A cruising patrol car for the police system to own (CCarAI MISSION_CRUISE law enforcer); undefined when none spawned. */
  spawnPatrol?:(position:V3,heading:number)=>Promise<WorldCar|undefined>;
 constructor(private sim:Simulation,private fleet:WorldFleet,base:string){
  void openStaticWorld(base).then(source=>{if(!this.disposed)this.paths=worldPaths(source);}).catch(e=>{this.error=String(e);});
 }
 snapshot(){return {ready:!!this.paths,pending:this.busy,error:this.error??null,cars:this.drivers.filter(d=>!d.car.disposed).map(d=>{
  const p=d.car.car.body.translation(),here=lanePoint(travel(d.current),d.currentLane),t=travel(d.current),n=toNative(p);
  const r=d.car.car.body.rotation(),f=toNative(new Vector3(0,0,-1).applyQuaternion(new Quaternion(r.x,r.y,r.z,r.w))),fl=Math.hypot(f.x,f.y)||1,tl=Math.hypot(t.forward.x,t.forward.y)||1;
  return {handle:d.car.car.body.handle,modelId:d.car.modelId,position:{...p},speed:Math.hypot(d.car.car.body.linvel().x,d.car.car.body.linvel().z),cruiseSpeed:d.cruiseSpeed,lane:d.currentLane,raged:!!d.raged,fleeScene:!!d.fleeScene,fled:!!d.fled,health:d.health,dying:!!d.dying,dead:!!d.dead,deadInSeat:!!d.deadInSeat,
   laneError:Math.abs((n.x-here.x)*t.forward.y-(n.y-here.y)*t.forward.x),
   /** Cosine between the car's heading and its link's direction of travel. */
   alignment:+((f.x*t.forward.x+f.y*t.forward.y)/(fl*tl)).toFixed(3),stopped:d.stopped,temp:d.temp?.action??null,avoidCars:d.avoidCars,honk:{car:d.car.honkAtCar,ped:d.car.honkAtPed,counter:d.car.horn.counter},
   distance:d.distance,active:!!d.car.autopilot,from:d.current.from.address,to:d.current.to.address,
   rails:d.rails?{speed:+d.rails.speed.toFixed(2),spendMs:Math.round(d.rails.spendMs),at:+((this.elapsed*1000-d.rails.enteredMs)/d.rails.spendMs).toFixed(2),entry:!!d.rails.entry}:null};})};}
 update(now:number){
  if(this.disposed||this.busy||!this.paths||now<this.nextCheck)return;this.nextCheck=now+2000;
  const player=this.sim.worldFocus;
  this.drivers=this.drivers.filter(d=>{if(d.car.disposed)return false;if(d.car.occupied||!this.fleet.canChangePopulation(d.car.car.body.translation(),6)||Math.hypot(d.car.car.body.translation().x-player.x,d.car.car.body.translation().z-player.z)<120&&d.car.car.body.translation().y>player.y-25)return true;this.fleet.removeTrafficCar(d.car);return false;});
  const paths=this.paths;this.busy=true;
   void paths.loadAround(player.x,player.z).then(async()=>{
    if(this.disposed)return;
    const maxDrivers=this.fleet.trafficDrivers()??3;
    // CCarCtrl::GenerateRandomCars returns while the current area cannot see outside.
    if(this.drivers.length>=maxDrivers||this.fleet.cars.size>=9||!this.fleet.outside()||this.noSpawn())return;
   const p=this.sim.worldFocus,centre=toNative(p),view=this.creationView(),rand=()=>Math.floor(Math.random()*0x80000000);
   // CCarCtrl::GenerateOneRandomCar's way to a place (two tries a frame there; a handful a check here, the browser's).
   for(let attempt=0;attempt<RANDOM_CAR_TRIES;attempt++){
    const bearing=randomCarCreationBearing({...view,frameCounter:this.frameCounter++});
    // Nothing is made in view here (see RANDOM_CAR_FAR_HIDDEN): the in-view circle is off, and every other try asks
    // the far hidden circle instead of the executable's 38.
    const hidden=attempt&1?RANDOM_CAR_FAR_HIDDEN:RANDOM_CAR_OUT_OF_VIEW;
    const hit=generateCarCreationCoors2(paths.areas,this.creation,{position:centre,...bearing,inViewDistance:0,outOfViewDistance:hidden,avoidSwitchedOff:true,noBoats:false},
     {nowMs:this.elapsed*1000,rand,sphereVisible:(q,r)=>!this.fleet.canChangePopulation({x:q.x,y:q.z,z:-q.y},r)});
    if(!hit||!spawnProbabilityPasses(rand(),hit.node1.spawnProbability,hit.node2.spawnProbability))continue;
    // A water start makes a boat there; the browser's traffic has none.
    if(hit.node1.water||this.kindaColliding(hit.position,RANDOM_CAR_CLEARANCE))continue;
    const link=trafficLinks(paths.areas,hit.node1).find(l=>l.to===hit.node2);if(!link)continue;
    const pick=this.fleet.trafficPick(),laneCount=lanes(link).lanes;
    if(!laneCountAllows(laneCount,pick.modelId,BMX_MODELS.has(pick.modelId)))continue;
    const lane=rand()%laneCount,from=hit.node1.position,to=hit.node2.position,nodeDistance=Math.hypot(to[0]-from[0],to[1]-from[1]);
    // The executable clamps by the model's own length; the browser has not loaded it yet, so a car of 5 stands in.
    const t=clampCreationT(hit.t,ASSUMED_CAR_LENGTH,nodeDistance),route=travel(link);
    const along=lanePoint({...route,position:{x:from[0]+(to[0]-from[0])*t,y:from[1]+(to[1]-from[1])*t}},lane),x=along.x,z=-along.y;
    const way=unit({x:to[0]-from[0],y:to[1]-from[1]}),heading=Math.atan2(-way.x,way.y);
    // The car must be closing on the player: its speed (the cruise a car of its kind is given, by the next node's
    // speed code) less his.
    const cruise=randomCarCruiseSpeed(rand(),ASSUMED_CAR_LENGTH,pick.modelId,BMX_MODELS.has(pick.modelId)),speed=cruise*nodeSpeedMultiplier(hit.node2.flags)/GAME_SPEED_TO_CARAI_SPEED;
    const mine=this.playerVelocity();
    if(!approachesPlayer({x:way.x*speed,y:way.y*speed},mine,{x,y:-z},centre))continue;
    if(!this.fleet.canChangePopulation({x,y:link.from.position[2]+1,z},6))continue;
    const top=from[2]+(to[2]-from[2])*t+3,hit2=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit2||hit2.normal.y<.8)continue;
    const foot=top-hit2.timeOfImpact,rotation={x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)};
    if(this.sim.world.intersectionWithShape({x,y:foot+1,z},rotation,new RAPIER.Cuboid(1,.8,2.5)))continue;
    if(this.spawnPatrol&&this.fleet.patrolCarDue()){
     const patrol=await this.spawnPatrol({x,y:foot,z},heading).catch(()=>undefined);
     if(patrol){this.serial++;break;}
    }
    const car=await this.fleet.spawnTrafficCar(pick.modelId,{x,y:foot,z},heading,()=>!this.disposed&&this.fleet.canChangePopulation({x,y:foot+1,z},6));
    if(!car)continue;
    car.gang=pick.gang;
    const focus=this.sim.worldFocus;if(this.disposed||Math.hypot(x-focus.x,z-focus.z)>100){this.fleet.removeTrafficCar(car);return;}
    this.error=undefined;car.autopilot={throttle:0,brake:0,steering:0,handbrake:true};car.activeRadius=this.physicsRadius;
    const b=car.nativeBody,length=b.boundsMax.y-b.boundsMin.y;
    const driver:Driver={car,health:100,current:link,currentLane:lane,nextLane:lane,seed:Math.floor(Math.random()*65536),timeToStartMission:this.elapsed*1000,timeSwitchedToRealPhysics:this.elapsed*1000,avoidCars:false,laneCountdown:initialLaneChangeCountdown(rand),speedCode:nodeSpeedCode(hit.node2.flags,false),speedMult:nodeSpeedMultiplier(hit.node2.flags),
     cruiseSpeed:length<=10?cruise:randomCarCruiseSpeed(rand(),length,pick.modelId,BMX_MODELS.has(pick.modelId)),stopped:null,distance:0,last:{x,z}};
    car.onCollisionDamage=(raw,byPlayer)=>this.collisionEvent(driver,raw,byPlayer);car.onTyreShot=shooter=>this.tyreShot(driver,shooter);car.onWeaponDamage=shooter=>this.tyreShot(driver,shooter);car.onBlowUp=aboard=>this.driverVehicleDied(driver,aboard);
    // GenerateOneRandomCar's speed code is the node ahead's, without the behaviour-type case.
    this.pickNext(driver,link);driver.speedCode=nodeSpeedCode(hit.node2.flags,false);this.drivers.push(driver);this.serial++;break;
   }
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
 /** The curve a car on rails is on: from where it left physics to its current link's lane point, then from each link's
  * lane point to the next one's. */
 private curve(d:Driver){
  const cur=travel(d.current),here=lanePoint(cur,d.currentLane);
  if(d.rails?.entry)return {start:d.rails.entry.from,startDir:d.rails.entry.dir,end:here,endDir:cur.forward,endLink:d.current,startLink:d.current};
  const next=travel(d.next!);return {start:here,startDir:cur.forward,end:lanePoint(next,d.nextLane),endDir:next.forward,startLink:d.current,endLink:d.next!};
 }
 /** m_nTimeToSpendOnCurrentCurve: CCurves::CalcSpeedScaleFactor × 1000 / m_fMaxTrafficSpeed. */
 private curveMs(d:Driver){const c=this.curve(d);return Math.max(1,calcSpeedScaleFactor(c.start,c.end,c.startDir.x,c.startDir.y,c.endDir.x,c.endDir.y)*1000/d.rails!.speed);}
 /** CAutoPilot::ModifySpeed: a new speed re-times the curve, keeping the car's place on it. */
 private modifySpeed(d:Driver,speed:number,now:number){
  const r=d.rails!,fraction=(now-r.enteredMs)/r.spendMs;r.speed=Math.max(.01,speed);r.spendMs=this.curveMs(d);r.enteredMs=now-fraction*r.spendMs;
 }
 private groundBelow(x:number,y:number,z:number,top:number,depth:number){
  const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:y+top,z},{x:0,y:-1,z:0}),top+depth,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  return hit?y+top-hit.timeOfImpact:undefined;
 }
 /** CCarCtrl::UpdateCarOnRails (SA's is a stub; the Vice City ancestor):
  * - SlowCarOnRailsDownForTrafficAndLights eases m_fMaxTrafficSpeed toward the traffic limit, or to 0 at a light,
  *   by 0.05 up and 0.7 down per TimeStep.
  * - PickNextNodeAccordingStrategy runs once the curve's time is up.
  * - The car is dragged onto the CCurves point (DragCarToPoint): its nose on the point, its tail 3 behind, each on
  *   the ground below. */
 private stepRails(d:Driver,now:number,dt:number,trafficSpeed:number,stop:boolean,hold=false){
  const car=d.car,body=car.car.body,p=body.translation();
  if(!d.rails){
   const r=body.rotation(),f=toNative(new Vector3(0,0,-1).applyQuaternion(new Quaternion(r.x,r.y,r.z,r.w))),v=body.linvel(),ground=this.groundBelow(p.x,p.y,p.z,1.5,3);
   d.rails={enteredMs:now,spendMs:1,speed:Math.max(.01,Math.hypot(v.x,v.z)),entry:{from:{x:p.x,y:-p.z},dir:unit(f)},heightAboveRoad:ground===undefined?1:p.y-ground,ahead:ground??p.y-1,behind:ground??p.y-1};
   d.rails.spendMs=this.curveMs(d);
  }
  const r=d.rails,ts=dt*50,limit=stop||!d.next?0:trafficSpeed;
  if(!d.next&&!r.entry){r.speed=0;car.car.placeOnRails({...p},{...body.rotation()},{x:0,y:0,z:0});return;}
  if(hold){this.modifySpeed(d,0,now);car.car.placeOnRails({...p},{...body.rotation()},{x:0,y:0,z:0});return;}
  if(limit>=r.speed){if(limit>r.speed)this.modifySpeed(d,Math.min(limit,r.speed+.05*ts),now);}
  else if(r.speed!==0)this.modifySpeed(d,r.speed<.1?0:Math.max(limit,r.speed-.7*ts),now);
  for(let guard=0;d.next&&r.enteredMs+r.spendMs<=now&&guard<8;guard++){
   r.enteredMs+=r.spendMs;
   if(r.entry)r.entry=undefined;
   else{d.previous=d.current;d.current=d.next;d.currentLane=d.nextLane;this.pickNext(d,d.current);if(!d.next)break;}
   r.spendMs=this.curveMs(d);
  }
  // The end of its road: the car stands where it is.
  if(!d.next&&!r.entry){r.speed=0;car.car.placeOnRails({...p},{...body.rotation()},{x:0,y:0,z:0});return;}
  const c=this.curve(d),t=(now-r.enteredMs)/r.spendMs;
  const target=calcCurvePoint(c.start,c.end,unit({x:c.startDir.x+railOffset(c.startLink,d.seed).x,y:c.startDir.y+railOffset(c.startLink,d.seed).y}),unit({x:c.endDir.x+railOffset(c.endLink,d.seed).x,y:c.endDir.y+railOffset(c.endLink,d.seed).y}),t,r.spendMs).point;
  // DragCarToPoint: 1.5 behind the car's position, then 3 back from the target along that line.
  const n=toNative(p),q0=body.rotation(),f=unit(toNative(new Vector3(0,0,-1).applyQuaternion(new Quaternion(q0.x,q0.y,q0.z,q0.w)))),behind={x:n.x-1.5*f.x,y:n.y-1.5*f.y};
  let dir={x:behind.x-target.x,y:behind.y-target.y};const dl=Math.hypot(dir.x,dir.y);dir=dl>1e-4?{x:dir.x/dl,y:dir.y/dl}:{x:-f.x,y:-f.y};
  const mid={x:target.x+dir.x*3,y:target.y+dir.y*3};
  // ProcessVerticalLine from 1.5 above the car to 2 below it, then 3 either way, else the last height.
  r.ahead=this.groundBelow(target.x,p.y,-target.y,1.5,2)??this.groundBelow(target.x,p.y,-target.y,3,3)??r.ahead;
  r.behind=this.groundBelow(mid.x,p.y,-mid.y,1.5,2)??this.groundBelow(mid.x,p.y,-mid.y,3,3)??r.behind;
  const pitch=Math.atan2((r.ahead-r.behind)/3,1),cos=Math.cos(pitch),sin=Math.sin(pitch);
  const right={x:(target.y-mid.y)/3,y:-(target.x-mid.x)/3},forward={x:-cos*right.y,y:cos*right.x,z:sin};
  const back=new Vector3(-forward.x,-forward.z,forward.y),rightB=new Vector3(right.x,0,-right.y).normalize(),up=new Vector3().crossVectors(back,rightB).normalize();
  const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(rightB,up,back.normalize()));
  const moveDir=unit({x:target.x-mid.x,y:target.y-mid.y}),speed=r.speed;
  car.car.placeOnRails({x:(mid.x+target.x)/2,y:(r.ahead+r.behind)/2+r.heightAboveRoad,z:-(mid.y+target.y)/2},{x:rotation.x,y:rotation.y,z:rotation.z,w:rotation.w},{x:moveDir.x*speed,y:0,z:-moveDir.y*speed});
 }
 /** Back within the active radius the car takes physics again from where the rails left it (SwitchVehicleToRealPhysics):
  * past its current link, it heads for the next one. */
 private leaveRails(d:Driver,now:number){
  const entering=!!d.rails?.entry;d.rails=undefined;d.railsLimit=undefined;d.timeSwitchedToRealPhysics=now;
  // Picked under physics: no refusal of a sharp turn.
  if(!entering&&d.next){d.previous=d.current;d.current=d.next;d.currentLane=d.nextLane;this.pickNext(d,d.current);}
 }
 /** CCarCtrl::PickNextNodeRandomly: the link after `from`, and the lane on it. Switched-off and don't-wander roads are
  * among the candidates: the pick's own rules keep a random car off the first unless it is on one, and only mission
  * cars off the second. */
 private pickNext(d:Driver,from:TrafficLink){
  // PickNextNodeAccordingStrategy first takes the speed code of the node just reached.
  d.speedCode=nodeSpeedCode(from.from.flags);
  const areas=this.paths?.areas;if(!areas){d.next=undefined;return;}
  const junction=from.to,onFrom=lanes(from),now=this.elapsed*1000,rand=()=>Math.floor(Math.random()*0x80000000);
  const candidates:NextCandidate<TrafficLink>[]=trafficLinks(areas,junction,true).map(link=>{const l=lanes(link);
   return {value:link,node:{x:link.to.position[0],y:link.to.position[1]},uTurn:sameNode(link.to,from.from),deadEnd:link.to.deadEnd,switchedOff:link.to.switchedOff,
    water:link.to.water,dontWander:link.to.dontWander,behaviour:link.to.behaviour,lanes:l.lanes,oppositeLanes:l.reverseLanes};});
  const pick=pickNextNodeRandomly({previous:{x:from.from.position[0],y:from.from.position[1]},current:{x:junction.position[0],y:junction.position[1]},candidates,
   lanesOnCurrent:onFrom.lanes,onOneWayRoad:onFrom.reverseLanes===0,nextLane:d.nextLane,junction,previousSwitchedOff:from.from.switchedOff,
   vehicle:{tryNotToTurn:TRY_NOT_TO_TURN_MODELS.has(d.car.modelId),onRails:!!d.rails,boundsMax:d.car.nativeBody.boundsMax},random:count=>rand()%count});
  d.next=pick.choice?.value;
  if(!d.next)return;
  // A U-turn switches a car on rails to physics (SwitchVehicleToRealPhysics: no temporary action, 2 s before a jam
  // can count). The browser's rails are decided by distance, so only the clocks are kept.
  if(pick.uTurn&&d.rails){d.temp=undefined;d.timeToStartMission=now+2000;d.timeSwitchedToRealPhysics=now;}
  // Node behaviour types: the car waits (TEMPACT_WAIT) 10 s heading for a type-10 node, and 4.5 s at a type-9 junction.
  if(d.next.to.behaviour===10)d.temp={action:'wait',until:now+10000,from:'node'};
  if(junction.behaviour===9)d.temp={action:'wait',until:now+4500,from:'node'};
  const change=laneChangeCountdown(d.laneCountdown,d.next.length,rand);d.laneCountdown=change.countdown;
  d.nextLane=nextLaneOnLink(d.nextLane,lanes(d.next).lanes,change.change,change.right);
 }
 beforeStep(dt:number){
  this.steps++;const previousNow=this.elapsed*1000;this.elapsed+=dt;const now=this.elapsed*1000,sirens=this.sirens?.()??[],peds=(this.peds?.()??[]).map(toNative);
  // Scan the fleet's live set, never a copy: a stalled driver removed below frees its body, and a copy would hand
  // that freed body to the next driver's danger scan (a Rapier panic that then failed every frame).
  const cars=this.fleet.cars;
  // Each vehicle's danger view, taken once a frame when first asked for (a car removed below is skipped as disposed).
  const views=new Map<WorldCar,DangerView&{car:WorldCar}>(),view=(c:WorldCar)=>{let v=views.get(c);if(!v){v={...c.dangerView(),car:c};views.set(c,v);}return v;};
  const others=function*(){for(const c of cars)if(!c.disposed)yield view(c);};
  let drivers:Map<WorldCar,Driver>|undefined;const driverOf=()=>drivers??=new Map(this.drivers.map(d=>[d.car,d]));
  const order=(c:WorldCar)=>{let n=this.carOrder.get(c);if(n===undefined)this.carOrder.set(c,n=this.carOrderNext++);return n;};
  const firstSeen=(c:WorldCar)=>{let t=this.carFirstSeen.get(c);if(t===undefined)this.carFirstSeen.set(c,t=now);return t;};
  for(const driver of this.drivers){
   const car=driver.car;if(car.disposed){driver.gone=true;continue;}car.honkAtCar=car.honkAtPed=false;car.pedDangerScan=undefined;
   // CAutomobile::ProcessControl raises CEventVehicleOnFire when the engine fire starts; the driver answers it once.
   if(car.onFire)this.driverVehicleOnFire(driver);
   if(car.occupied||!car.autopilot)continue;
   // A dead driver: the car brakes and holds where it stopped (its status is no longer driven).
   if(driver.dead){const v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z);car.autopilot={steering:0,throttle:0,brake:1,handbrake:speed<.3};continue;}
   // CTaskComplexDieInCar: 2000 ms after the fatal shot, out of the door and dead if the car can be stepped out of, else dead in the seat.
   if(driver.dying&&now>=driver.dying.at+DIE_IN_CAR_OFFSET_MS){
    const v=car.car.body.linvel(),w=car.car.body.angvel(),r=car.car.body.rotation(),upZ=1-2*(r.x*r.x+r.z*r.z);
    driver.dead=true;driver.dying=undefined;car.driverDead=true;
    if(canPedStepOutCar(upZ,{x:v.x/50,y:-v.z/50,z:v.y/50},{x:w.x/50,y:-w.z/50,z:w.y/50}))this.onDriverDiesOut?.(car,{armour:0,accounted:!!driver.deathAccounted});
    else{driver.deadInSeat=true;this.onDriverDeadInSeat?.(car);}
    car.autopilot={steering:0,throttle:0,brake:1,handbrake:true};continue;
   }
   if(driver.rageWait){
    const v=car.car.body.linvel(),w=car.car.body.angvel(),r=car.car.body.rotation(),upZ=1-2*(r.x*r.x+r.z*r.z);
    if(canPedStepOutCar(upZ,{x:v.x/50,y:-v.z/50,z:v.y/50},{x:w.x/50,y:-w.z/50,z:w.y/50})){driver.rageWait=false;this.onRoadRage?.(car);}
    else car.autopilot={steering:0,throttle:0,brake:1,handbrake:Math.hypot(v.x,v.z)<.3};
    continue;
   }
   if(car.holdForEntry){const v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z);car.autopilot={steering:0,throttle:0,brake:1,handbrake:speed<.3};continue;}
   const body=car.car.body,p=body.translation(),r=body.rotation(),v=body.linvel(),speed=Math.hypot(v.x,v.z);
   driver.distance+=Math.hypot(p.x-driver.last.x,p.z-driver.last.z);driver.last={x:p.x,z:p.z};
   const q=new Quaternion(r.x,r.y,r.z,r.w),f3=toNative(new Vector3(0,0,-1).applyQuaternion(q)),right3=toNative(new Vector3(1,0,0).applyQuaternion(q));
   const position=toNative(p),move=toNative({x:v.x/50,y:v.y/50,z:v.z/50}),flat=Math.hypot(f3.x,f3.y)||1,forward={x:f3.x/flat,y:f3.y/flat};
   const state={position,forward,moveSpeed:move,forward3:f3};
   if(driver.chase){
    const target=toNative(this.sim.player.position);
    if(this.elapsed>driver.chase.until||this.sim.player.health<=0||Math.hypot(target.x-position.x,target.y-position.y)>CHASE_GIVE_UP_DISTANCE){driver.chase=undefined;driver.fleeScene=true;driver.cruiseSpeed=FLEE_SCENE_CRUISE_SPEED;}
    else{
     if(driver.rails)this.leaveRails(driver,now);
     car.obstructingEntity=undefined;
     const pedals=steerHeadingForTarget(state,{x:target.x,y:target.y},FLEE_SCENE_CRUISE_SPEED);
     car.autopilot={steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};driver.stopped=null;continue;
    }
   }
   // Beyond the car's active radius its body sleeps: it drives on rails (STATUS_SIMPLE) instead of freezing. A car
   // told to make way for a siren is put under physics (MakeWayForCarWithSiren sets STATUS_PHYSICS) while it does.
   const onRails=!car.inActiveRange()&&!(driver.temp?.from==='siren'&&now<driver.temp.until);
   if(!onRails)car.obstructingEntity=undefined;
   if(!onRails&&driver.rails)this.leaveRails(driver,now);
   // SteerAICarWithPhysicsFollowPath's node change, before steering.
   if(!onRails&&driver.next&&shouldPickNextNode(state,travel(driver.current),driver.currentLane,travel(driver.next),driver.nextLane)){
    driver.previous=driver.current;driver.current=driver.next;driver.currentLane=driver.nextLane;this.pickNext(driver,driver.current);
   }
   // CCarAI::MakeWayForCarWithSiren, run by CAutomobile::ProcessControl of each car sounding its siren.
   // MakeWayForCarWithSiren skips big vehicles (and mad drivers, law cars and emergency vehicles on duty, none of
   // which are this browser's random traffic).
   const bigClass=this.fleet.vehicleClass(car.modelId)==='big';
   for(const siren of bigClass?[]:sirens){
    if(siren.position.x===p.x&&siren.position.z===p.z)continue;
    const yielded=makeWayForCarWithSiren({position,moveSpeed:move,forward,current:driver.temp&&now<driver.temp.until?driver.temp.action:undefined},{position:toNative(siren.position),moveSpeed:toNative({x:siren.velocity.x/50,y:siren.velocity.y/50,z:siren.velocity.z/50})});
    if(yielded)driver.temp={action:yielded.action,until:now+yielded.ms,from:'siren'};
   }
   // CCarAI::UpdateCarAI: m_SpeedMult glides 0.01 a 50 Hz step towards the speed code's multiplier, snapping within a step.
   {const target=speedMultiplierFromNodes(driver.speedCode),step=dt*50*.01;driver.speedMult=Math.abs(driver.speedMult-target)<step?target:driver.speedMult+(driver.speedMult>target?-step:step);}
   // CCarCtrl::FindMaximumSpeedForThisCarInTraffic (iOS 0x100193dcc) under STOP_FOR_CARS: from cruise × m_SpeedMult, the
   // lowest speed any vehicle or ped in the ±14 box allows. DRIVINGSTYLE_AVOID_CARS returns cruise × m_SpeedMult at once.
   // SlowCarOnRailsDownForTrafficAndLights refreshes a car on rails' limit only on frames where (frame + seed) & 3 is 0;
   // on the others ScanForPedDanger's ±11 ped check runs alone, for its temporary actions.
   const cur=driver.cruiseSpeed*driver.speedMult,b=car.nativeBody,scanFrame=!onRails||driver.railsLimit===undefined||((this.steps+driver.seed)&3)===0;
   let trafficSpeed=cur,slowedByCars=false,slowedByPeds=false;
   if(!driver.avoidCars&&!scanFrame){
    const inBox=peds.filter(q=>Math.abs(q.x-position.x)<PED_DANGER_SCAN_DISTANCE&&Math.abs(q.y-position.y)<PED_DANGER_SCAN_DISTANCE);
    const pedScan=slowCarDownForPeds({position,forward:f3,right:right3,moveSpeed:move,front:b.boundsMax.y,halfWidth:b.boundsMax.x},inBox,driver.cruiseSpeed,driver.cruiseSpeed);
    if(pedScan.action)driver.temp={action:pedScan.action,until:now+4000,from:'ped'};
   }else if(!driver.avoidCars){
    car.pedDangerScan=DISTANCE_TO_SCAN_FOR_DANGER;
    const own=view(car),scan=slowCarDownForCars(own,others(),trafficSpeed,cur,(other,proximity,speed)=>{
     car.obstructingEntity=other.car;
     // SlowCarDownForOtherCar's 15-second standoff, asked of one car of the pair (the executable compares pointers):
     // at least 0.2 of cur, and DRIVINGSTYLE_AVOID_CARS. It also switches a car on rails to physics, which the
     // browser's rails (decided by the active radius) cannot.
     const them=driverOf().get(other.car);
     if(other.car.occupied||order(car)>order(other.car)||!standoffApplies(proximity,{now,stillSince:driver.timeSwitchedToRealPhysics,otherStillSince:them?them.timeSwitchedToRealPhysics:firstSeen(other.car),forward:own.forward,otherForward:other.forward}))return speed;
     driver.avoidCars=true;return Math.max(speed,cur*.2);
    });
    trafficSpeed=scan.speed;slowedByCars=scan.honk;
    // CPlayerInfo::m_pLastTargetVehicle, which passes the player over, is only set while he falls off a car he was
    // getting into (CTaskComplexEnterCar's fall and get-up), which the browser's entry has not.
    const inBox=peds.filter(q=>Math.abs(q.x-position.x)<DISTANCE_TO_SCAN_FOR_DANGER&&Math.abs(q.y-position.y)<DISTANCE_TO_SCAN_FOR_DANGER);
    const pedScan=slowCarDownForPeds({position,forward:f3,right:right3,moveSpeed:move,front:b.boundsMax.y,halfWidth:b.boundsMax.x},inBox,trafficSpeed,cur);
    trafficSpeed=pedScan.speed;slowedByPeds=pedScan.honk;
    // TEMPACT_WAIT within 4 of the nose, TEMPACT_BRAKE within 2.5, for 4 s, over whatever the car was doing.
    if(pedScan.action)driver.temp={action:pedScan.action,until:now+4000,from:'ped'};
   }
   const approach=(link:TrafficLink|undefined)=>link&&{navigation:link.navigation,routeAddress:link.to.address,travelSign:travelSign(link)};
   // ShouldCarStopForLight checks the previous link's light only for a car under physics.
   const atSignal=scanFrame&&nativeShouldStopForLight({position:[position.x,position.y],appearance:'car',physicsStatus:!onRails,current:approach(driver.current)!,next:approach(driver.next),previous:approach(driver.previous)},Math.floor(now)>>>0);
   // CCarAI::CarHasReasonToStop: a car stopping for a light is not stuck.
   if(atSignal&&(onRails||!driver.avoidCars))driver.timeToStartMission=now;
   // CCarAI::UpdateCarAI's jam handling, which a temporary action skips until the steering below clears it as it runs
   // out (restarting the jam clock), so the frame it ends is not a jam. A car on its roof (up.z under −0.7) skips it
   // and waits (TEMPACT_WAIT) for 1000 ms, refreshed (iOS 0x10018a620; gta-reversed reads a reverse).
   const flipped=toNative(new Vector3(0,1,0).applyQuaternion(q)).z<-.7;
   const jam=carAIJam({now,previousNow,moveSpeed2D:Math.hypot(move.x,move.y),collisionAgeMs:car.collisionAge*1000,seed:driver.seed,tempAction:flipped||!!driver.temp,timeToStartMission:driver.timeToStartMission,timeSwitchedToRealPhysics:driver.timeSwitchedToRealPhysics,stopForCars:!driver.avoidCars});
   driver.timeToStartMission=jam.timeToStartMission;driver.timeSwitchedToRealPhysics=jam.timeSwitchedToRealPhysics;
   if(jam.action){driver.temp={action:'reverse',until:now+jam.action.ms,from:'jam'};driver.avoidCars=true;if(jam.action.horn)playCarHorn(car);}
   if(flipped)driver.temp={action:'wait',until:now+1000,from:'flipped'};
   if(onRails){
    // UpdateCarOnRails: TEMPACT_WAIT and TEMPACT_BRAKE hold the car where it is (ModifySpeed(0)) until they run out,
    // which restarts both jam clocks.
    const hold=driver.temp&&(driver.temp.action==='wait'||driver.temp.action==='brake')?driver.temp:undefined;
    if(hold&&now>hold.until){driver.temp=undefined;driver.timeToStartMission=driver.timeSwitchedToRealPhysics=now;}
    // SlowCarOnRailsDownForTrafficAndLights stops a car on rails for a light whatever its driving style.
    if(scanFrame)driver.railsLimit=atSignal?0:trafficSpeed;
    this.stepRails(driver,now,dt,driver.railsLimit!,false,!!hold);
    car.autopilot={steering:0,throttle:0,brake:0,handbrake:false};driver.stopped=null;continue;
   }
   // Only STOP_FOR_CARS drivers stop for lights, and only their FollowPath reads the traffic speed.
   const follow=driver.next?steerFollowPath(state,travel(driver.current),driver.currentLane,travel(driver.next),{cruiseSpeed:driver.cruiseSpeed,trafficSpeed:driver.avoidCars?driver.cruiseSpeed:trafficSpeed,stop:atSignal&&!driver.avoidCars})
     :{swerve:0,accel:0,brake:1,handbrake:speed<.3};
   let pedals=follow;
   if(driver.temp&&now<driver.temp.until)pedals=tempActionPedals(driver.temp.action,driver.temp.until-now,{follow,forwardSpeed:move.x*f3.x+move.y*f3.y+move.z*f3.z});
   else if(driver.temp){
    // TEMPACT_WAIT and TEMPACT_BRAKE restart the jam clock as they end; BRAKE the moving one too. A swerve to a stop
    // then waits.
    if(driver.temp.action==='wait'||driver.temp.action==='brake')driver.timeToStartMission=now;
    if(driver.temp.action==='brake')driver.timeSwitchedToRealPhysics=now;
    driver.temp=driver.temp.action==='swerveStop'?{action:'wait',until:now+SWIRVE_STOP_WAIT_MS,from:driver.temp.from}:undefined;
   }
   // CAutoPilot::m_bSlowedDownBecauseOfCars and ...Peds, which PlayHornIfNecessary reads.
   car.honkAtCar=slowedByCars;car.honkAtPed=slowedByPeds;car.stoppedForLight=atSignal;
   const forwardSpeed=(move.x*f3.x+move.y*f3.y+move.z*f3.z)*GAME_SPEED_TO_CARAI_SPEED;
   const temp=driver.temp&&now<driver.temp.until?driver.temp:undefined;
   driver.stopped=temp?.from==='siren'?'siren':temp?'obstacle':!this.paths?.areas.has(driver.current.to.address.area)?'unloaded road':!driver.next?'end of route':atSignal&&!driver.avoidCars?'traffic light':(slowedByCars||slowedByPeds)&&forwardSpeed<1?'obstacle':null;
   const limit=recoveryLimit(driver.stopped);
   if(limit>0){
    if(driver.stalledReason!==driver.stopped){driver.stalledReason=driver.stopped;driver.stalledAt=this.elapsed;}
    if(this.elapsed-(driver.stalledAt??this.elapsed)>limit&&this.fleet.canChangePopulation(p,6)){this.fleet.removeTrafficCar(car);driver.gone=true;continue;}
   }else driver.stalledReason=undefined;
   car.autopilot={steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
  }
  if(this.drivers.some(d=>d.gone))this.drivers=this.drivers.filter(d=>!d.gone);
 }
 /** CEventVehicleDamageCollision: a collision costing the driven car over 5 health (CAutomobile::VehicleDamage)
  * answered by the driver's decision maker (CEventHandler::ComputeVehicleDamageResponse): nothing,
  * CTaskComplexCarDriveMissionFleeScene (cruise at 40 avoiding cars) or CTaskComplexRoadRage. Only the player's car
  * is a source here: an AI-to-AI ram picks which driver hears it by the impact direction, not modelled. */
 private collisionEvent(driver:Driver,rawLoss:number,byPlayer:boolean){
  const car=driver.car;
  if(!byPlayer||rawLoss<=5||car.occupied||!car.autopilot||car.driverOut||car.wrecked||driver.raged)return;
  const response=collisionDamageResponse(this.driverDecisionMaker?.(car),RELATIONSHIP.player,this.random);
  const fleeScene=()=>{driver.fleeScene=true;driver.cruiseSpeed=FLEE_SCENE_CRUISE_SPEED;driver.avoidCars=true;};
  if(response==='fleeScene')fleeScene();
  // CTaskComplexRoadRage leaves the car through CTaskComplexLeaveCar with sensible set: CTaskSimpleCarWaitToSlowDown
  // holds him in the seat, braking, until the car can be stepped out of.
  else if(response==='roadRage'){driver.raged=true;driver.rageWait=true;}
  // TASK_COMPLEX_CAR_DRIVE_MISSION_KILL_PED (0x4C3111): a game driver the player rams during a mission flees the scene;
  // otherwise CTaskComplexCarDriveMissionKillPed goes after the player. That task is not reversed: the chase drives at
  // him, avoiding cars, for CHASE_SECONDS (authored) or until he is CHASE_GIVE_UP_DISTANCE away.
  else if(response==='killPed'){if(this.playerOnMission?.())fleeScene();else{driver.chase={until:this.elapsed+CHASE_SECONDS};driver.avoidCars=true;}}
 }
 /** CEventGunShot on the traffic drivers: CEventGunShot::AffectsPed excludes only a passenger whose car has a driver,
  * so a driver within 45 units of the shooter hears the shot (a silenced one only where it could see it: not
  * modelled, so none) and answers from his decision maker. A driver already answering an event keeps to it. */
 gunShot(from:{x:number;y:number;z:number},silent:boolean,byPlayer:boolean){
  if(silent)return;
  for(const driver of this.drivers){
   const car=driver.car;
   if(driver.gone||car.disposed||car.occupied||!car.autopilot||car.driverOut||car.wrecked||driver.dead||driver.dying||driver.raged||driver.fled||driver.fleeScene||driver.chase)continue;
   const p=car.car.body.translation();if(Math.hypot(p.x-from.x,p.y-from.y,p.z-from.z)>45)continue;
   if(gunShotDriverResponse(this.driverDecisionMaker?.(car),byPlayer?RELATIONSHIP.player:RELATIONSHIP.neutral,this.random)==='fleeScene'){driver.fleeScene=true;driver.cruiseSpeed=FLEE_SCENE_CRUISE_SPEED;driver.avoidCars=true;}
  }
 }
 /** CTheScripts::IsPlayerOnAMission, for the kill-ped answer to a ram. */
 playerOnMission?:()=>boolean;
 /** CEventVehicleDamageWeapon: a ped's bullet burst the car's tyre (CWeapon::DoBulletImpact), or a ped's weapon harmed
  * the car and left it health (CVehicle::InflictDamage, iOS 0x1004781b4). The driver's decision
  * maker draws nothing, the flee-scene drive, a kill on foot (IsKillTaskAppropriate: an unarmed driver never takes on a
  * gunman, so the driver flees the scene instead) or CTaskComplexLeaveCarAndFlee. Cops and gang members answer with
  * tasks that do not apply here (kill criminal, inform) so nothing happens. */
 private tyreShot(driver:Driver,shooter:'player'|'ped'){
  const car=driver.car;
  if(car.occupied||!car.autopilot||car.driverOut||car.wrecked||driver.raged||driver.fled)return;
  const response=weaponDamageResponse(this.driverDecisionMaker?.(car),shooter==='player'?RELATIONSHIP.player:RELATIONSHIP.neutral,this.random);
  const fleeScene=()=>{driver.fleeScene=true;driver.cruiseSpeed=FLEE_SCENE_CRUISE_SPEED;driver.avoidCars=true;};
  if(response==='fleeScene')fleeScene();
  else if(response==='killPedOnFoot'){if(!isKillTaskAppropriate({holdsGun:false,attackerHoldsGun:true}))fleeScene();}
  else if(response==='leaveCarAndFlee'){driver.fled=true;this.onLeaveCarAndFlee?.(car);}
 }
 /** The loaded car path nodes within `maxDistance` of a browser point, nearest first (CPathFind::FindNthNodeClosestToCoors
  * over the vehicle nodes). Browser x/y/z. */
 roadNodesNear(point:{x:number;z:number},maxDistance:number){
  if(!this.paths)return [];
  return [...this.paths.areas.values()].flatMap(a=>a.nodes).map(n=>({x:n.position[0],y:n.position[2],z:-n.position[1],d:Math.hypot(n.position[0]-point.x,-n.position[1]-point.z)})).filter(n=>n.d<=maxDistance).sort((a,b)=>a.d-b.d);
 }
 dispose(){this.disposed=true;for(const d of this.drivers)this.fleet.removeTrafficCar(d.car);this.drivers=[];}
}
