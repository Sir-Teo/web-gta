import {bindNativeCarDirt} from '../render/nativeCarDirt';
import {NativeCarReflection} from '../assets/nativeCarEnvMap';
import {randomSeed} from './nativeVehicleLights';
import {bindNativeCarPaint,type NativeCarColors} from '../render/nativeCarPaint';
import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Matrix4,Quaternion,Vector3,type Scene,type Object3D} from 'three';
import type {Simulation} from './Simulation';
import type {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {prepareHandling} from './nativeHandling';
import {interpolateVehiclePose} from '../render/vehiclePose';
import {FLIGHT_MODEL,applyGravityAndAirResistance,heightAboveCeiling as nativeHeightAboveCeiling,planeFlyingControl,smoothPlaneInput,stepPropSpeed,HELI_FLIGHT_MODEL,HELI_ROTOR_FLY,HELI_ROTOR_FULL,HYDRA_NOZZLE_MAX,HYDRA_NOZZLE_RATE,HYDRA_VTOL_NOZZLE,heliFlyingControl,heliHoverInputs,hydraThrustAxis,stepHeliRotor,type FlyingBody,type NativeVec as NV,type PlaneControls} from './nativeFlyingControl';
import {requireAsset} from '../assets/binary';
import {MISSION_HELI_ATTACK_PLAYER,MISSION_HELI_ATTACK_PLAYER_FLY_AWAY,MISSION_HELI_CRASH_AND_BURN,MISSION_HELI_FLYTOCOORS,MISSION_HELI_FLY_AWAY_FROM_PLAYER,MISSION_HELI_FOLLOW_ENTITY,MISSION_HELI_KEEP_ENTITY_IN_VIEW,MISSION_HELI_POLICE_BEHAVIOUR,MISSION_HELI_LAND,MISSION_HELI_LAND_TOUCHING_DOWN,heliCrashYaw,heliForcedOrientation,heliProbeDue,newHeliAI,steerAIHeliAsPoliceHeli,steerAIHeliToAttackPlayer,steerAIHeliFlyingAwayFromPlayer,steerAIHeliToCrashAndBurn,steerAIHeliToFollowEntity,steerAIHeliToKeepEntityInView,steerAIHeliToLand,steerAIHeliTowardsTargetCoors,type HeliAI,type HeliPilot} from './nativeHeliAI';
import {blastBombTimerMs,firesExplodesOrShoots,notePlayerVehicleHarm,playerVehicleDamage} from './carDamageHost';
import {stepBombTimer} from '../vehicle/nativeCarBomb';
import {stepPlaneWheelRoll,type PlaneWheelRoll} from './planeWheelRoll';
import {MISSION_PLANE_ATTACK_PLAYER,MISSION_PLANE_ATTACK_PLAYER_POLICE,MISSION_PLANE_FLYINDIRECTION,MISSION_PLANE_FLYTOCOORS,MISSION_PLANE_FOLLOW_ENTITY,atanOfXY,newPlaneAI,planeSearchDue,steerAIPlane,type PlaneAI,type PlanePilot} from './nativePlaneAI';
import {applyNativeBuoyancy,nativeBuoyancySplashEdges,nativeSplashParticles,type NativeBuoyancyBody,type NativeVec} from './nativeBuoyancy';
import type {NativeAnimation} from '../assets/ifp';
import {vehicleAnimation,VEHICLE_ANIM,type VehicleAnimGroupData} from '../assets/vehicleAnimGroups';
export const PLAYABLE_PLANES:Readonly<Record<number,string>>={476:'Rustler',511:'Beagle',512:'Cropduster',513:'Stuntplane',519:'Shamal',553:'Nevada',593:'Dodo',417:'Leviathan',425:'Hunter',447:'Seasparrow',469:'Sparrow',487:'Maverick',488:'News Maverick',497:'Police Maverick',548:'Cargobob',563:'Raindance',520:'Hydra',
 /* The RC aircraft (bIsRCVehicle), which a script makes (ZERO1's barons) or the player flies by remote control. */
 464:'RC Baron',465:'RC Raider',501:'RC Goblin'};
/** Entry/exit clip slots resolved through the model's handling anim group (AssocGroupId
 * 88+n): align comes from the file where its flag bit clears (rustler/shamal for detailed
 * aircraft, ped CAR_align elsewhere), while getin/getout almost always fall back to ped
 * CAR_* clips. Door-only open/close phases have no aircraft equivalent and are skipped. */
export function planeEntrySlots(group:VehicleAnimGroupData|undefined,phase:'getin'|'getout'){
 if(!group)return undefined;
 const slots=phase==='getin'?[VEHICLE_ANIM.alignLHS,VEHICLE_ANIM.getinLHS]:[VEHICLE_ANIM.getoutLHS];
 const steps:{file:string;name:string}[]=[];
 for(const slot of slots){
  const resolved=vehicleAnimation(group,slot);
  if(!resolved){
   // The getin climb itself is required; a missing align just shortens the sequence.
   if(phase==='getin'&&slot!==VEHICLE_ANIM.getinLHS)continue;
   return undefined;
  }
  steps.push({file:resolved.file,name:resolved.name});
 }
 return steps;
}
export interface PlaneEntryStep {clip:NativeAnimation;clipName:string}
export interface PlaneEntry {phase:'getin'|'getout';steps:PlaneEntryStep[];index:number;time:number;foot?:{x:number;y:number;z:number}}
/** Advance a choreographed entry/exit sequence; true when its final clip completes. */
export function advancePlaneEntry(entry:PlaneEntry,dt:number){
 entry.time+=dt;
 for(;;){
  const step=entry.steps[entry.index],duration=step?.clip.duration??0;
  if(!(duration>0)||entry.time<duration)return false;
  if(entry.index>=entry.steps.length-1)return true;
  entry.time-=duration;entry.index++;
 }
}
type Assets=Awaited<ReturnType<Awaited<ReturnType<typeof openStaticWorldVehicles>>['load']>>;
/** CVehicle::InflictDamage (iOS 0x1004781b4, mask 0x0008000000190000 and 0x3ECCCCCD): a heli or plane takes 0.4 of a
 * weapon's damage, except a grenade's, a rocket's (ROCKET, ROCKET_HS) and a blast's (WEAPON_EXPLOSION), which it takes
 * in full. The RC Baron, RC Raider and RC Goblin (bIsRCVehicle) take everything in full. */
export function aircraftWeaponDamageScale(modelId:number,weapon:number){
 if(modelId===464||modelId===465||modelId===501)return 1;
 return weapon===16||weapon===19||weapon===20||weapon===51?1:Math.fround(.4);
}

export class WorldPlane {
 /** m_autoPilot.m_vehicleRecordingId and the controls a playback sets (recordingBody.ts): CVehicleRecording plays an
  * aircraft's recording as a car's. DRUGS4's police Maverick holds its recording paused, which the script waits on. */
 recordingSlot=-1;recordingControls?:{steerAngle:number;gas:number;brake:number;handbrake:boolean};
 readonly body:RAPIER.RigidBody;readonly root=new Group();
 /** CCustomCarEnvMapPipeline's reflection state (every vehicle model uses the car pipeline). */
 readonly reflection=new NativeCarReflection();readonly name:string;readonly modelId:number;
 /** CVehicle's constructor: every vehicle starts at 1000 health. */
 health=1000;
 /** The Hydra's nozzle direction (CPlane's keyboard nozzle, iOS 0x100654160): true moving toward vertical lift. */
 vtol=true;
 /** CAutomobile::m_wMiscComponentAngle, the Hydra's nozzle: 0 forward to 5000 vertical. */
 nozzle=0;
 /** CAutomobile::m_fBurnTimer in milliseconds, which ProcessCarOnFireAndExplode runs for planes and helicopters too. */
 burnTimer=0;
 /** CAutomobile::m_fireParticleCounter: set once when the fire starts, 2 for an aircraft in the air, 1 otherwise, and never cleared. */
 fireCounter=0;
 /** Set by a BlowUpCar the flight step reached (the water dive) until afterStep hands the explosion on. */
 private pendingExplosion=false;
 /** EXPLOSION_ROCKET at the aircraft: a burning aircraft nobody flies goes off like this 1.2% of frames. */
 onBurnExplosion?:(position:{x:number;y:number;z:number})=>void;
 random:()=>number=Math.random;
 /** Below 250 health and not sinking: on fire. */
 get burning(){return this.health>0&&this.health<250&&!this.drowning;}
 get helicopter(){return this.assets.vehicle.type==='heli';}
 /** GetPlaneNumGuns for the flyable models: the Hunter, Seasparrow, Rustler and Hydra carry guns. */
 get armed(){return [425,447,476,520].includes(this.modelId);}
 /** FireUnguidedMissile: only the Hunter and the Hydra launch rockets. */
 get rocketsArmed(){return this.modelId===425||this.modelId===520;}
 /** GetPlaneOrdnancePosition in native model space (right, forward, up): the Hunter's and the Hydra's first rocket pod. */
 ordnancePosition():[number,number,number]{return this.modelId===425?[2.17,1,-.8]:[3.7,.98,-1.02];}
 /** Damage, returning true when it destroys the aircraft. With a weapon it is CVehicle::InflictDamage's:
  * - the player's own aircraft refuses blasts, rounds and the molotov once burning under 250, and otherwise takes
  *   playerVehicleDamage's share;
  * - more than 10 of the player's harm counts toward property damage;
  * - aircraftWeaponDamageScale applies;
  * - a blast (WEAPON_EXPLOSION) that destroys the aircraft leaves it on the bomb timer.
  * Without a weapon (a crash, the burn-out, the water) it is taken as given, and the aircraft goes up at once. */
 damage(amount:number,weapon?:number,byPlayer?:boolean){
  if(this.health<=0)return false;
  if(weapon!==undefined){
   if(this.occupied){if(this.health<250&&firesExplodesOrShoots(weapon))return false;amount=playerVehicleDamage(amount);}
   notePlayerVehicleHarm(amount,byPlayer);
   amount*=aircraftWeaponDamageScale(this.modelId,weapon);
  }
  this.health=Math.max(0,this.health-amount);
  if(this.health>0)return false;
  if(weapon===51)this.bombTimerMs=blastBombTimerMs();else this.destroyed();
  return true;
 }
 /** m_wBombTimer (ms): a blast's victim blows up when ProcessDelayedExplosion (CAutomobile::ProcessControl, which
  * CPlane and CHeli run) has counted it down. */
 bombTimerMs=0;
 /** STATUS_WRECKED, which BlowUpCar sets: blown up, its health gone and no bomb timer left to run. IS_CAR_DEAD asks it;
  * a shot-down helicopter never counted as dead, and a mission waiting on one waited for good. */
 get wrecked(){return this.health<=0&&this.bombTimerMs<=0;}
 /** BlowUpCar's end for the aircraft: the engine stops and the player aboard dies with it. */
 private destroyed(){this.throttle=0;if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.vehicleOccupantDied();}}
 toggleVtol(){if(this.modelId!==520)return '';this.vtol=!this.vtol;return this.vtol?'Hydra: vertical lift':'Hydra: forward flight';}
 /** physicalFlags.bMakeMassTwiceAsBig (SET_CAR_HEAVY): the water's drag ×1.5. */
 heavy=false;
 /** CHeli::m_fHeliRotorSpeed, 0 to 0.22: the dust, the water gates and the rotor sound read it. */
 rotorSpeed=0;
 /** Its audio entity's m_IsHelicopterDisabled (DISABLE_HELI_AUDIO): the helicopter makes no sound while set. */
 heliAudioDisabled=false;
 occupied=false;gearUp=false;throttle=0;grounded=true;stall=false;airspeed=0;altitude=0;
 /** Scripted collective/cyclic input while no player sits aboard (police pursuit). */
 autopilot?:PlaneControls;
 /** A helicopter's AI pilot: the CAutoPilot fields and CHeli's own the native steering flies it by (nativeHeliAI.ts),
  * from TellHeliToGoToCoors on. */
 heliPilot?:HeliPilot&{ai:HeliAI;target?:()=>NV|undefined};
 private heliClockMs=0;private readonly heliSeed=randomSeed()&0xffff;private readonly crashYaw=heliCrashYaw(Math.random);
 /** CAutomobile::TellHeliToGoToCoors (0x6A2390, iOS 0x100440880), which HELI_GOTO_COORDS calls with its arguments as
  * they are: the destination (native), MISSION_HELI_FLYTOCOORS at cruise speed 100, the altitude band (the heli holds
  * the maximum, an absolute height, or the minimum over what lies ahead), and STATUS_PHYSICS. */
 tellHeliToGoToCoors(x:number,y:number,z:number,minAltitude:number,maxAltitude:number){
  const pilot=this.aiPilot();if(!pilot)return;
  pilot.destination=[x,y,z];pilot.mission=MISSION_HELI_FLYTOCOORS;pilot.cruiseSpeed=100;pilot.ai.minAltitude=minAltitude;pilot.ai.maxAltitude=maxAltitude;pilot.target=undefined;
 }
 /** HELI_FOLLOW_ENTITY (iOS 0x1001f5edc): MISSION_HELI_FOLLOW_ENTITY on the entity (`target` its native position, or
  * nothing once it is gone), the command's distance as m_fMinAltitude, cruise speed 100; a heli coming down in a crash
  * (missions 57 and 58) keeps to that. */
 tellHeliToFollowEntity(target:()=>NV|undefined,minAltitude:number,police=false){
  const pilot=this.aiPilot();if(!pilot)return;
  if(pilot.mission!==57&&pilot.mission!==58)pilot.mission=police?MISSION_HELI_POLICE_BEHAVIOUR:MISSION_HELI_FOLLOW_ENTITY;
  pilot.target=target;pilot.ai.minAltitude=minAltitude;pilot.cruiseSpeed=100;
 }
 /** HELI_LAND_AT_COORDS (iOS 0x1001f5c10): TellHeliToGoToCoors with its arguments, then MISSION_HELI_LAND (the handler's
  * own test for a heli crashing comes after TellHeliToGoToCoors has made the mission 20, so it always lands). */
 tellHeliToLand(x:number,y:number,z:number,minAltitude:number,maxAltitude:number){
  this.tellHeliToGoToCoors(x,y,z,minAltitude,maxAltitude);const pilot=this.heliPilot;if(pilot)pilot.mission=MISSION_HELI_LAND;
 }
 /** SET_HELI_ORIENTATION (iOS 0x1001e34ac, a heading in degrees) and CLEAR_HELI_ORIENTATION (iOS 0x1001e39c4, −1):
  * CAutomobile::m_fForcedOrientation. */
 setHeliOrientation(degrees:number|undefined){const pilot=this.aiPilot();if(pilot)pilot.forcedOrientation=degrees===undefined?-1:heliForcedOrientation(degrees);}
 /** MAKE_HELI_COME_CRASHING_DOWN (iOS 0x1001e5414): MISSION_HELI_CRASH_AND_BURN, unless it is crashing already. */
 makeHeliComeCrashingDown(){const pilot=this.aiPilot();if(pilot&&pilot.mission!==57&&pilot.mission!==58)pilot.mission=MISSION_HELI_CRASH_AND_BURN;}
 /** HELI_ATTACK_PLAYER (iOS 0x1001f6870): MISSION_HELI_ATTACK_PLAYER, its distance as m_fMinAltitude, cruise speed 100;
  * a crashing heli keeps crashing. */
 tellHeliToAttackPlayer(minAltitude:number){
  const pilot=this.aiPilot();if(!pilot)return;
  if(pilot.mission!==57&&pilot.mission!==58)pilot.mission=MISSION_HELI_ATTACK_PLAYER;
  pilot.ai.minAltitude=minAltitude;pilot.cruiseSpeed=100;
 }
 /** HELI_KEEP_ENTITY_IN_VIEW (iOS 0x1001f8ae4): MISSION_HELI_KEEP_ENTITY_IN_VIEW on the entity, the first distance as
  * m_ucHeliTargetDist (a byte) and the second as m_fMinAltitude, cruise speed 100; a crashing heli keeps crashing. */
 tellHeliToKeepEntityInView(target:()=>NV|undefined,distance:number,minAltitude:number){
  const pilot=this.aiPilot();if(!pilot)return;
  if(pilot.mission!==57&&pilot.mission!==58)pilot.mission=MISSION_HELI_KEEP_ENTITY_IN_VIEW;
  pilot.target=target;pilot.heliTargetDist=Math.trunc(distance)&0xff;pilot.ai.minAltitude=minAltitude;pilot.cruiseSpeed=100;
 }
 /** A plane's AI pilot: the CAutoPilot fields and CPlane's own the native steering flies it by (nativePlaneAI.ts). */
 planePilot?:PlanePilot&{ai:PlaneAI;target?:()=>NV|undefined};
 /** CTimer's clock for the plane AI's once-a-second search and its time off the ground, ms; it starts well on, as the
  * game's has by the time a script makes a plane. */
 private planeClockMs=60000;
 /** CAutomobile::TellPlaneToGoToCoors (iOS 0x100440934), which PLANE_GOTO_COORDS calls with its arguments as they are:
  * MISSION_PLANE_FLYTOCOORS to the destination (native), the fifth as m_minAltitude (the height over the ground ahead)
  * and the greater of the sixth and the destination's height as m_maxAltitude, STATUS_PHYSICS, the engine on. */
 tellPlaneToGoToCoors(x:number,y:number,z:number,minAltitude:number,maxAltitude:number){
  const pilot=this.aiPlanePilot();if(!pilot)return;
  pilot.mission=MISSION_PLANE_FLYTOCOORS;pilot.destination=[x,y,z];pilot.target=undefined;pilot.ai.minAltitude=minAltitude;pilot.ai.maxAltitude=Math.max(maxAltitude,z);
 }
 /** PLANE_FLY_IN_DIRECTION (iOS 0x1001f65f8): MISSION_PLANE_FLYINDIRECTION unless it is crashing, the heading (degrees from
  * the x axis) as the one it wants and takes, and the two altitudes. */
 tellPlaneToFlyInDirection(degrees:number,minAltitude:number,maxAltitude:number){
  const pilot=this.aiPlanePilot();if(!pilot)return;
  if(pilot.mission!==57&&pilot.mission!==58)pilot.mission=MISSION_PLANE_FLYINDIRECTION;
  pilot.ai.heading=pilot.ai.headingPrev=degrees*Math.PI/180;pilot.ai.minAltitude=minAltitude;pilot.ai.maxAltitude=maxAltitude;
 }
 /** PLANE_FOLLOW_ENTITY (iOS 0x1001f6440): MISSION_PLANE_FOLLOW_ENTITY on the entity (`target` its native position, or
  * nothing once it has gone) unless the plane is crashing, the command's height as m_minAltitude, the engine on. */
 tellPlaneToFollowEntity(target:()=>NV|undefined,minAltitude:number){
  const pilot=this.aiPlanePilot();if(!pilot)return;
  if(pilot.mission!==57&&pilot.mission!==58)pilot.mission=MISSION_PLANE_FOLLOW_ENTITY;
  pilot.target=target;pilot.ai.minAltitude=minAltitude;
 }
 /** PLANE_ATTACK_PLAYER (iOS 0x1001f63d0): MISSION_PLANE_ATTACK_PLAYER unless the plane is crashing, the command's height
  * as m_minAltitude. */
 tellPlaneToAttackPlayer(minAltitude:number){
  const pilot=this.aiPlanePilot();if(!pilot)return;
  if(pilot.mission!==57&&pilot.mission!==58)pilot.mission=MISSION_PLANE_ATTACK_PLAYER;
  pilot.ai.minAltitude=minAltitude;
 }
 /** SET_PLANE_THROTTLE (iOS 0x1001f6df0): m_fAccelerationBreakStatusPrev, the throttle the AI flies at. */
 setPlaneThrottle(throttle:number){const pilot=this.aiPlanePilot();if(pilot)pilot.ai.accelPrev=throttle;}
 private aiPlanePilot(){
  if(this.helicopter)return undefined;
  this.autopilot??={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
  // m_planeCreationHeading: the way it faced as it was placed.
  return this.planePilot??={mission:0,destination:[0,0,0],tempAction:0,rc:this.modelId===464||this.modelId===465,ai:newPlaneAI(atanOfXY(this.flyingBody().forward[0],this.flyingBody().forward[1]))};
 }
 /** CCarCtrl::SteerAICarWithPhysics for an AI plane's mission: its four controls for this step, as the autopilot's, and
  * its gear up once it is flying. */
 private steerAIPlane(dt:number){
  const pilot=this.planePilot;if(!pilot||this.occupied||this.health<=0)return;
  const previous=this.planeClockMs;this.planeClockMs+=dt*1000;
  const b=this.flyingBody(),world=this.sim.world,port=(v:NV)=>({x:v[0],y:v[2],z:-v[1]});
  const lineOfSight=(from:NV,to:NV):NV|undefined=>{
   const a=port(from),c=port(to),d={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},l=Math.hypot(d.x,d.y,d.z);if(l<1e-6)return undefined;
   const hit=world.castRay(new RAPIER.Ray(a,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)return undefined;
   const t=hit.timeOfImpact/l;return [from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,from[2]+(to[2]-from[2])*t];
  };
  const body={position:b.position,moveSpeed:b.moveSpeed,right:b.right,forward:b.forward,up:b.up,onGround:this.grounded};
  // The attack's target: FindPlayerCoors plus 50 frames of FindPlayerSpeed.
  const attack=pilot.mission===MISSION_PLANE_ATTACK_PLAYER||pilot.mission===MISSION_PLANE_ATTACK_PLAYER_POLICE;
  const me=this.sim.player.position,v=attack?this.sim.playerVelocity():undefined;
  const target=pilot.mission===MISSION_PLANE_FOLLOW_ENTITY?pilot.target?.():v?[me.x+v.x,-me.z-v.z,me.y+v.y] as NV:undefined;
  if(!steerAIPlane(pilot.ai,body,pilot,{lineOfSight},this.planeClockMs,planeSearchDue(this.planeClockMs,previous,this.heliSeed),dt*50,target))return;
  const ai=pilot.ai;this.autopilot={throttle:ai.accel,pitch:ai.pitch,roll:ai.roll,rudder:ai.rudder,brake:false};
  if(ai.gearUp)this.gearUp=true;
 }
 /** ACTIVATE_HELI_SPEED_CHEAT: CAutoPilot's m_ucHeliSpeedMult. */
 setHeliSpeedMult(value:number){const pilot=this.aiPilot();if(pilot)pilot.heliSpeedMult=value;}
 /** SELECT_WEAPONS_FOR_VEHICLE's choice (+0x6a3 on iOS): which of its weapons the vehicle's AI may fire. */
 weaponSelection=0;
 /** SET_HELI_REACHED_TARGET_DISTANCE (iOS 0x1001fe394): CAutoPilot's m_ucHeliTargetDist2, a byte. */
 setHeliReachedTargetDistance(distance:number){const pilot=this.aiPilot();if(pilot)pilot.heliTargetDist2=distance&0xff;}
 private aiPilot(){
  if(!this.helicopter)return undefined;
  this.autopilot??={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
  return this.heliPilot??={mission:0,cruiseSpeed:0,heliSpeedMult:0,heliTargetDist2:10,destination:[0,0,0],rc:this.rcHeli,forcedOrientation:-1,ai:newHeliAI()};
 }
 /** CCarCtrl::SteerAICarWithPhysics for an AI helicopter's mission: its four controls for this step, as the autopilot's
  * (the roll field is FlyingControl's own sign, which flyHeli turns back). */
 private steerAIHeli(dt:number){
  const pilot=this.heliPilot;if(!pilot||this.occupied||this.health<=0)return;
  const ai=pilot.ai,controls=()=>{this.autopilot={throttle:ai.accel,pitch:ai.pitch,roll:-ai.roll,rudder:ai.yaw,brake:false};};
  if(pilot.mission===MISSION_HELI_CRASH_AND_BURN){steerAIHeliToCrashAndBurn(ai,this.heliSeed,this.crashYaw);controls();return;}
  const landing=pilot.mission===MISSION_HELI_LAND||pilot.mission===MISSION_HELI_LAND_TOUCHING_DOWN;
  const keeping=pilot.mission===MISSION_HELI_KEEP_ENTITY_IN_VIEW,police=pilot.mission===MISSION_HELI_POLICE_BEHAVIOUR,away=pilot.mission===MISSION_HELI_FLY_AWAY_FROM_PLAYER;
  const attack=pilot.mission===MISSION_HELI_ATTACK_PLAYER||pilot.mission===MISSION_HELI_ATTACK_PLAYER_FLY_AWAY;
  if(pilot.mission!==MISSION_HELI_FLYTOCOORS&&pilot.mission!==MISSION_HELI_FOLLOW_ENTITY&&!landing&&!keeping&&!police&&!away&&!attack)return;
  const previous=this.heliClockMs;this.heliClockMs+=dt*1000;
  const body=this.flyingBody(),world=this.sim.world;
  const port=(v:NV)=>({x:v[0],y:v[2],z:-v[1]});
  const lineOfSight=(from:NV,to:NV):NV|undefined=>{
   const a=port(from),b=port(to),d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},l=Math.hypot(d.x,d.y,d.z);if(l<1e-6)return undefined;
   const hit=world.castRay(new RAPIER.Ray(a,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)return undefined;
   const t=hit.timeOfImpact/l;return [from[0]+(to[0]-from[0])*t,from[1]+(to[1]-from[1])*t,from[2]+(to[2]-from[2])*t];
  };
  const env={lineOfSight,rand:()=>Math.floor(Math.random()*32768)},probe=heliProbeDue(this.heliClockMs,previous,this.heliSeed);
  const target=pilot.mission===MISSION_HELI_FOLLOW_ENTITY||keeping||police?pilot.target?.():undefined;
  // A wheel on the ground: the port's aircraft stands on its gear when the ground is within its clearance.
  const me=this.sim.player.position;
  if(away)steerAIHeliFlyingAwayFromPlayer(pilot.ai,body,pilot,env,[me.x,-me.z,me.y],probe,dt*50);
  else if(attack)pilot.mission=steerAIHeliToAttackPlayer(pilot.ai,body,pilot,env,[me.x,-me.z,me.y],probe,dt*50);
  else if(police&&target)pilot.mission=steerAIHeliAsPoliceHeli(pilot.ai,body,pilot,env,target,this.health,probe,dt*50);
  else if(landing)steerAIHeliToLand(pilot.ai,body,pilot,env,probe,dt*50,this.grounded);
  else if(target&&keeping)steerAIHeliToKeepEntityInView(pilot.ai,body,pilot,env,target,probe,dt*50);
  else if(target)steerAIHeliToFollowEntity(pilot.ai,body,pilot,env,target,probe,dt*50);
  else steerAIHeliTowardsTargetCoors(pilot.ai,body,pilot,env,probe,dt*50);
  // m_ucHeliSpeedMult's push forward is on the move speed itself.
  if(pilot.heliSpeedMult!==0)this.body.setLinvel({x:body.moveSpeed[0]*50,y:body.moveSpeed[2]*50,z:-body.moveSpeed[1]*50},true);
  controls();
 }
 /** Law-enforcement air unit: the fleet never retires it as ambient traffic. */
 policeHeli=false;
 private physical:ReturnType<typeof installNativeVehicleBody>;private handling:ReturnType<typeof prepareHandling>;
 /** Native-coordinate water height query (WATER.DAT). */
 waterLevel?:(x:number,y:number,z?:number,touchingWater?:boolean,normal?:number[])=>number|undefined;
 private water={touching:false,buoyancy:0,rotorSpeed:0};inWater=false;drowning=false;private visual:ReturnType<typeof modelObject>;private ambient=nativeAmbientState();
 private impactVelocity=new Vector3();
 /** cBuoyancy::AddSplashParticles spray waiting for the FX system, and the move speed of the last splash reported to the audio engine. */
 readonly splashes:{position:NativeVec;velocity:NativeVec}[]=[];splashReport?:NativeVec;private splashClock=0;
 private previous:{x:number;y:number;z:number};private previousRotation:RAPIER.Rotation;
 private moving:{object:Object3D;base:Matrix4;kind:string}[]=[];private wheels:RAPIER.Collider[]=[];private propAngle=0;
 private inputs:PlaneControls={throttle:0,pitch:0,roll:0,rudder:0,brake:false};
 private rollingWheels:{object:Object3D;base:Matrix4;radius:number;previous:number;roll:PlaneWheelRoll}[]=[];
 constructor(private sim:Simulation,scene:Scene,readonly assets:Assets,position:{x:number;y:number;z:number},heading=0,colors?:NativeCarColors){
  requireAsset(PLAYABLE_PLANES[assets.vehicle.id]&&assets.collision&&assets.flyingHandling&&!assets.missingTextures.length,'Unresolved aircraft resources.');
  this.modelId=assets.vehicle.id;this.name=PLAYABLE_PLANES[this.modelId];
  this.handling=prepareHandling(assets.handling,assets.flyingHandling!.handlingId);this.water.buoyancy=this.handling.buoyancy;
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,this.handling,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.05,restitution:0});this.body=this.physical.body;this.car={body:this.body,root:this.root};
  const model={...assets.model,atomics:assets.model.atomics.map(a=>({...a,flags:/(_dam|_vlo|moving_prop|moving_rotor)/i.test(assets.model.frames[a.frame].name)?0:a.flags}))};
  // Native plane models reuse a main wheel atomic at empty wheel dummy frames.
  const wheelAtomic=model.atomics.find(a=>/^wheel(?:\d|_[lr])?$/.test(model.frames[a.frame].name));
  if(wheelAtomic){for(const [index,frame] of model.frames.entries())if(/^wheel_.*_dummy$/.test(frame.name)&&!model.atomics.some(a=>{let at=a.frame;while(at>=0){if(at===index)return true;at=model.frames[at].parent;}return false;}))model.atomics.push({...wheelAtomic,frame:index});}
  this.visual=modelObject(model,assets.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient,carEnv:this.reflection.state});bindNativeCarDirt(this.visual.materialBindings).setLevel(randomSeed()%15);if(colors)bindNativeCarPaint(this.visual.materialBindings,assets.textures.find(t=>t.name==='vehiclelights128')).setColors(colors);this.root.add(this.visual.root);scene.add(this.root);
  this.visual.root.updateMatrixWorld(true);
  const seen=new Set<string>();
  this.visual.root.traverse(object=>{
   const name=object.name.toLowerCase();if(object.userData.nativeFrame===undefined)return;
   if(/^(static_prop|static_rotor|aileron_|elevator|rudder$|gear_)/.test(name))this.moving.push({object,base:object.matrix.clone(),kind:name});
   if(/^wheel_.*_dummy$/.test(name)){
    const p=new Vector3().setFromMatrixPosition(object.matrixWorld); // root is identity here; visual basis already converts native axes.
    const key=[p.x,p.y,p.z].map(n=>n.toFixed(2)).join(',');if(seen.has(key))return;seen.add(key);
    const radius=Math.max(.15,(assets.vehicle.frontWheelSize??.6)*.5);
    this.rollingWheels.push({object,base:object.matrix.clone(),radius,previous:0,roll:{angle:0,speed:0}});
    // A plane's wheels roll (CAutomobile's wheels): their ball takes its own small friction whatever it touches, the
    // grip and the brakes being the flight step's. A helicopter's keeps the ground's.
    const wheel=RAPIER.ColliderDesc.ball(radius).setTranslation(p.x,p.y,p.z).setDensity(0).setFriction(.02).setRestitution(0);
    if(assets.vehicle.type!=='heli')wheel.setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min);
    this.wheels.push(sim.world.createCollider(wheel,this.body));
   }
  });
  this.previous={...position};this.previousRotation={...this.body.rotation()};this.update(1);
 }
 distance(){const p=this.sim.player.position,b=this.body.translation();return Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z);}
 get modelFlags(){return this.handling.values.modelFlags;}
 /** The ped_frontseat dummy in native model space, mirrored to the driver's side (GetSeatPositionInVehicle). */
 seat(){const frame=this.assets.model.frames.find(f=>f.name.toLowerCase()==='ped_frontseat');return frame?{x:-Math.abs(frame.matrix[12]),y:frame.matrix[13],z:frame.matrix[14]}:undefined;}
 /** Damaged-particle smoke ejectors (CPlane/C heli engine dummies): native
  * engine/exhaust frame positions, else symmetric wing stations from the collision bounds. */
 engineEjectors():{x:number;y:number;z:number}[]{
  const dummies=this.assets.model.frames.filter(f=>/^(engine|exhaust)/i.test(f.name)).slice(0,4);
  if(dummies.length)return dummies.map(f=>({x:f.matrix[12],y:f.matrix[13],z:f.matrix[14]}));
  const b=this.assets.collision?.bounds;
  if(!b)return [{x:0,y:0,z:0}];
  const span=(b.max[0]-b.min[0])/2;
  return span>0.5?[{x:-span*0.5,y:0,z:0},{x:span*0.5,y:0,z:0}]:[{x:0,y:0,z:0}];
 }
 /** m_fSteerAngle from the steering (bank) input and the handling steering lock; positive steers left. */
 get steerAngle(){return -this.inputs.roll*this.handling.values.steeringLock*Math.PI/180;}
  /** Choreographed entry/exit phase; controls lock and the pose plays until its clip completes. */
  entry?:PlaneEntry;
  get entryBusy(){return !!this.entry;}
  /** Death or arrest mid-sequence: land on foot when exiting, otherwise drop the phase. */
  /** Leaving at speed on the ground: out at the door with the aircraft's velocity (CTaskSimpleCarJumpOut). */
  jumpOutOnGround(foot:{x:number;y:number;z:number}){
   const v=this.body.linvel(),message=this.finishExit(foot);
   this.sim.player.speed=Math.hypot(v.x,v.z);this.sim.player.jumpMomentum={x:v.x,z:v.z};this.sim.player.grounded=false;this.sim.exitCarriesSpeed=true;
   return message;
  }
  cancelEntry(){const e=this.entry;if(!e)return;this.entry=undefined;if(e.phase==='getout')this.finishExit(e.foot);}
  /** Bailing out mid-flight with the parachute: the fall starts with the
  * aircraft's velocity and the canopy glide takes over (native skydive).
  * The jumper leaves below the belly with room for the full standing
  * capsule, so the first sweep never grounds out on the airframe (which
  * would collapse the canopy through the tick). */
 exitAir(){
  if(this.sim.player.health<=0||!this.occupied)return 'No one to bail out.';
  const p=this.body.translation(),v=this.body.linvel();
  this.occupied=false;this.throttle=0;this.sim.cameraExcludedBody=undefined;
  this.sim.playerCollider.setEnabled(true);
  const spot={x:p.x,y:p.y+this.assets.collision!.bounds.min[2]-2.5,z:p.z};
  this.sim.player.position={...spot};this.sim.player.previous={...spot};
  this.sim.player.speed=Math.hypot(v.x,v.z);this.sim.player.verticalSpeed=Math.min(0,v.y);this.sim.player.grounded=false;
  this.sim.player.jumpMomentum={x:v.x,z:v.z};this.sim.exitCarriesSpeed=true;
  this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);
  this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});
  this.sim.playerCollider.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z});
  return 'Parachute away';
 }
 /** '' when the player may enter, otherwise the refusal reason. */
  enterCheck(){
   if(this.sim.player.health<=0)return '';
   if(this.health<=0)return 'This aircraft is destroyed.';
   if(this.distance()>Math.max(5,this.assets.collision!.bounds.radius))return `Move closer to the ${this.name}.`;
   // CTaskComplexEnterCar (0x63EDAB): the player gives up at the door of a vehicle moving over 0.2 units a frame.
   {const v=this.body.linvel();if(Math.hypot(v.x,v.z)/50>.2)return `The ${this.name} is moving too fast.`;}
   return '';
  }
  /** CVehicle::CanPedStepOutCar (0x6D1F30) and CanPedJumpOutCar (0x6D2030) for planes and helicopters, in units per
   * frame: step out with |v2D| ≤ 0.01, |vz| ≤ 0.05 and |ω|² ≤ 0.0004 (a still hover included), jump out at v2D² ≥ 0.1
   * whatever the attitude; in between the pilot waits. No altitude rule exists: leaving in the air is a fall. */
  leaveMode():'step'|'jump'|'wait'{
   const v=this.body.linvel(),w=this.body.angvel(),s=1/50,v2=(v.x*v.x+v.z*v.z)*s*s;
   if(Math.sqrt(v2)<=.01&&Math.abs(v.y)*s<=.05&&(w.x*w.x+w.y*w.y+w.z*w.z)*s*s<=.0004)return 'step';
   return v2>=.1?'jump':'wait';
  }
  /** A leave the pilot asked for while the aircraft was too fast to step out and too slow to jump. */
  exitPending=false;
  /** CVehicle::CanPedJumpOutCar (0x6D2030) for planes and helicopters, called each frame the leave task waits: the
   * turn speed eases by a tenth, and the move speed by a tenth while it is above 0.008 x time step x 10 units a frame,
   * then by a fixed 0.016 x time step, so a drifting aircraft settles and the pilot can step out. */
  private slowForExit(dt:number){
   // The tenth is taken once per game frame (30 fps), unscaled; the fixed branch is timestep-scaled.
   const ts=dt*50,tenth=Math.pow(.9,dt*30),w=this.body.angvel(),v=this.body.linvel(),speed=Math.hypot(v.x,v.y,v.z)/50;
   this.body.setAngvel({x:w.x*tenth,y:w.y*tenth,z:w.z*tenth},true);
   const k=speed*speed/100>(ts*.008)**2?tenth:Math.max(0,1-ts/Math.max(speed,1e-6)*.016);
   this.body.setLinvel({x:v.x*k,y:v.y*k,z:v.z*k},true);
  }
  /** '' when the player may leave, otherwise the refusal reason. */
  exitCheck(){
   if(this.sim.player.health<=0)return '';
   if(this.leaveMode()==='wait')return 'Slow down before leaving the aircraft.';
   return '';
  }
  /** Clear disembark spot beside the aircraft, or null when both sides are blocked. */
  exitFoot(){
   const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation());
   for(const side of [-1,1]){
    const out=new Vector3(side*(this.assets.collision!.bounds.max[0]+1.5),2,0).applyQuaternion(q).add(new Vector3().copy(p));
    const hit=this.sim.world.castRay(new RAPIER.Ray(out,{x:0,y:-1,z:0}),12,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)continue;
    const foot={x:out.x,y:out.y-hit.timeOfImpact+.04,z:out.z},center={...foot,y:foot.y+.9};
    if(this.sim.world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3),undefined,undefined,this.sim.playerCollider,this.body))continue;
    return foot;
   }
   return null;
  }
  /** CTaskSimpleCarSetPedInAsDriver without its entry tasks. */
  finishEnter(){
   this.sim.setCrouched(false);this.occupied=true;this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S throttle · ↑/↓ pitch · A/D bank · Q/E rudder · G gear · Space brake · F exit`;
  }
  /** Start the entry clips; finishEnter runs when the sequence completes. */
  beginEnter(steps:PlaneEntryStep[]){this.entry={phase:'getin',steps,index:0,time:0};}
  /** CTaskSimpleCarSetPedOut at `foot`; the collider stays off until the getout clip completes. */
  beginExit(foot:{x:number;y:number;z:number},steps:PlaneEntryStep[]){
   this.occupied=false;this.throttle=0;this.sim.cameraExcludedBody=undefined;
   this.sim.player.position={...foot};this.sim.player.previous={...foot};this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;
   this.sim.playerBody.setTranslation({x:foot.x,y:foot.y+.9,z:foot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:foot.x,y:foot.y+.9,z:foot.z});
   // CTaskSimpleCarSetPedOut has already placed him: the getout clip ends where it started.
   this.entry={phase:'getout',steps,index:0,time:0,foot:{...foot}};
  }
  finishExit(foot?:{x:number;y:number;z:number}){
   const spot=foot??this.exitFoot();if(!spot)return 'No clear ground beside the plane.';
   this.occupied=false;this.throttle=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=spot;this.sim.player.previous={...spot};this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});this.sim.playerCollider.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z});return 'On foot';
  }
  interact(){
   if(this.sim.player.health<=0)return '';
   if(this.occupied){
    const blocked=this.exitCheck();if(blocked)return blocked;
    return this.finishExit();
   }
   const check=this.enterCheck();if(check)return check;
   return this.finishEnter();
  }
 /** Whether the model has landing gear to retract (gear_ frames). */
 get retractableGear(){return this.gearFrames??=this.assets.model.frames.some(f=>f.name.startsWith('gear_'));}
 private gearFrames?:boolean;
 /** The gear widget (iOS widget 102): the next flight step sends the gear the other way, if it may move. */
 toggleGear(){if(!this.retractableGear)return 'This aircraft has fixed landing gear.';if(this.grounded)return 'Take off before retracting the landing gear.';this.gearToggle=true;return `Landing gear ${this.gearStatus===0||this.gearStatus<0?'up':'down'}`;}
 private gearToggle=false;
 /** CPlane::m_fLandingGearStatus: 0 down, 1 up, rising from 0 to 1 while retracting and from −1 to 0 while lowering. */
 gearStatus=0;
 /** CPlane::ProcessControlInputs' landing gear (iOS 0x100469930): within 30 units of the ground with the gear up and
  * no throttle it comes down, above that it goes up, and the widget sends it the other way; it moves only with every
  * wheel off the ground, on a gear with fGearUpR under 1, and takes 50 steps (1 s). The wheels and the drag change as
  * it reaches either end. */
 private stepGear(ts:number,accelerating:boolean){
  const f=this.assets.flyingHandling!.values;
  if(this.retractableGear&&f.gearUpResistance<1&&this.modelId!==464&&!this.grounded){
   const toggle=this.gearToggle||(this.altitude<=30?!accelerating&&this.gearStatus===1:this.gearStatus===0);
   if(toggle)this.gearStatus=this.gearStatus===0?.02*ts:this.gearStatus===1?.02*ts-1:-this.gearStatus;
  }
  this.gearToggle=false;
  if(this.gearStatus<0){this.gearStatus+=.02*ts;if(this.gearStatus>=0){this.gearStatus=0;this.setGearUp(false);}}
  else if(this.gearStatus>0&&this.gearStatus<1){this.gearStatus+=.02*ts;if(this.gearStatus>=1){this.gearStatus=1;this.setGearUp(true);}}
 }
 private setGearUp(up:boolean){this.gearUp=up;for(const c of this.wheels)c.setEnabled(!up);}
 /** CPlane::SetGearUp and SetGearDown (0x6CAC20, 0x6CAC70; iOS 0x100469e58, 0x100469e28), as
  * SET_PLANE_UNDERCARRIAGE_UP calls them: the gear is at once fully up or down, with its drag and its wheels (missing
  * while up), whatever the model, fixed gear and all. */
 setGear(up:boolean){this.gearStatus=up?1:0;this.setGearUp(up);}
 /** CColStore::HasCollisionLoaded for an empty plane at rest (bIsStaticWaitingForCollision), as a bike's: out where the
  * world's collision has not streamed in, it waits for it rather than falling through the map. HEIST2's Nevada, made
  * on the far end of Las Venturas airport 860 units from CJ, woke at 250 units over a runway not yet in and dropped
  * through it. Fixed ground (or water) within forty units below, asked twice a second; one already moving (flying
  * empty, or falling after its pilot bails out) goes on. */
 private groundCheck={seconds:0,loaded:true};
 private collisionLoaded(dt:number){
  const v=this.body.linvel();if(Math.hypot(v.x,v.y,v.z)>1)return true;
  const g=this.groundCheck;g.seconds-=dt;if(g.seconds>0)return g.loaded;g.seconds=.5;
  const p=this.body.translation();
  g.loaded=!!this.sim.world.castRay(new RAPIER.Ray({x:p.x,y:p.y+2,z:p.z},{x:0,y:-1,z:0}),40,true,RAPIER.QueryFilterFlags.ONLY_FIXED)||this.waterLevel?.(p.x,-p.z)!==undefined;
  return g.loaded;
 }
 /** PLANE_STARTS_IN_AIR (iOS 0x1001f701c): CPlane::IsAlreadyFlying puts m_nStartedFlyingTime 20 s back, which only the
  * AI pilot reads (gear up after 4 s off the ground, iOS 0x10019f490; not ported, as no AI plane flies here), and a
  * Hydra's nozzle is set level. */
 startsInAir(){this.startedInAir=true;if(this.modelId===520)this.nozzle=0;}
 /** Made flying (PLANE_STARTS_IN_AIR): never held for the ground under it. */
 private startedInAir=false;
 /** FREEZE_CAR_POSITION (bIsFrozen): the body stays off while it is set, which this step would otherwise undo. */
 frozen=false;
 beforeStep(dt:number,input:{throttle:number;pitch:number;roll:number;rudder:number;brake:boolean}){
  // An AI pilot's aircraft flies on however far off it is (SteerAICarWithPhysics has no range); it is drawn only near.
  const piloted=(this.helicopter?!!this.heliPilot?.mission:!!this.planePilot?.mission)&&!this.occupied&&this.health>0;
  const recorded=this.recordingSlot>=0&&this.body.bodyType()===RAPIER.RigidBodyType.KinematicVelocityBased;
  const nearby=this.occupied||this.distance()<250,active=recorded||(nearby||piloted)&&!this.frozen&&(this.occupied||!!this.autopilot||this.startedInAir||this.collisionLoaded(dt));
  this.body.setEnabled(active);this.root.visible=nearby;if(!active)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};this.stepDt=dt;
  // Attached to another vehicle (ATTACH_CAR_TO_CAR): a kinematic body the host sets on it after the step.
  if(this.body.bodyType()===RAPIER.RigidBodyType.KinematicPositionBased)return;
  // A playback without car AI moves the body itself (a kinematic body on the recording's speeds); a helicopter's rotor
  // runs at speed meanwhile, as one made already flying.
  if(recorded){if(this.helicopter){this.rotorSpeed=HELI_ROTOR_FULL;this.propAngle=(this.propAngle+dt*95)%(Math.PI*2);}return;}
  const p=this.body.translation(),hit=this.sim.world.castRay(new RAPIER.Ray(p,{x:0,y:-1,z:0}),3000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  this.altitude=hit?hit.timeOfImpact:Math.max(0,p.y);const clearance=Math.max(1.5,-this.assets.collision!.bounds.min[2]+.8);this.grounded=!!hit&&hit.timeOfImpact<clearance;
   if(this.helicopter)this.steerAIHeli(dt);else this.steerAIPlane(dt);
   const auto=!this.occupied&&this.health>0?this.autopilot:undefined;
   if(auto)this.throttle=Math.max(0,Math.min(1,auto.throttle));
   else if(this.occupied&&this.health>0&&!(this.drowning&&this.water.buoyancy<this.handling.values.mass/125))this.throttle=Math.max(0,Math.min(1,this.throttle+input.throttle*dt*.4));else this.throttle=0;
   // CHeli::m_fHeliRotorSpeed runs on its own while the engine runs, whatever the collective; it spins up 0.001 a
   // frame (0.003 for the RC helicopters) to 0.22 and winds down 0.00055 a step. A heli the game flies itself was
   // made already flying, with its rotor at speed (0.22 from script and AI creation).
   if(this.helicopter){
    const running=this.health>0&&(!!auto||this.occupied)&&!this.drowning;
    this.rotorSpeed=auto?HELI_ROTOR_FULL:stepHeliRotor(this.rotorSpeed,running,this.rcHeli,dt*30,dt*50);
   }
   this.inputs={throttle:this.throttle,pitch:this.occupied?input.pitch:auto?.pitch??0,roll:this.occupied?input.roll:auto?.roll??0,rudder:this.occupied?input.rudder:auto?.rudder??0,brake:auto?auto.brake:!this.occupied||input.brake};
  if(this.helicopter)this.flyHeli(dt,input,auto);else this.flyPlane(dt,input,auto);
  const forwardSpeed=-new Vector3().copy(this.body.linvel()).applyQuaternion(new Quaternion().copy(this.body.rotation()).invert()).z;
  for(const wheel of this.rollingWheels){wheel.previous=wheel.roll.angle;wheel.roll=stepPlaneWheelRoll(wheel.roll,forwardSpeed,wheel.radius,this.grounded&&!this.gearUp,dt);}
  this.impactVelocity.copy(this.body.linvel());
  this.propAngle=(this.propAngle+dt*(this.helicopter?this.rotorSpeed/HELI_ROTOR_FULL*95:5+this.throttle*90))%(Math.PI*2);
  this.floatOnWater(dt);
 }
 /** CPlane's flight for a fixed-wing aircraft (nativeFlyingControl.ts): ProcessControlInputs' smoothing, ProcessFlyingCarStuff
  * (the damage biases under 250, the throttle cut above the ceiling, the propeller and its gate) and FlyingControl,
  * after CPhysical's gravity and air resistance, in native units on the body's velocities. On its wheels the browser
  * keeps its own grip, brakes and nose-wheel turn (CAutomobile's wheel physics for planes are not ported). */
 private flyPlane(dt:number,input:{throttle:number;pitch:number;roll:number;rudder:number;brake:boolean},auto:WorldPlane['autopilot']){
  const ts=dt*50,h=this.handling.values,f=this.assets.flyingHandling!.values,v=this.body.linvel();
  const body=this.flyingBody(),{right,forward,up,position}=body;
  const flying=this.health>0&&(!!auto||this.occupied)&&!(this.drowning&&this.water.buoyancy<h.mass/125);
  // ProcessControlInputs: the player's pitch, roll and rudder follow the stick 0.069 of the way a step; the throttle is
  // (gas − brake) / 255 at once. The AI writes its own.
  const s=this.planeInput;
  if(this.occupied){s.pitch=smoothPlaneInput(s.pitch,input.pitch,ts);s.roll=smoothPlaneInput(s.roll,input.roll,ts);s.rudder=smoothPlaneInput(s.rudder,input.rudder,ts);s.accel=input.throttle;}
  else if(auto){s.pitch=auto.pitch;s.roll=auto.roll;s.rudder=auto.rudder;s.accel=auto.throttle;}
  else{s.pitch=s.roll=s.rudder=s.accel=0;}
  let {pitch,roll,rudder,accel}=s;
  if(this.occupied)this.stepGear(ts,input.throttle>0);
  const model=this.modelId===464?FLIGHT_MODEL.baron:FLIGHT_MODEL.plane;
  if(this.occupied){
   // ProcessFlyingCarStuff under 250 health: the controls pull the burning plane over.
   if(this.health<250){const bank=Math.atan2(right[2],up[2]<0?-Math.hypot(right[0],right[1]):Math.hypot(right[0],right[1]));if(Math.abs(bank)<3*Math.PI/4)roll+=.75;rudder+=.5;if(Math.abs(bank)>Math.PI/2)pitch+=.5;}
   // Above the ceiling the throttle is cut by a twenty-fifth a unit.
   const above=nativeHeightAboveCeiling(position[2],model);if(above>0)accel=Math.max(accel-above/25,-1);
  }
  this.propSpeed=flying?stepPropSpeed(this.propSpeed,accel,ts):this.propSpeed>.001*ts?this.propSpeed-(this.propSpeed>.18?.003:.001)*ts:0;
  this.throttle=flying?Math.max(0,accel):0;
  applyGravityAndAirResistance(body,h.dragMultiplier/2000*(this.gearUp?f.gearUpResistance:1),ts);
  // The Hydra's nozzle (CPlane::ProcessControlInputs, the keyboard's way): 25 a step toward where it was last sent.
  const hydra=this.modelId===520;
  if(hydra&&this.occupied)this.nozzle=Math.max(0,Math.min(HYDRA_NOZZLE_MAX,this.nozzle+HYDRA_NOZZLE_RATE*(this.vtol?1:-1)*ts));
  const moving=body.moveSpeed[0]**2+body.moveSpeed[1]**2+body.moveSpeed[2]**2>.05;
  this.stall=false;
  if(flying&&(this.propSpeed>.05||moving)){
   const axis=hydra?hydraThrustAxis(body,this.nozzle):undefined;
   // Over 3000 the player's Hydra hovers: FlyingControl's heli model on the Hunter's flying handling, the roll
   // reversed and a quarter of the throttle, while climbing or off its wheels.
   if(hydra&&this.occupied&&this.nozzle>=HYDRA_VTOL_NOZZLE&&this.assets.vtolFlyingHandling){
    const hunter=this.assets.vtolFlyingHandling.values;
    if(accel>0||!this.grounded&&!this.inWater)heliFlyingControl(body,hunter,{yaw:rudder,pitch,roll:-roll,accel:accel*.25},HELI_FLIGHT_MODEL.heli,ts,{liftAxis:axis,wind:this.flightWind(hunter.windMultiplier)});
   }else{const r=planeFlyingControl(body,f,{rudder,pitch,roll,accel},model,ts,{vortex:this.modelId===539,thrustAxis:axis,wind:this.flightWind(f.windMultiplier)});this.stall=r.stallMs>0;}
  }
  if(this.grounded){
   // The browser's wheels: side grip, the brakes and the nose wheel's turn (rad/s at the browser's metres).
   const side=body.moveSpeed[0]*right[0]+body.moveSpeed[1]*right[1]+body.moveSpeed[2]*right[2],speed=Math.hypot(v.x,v.z);
   body.moveSpeed=body.moveSpeed.map((c,i)=>c-right[i]*side*Math.min(1,5*dt)) as NV;
   if(input.brake||!flying){const fwd=body.moveSpeed[0]*forward[0]+body.moveSpeed[1]*forward[1],cut=Math.min(Math.abs(fwd),Math.min(speed*3,14)*ts/2500)*Math.sign(fwd);body.moveSpeed=body.moveSpeed.map((c,i)=>c-forward[i]*cut) as NV;}
   const yaw=-rudder*.5*Math.min(1,speed/5)/50,spin=body.turnSpeed[0]*up[0]+body.turnSpeed[1]*up[1]+body.turnSpeed[2]*up[2];
   body.turnSpeed=body.turnSpeed.map((c,i)=>c+up[i]*(yaw-spin)) as NV;
  }
  this.writeFlyingBody(body);
 }
 /** The body as FlyingControl reads it: native axes, move and turn speeds a 50 Hz step. */
 private flyingBody():FlyingBody{
  const h=this.handling.values,q=new Quaternion().copy(this.body.rotation()),p=this.body.translation();
  const native=(v:{x:number;y:number;z:number}):NV=>[v.x,-v.z,v.y],axis=(x:number,y:number,z:number)=>native(new Vector3(x,y,z).applyQuaternion(q));
  const right=axis(1,0,0),forward=axis(0,0,-1),up=axis(0,1,0);
  return {moveSpeed:native(this.body.linvel()).map(c=>c/50) as NV,turnSpeed:native(this.body.angvel()).map(c=>c/50) as NV,position:[p.x,-p.z,p.y],right,forward,up,
   comWorld:[0,1,2].map(i=>right[i]*h.centerOfMassX+forward[i]*h.centerOfMassY+up[i]*h.centerOfMassZ) as NV,
   tailY:this.assets.collision!.bounds.min[1],allWheelsInAir:!this.grounded,gearStatus:this.gearStatus};
 }
 private writeFlyingBody(body:FlyingBody){
  this.airspeed=Math.hypot(...body.moveSpeed)*50;
  const [mx,my,mz]=body.moveSpeed,[tx,ty,tz]=body.turnSpeed;
  this.body.setLinvel({x:mx*50,y:mz*50,z:-my*50},true);this.body.setAngvel({x:tx*50,y:tz*50,z:-ty*50},true);
 }
 /** The RC Raider and RC Goblin (bIsRCVehicle): FlyingControl's RC model, the 500 m ceiling band, a quicker rotor. */
 get rcHeli(){return this.modelId===465||this.modelId===501;}
 /** CHeli's flight (nativeFlyingControl.ts): ProcessControlInputs (the collective from gas and brake at once, the roll
  * the stick's opposite, yaw from its own keys; the hover button holds yaw and brakes the drift; a heli under 250
  * health sinks and turns), and ProcessFlyingCarStuff, which calls FlyingControl only with the rotor over 0.15 and
  * the heli climbing, off its wheels (a sea heli afloat counts as on them) or moving, after CPhysical's gravity and
  * air resistance. */
 private flyHeli(dt:number,input:{throttle:number;pitch:number;roll:number;rudder:number;brake:boolean},auto:WorldPlane['autopilot']){
  const ts=dt*50,h=this.handling.values,f=this.assets.flyingHandling!.values,body=this.flyingBody();
  let yaw=0,pitch=0,roll=0,accel=0;
  if(this.occupied&&this.health>0){
   accel=input.throttle;pitch=input.pitch;roll=-input.roll;yaw=input.rudder;
   if(input.brake&&body.up[2]>0)({yaw,pitch,roll}=heliHoverInputs(body,f));
   if(this.health<250){accel=-.05;yaw+=.5;}
  }else if(auto){accel=auto.throttle;pitch=auto.pitch;roll=-auto.roll;yaw=auto.rudder;}
  this.throttle=Math.max(0,accel);
  applyGravityAndAirResistance(body,h.dragMultiplier/2000,ts);
  const m=body.moveSpeed,floating=this.inWater&&(this.modelId===447||this.modelId===417);
  if(this.rotorSpeed>HELI_ROTOR_FLY&&(this.rcHeli||accel>0||!this.grounded&&!floating||Math.abs(m[0])>.02||Math.abs(m[1])>.02||Math.abs(m[2])>.02))
   heliFlyingControl(body,f,{yaw,pitch,roll,accel},this.rcHeli?HELI_FLIGHT_MODEL.rc:HELI_FLIGHT_MODEL.heli,ts,{wind:this.flightWind(f.windMultiplier)});
  this.stall=false;
  this.writeFlyingBody(body);
 }
 /** CPlane's m_fSteeringUpDown, m_fSteeringLeftRight, m_fLeftRightSkid and m_fAccelerationBreakStatus. */
 private planeInput={pitch:0,roll:0,rudder:0,accel:0};
 /** CPlane::m_fPropSpeed. */
 propSpeed=0;
 /** CAutomobile::ProcessBuoyancy for aircraft over WATER.DAT surfaces, at native gravity (0.008 a 50 Hz step, which the
  * flight step applies), so the buoyancy force is the native one. */
 private floatOnWater(dt:number){
  // cBuoyancy asks GetWaterLevel at the body's own height with its bTouchingWater (iOS 0x10045f9f0), so
  // limited-depth water far over it, or water far under it, is none.
  const hook=this.waterLevel;if(!hook){this.inWater=this.drowning=false;return;}
  const waterHeight=this.body.translation().y,level=(x:number,y:number)=>hook(x,y,waterHeight,this.water.touching);
  const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation()),v=this.body.linvel(),w=this.body.angvel(),h=this.handling.values;
  const native=(x:number,y:number,z:number):NativeVec=>[x,-z,y],axis=(x:number,y:number,z:number)=>{const a=new Vector3(x,y,z).applyQuaternion(q);return native(a.x,a.y,a.z);};
  const b=this.assets.collision!.bounds;
  const state:NativeBuoyancyBody={position:native(p.x,p.y,p.z),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:[...b.min] as NativeVec,boundsMax:[...b.max] as NativeVec,modelId:this.modelId,heli:this.helicopter,plane:!this.helicopter,touchingWater:this.water.touching,mass:h.mass,turnMass:h.turnMass,centerOfMass:[h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ],heavy:this.heavy,buoyancyConstant:this.water.buoyancy,moveSpeed:native(v.x/50,v.y/50,v.z/50),turnSpeed:native(w.x/50,w.y/50,w.z/50)};
  const rotor:Parameters<typeof applyNativeBuoyancy>[3]={rotorSpeed:this.helicopter?this.rotorSpeed:0,initialBuoyancy:this.handling.buoyancy},moveSpeed=[...state.moveSpeed] as NativeVec;
  const result=applyNativeBuoyancy(state,level,dt*50,rotor,1);
  // SimpleCalcBuoyancy throws spray from partly submerged edges once per native 30 fps frame, using the speed before the buoyancy response.
  this.splashClock+=dt;
  if(rotor.sample&&this.splashClock>=1/30){
   this.splashClock%=1/30;
   for(const edge of nativeBuoyancySplashEdges(rotor.sample)){const particles=nativeSplashParticles({...state,moveSpeed},edge.from,edge.to);if(particles){this.splashes.push(...particles);this.splashReport=moveSpeed;}}
  }
  this.water.touching=state.touchingWater;this.water.buoyancy=state.buoyancyConstant;this.inWater=result.inWater;this.drowning=result.drowning;
  if(!result.inWater)return;
  if(result.drowning&&this.occupied&&this.sim.player.health>0)this.sim.handlePlayerBreath(dt);
  const [mx,my,mz]=state.moveSpeed,[tx,ty,tz]=state.turnSpeed;
  this.body.setLinvel({x:mx*50,y:mz*50,z:-my*50},true);this.body.setAngvel({x:tx*50,y:tz*50,z:-ty*50},true);
  if(this.helicopter)this.rotorSpeed=rotor.rotorSpeed;
  if(result.rotorKilled||result.engineOff)this.throttle=0;
  // CAutomobile::ProcessBuoyancy's BlowUpCar for a plane diving into the water: the explosion follows.
  if(result.blowUp&&this.health>0&&this.damage(this.health))this.pendingExplosion=true;
 }
 private stepDt=1/60;
 /** CAutomobile::ProcessCarOnFireAndExplode for a plane or helicopter: the burn timer runs at the full time step (the
  * particle counter is set first), the aircraft blows up past 5000 ms, and one nobody flies that is not an RC toy
  * has a 1.2% chance a frame of an EXPLOSION_ROCKET where it is. Out of the fire, the timer is cleared. */
 private burn(dt:number){
  if(!this.burning){this.burnTimer=0;return false;}
  if(!this.fireCounter)this.fireCounter=this.inAir?2:1;
  this.burnTimer+=dt*1000;
  if(this.burnTimer>5000)return this.damage(this.health);
  const rc=this.modelId===464||this.modelId===465||this.modelId===501;
  if(!this.occupied&&!rc&&this.random()<1-Math.pow(1-.012,dt*30))this.onBurnExplosion?.({...this.body.translation()});
  return false;
 }
 /** CAutomobile::IsInAir: not in the water, no wheel on the ground and moving. */
 get inAir(){if(this.inWater)return false;const v=this.body.linvel();return !this.grounded&&(v.x!==0||v.y!==0||v.z!==0);}
 /** Touching fixed world geometry this step: a contact pair with a contact point. A pair alone is only the bounding
  * boxes meeting, which a terrain block's does for anything flying low over it. */
 private touchingFixed(){
  let contact=false;
  for(let i=0;i<this.body.numColliders()&&!contact;i++){const collider=this.body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   if(contact||!other||other.parent()&&!other.parent()!.isFixed())return;
   this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)contact=true;});
  });}
  return contact;
 }
 afterStep(){let destroyed=this.pendingExplosion;this.pendingExplosion=false;
  if(stepBombTimer(this,this.stepDt*50)){this.destroyed();destroyed=true;}
  if(!this.occupied)this.exitPending=false;
  else if(this.exitPending&&this.leaveMode()==='wait')this.slowForExit(this.stepDt);
  const change=new Vector3().copy(this.body.linvel()).sub(this.impactVelocity).length();
  if(this.health>0&&change>12&&this.touchingFixed())destroyed=this.damage((change-10)*45);
  // CAutomobile::ProcessControl's crash-and-burn: a helicopter told to come down (MISSION_HELI_CRASH_AND_BURN), or the
  // player's plane or helicopter burning whose fire started in the air (m_fireParticleCounter 2), blows up at once,
  // burning (under 250 health), when it strikes something rising or is down, unless it is still sinking.
  if(!destroyed)destroyed=this.burn(this.stepDt);
  if(!destroyed&&this.health>0&&this.health<250&&(this.occupied&&this.fireCounter===2||this.heliPilot?.mission===MISSION_HELI_CRASH_AND_BURN)){
   const v=this.body.linvel(),rising=this.touchingFixed()&&v.y-this.impactVelocity.y>0;
   if((rising||this.grounded)&&(v.y>=0||this.inWater))destroyed=this.damage(this.health);
  }
  if(!this.occupied)return destroyed;const p=this.body.translation(),q=this.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={...p};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=this.airspeed;player.grounded=this.grounded;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});return destroyed;}
 update(alpha:number){
  for(const wheel of this.rollingWheels){wheel.object.visible=!this.gearUp;wheel.object.matrix.copy(wheel.base).multiply(new Matrix4().makeRotationX(wheel.previous+(wheel.roll.angle-wheel.previous)*alpha));}
  interpolateVehiclePose(this.root,{body:this.body,previous:this.previous,previousRotation:this.previousRotation},alpha);
  for(const {object,base,kind} of this.moving){object.visible=!kind.startsWith('gear_')||!this.gearUp;const angle=kind.startsWith('static_prop')||kind.startsWith('static_rotor')?this.propAngle:kind.startsWith('aileron')?this.inputs.roll*.3*(kind.endsWith('_l')?1:-1):kind.startsWith('elevator')?this.inputs.pitch*.3:kind==='rudder'?this.inputs.rudder*.3:0;object.matrix.copy(base).multiply(kind.startsWith('static_rotor')?(kind.endsWith('2')?new Matrix4().makeRotationX(angle):new Matrix4().makeRotationZ(angle)):kind.startsWith('static_prop')?new Matrix4().makeRotationY(angle):kind==='rudder'?new Matrix4().makeRotationZ(angle):new Matrix4().makeRotationX(angle));}
 }
 /** SetupLightingForEntity's multiplier, GetLightingFromCol(true) × 0.95 + 0.05: the object ambient's mean with a
  * contact brightness of 0.5 stands in (this vehicle keeps no contact lighting). */
 private updateReflection(rgb:readonly number[]|undefined){
  // A blown-up vehicle's atomics lose their reflection passes.
  this.reflection.state.enabled.value=!this.wrecked;
  const mean=rgb?(rgb[0]+rgb[1]+rgb[2])/3:.5;
  this.reflection.update(Math.min(1.05,(mean+.5)*.95+.05),this.body.translation(),this.body.rotation());
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(this.reflection)this.updateReflection(rgb);if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual.setNight(night);}
 snapshot(){return {inWater:this.inWater,drowning:this.drowning,health:this.health,rotorSpeed:this.rotorSpeed,vtol:this.modelId===520?this.vtol:null,helicopter:this.helicopter,modelId:this.modelId,name:this.name,occupied:this.occupied,gearUp:this.gearUp,throttle:this.throttle,grounded:this.grounded,stall:this.stall,airspeed:this.airspeed,altitude:this.altitude,position:{...this.body.translation()},rotation:{...this.body.rotation()},velocity:{...this.body.linvel()}};}
 /** What the script's vehicle host reads of any vehicle: the body under `car`, the heading as WorldCar's (the
  * body's yaw turned half round), and whether it has gone. `car.root` is what the occupant renderer seats riders on. */
 readonly car:{body:RAPIER.RigidBody;root:Group};disposed=false;
 /** A script's vehicle (CVehicle's MISSION_VEHICLE creation): the population never removes it; the script lets it go. */
 missionCar=false;
 /** CWeather::WindDir (native axes), which FlyingControl blows aircraft with. */
 static windDir?:()=>{x:number;y:number;z:number};
 /** FlyingControl's −CWeather::WindDir × fWindMult, none for a mission vehicle. */
 private flightWind(windMult:number):NV{const w=this.missionCar?undefined:WorldPlane.windDir?.();return w?[-w.x*windMult,-w.y*windMult,-w.z*windMult]:[0,0,0];}
 /** CVehicle::bConsideredByPlayer, which SET_VEHICLE_IS_CONSIDERED_BY_PLAYER clears: the player's enter search passes it over. */
 consideredByPlayer=true;
 heading(){const q=this.body.rotation();return Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));}
 dispose(){this.disposed=true;this.root.removeFromParent();this.visual.dispose();this.physical.dispose();}
}
