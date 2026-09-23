import {surfaceAdhesiveLimit} from '../assets/surfaceAdhesion';
import {nativeCoastBrake} from './nativeWheelResponse';
/** cHandlingDataMgr::Initialise's fWheelFriction: with no gas and no brake, ProcessWheel brakes each wheel by it over the
 * mass every step, so a car let off the throttle slows and stops. MODEL_RCBANDIT brakes at a fifth. */
const WHEEL_FRICTION=.9,MODEL_RC_BANDIT=441;
import {NATIVE_WHEELBASE_SURFACE} from '../assets/surfaceIds';
import {LAW_ENFORCEMENT_MODELS} from './nativeWanted';
import {CHEATS} from './nativeCheats';
import {initialCarCollisionLighting,nativeCarContactBrightness} from './nativeCarContactLighting';
import {nativeContactLightMultiplier} from './nativeContactLighting';
import {NATIVE_CAR_WHEELS} from './nativeDriveContacts';
import {nativeSurfaceGrip,nativeWetGripByte} from './nativeSurfaceGrip';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
import RAPIER from '@dimforge/rapier3d-compat';
import {Quaternion,Vector3,type Scene} from 'three';
import type {Simulation} from './Simulation';
import {CAR_SOLVER_GROUPS} from './solverGroups';
import {burstCompressionRandomUpper} from './nativeGroundCompression';
import {softGroundResistance} from './nativeSoftGround';
import {hoverWheelContact,hoverActive} from './nativeHoverSuspension';
import type {CarWheel} from './nativeDriveContacts';
const MODEL_VORTEX=539;
/** eCarWheel indices of the native wheel names. */
const CAR_WHEEL_INDEX={frontLeft:0,rearLeft:1,frontRight:2,rearRight:3} as const;
/** CVehicle::ProcessWheel's fBurstTyreMod (0x8D34B4). */
const BURST_TYRE_MOD=.13;
import {VEHICLE_ELASTICITY,impulseVelocityChange,vehicleHitsObject,vehicleUprootsObject,type NativeObjectState,type ObjectDamageResult} from './nativeObjectDamage';
import {installNativeCar,type NativeCarAssets} from './installNativeCar';
import type {NativeRaycastPlayerInput} from './NativeRaycastVehicle';
import type {NativeCollisionSource} from './nativeCollision';
import {CAR_BURN_SECONDS,CAR_FIRE_HEALTH,COLLISION_COMPONENT,DAMSTATE,DOOR_FRAMES,PANEL_FRAMES,applyCollisionComponents,collisionHealthLoss,collisionHealthLossRaw,createCarDamage,type ComponentChange} from './nativeCarDamage';
import {carWindscreenFrame,findGlassTriangles} from './nativeGlass';
import {DOOR,MODEL_FLAG,createCarDoors,type CarAxes,type Vec} from './nativeDoor';
import {NativeBouncingPanel} from './nativeBouncingPanel';
import {FLYING,FlyingComponents} from './flyingComponents';
import {applyNativeBuoyancy,nativeBuoyancySplashEdges,nativeSplashParticles,type NativeBuoyancyBody,type NativeVec} from './nativeBuoyancy';
import type {VehicleAnimGroupData} from '../assets/vehicleAnimGroups';
export interface TrafficControls {throttle:number;brake:number;steering:number;handbrake:boolean;
 /** CCarCtrl::SteerAICarWithPhysics output, applied as the game applies it: steer angle in radians (positive
  * left), gas (negative reverses), brake and handbrake. Takes precedence over the pad-style fields. */
 native?:{steerAngle:number;gas:number;brake:number;handbrake:boolean};}
/** Authored break-in alarm length. */
export const CAR_ALARM_SECONDS=8;
/** m_nAlarmState set by AddCollisionRecord: 15000 ms. */
export const ALARM_TRIGGER_SECONDS=15;
/** Count an alarm down; the horn pulses while time remains. */
export function tickAlarm(alarm:number,dt:number){return Math.max(0,alarm-Math.max(0,dt));}
/** handling.cfg `^ 0` (STDCARAMIMS) for cars loaded without their anim group rows. */
export const DEFAULT_VEHICLE_ANIM_GROUP:VehicleAnimGroupData={id:0,first:0,second:0,flags:0,special:0,times:{getIn:.5,jumpOut:0,getOut:-.5,jackedOut:-.3,fallOut:.3},openOut:[.41,.8],closeIn:[.3,.45],openIn:[.06,.43],closeOut:[.2,.43]};
type V3={x:number;y:number;z:number};
/** Browser (x, y up, z south) to native (x, y north, z up). */
const native=(v:V3):Vec=>[v.x,-v.z,v.y];
const rotate=(q:{x:number;y:number;z:number;w:number},v:V3)=>new Vector3(v.x,v.y,v.z).applyQuaternion(q as never);
/** Native car lifecycle in the streamed world. Entry and exit sequencing lives in CarEntry; `interact` is the direct seat warp. */
/** Whether a car takes nothing from a blow. CAutomobile::BlowUpCar_Impl leaves at once without
 * vehicleFlags.bCanBeDamaged, and CPhysical's damage response refuses the weapon's own class, which for the
 * browser's two kinds of vehicle damage is the explosion proof and the bullet proof. */
export const carRefusesDamage=(car:{canBeDamaged:boolean;proofs?:{bullet:boolean;explosion:boolean}},explosive:boolean)=>
 !car.canBeDamaged||!!(explosive?car.proofs?.explosion:car.proofs?.bullet);
export class WorldCar {
 readonly car:ReturnType<typeof installNativeCar>;
 readonly modelId:number;
 readonly name:string;
 /** Native vehicle health: 1000, burning below 250, then CAutomobile::BlowUpCar after 5000 ms. */
 health=1000;
 /** CPhysical::physicalFlags as SET_CAR_PROOFS grants them: a car proof against the kind of damage it is taking
  * loses no health, which is the response CPhysical decides by the weapon's class. */
 proofs?:{bullet:boolean;fire:boolean;explosion:boolean;collision:boolean;melee:boolean};
 /** vehicleFlags.bCanBeDamaged, which SET_VEHICLE_CAN_BE_DAMAGED clears. CAutomobile::BlowUpCar_Impl returns
  * at once without it, so a car that cannot be damaged cannot be blown up either. */
 canBeDamaged=true;
 /** vehicleFlags.bTyresDontBurst, which SET_CAR_CAN_BURST_TYRES clears: a shot wheel keeps its air. */
 tyresDontBurst=false;
 /** CAutoPilot's own fields as a script sets them: the cruise speed, the driving style and whether the car
  * loads collision round itself. Nothing drives a script's car here yet, so these are held and no more. */
 autopilotFields?:{cruiseSpeed?:number;drivingStyle?:number;loadsCollision?:number};
 /** physicalFlags.bInvulnerable on a car, which SET_CAR_ONLY_DAMAGED_BY_PLAYER sets: a blow from anyone but
  * the player leaves it alone, which in this browser is a ped's gunfire. */
 onlyDamagedByPlayer=false;
 burnTimer=0;
 wrecked=false;
 /** Set by BlowUpCar until the weapon system spawns its explosion. */
 pendingExplosion=false;
 readonly damageState=createCarDamage();
 /** CAutomobile::m_doors in eDoors order. */
 readonly doors:ReturnType<typeof createCarDoors>;
 readonly modelFlags:number;
 readonly animGroup:VehicleAnimGroupData;
 readonly debris:FlyingComponents;
 /** m_fSteerAngle and m_GasPedal from the latest control step, for the player's driving poses. */
 steerAngle=0;gasPedal=0;
 /** CAutomobile::m_fContactSurfaceBrightness from the wheels' collision lighting. */
 contactBrightness(night:number){return nativeCarContactBrightness(this.collisionLighting,night);}
 /** cTransmission current gear (m_nCurrentGear). */
 gear=1;
 /** m_HornCounter/m_HornPattern and bSirenOrAlarm, read by CAEVehicleAudioEntity. */
 readonly horn={counter:0,pattern:0};siren=false;
 /** PlayCarHorn state (see nativeCarHorn.ts); the traffic controller raises the honk flags each step. */
 honkAtCar=false;honkAtPed=false;stoppedForLight=false;hornTimer=0;
 /** Per-step CAutomobile fields used by the vehicle audio entity: wheel states and counts, m_fWheelSpinForAudio,
  * drive wheels on ground, the last wheel contact surface, pedals and the player's pad bytes as 0..1. */
 readonly audio={states:['normal','normal','normal','normal'] as ('normal'|'spinning'|'skidding'|'fixed')[],counts:[0,0,0,0],contactWheels:0,driveOnGround:0,driveOnGroundLastFrame:0,spinForAudio:0,burst:[false,false,false,false],contactSurface:0,brakePedal:0,handbrake:false,accelerate:0,brake:0};
 /** CAutomobile::ProcessControlInputs: the exit button holds the handbrake until the driver's exit starts. */
 exitHandbrake=false;
 /** Seated driving input; cleared while a driver transition runs. */
 driverInput=true;
 onDoorEvent?:(event:'open'|'close',door:number)=>void;
 /** CPhysical::ApplyCollision audio reports: the other collider, the world contact point, the normal toward this car and the normal impulse per unit mass in native units per frame. */
 onCollision?:(report:{other:RAPIER.Collider;point:V3;normal:V3;impulse:number})=>void;
 camera?:()=>Vector3|undefined;
 private mass:number;private collisionDamageMultiplier:number;private boundsMaxX:number;
 private stepVelocity?:V3;
 private stepTurn?:V3;
 private turnMass=1;
 /** OBJECT.DAT props this car can damage: the prop's data and live state, and
  * a callback that removes the placement once it is smashed or broken. */
 propFor?:(other:RAPIER.Collider)=>{effect:number;colDamageMultiplier:number;uprootLimit:number;mass:number;state:NativeObjectState;
  /** Called for every ObjectDamage the car deals; the owner removes the prop when `result.removed`. Point and normal are world (y-up). */
  damaged:(hit:{result:ObjectDamageResult;damage:number;point:{x:number;y:number;z:number};normal:{x:number;y:number;z:number}})=>void;
  /** OBJECT.DAT turn mass and elasticity for the two-body response after an uproot. */
  turnMass:number;elasticity:number;
  /** Unfreezes the prop with the given velocity (m/s) and spin (rad/s); false when it could not. */
  uproot:(linvel:{x:number;y:number;z:number},angvel:{x:number;y:number;z:number})=>boolean}|undefined;
 /** Props destroyed by this car, for diagnostics. */
 propsSmashed=0;propsUprooted=0;
 private previousMotion?:{linear:V3;angular:V3};
 private damageIntensity=0;
 private panels:NativeBouncingPanel[]=[];
 private visual:Record<string,number>={};
 /** The player's car, used for native rammed-by-player damage divisors. */
 playerVehicle?:()=>WorldCar|undefined;
  occupied=false;
  trafficOrigin=false;
  /** The clump alpha (0 to 255): a generated car starts at 0 and CVehicle::UpdateClumpAlpha raises it 16 a frame. */
  alpha=255;
  /** CarGenerator and CCarCtrl set a new car's clump alpha to 0 so it fades in. */
  fadeIn(){this.alpha=0;this.car.setAlpha(0);}
  /** pedgrp.dat gang (0 to 9) whose members drive this car; civilians drive when undefined. */
  gang?:number;
  /** Set once dispose() freed the physics body: any handle kept by a scan or unit is stale after this. */
  disposed=false;
  /** Generator door locks (doorLockChance): locked cars refuse entry. */
  locked=false;
  /** Alarm horn, seconds remaining: 15 s when an armed alarm goes off (CPhysical::AddCollisionRecord on a vehicle
   * collision), 8 s for the authored break-in rattle; nearby foot officers investigate. */
  alarm=0;
  private surfaces:Map<number,{values:{glass:number};adhesionGroup?:string}>;
  /** CGlass::CarWindscreenShatters when the windscreen panel reaches DAMSTATE_OPENED_DAMAGED: the pane's frame in
   * native world space (point, fwd, right, center) and the car's move speed in units a frame; unset, the panel flies
   * off as any other. */
  onWindscreenShatter?:(frame:{point:[number,number,number];fwd:[number,number,number];right:[number,number,number];center:[number,number,number]},moveSpeed:[number,number,number])=>void;
  /** The windscreen's glass quad in native world space from the collision's glass triangles and the car's matrix. */
  windscreenGlassFrame(){
   const glass=findGlassTriangles(this.assets.collision.mesh,material=>(this.surfaces.get(material)?.values.glass??0)!==0);
   if(!glass)return undefined;
   const q=this.car.body.rotation(),t=this.car.body.translation();
   // Model native (x, y, z) is scene (x, z, -y); rotate by the body, then back to native (x, -z, y).
   const rotate=(v:[number,number,number]):[number,number,number]=>{const x=v[0],y=v[2],z=-v[1];const ix=q.w*x+q.y*z-q.z*y,iy=q.w*y+q.z*x-q.x*z,iz=q.w*z+q.x*y-q.y*x,iw=-q.x*x-q.y*y-q.z*z;
    const rx=ix*q.w+iw*-q.x+iy*-q.z-iz*-q.y,ry=iy*q.w+iw*-q.y+iz*-q.x-ix*-q.z,rz=iz*q.w+iw*-q.z+ix*-q.y-iy*-q.x;return [rx,-rz,ry];};
   const vertices=glass.vertices.map(v=>{const r=rotate(v);return [r[0]+t.x,r[1]-t.z,r[2]+t.y] as [number,number,number];});
   return carWindscreenFrame(vertices,rotate(glass.normal),rotate([1,0,0]),rotate([0,0,1]));
  }
  /** m_nAlarmState -1: the generator fitted an alarm (alarmChance) that the next vehicle collision sets off. */
  alarmArmed=false;
  /** The fleet car owning a rigid body handle, for the collision record between vehicles. */
  otherCar?:(bodyHandle:number)=>WorldCar|undefined;
  /** CAutomobile::VehicleDamage's collision: the health loss before divisors and whether the player's car did it
   * (CEventVehicleDamageCollision needs over 5 from a driven car). */
  onCollisionDamage?:(rawLoss:number,byPlayer:boolean)=>void;
  /** CPhysical::AddCollisionRecord for two vehicles: both armed alarms go off for 15 s. */
  private recordVehicleCollision(other:WorldCar){
   if(this.alarmArmed){this.alarmArmed=false;this.alarm=ALARM_TRIGGER_SECONDS;}
   if(other.alarmArmed){other.alarmArmed=false;other.alarm=ALARM_TRIGGER_SECONDS;}
  }
 autopilot?:TrafficControls;
 private latch=false;
 private collisionLighting=initialCarCollisionLighting();
 /** m_wheelColPoint as the skidmarks read it: each wheel's ground contact in native world space and its COL
  * material, or null off the ground. */
 readonly wheelGround:({x:number;y:number;z:number;material:number}|null)[]=[null,null,null,null];
 /** m_wheelSkidmarkBloodState, in eCarWheel order. */
 readonly wheelBlood=[false,false,false,false];
 private lastRoad=new Map<string,{normal:{x:number;y:number;z:number};groundSpeed:{x:number;y:number;z:number}}>();
 private input:NativeRaycastPlayerInput;
 private sourceOwner?:ReadonlyMap<number,{source:NativeCollisionSource}>;
 private sources=new Map<number,NativeCollisionSource>();
 constructor(private sim:Simulation,scene:Scene,readonly assets:NativeCarAssets,position:{x:number;y:number;z:number},road:Awaited<ReturnType<typeof loadWorldRoadMaterials>>,heading=0){
  this.modelId=assets.vehicle.id;this.name=assets.vehicle.id===492?'Greenwood':assets.vehicle.model;this.surfaces=road.records;
  this.car=installNativeCar(sim.world,scene,assets,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.4,restitution:0});
  const h=assets.handling.values;this.mass=h.mass;this.turnMass=h.turnMass;this.collisionDamageMultiplier=h.collisionDamageMultiplier;this.boundsMaxX=Math.max(.5,assets.collision.bounds.max[0]);
  this.groupColliders();
  this.modelFlags=h.modelFlags;this.animGroup=assets.animGroup??DEFAULT_VEHICLE_ANIM_GROUP;this.doors=createCarDoors(h.modelFlags,this.modelId);this.debris=new FlyingComponents(sim.world,scene);
  // CAutomobile::SetupModelNodes: cars without doors have every side door not present.
  if(h.modelFlags&MODEL_FLAG.noDoors){for(const door of [DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear])this.damageState.doors[door]=DAMSTATE.notPresent;this.refreshVisuals(true);}
  this.input={gravity:{applyGravity:true,disableMoveForce:false,usesCollision:true},airResistance:{},
   pedals:{accelerate:0,brake:0,automaticallyHandbrake:false,handbrake:true,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true},
   steering:{steeringAxis:0,mouseDeltaX:0,mouseThirdPerson:false,mouseSteeringEnabled:false,vehicleMouseLook:false},// ProcessControlInputs' speed-sensitive steering lock reads GetAdhesiveLimit for the wheelbase on SURFACE_TARMAC.
   steeringControl:{playerStatus:true,tarmacAdhesion:surfaceAdhesiveLimit(road.rows,road.records.get(NATIVE_WHEELBASE_SURFACE)!,road.records.get(1)!)},
   // ProcessSuspension: the Vortex (and the unused CARS_ON_WATER cheat) springs along the car's down axis (ApplySpringCollision), other cars along the contact normal (Alt).
   suspension:{mode:assets.vehicle.id===MODEL_VORTEX?'direction':'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2},
   tires:{velocityFrequency:1,playerControlled:true,vehicleGrip:{physicsStatus:false,get perfectHandling(){return CHEATS.isActive('perfectHandling');},extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},wheelParameters:{coastBrake:nativeCoastBrake(WHEEL_FRICTION,h.mass,assets.vehicle.id===MODEL_RC_BANDIT?'rcBandit':'car'),wheelDamageEffect:.5,playerCollisions:false}},
   // Exact native collision material and adhesion matrix. DoBurstAndSoftGroundRatios sinks non-Rhino wheels on SAND surfaces
   // (less as CWeather::WetRoads rises), and the player's wet multiplier comes from the road's SURFINFO.DAT wet grip.
   resolveWheel:(wheel,contact)=>{
    const material=contact?.surface?.material??0,record=road.records.get(material);
    // CDamageManager wheel status (0 ok, 1 burst, 2 missing) in eCarWheel order.
    const status=this.damageState.wheels[CAR_WHEEL_INDEX[wheel]],burst=status===1;
    const forwardSpeed=burst?this.forwardSpeedUnits():0;
    if(contact){this.lastRoad.set(wheel,{normal:{...contact.normal},groundSpeed:{...contact.groundSpeed}});this.audio.contactSurface=material;}
    const t=this.car.body.translation(),index=CAR_WHEEL_INDEX[wheel];
    this.wheelGround[index]=contact?{x:t.x+contact.point.x,y:-t.z+contact.point.y,z:t.y+contact.point.z,material}:null;
    return {ground:{status:status===2?'missing':burst?'burst':'normal',burstSample:burst?Math.floor(Math.random()*burstCompressionRandomUpper(forwardSpeed)):undefined,sandGroup:record?.adhesionGroup==='SAND',railTrack:material===178,rhino:this.modelId===432,wetRoads:this.wetRoads,rotation:0,wheelSpeed:0},suspension:{forceLevel:h.suspensionForce*this.hoverForceScale(),bias:wheel.startsWith('front')?h.suspensionBias:1-h.suspensionBias,damping:h.suspensionDamping},surface:nativeSurfaceGrip(material,road.records,road.rows,nativeWetGripByte(record?.wetGrip??0),this.wetRoads,{burst,burstNoise:burst?(Math.random()*2-1)*BURST_TYRE_MOD:undefined}),fallback:this.lastRoad.get(wheel)};
   }};
 }
 /** Weapon damage: CVehicle::InflictDamage port — health loss scaled by impact
  * angle (grazing shots keep 40%, square hits 100%) plus CAutomobile::VehicleDamage
  * component progression for the hit COL piece. Returns true only when the car is wrecked. */
 damage(amount:number,collider?:number,explosive=false,shotDir?:{x:number;y:number;z:number}){
  if(this.wrecked||carRefusesDamage(this,explosive))return false;
  if(shotDir&&!explosive){
   // Face-normal falloff in native axes: the struck face is the car axis most
   // opposed to the shot; grazing shots keep 40%, square hits deal 100%.
   const {right,forward,up}=this.axes(),s=native(shotDir);
   const face=Math.max(Math.abs(s[0]*right[0]+s[1]*right[1]+s[2]*right[2]),Math.abs(s[0]*forward[0]+s[1]*forward[1]+s[2]*forward[2]),Math.abs(s[0]*up[0]+s[1]*up[1]+s[2]*up[2]));
   amount*=0.4+0.6*Math.min(1,face/Math.max(1e-4,Math.hypot(s[0],s[1],s[2])));
  }
  // Bullets leave a destroyed car at 1 health to burn out; blasts that exhaust its health blow it up at once.
  this.health=Math.max(explosive?0:1,this.health-amount);
  const piece=collider===undefined?undefined:this.pieceOf(collider);
  if(piece!==undefined&&amount>25)this.applyComponents(applyCollisionComponents(this.damageState,piece,amount,this.mass,{localDir:0,dirDotRight:0},Math.random,true),true);
  if(this.health===0){this.blowUp();return true;}
  return false;
 }
 /** COL spheres and boxes carry the eVehicleCollisionComponent piece byte; mesh faces do not. */
 private pieceOf(handle:number){const source=this.car.sources.get(handle);return source&&source.kind!=='mesh'?source.surface.flags:undefined;}
 private axes():CarAxes{const q=this.car.body.rotation();return {right:native(rotate(q,{x:1,y:0,z:0})),forward:native(rotate(q,{x:0,y:0,z:-1})),up:native(rotate(q,{x:0,y:1,z:0}))};}
 /** Native component offset (car-space frame position) rotated into browser world axes. */
 private worldOffset(local:{x:number;y:number;z:number}){return rotate(this.car.body.rotation(),{x:local.x,y:local.z,z:-local.y});}
 private spawnFlying(frame:string,type:number){
  const source=this.car.cloneComponent(frame);if(!source)return undefined;
  const q=this.car.body.rotation();
  return this.debris.spawn(source,type,{position:this.car.body.translation(),velocity:this.car.body.linvel(),angularVelocity:this.car.body.angvel(),up:rotate(q,{x:0,y:1,z:0}),wrecked:this.wrecked,camera:this.camera?.()});
 }
 /** CAutomobile::ProcessOpenDoor's torn-off bonnet: flying component type 2 (the door collision), sent off at 0.4 of
  * the car's speed plus 0.1 units a frame to its right and half a unit a frame up or down at random, turned by
  * ApplyTurnForce(up x 10) at the front (the component's turn mass is 25). */
 private tearOffBonnet(){
  this.damageState.doors[DOOR.bonnet]=DAMSTATE.notPresent;
  const body=this.spawnFlying('bonnet_dummy',FLYING.door);this.refreshVisuals();
  if(!body)return;
  const q=this.car.body.rotation(),right=rotate(q,{x:1,y:0,z:0}),up=rotate(q,{x:0,y:1,z:0}),forward=rotate(q,{x:0,y:0,z:-1}),v=this.car.body.linvel(),sign=Math.random()<.5?1:-1;
  body.setLinvel({x:v.x*.4+right.x*.1*50+up.x*.5*50*sign,y:v.y*.4+right.y*.1*50+up.y*.5*50*sign,z:v.z*.4+right.z*.1*50+up.z*.5*50*sign},true);
  // Turn speed change (forward x up x 10) / 25 per frame, as radians a second.
  const turn={x:forward.y*up.z-forward.z*up.y,y:forward.z*up.x-forward.x*up.z,z:forward.x*up.y-forward.y*up.x},w=body.angvel(),k=10/25*50;
  body.setAngvel({x:w.x+turn.x*k,y:w.y+turn.y*k,z:w.z+turn.z*k},true);
 }
 /** CAutomobile::SetBumperDamage/SetPanelDamage/SetDoorDamage visual responses to component state changes. */
 private applyComponents(changes:readonly (ComponentChange|true)[],weapon=false){
  if(!changes.length)return;
  for(const change of changes){
   if(change===true)continue;
   if(change.kind==='panel'){
    const frame=PANEL_FRAMES[change.index],node=`${frame}_dummy`;
    if(change.state===DAMSTATE.damaged&&!(this.modelFlags&MODEL_FLAG.bouncePanels)&&this.car.hasFrame(node)&&!this.panels.some(p=>p.frame===node)&&this.panels.length<3){
     // ApplyDamage sends the panel group (windscreen and bumpers) to SetBumperDamage, a type 0 bouncing panel, and
     // the wings to SetPanelDamage, type 1 for the rear two.
     if(change.index>=4)this.panels.push(new NativeBouncingPanel(node,0,-.5+Math.random()*.3));
     else if(change.index>1)this.panels.push(new NativeBouncingPanel(node,1,-.5+Math.random()*.3));
    }
    if(change.state===DAMSTATE.openedDamaged&&(this.visual[frame]??0)!==DAMSTATE.openedDamaged){
     // SetBumperDamage throws the windscreen and bumpers off as flying component type 0 (SpawnFlyingComponent gives
     // the windscreen the bonnet's collision); SetPanelDamage throws the wings as panels. A gunshot windscreen
     // (CVehicle::InflictDamage, unreversed) shatters into glass panes instead.
     const glass=weapon&&frame==='windscreen'&&this.onWindscreenShatter?this.windscreenGlassFrame():undefined;
     if(glass){const v=this.car.body.linvel();this.onWindscreenShatter!(glass,[v.x/50,-v.z/50,v.y/50]);}
     else this.spawnFlying(node,change.index>=4?FLYING.bumper:FLYING.panel);
    }
   }else if(change.kind==='door'){
    const door=this.doors[change.index],frame=DOOR_FRAMES[change.index];
    // CAutomobile::SetDoorDamage: a locked car's side doors (CanDoorsBeDamaged false) are never knocked open or off;
    // they close and stay merely damaged.
    if(change.index>=DOOR.leftFront&&this.locked&&(change.state===DAMSTATE.openedDamaged||change.state===DAMSTATE.notPresent)){
     this.damageState.doors[change.index]=DAMSTATE.damaged;door.angle=door.prevAngle=door.angVel=0;this.car.setDoorAngle(change.index,door.axis,0);continue;
    }
    if(change.state===DAMSTATE.damaged&&door.prevAngle!==0){door.angle=door.prevAngle=door.angVel=0;this.car.setDoorAngle(change.index,door.axis,0);this.onDoorEvent?.('close',change.index);}
    if(change.state===DAMSTATE.notPresent&&(this.visual[frame]??0)!==DAMSTATE.notPresent)this.spawnFlying(`${frame}_dummy`,change.index===DOOR.bonnet?FLYING.bonnet:change.index===DOOR.boot?FLYING.boot:FLYING.door);
    if((change.state===DAMSTATE.opened||change.state===DAMSTATE.openedDamaged)&&change.index===DOOR.bonnet)door.angVel=.2;
   }
  }
  this.refreshVisuals();
 }
 private refreshVisuals(all=false){
  const states:Record<string,number>={...this.visual};
  PANEL_FRAMES.forEach((name,i)=>{if(all||this.damageState.panels[i]!==DAMSTATE.ok)states[name]=this.damageState.panels[i];});
  DOOR_FRAMES.forEach((name,i)=>{states[name]=this.damageState.doors[i];});
  this.visual=states;this.car.setComponentDamage(states);
 }
 /** CAutomobile::BlowUpCar: wrecked status, a 0.13-per-step upward jolt, CDamageManager::FuckCarCompletely and flying doors. */
 /** CEventVehicleDied: the car blew up with an NPC driver aboard (autopilot, not driven out, not the player's). */
 onBlowUp?:(driverAboard:boolean)=>void;
 /** CAutomobile::BlowUpCarsInPath: the Rhino (432) at 0.1 units a step or more blows up every car it touches
  * (not another Rhino, not a scorched wreck); the player's Rhino reports CRIME_EXPLOSION for each. */
 onCrushCar?:(other:WorldCar)=>void;
 private crushCarsInPath(){
  if(this.modelId!==432||this.wrecked||!this.car.body.isEnabled())return;
  const v=this.car.body.linvel();if(Math.hypot(v.x,v.y,v.z)<5)return;
  for(let i=0;i<this.car.body.numColliders();i++){const collider=this.car.body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   const parent=other.parent();if(!parent||parent.isFixed())return;
   let touching=false;this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)touching=true;});if(!touching)return;
   const hit=this.otherCar?.(parent.handle);if(!hit||hit===this||hit.modelId===432||hit.wrecked)return;
   hit.blowUp();this.onCrushCar?.(hit);
  });}
 }
 /** The Rhino's turret (misc_a about its Z) and barrel (misc_c about its X), CAutomobile::TankControl's doom angles. */
 setTurret(yaw:number,pitch:number){
  const c=Math.cos(yaw),s=Math.sin(yaw),pc=Math.cos(pitch),ps=Math.sin(pitch);
  this.car.setFrameBasis('misc_a',[[0,0,c],[0,1,s],[0,2,0],[1,0,-s],[1,1,c],[1,2,0],[2,0,0],[2,1,0],[2,2,1]]);
  this.car.setFrameBasis('misc_c',[[0,0,1],[0,1,0],[0,2,0],[1,0,0],[1,1,pc],[1,2,ps],[2,0,0],[2,1,-ps],[2,2,pc]]);
 }
 /** The barrel node's world position (renderer space), or undefined without the node. */
 muzzleWorld(){return this.car.frameWorldPosition('misc_c');}
 /** The Fire Truck / S.W.A.T. water cannon node (misc_a) turned to the aim's yaw. */
 setCannon(yaw:number){const c=Math.cos(yaw),s=Math.sin(yaw);this.car.setFrameBasis('misc_a',[[0,0,c],[0,1,s],[0,2,0],[1,0,-s],[1,1,c],[1,2,0],[2,0,0],[2,1,0],[2,2,1]]);}
 blowUp(){
  if(this.wrecked||!this.canBeDamaged)return;const driverAboard=!!this.autopilot&&!this.driverOut&&!this.occupied;this.wrecked=true;this.health=0;this.autopilot=undefined;this.pendingExplosion=true;this.onBlowUp?.(driverAboard);
  const doors:ComponentChange[]=[];
  for(let i=0;i<this.damageState.doors.length;i++){if(this.damageState.doors[i]!==DAMSTATE.notPresent){this.damageState.doors[i]=DAMSTATE.notPresent;doors.push({kind:'door',index:i,state:DAMSTATE.notPresent});}}
  // FuckCarCompletely resets every panel status to OK afterwards, so bumper and panel atomics keep their earlier damage.
  for(let i=0;i<this.damageState.panels.length;i++)this.damageState.panels[i]=DAMSTATE.ok;
  this.applyComponents(doors);
  // CDamageManager::FuckCarCompletely detaches a random wheel (its corner drops), and BlowUpCar throws the left
  // front wheel off and stops drawing it.
  this.damageState.wheels[Math.floor(Math.random()*4)]=2;
  this.spawnFlying('wheel_lf_dummy',FLYING.wheel);this.car.setWheelHidden('frontLeft',true);
  this.car.setColors([[24,24,24],[24,24,24],[24,24,24],[24,24,24]]);
  const v=this.car.body.linvel();this.car.body.setLinvel({x:v.x,y:v.y+.13*50,z:v.z},true);
  if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.vehicleOccupantDied();}
 }
 /** CAutomobile::Fix (0x6A3440): every damage status back to OK, damaged atomics hidden, doors shut and bouncing panels
  * reset. The cheat that calls it sets health to 1000 and the burn timer to 0. */
 fix(){
  const d=this.damageState;d.panels.fill(DAMSTATE.ok);d.doors.fill(DAMSTATE.ok);d.lights.fill(false);d.wheels.fill(0);this.car.setWheelHidden('frontLeft',false);
  // A model without doors gets its side doors back as not present, as it was built.
  if(this.modelFlags&MODEL_FLAG.noDoors)for(const door of [DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear])d.doors[door]=DAMSTATE.notPresent;
  this.panels.length=0;
  this.doors.forEach((door,i)=>{if(door.angle!==0||door.prevAngle!==0){door.angle=door.prevAngle=door.angVel=0;this.car.setDoorAngle(i,door.axis,0);}});
  this.visual={};this.refreshVisuals(true);
 }
 /** ProcessCarOnFireAndExplode: below 250 health a car burns, unless it is sinking (bIsDrowning). */
 get onFire(){return !this.wrecked&&this.health<CAR_FIRE_HEALTH&&!this.drowning;}
 distance(){const a=this.sim.player.position,b=this.car.body.translation();return Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);}
 /** CDamageManager door status helpers. */
 doorMissing(door:number){return this.damageState.doors[door]===DAMSTATE.notPresent;}
 setDoorOpen(door:number){const s=this.damageState.doors;if(s[door]===DAMSTATE.ok)s[door]=DAMSTATE.opened;else if(s[door]===DAMSTATE.damaged)s[door]=DAMSTATE.openedDamaged;}
 setDoorClosed(door:number){const s=this.damageState.doors;if(s[door]===DAMSTATE.opened)s[door]=DAMSTATE.ok;else if(s[door]===DAMSTATE.openedDamaged)s[door]=DAMSTATE.damaged;}
 /** CAutomobile::OpenDoor. */
 openDoor(door:number,ratio:number){
  if(this.doorMissing(door))return;
  const d=this.doors[door],wasClosed=d.closed;d.open(ratio);
  if(wasClosed&&!d.closed)this.onDoorEvent?.('open',door);
  else if(!wasClosed&&ratio===0){this.setDoorClosed(door);this.onDoorEvent?.('close',door);}
  this.car.setDoorAngle(door,d.axis,d.angle);
 }
 /** CAutomobile::IsDoorFullyOpen / IsDoorClosed with missing doors counted as fully open. */
 doorFullyOpen(door:number){return this.doors[door].fullyOpen||this.doorMissing(door);}
 /** Driver seat (`ped_frontseat` mirrored, GetSeatPositionInVehicle) or front passenger seat, in native car space. */
 seat(side:'left'|'right'){const p=this.car.nativeFramePosition('ped_frontseat');return p?{x:side==='left'?-Math.abs(p.x):Math.abs(p.x),y:p.y,z:p.z}:undefined;}
 /** World position of a native car-space point. */
 worldPoint(local:{x:number;y:number;z:number}){const p=this.car.body.translation();return this.worldOffset(local).add(new Vector3(p.x,p.y,p.z));}
 /** Native heading of the car: the browser yaw used by the player controller. */
 heading(){const q=this.car.body.rotation();return Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));}
 /** CVehicle::CanPedStepOutCar: |v2D| ≤ 0.01, |vz| ≤ 0.05 units/frame and |ω|² ≤ 0.0004. */
 canStepOut(){const v=this.car.body.linvel(),w=this.car.body.angvel(),s=1/50;return Math.hypot(v.x,v.z)*s<=.01&&Math.abs(v.y)*s<=.05&&(w.x*w.x+w.y*w.y+w.z*w.z)*s*s<=.0004;}
 /** CVehicle::CanPedJumpOutCar (0x6D2030) for automobiles, in units per frame: 0.1 ≤ v2D² ≤ 0.5 unless the car is
  * tilted (up.z < 0.3) and hit something within the last second, when v2D² ≥ 0.1 is enough. A tilted car too slow for
  * that and still unable to step out is slowed: turn speed × 0.9, and move speed × 0.9 while |v|²/100 exceeds
  * (timeStep · 0.008)², else by 1 − timeStep / |v| · 0.016 (the original mutates the car here too). `seconds` is the
  * step the caller polls at. */
 canJumpOut(seconds=1/50){
  const v=this.car.body.linvel(),s=1/50,v2=(v.x*v.x+v.z*v.z)*s*s,up=rotate(this.car.body.rotation(),{x:0,y:1,z:0});
  if(!(up.y<.3&&this.collisionAge<=1))return v2>=.1&&v2<=.5;
  if(v2>=.1)return true;
  if(this.canStepOut())return false;
  const w=this.car.body.angvel();this.car.body.setAngvel({x:w.x*.9,y:w.y*.9,z:w.z*.9},true);
  const timeStep=seconds*50,m2=(v.x*v.x+v.y*v.y+v.z*v.z)*s*s;
  const mult=m2/100>(timeStep*.008)**2?.9:Math.max(0,1-timeStep/Math.sqrt(m2)*.016);
  this.car.body.setLinvel({x:v.x*mult,y:v.y*mult,z:v.z*mult},true);
  return false;
 }
 /** CVehicle::IsSphereTouchingVehicle against the collision bounding box. */
 sphereTouches(point:{x:number;y:number;z:number},radius:number){
  const p=this.car.body.translation(),q=this.car.body.rotation(),inverse={x:-q.x,y:-q.y,z:-q.z,w:q.w},local=rotate(inverse,{x:point.x-p.x,y:point.y-p.y,z:point.z-p.z}),n=native(local),b=this.assets.collision.bounds;
  return n.every((v,i)=>v>b.min[i]-radius&&v<b.max[i]+radius);
 }
 /** Native 2D speed in units per frame. */
 speed2D(){const v=this.car.body.linvel();return Math.hypot(v.x,v.z)/50;}
 interact(){
  if(this.sim.player.health<=0)return '';
  if(this.occupied){
   if(this.car.body.linvel().x**2+this.car.body.linvel().z**2>4)return 'Stop the car before getting out.';
   const p=this.car.body.translation();
   for(const side of [-1,1]){
    const q=this.car.body.rotation(),local={x:side*2.3,y:0,z:0};
    const x=p.x+(1-2*(q.y*q.y+q.z*q.z))*local.x,z=p.z+2*(q.x*q.z-q.w*q.y)*local.x;
    const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:p.y+3,z},{x:0,y:-1,z:0}),8,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit)continue;const foot={x,y:p.y+3-hit.timeOfImpact+.03,z},center={...foot,y:foot.y+.9};
    if(this.sim.world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3),undefined,undefined,this.sim.playerCollider,this.car.body))continue;
    this.setPedOut(foot);return 'On foot';
   }return 'Both doors are blocked.';
  }
  if(this.wrecked)return 'This vehicle is destroyed.';
  if(this.distance()>4)return `Move closer to the ${this.name} to enter.`;
  if(Math.hypot(this.car.body.linvel().x,this.car.body.linvel().z)>2)return 'Wait for the car to stop before entering.';
  this.setPedInAsDriver();return `${this.name} · W/S drive · A/D steer · Space handbrake · F exit`;
 }
 /** CTaskSimpleCarSetPedInAsDriver: the player becomes the driver and loses on-foot collision. */
 setPedInAsDriver(){this.engineRunning=!this.wrecked;this.autopilot=undefined;this.driverless=false;this.holdForEntry=false;this.sim.setCrouched(false);this.occupied=true;this.driverInput=true;this.exitHandbrake=false;this.sim.cameraExcludedBody=this.car.body;this.sim.playerCollider.setEnabled(false);this.sim.player.moveBlend=0;this.sim.player.speed=0;this.sim.player.jumpMomentum={x:0,z:0};}
 /** CTaskSimpleCarSetPedOut: the driver leaves the seat and stands at `foot`. */
 setPedOut(foot:V3,heading=this.sim.player.heading){
  this.occupied=false;this.driverless=true;this.driverInput=true;this.exitHandbrake=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);
  // The ped stands still out of the car: the move blend from the run up to it must not walk him on after the door.
  this.sim.player.moveBlend=0;this.sim.player.speed=0;this.sim.player.jumpMomentum={x:0,z:0};
  const center={...foot,y:foot.y+.9};this.sim.player.position={...foot};this.sim.player.previous={...foot};this.sim.player.heading=heading;
  this.sim.playerBody.setTranslation(center,true);this.sim.playerBody.setNextKinematicTranslation(center);this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;
 }
  beforeStep(seconds:number,axes:{x:number;y:number},handbrake:boolean,sources?:ReadonlyMap<number,{source:NativeCollisionSource}>){
   this.collisionAge+=seconds;
   if(sources!==this.sourceOwner){this.sourceOwner=sources;this.sources=new Map([...(sources??[])].map(([id,value])=>[id,value.source]));}
   this.groupColliders();
   if(this.alarm>0)this.alarm=tickAlarm(this.alarm,seconds);
   const nearby=this.inActiveRange();this.car.body.setEnabled(nearby);this.car.root.visible=true;if(!nearby)return;
  const driving=this.occupied&&this.driverInput;
  // CEntity::TreatAsPlayerForCollisions (STATUS_PLAYER): wet grip, suspension load and off-road adhesion apply to the player's car only.
  this.input.tires.wheelParameters.playerCollisions=this.occupied;
  const p=this.input.pedals,ai=this.occupied?undefined:this.autopilot;p.accelerate=driving?(axes.y>0?255:0):Math.round((ai?.throttle??0)*255);p.brake=driving?(axes.y<0?255:0):Math.round((ai?.brake??0)*255);
  p.handbrake=this.occupied?(driving&&handbrake)||this.exitHandbrake:ai?.handbrake??!this.driverless;
  // CAutomobile::ProcessControl's STATUS_ABANDONED branch: no handbrake, gas or steering, and a 0.2 brake once
  // |v|² < 0.01 units/frame (0.5 on a physical object is not modelled), else none: a car left on a slope settles.
  // These are the native pedals themselves (the S key's brake-then-reverse must not drive an empty car backwards).
  const abandoned=!this.occupied&&!ai&&this.driverless?(()=>{const v=this.car.body.linvel(),s=1/50;return {steerAngle:0,gas:0,brake:(v.x*v.x+v.y*v.y+v.z*v.z)*s*s<.01?.2:0,handbrake:false};})():undefined;
  if(abandoned){p.accelerate=0;p.brake=0;p.handbrake=false;}this.input.steering.steeringAxis=driving?axes.x*128:Math.round((ai?.steering??0)*128);
  if(this.wrecked){p.accelerate=0;p.brake=255;p.handbrake=true;}
  // CAutomobile::ProcessCarOnFireAndExplode for ordinary cars.
  if(this.onFire){this.burnTimer+=seconds;if(this.burnTimer>CAR_BURN_SECONDS)this.blowUp();}else this.burnTimer=0;
  this.crushCarsInPath();
  this.input.ai=this.wrecked?undefined:ai?.native??abandoned;
  // CAutomobile::DoHoverSuspensionRatios: the Vortex rides its wheel lines on the water surface.
  const hover=this.modelId===MODEL_VORTEX&&this.waterLevel&&hoverActive(this.axes().up[2],this.drowning)
   ?(wheel:CarWheel,line:{start:{x:number;y:number;z:number};end:{x:number;y:number;z:number}},groundContactZ:number|undefined)=>hoverWheelContact({start:line.start,end:line.end,groundContactZ,waterLevel:this.waterLevel!(line.end.x,line.end.y)}):undefined;
  // CAutomobile::ProcessControlInputs: a drowning car's gas is cut (m_nStatus engine on, bDrowning).
  this.input.pedals.drowning=this.drowning;
  // ProcessControlInputs (0x6ADDCC): with the player's controls taken, the car is held on the handbrake and brake,
  // its gas cut and its speed capped at 0.28 units a frame.
  if(this.occupied&&this.controlsDisabled){
   this.input.pedals.accelerate=0;this.input.pedals.brake=255;this.input.pedals.handbrake=true;
   const v=this.car.body.linvel(),speed=Math.hypot(v.x,v.y,v.z)/50;
   if(speed>=.28){const k=.28/speed;this.car.body.setLinvel({x:v.x*k,y:v.y*k,z:v.z*k},true);}
  }
  const result=this.car.stepPlayer(seconds,this.input,this.latch,{sources:this.sources,filter:c=>c.handle!==this.sim.playerCollider.handle,hover});this.latch=result.alreadySkidding;
  this.steerAngle=result.steeringInput.angle;this.gasPedal=result.pedals.gas;this.gear=result.state.drivetrain.transmission.gear;
  this.updateAudioState(seconds*50,result.state.drivetrain.contacts,result.state.wheels,result.pedals);
   for(const wheel of NATIVE_CAR_WHEELS){const lighting=result.sampled.geometry[wheel]?.surface?.light;if(lighting!==undefined)this.collisionLighting[wheel]=lighting;}
   this.softGround(seconds);
   this.rollOntoWheels(result.sampled.compression);
   this.gearChangeKick(result.pedals,result.state.drivetrain.contacts);
   this.comeToRest();this.wheelTouchedGround=Object.values(result.state.drivetrain.contacts).some(count=>count>0);
   this.stepVelocity={...this.car.body.linvel()};this.stepTurn={...this.car.body.angvel()};
   this.floatOnWater(seconds);
  }
  /** The tail of CAutomobile::ProcessSuspension: nearly stopped (0.02 units a frame forward, 0.04 unless the player
   * drives) with both wheels of one side hanging and one on the other side down, and not lying too far over, the car
   * is tipped back onto its wheels by ApplyTurnForce(up x side x 0.0025 x turnMass) at the side of its bounds and
   * ApplyMoveForce(-flat right x side x 0.0025 x mass), both doubled for a car the player is not driving. */
  private rollOntoWheels(compression:Record<CarWheel,number>){
   const r=this.car.body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),forward=new Vector3(0,0,-1).applyQuaternion(q),right=new Vector3(1,0,0).applyQuaternion(q),up=new Vector3(0,1,0).applyQuaternion(q);
   const v=this.car.body.linvel(),player=this.occupied,threshold=player?.02:.04,force=player?.0025:.005;
   if(Math.abs(v.x*forward.x+v.y*forward.y+v.z*forward.z)/50>=threshold)return;
   const c=compression;let side=0;
   if(c.frontLeft===1&&c.rearLeft===1&&(c.frontRight<1||c.rearRight<1))side=1;
   else if(c.frontRight===1&&c.rearRight===1&&(c.frontLeft<1||c.rearLeft<1))side=-1;
   if(!side)return;
   // CrossProduct(GetForward(), (0, 0, 1)): the level right.
   const flatRight=new Vector3().crossVectors(forward,new Vector3(0,1,0));
   if(Math.abs(flatRight.dot(right))>=.6)return;
   const spin=new Vector3().crossVectors(right.clone().multiplyScalar(this.boundsMaxX),up.clone().multiplyScalar(side*force)),w=this.car.body.angvel();
   this.car.body.setAngvel({x:w.x+spin.x*50,y:w.y+spin.y*50,z:w.z+spin.z*50},true);
   this.car.body.setLinvel({x:v.x-flatRight.x*force*side*50,y:v.y-flatRight.y*force*side*50,z:v.z-flatRight.z*force*side*50},true);
  }
  /** CPad::DisablePlayerControls, which the host sets from the script's SET_PLAYER_CONTROL. */
  controlsDisabled=false;
  /** vehicleFlags.bAudioChangingGear, read from the engine sound (the host's hook) and cleared every step. */
  takeAudioChangingGear?:()=>boolean;
  /** Whether the camera is the first-person one, which the kick skips. */
  firstPersonCamera=false;
  /** CAutomobile::ProcessControl: the engine sound changing gear under more than 0.4 gas, under 0.1 brake and above 0.15
   * units a frame forward lifts the player's nose, ApplyTurnForce(up x -0.008 x min(turnMass, 2500)) one unit behind
   * the centre, while a front and a rear wheel are down. */
  private gearChangeKick(pedals:{gas:number;brake:number},contacts:Record<string,number>){
   const changing=this.takeAudioChangingGear?.()??false;
   if(!changing||!this.occupied||this.firstPersonCamera||pedals.gas<=.4||pedals.brake>=.1||this.forwardSpeedUnits()<=.15)return;
   if(!((contacts.frontLeft>0||contacts.frontRight>0)&&(contacts.rearLeft>0||contacts.rearRight>0)))return;
   const r=this.car.body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),forward=new Vector3(0,0,-1).applyQuaternion(q),up=new Vector3(0,1,0).applyQuaternion(q);
   const k=-.008*Math.min(this.turnMass,2500)/this.turnMass,spin=new Vector3().crossVectors(forward.clone().multiplyScalar(-1),up.clone().multiplyScalar(k)),w=this.car.body.angvel();
   this.car.body.setAngvel({x:w.x+spin.x*50,y:w.y+spin.y*50,z:w.z+spin.z*50},true);
  }
  /** DidAnyWheelTouchGroundPrev: whether a wheel line touched last step. */
  private wheelTouchedGround=false;
  /** CAutomobile::ProcessControl (0x6B32EF): with no gas and every move-speed axis under 0.0045 units a frame, a car
   * that had a wheel down and is not afloat (the Vortex excepted) comes to rest, its yaw rate cleared. The reference
   * waits out damage from the player only; the browser keeps no damage source, so any fresh damage waits. */
  private comeToRest(){
   const v=this.car.body.linvel(),still=.0045*50;
   if(!(this.gasPedal===0||this.wrecked)||Math.abs(v.x)>=still||Math.abs(v.y)>=still||Math.abs(v.z)>=still)return;
   if(this.damageIntensity>0||this.inWater||!this.wheelTouchedGround||this.modelId===MODEL_VORTEX)return;
   const w=this.car.body.angvel();this.car.body.setLinvel({x:0,y:0,z:0},true);this.car.body.setAngvel({x:w.x,y:0,z:w.z},true);
  }
  /** CAutomobile::ProcessBuoyancy for cars over WATER.DAT surfaces. Force scale matches the aircraft path:
   * browser gravity is 9.81 m/s² against native 0.008 per 50 Hz step (20 m/s²). */
  private floatOnWater(dt:number){
   const level=this.waterLevel;if(!level){this.inWater=this.drowning=false;return;}
   if(!this.assets.handling||!this.assets.collision)return;
   const p=this.car.body.translation(),q=this.car.body.rotation(),v=this.car.body.linvel(),w=this.car.body.angvel(),h=this.assets.handling.values;
   if(this.assets.handling.buoyancy===undefined||this.water.buoyancy===0&&!this.water.touching)this.water.buoyancy=this.assets.handling.buoyancy??0;
   const axis=(x:number,y:number,z:number)=>{const a=rotate(q,{x,y,z});return native(a);};
   const b=this.assets.collision.bounds;
   const state:NativeBuoyancyBody={position:native(p),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:[...b.min] as NativeVec,boundsMax:[...b.max] as NativeVec,modelId:this.modelId,heli:false,touchingWater:this.water.touching,mass:h.mass,turnMass:h.turnMass,centerOfMass:[h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ],buoyancyConstant:this.water.buoyancy,moveSpeed:native({x:v.x/50,y:v.y/50,z:v.z/50}),turnSpeed:native({x:w.x/50,y:w.y/50,z:w.z/50})};
   const rotor:Parameters<typeof applyNativeBuoyancy>[3]={rotorSpeed:0,initialBuoyancy:this.assets.handling.buoyancy??0},moveSpeed=[...state.moveSpeed] as NativeVec;
   const result=applyNativeBuoyancy(state,level,dt*50,rotor,9.81/20);
   this.splashClock+=dt;
   if(rotor.sample&&this.splashClock>=1/30){
    this.splashClock%=1/30;
    for(const edge of nativeBuoyancySplashEdges(rotor.sample)){const particles=nativeSplashParticles({...state,moveSpeed},edge.from,edge.to);if(particles){this.splashes.push(...particles);this.splashReport=moveSpeed;}}
   }
   // CAutomobile::ProcessBuoyancy: the player's Vortex with its up axis over 0.3 neither drowns nor submerges.
   const hovering=this.modelId===MODEL_VORTEX&&this.occupied&&state.up[2]>.3;
   if(hovering)result.drowning=false;
   this.water.touching=state.touchingWater;this.water.buoyancy=state.buoyancyConstant;this.inWater=result.inWater;this.drowning=result.drowning;
   if(!result.inWater)return;
   if(result.drowning&&this.occupied&&this.sim.player.health>0)this.sim.handlePlayerBreath(dt);
   const [mx,my,mz]=state.moveSpeed,[tx,ty,tz]=state.turnSpeed;
   this.car.body.setLinvel({x:mx*50,y:mz*50,z:-my*50},true);this.car.body.setAngvel({x:tx*50,y:tz*50,z:-ty*50},true);
   if(result.blowUp&&this.health>0&&!hovering){this.health=0;this.blowUp();}
  }
 /** CAutomobile::ProcessControl wheel-spin audio rate. WHEELSPIN_* constants (0x8D3498-0x8D34A4) use reVC's 1, 10, 0.95 and 0.7. */
 private updateAudioState(timeStep:number,counts:Record<string,number>,states:Record<string,string>,pedals:{gas:number;brake:number;handbrake:boolean}){
  const a=this.audio,drive=this.assets.handling.values.driveType;let rate=0,contact=0,driveOnGround=0;
  NATIVE_CAR_WHEELS.forEach((wheel,i)=>{
   const front=wheel.startsWith('front'),count=counts[wheel]??0,driven=drive==='4'||front&&drive==='F'||!front&&drive==='R';
   a.counts[i]=count;a.states[i]=(states[wheel]??'normal') as typeof a.states[number];
   if(count>0){contact++;if(driven)driveOnGround++;}
   if(count<=0&&Math.abs(pedals.gas)>.5&&(front?drive!=='R':drive!=='F'))rate+=10;else if(a.states[i]==='spinning')rate+=1;
  });
  rate*=drive==='4'?.25:.5;
  const k=Math.pow(rate>=a.spinForAudio?.95:.7,timeStep);a.spinForAudio=a.spinForAudio*k+(1-k)*rate;
  a.driveOnGroundLastFrame=a.driveOnGround;a.driveOnGround=driveOnGround;a.contactWheels=contact;
  a.brakePedal=pedals.brake;a.handbrake=pedals.handbrake;a.accelerate=this.input.pedals.accelerate/255;a.brake=this.input.pedals.brake/255;
 }
  /** Physics and rendering stay active within this distance of the player. */
  activeRadius=100;
  private beyondRange=false;
  /** Within the active radius, with 5 units of hysteresis so a car at its edge does not flap between physics and rails. */
  inActiveRange(){
   const d=this.distance();
   if(this.beyondRange){if(d<this.activeRadius-5)this.beyondRange=false;}else if(d>=this.activeRadius)this.beyondRange=true;
   return this.occupied||!this.beyondRange;
  }
  /** ProcessSuspension for the Vortex: the spring force level grows by a quarter of the throttle (CPlane's
   * m_fAccelerationBreakStatus); every other car keeps its handling value. */
  private hoverForceScale(){return this.modelId===MODEL_VORTEX?Math.abs(this.input.pedals.accelerate-this.input.pedals.brake)/255*.25+1:1;}
  /** CWeather::WetRoads. */
  wetRoads=0;
  /** CVehicle::ms_fRailTrackResistance (its exe-data default is not in the reference: 0 until measured). */
  railTrackResistance=0;
  /** CAutomobile autoFlags.bIsBoggedDownInSand and the EXTRA_HANDLING_WHEELS_TOUCHING_SAND flag of the last step. */
  boggedDownInSand=false;touchingSand=false;
  /** CAutomobile::DoSoftGroundResistance: sand drags the planar move speed down each step (rail tracks likewise). */
  private softGround(seconds:number){
   let sand=false,rail=false;
   for(const g of this.wheelGround){if(!g)continue;if(this.surfaces.get(g.material)?.adhesionGroup==='SAND')sand=true;else if(g.material===178)rail=true;}
   const v=this.car.body.linvel(),axes=this.axes();
   const r=softGroundResistance({moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},up:{x:axes.up[0],y:axes.up[1],z:axes.up[2]},modelId:this.modelId,handlingFlags:this.assets.handling.values.handlingFlags,wetRoads:this.wetRoads,timeStep:seconds*50,touchingSand:sand,touchingRailTrack:rail,railTrackResistance:this.railTrackResistance});
   this.boggedDownInSand=r.boggedDown;this.touchingSand=r.touchingSand;
   if(r.delta)this.car.body.setLinvel({x:v.x+r.delta.x*50,y:v.y+r.delta.z*50,z:v.z-r.delta.y*50},true);
  }
  /** Native-coordinate WATER.DAT height query (shared with aircraft). */
  waterLevel?:(x:number,y:number)=>number|undefined;
  private water={touching:false,buoyancy:0};inWater=false;drowning=false;
  /** cBuoyancy::AddSplashParticles spray waiting for the FX system, and the move speed of the last splash reported to the audio engine. */
  readonly splashes:{position:NativeVec;velocity:NativeVec}[]=[];splashReport?:NativeVec;private splashClock=0;
 /** CVehicle::m_nVehicleFlags.bEngineOn for a car a driver has sat in: RemoveDriver switches it off only for a
  * non-player driver, so a car the player steps out of keeps idling; a jump-out's CTaskSimpleCarSetPedOut is built
  * with bSwitchOffEngine. */
 engineRunning=false;
 /** CVehicle::RemoveDriver's STATUS_ABANDONED: a car its driver left (stepped, jumped, crawled or was dragged out). */
 driverless=false;
 /** PrepareVehicleForPedEnter: the NPC driver stops while someone lines up with the car. */
 holdForEntry=false;
 /** The NPC driver was dragged out or left; the car keeps no autopilot. */
 driverOut=false;
 /** Collision damage from the velocity change the contact solver applied during the world step (native impulse = mass × Δv per 50 Hz step). */
 private collisionDamage(){
  const before=this.stepVelocity;this.stepVelocity=undefined;this.damageIntensity=0;if(!before||this.wrecked||!this.car.body.isEnabled())return;
  const v=this.car.body.linvel(),dv={x:v.x-before.x,y:v.y-before.y,z:v.z-before.z},change=Math.hypot(dv.x,dv.y,dv.z),intensity=this.mass*change/50;
  // CPhysical's SetDamagedPieceRecord keeps every collision's intensity, ground hits and light knocks included;
  // ProcessOpenDoor reads it.
  this.damageIntensity=intensity;
  // CAutomobile::VehicleDamage returns at once for a car that cannot be damaged, and a collision-proof one takes
  // nothing from a crash.
  if(!this.canBeDamaged||this.proofs?.collision)return;
  if(intensity<=this.mass/1500*25)return;
  const q=this.car.body.rotation(),up={x:2*(q.x*q.y-q.w*q.z),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.w*q.x)},right={x:1-2*(q.y*q.y+q.z*q.z),y:2*(q.x*q.y+q.w*q.z),z:2*(q.x*q.z-q.w*q.y)};
  let piece:number=COLLISION_COMPONENT.default,point:{x:number;y:number;z:number}|undefined,building=true,rammedByPlayer=false,damager:WorldCar|undefined;
  const player=this.playerVehicle?.();
  for(let i=0;i<this.car.body.numColliders();i++){const collider=this.car.body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   if(other.isSensor()||other.handle===this.sim.playerCollider.handle)return;const parent=other.parent();
   let touching=false;this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)touching=true;});if(!touching)return;
   if(parent&&!parent.isFixed()){building=false;if(player&&player!==this&&parent.handle===player.car.body.handle)rammedByPlayer=true;const hit=this.otherCar?.(parent.handle);if(hit&&hit!==this){this.recordVehicleCollision(hit);damager=hit;}}
   const flags=this.pieceOf(collider.handle);if(flags!==undefined&&flags!==COLLISION_COMPONENT.default||!point){piece=flags??piece;point={...collider.translation()};}
  });}
  // CPhysical::ApplyCollision: under the float-away cheat a vehicle the player's vehicle hits loses its gravity.
  if(rammedByPlayer&&CHEATS.isActive('carsFloatAway')&&this.input.gravity)this.input.gravity.applyGravity=false;
  if(!point)return;
  // Hits from below by buildings (ground) do not damage: DotProduct(direction, up) > 0.6.
  const direction={x:dv.x/change,y:dv.y/change,z:dv.z/change};
  if(building&&direction.x*up.x+direction.y*up.y+direction.z*up.z>.6)return;
  const p=this.car.body.translation(),localDir=((point.x-p.x)*right.x+(point.y-p.y)*right.y+(point.z-p.z)*right.z)/this.boundsMaxX,dirDotRight=direction.x*right.x+direction.y*right.y+direction.z*right.z;
  // A cop car the player's car rams while going at least as fast, and faster than 0.1 units a frame, gives him a star.
  if(rammedByPlayer&&player&&LAW_ENFORCEMENT_MODELS.has(this.modelId)&&!this.driverless){
   const pv=player.car.body.linvel(),mine=v,theirs=(pv.x**2+pv.y**2+pv.z**2)/2500;
   if(theirs>=(mine.x**2+mine.y**2+mine.z**2)/2500&&theirs>.01)WorldCar.onPlayerRammedLaw?.();
  }
  // Panels and doors take the hit unless the car is on its roof and moving slower than √0.3 units a frame.
  if(up.y>0||(v.x**2+v.y**2+v.z**2)/2500>.3)this.applyComponents(applyCollisionComponents(this.damageState,piece,intensity,this.mass,{localDir,dirDotRight,van:!!(this.modelFlags&MODEL_FLAG.van)},Math.random));
  const previous=this.health;
  const models={modelId:this.modelId,damagerModelId:damager?.modelId};
  if(this.onCollisionDamage){const raw=collisionHealthLossRaw({intensity,mass:this.mass,collisionDamageMultiplier:this.collisionDamageMultiplier,...models,damagerIsPlayer:rammedByPlayer});if(raw>0)this.onCollisionDamage(raw,rammedByPlayer);}
  this.health=Math.max(0,this.health-collisionHealthLoss({intensity,mass:this.mass,collisionDamageMultiplier:this.collisionDamageMultiplier,playerVehicle:this.occupied,hitByPlayerVehicle:rammedByPlayer,...models}));
  // CAutomobile::VehicleDamage: the smash n boom cheat blows up whatever the player's vehicle hits. Otherwise a
  // crash-killed car stays at 1 health to burn, unless a Rhino (here, the player's) killed it.
  if(CHEATS.isActive('smashNBoom')&&rammedByPlayer){this.blowUp();return;}
  // Only a car that had health left is held at 1; one already drained (on its roof, say) stays at nothing.
  if(this.health<=0&&Math.trunc(previous)>0){this.health=1;if(rammedByPlayer&&player?.modelId===432)this.blowUp();}
 }
 /** SetWantedLevelNoDrop(1) for the player, when his car rams a manned law car (the host wires the law). */
 static onPlayerRammedLaw?:()=>void;
 /** The player's flipped-car count (CPlayerInfo::m_nUpsideDownCounter) and its 32-frame clock. */
 upsideDownCounter=0;private upsideDownClock=0;
 /** A flipped car burns. CAutomobile::VehicleDamage takes 4 health per 1/50 s frame from any upside-down
  * car that is not the player's, so it catches fire and blows up. CPlayerInfo::Process, which handles the
  * player's own car, is a retail stub; its Vice City ancestor (reVC, PlayerInfo.cpp) checks every 32
  * frames at 30 fps, adds 2 for a car on its roof or 1 on its side while it is slower than 0.05 units per
  * frame and out of water, clears the count otherwise, and past 6 caps health at 249, just below burning. */
 private upsideDownDamage(seconds:number){
  if(this.wrecked||!this.car.body.isEnabled()||!this.canBeDamaged)return;
  const q=this.car.body.rotation(),upY=1-2*(q.x*q.x+q.z*q.z);
  if(!this.occupied){this.upsideDownCounter=0;this.upsideDownClock=0;if(upY<0)this.health=Math.max(0,this.health-4*seconds*50);return;}
  this.upsideDownClock+=seconds;if(this.upsideDownClock<32/30)return;this.upsideDownClock-=32/30;
  const v=this.car.body.linvel(),speed=Math.hypot(v.x,v.y,v.z)/50;
  if(upY<0&&speed<.05&&!this.inWater)this.upsideDownCounter+=upY<-.5?2:1;else this.upsideDownCounter=0;
  if(this.upsideDownCounter>6)this.health=Math.min(this.health,249);
 }
 /** CAutomobile::ProcessSwingingDoor and CBouncingPanel::ProcessPanel from the previous step's move and turn speeds. */
 private processComponents(seconds:number){
  const body=this.car.body,linear=body.linvel(),angular=body.angvel(),previous=this.previousMotion;
  this.previousMotion={linear:{...linear},angular:{...angular}};
  if(!previous||!body.isEnabled())return;
  const timeStep=seconds*50,axes=this.axes(),move=native(linear),forwardSpeed=(move[0]*axes.forward[0]+move[1]*axes.forward[1]+move[2]*axes.forward[2])/50;
  const pointDelta=(offset:Vector3):Vec=>{
   const now=new Vector3(angular.x,angular.y,angular.z).cross(offset).add(linear as Vector3),old=new Vector3(previous.angular.x,previous.angular.y,previous.angular.z).cross(offset).add(previous.linear as Vector3);
   return native({x:(now.x-old.x)/50,y:(now.y-old.y)/50,z:(now.z-old.z)/50});
  };
  for(let i=0;i<this.doors.length;i++){
   const position=this.car.doorPosition(i);if(!position||this.doorMissing(i))continue;
   const door=this.doors[i],state=this.damageState.doors[i],closedStatus=state===DAMSTATE.ok||state===DAMSTATE.damaged;
   // CAutomobile::ProcessOpenDoor: a shut door only swings open on a hard hit to the player's car or one under
   // physics (a driven car, not a parked or abandoned one), and never on a locked car (CanDoorsBeDamaged).
   const physics=this.occupied||!!this.autopilot&&!this.driverOut;
   if(closedStatus&&(this.damageIntensity<=100||i===DOOR.bonnet||!physics))continue;
   const delta=pointDelta(this.worldOffset(position));
   if(closedStatus&&!this.locked&&door.processImpact(delta,axes,Math.random))this.setDoorOpen(i);
   if(!(this.damageState.doors[i]===DAMSTATE.opened||this.damageState.doors[i]===DAMSTATE.openedDamaged))continue;
   if(i===DOOR.bonnet&&(door.dirn&0x0f)===1)door.angVel+=Math.sin(door.angle+.1)*.05*forwardSpeed*timeStep;
   if(door.process(delta,axes,timeStep)){this.setDoorClosed(i);this.onDoorEvent?.('close',i);}
   this.car.setDoorAngle(i,door.axis,door.angle);
   // A bonnet that hits its open stop while the car moves forward faster than 0.4 units/frame tears off.
   if(i===DOOR.bonnet&&door.hitOpenStop&&forwardSpeed>.4)this.tearOffBonnet();
  }
  for(const panel of this.panels){
   const position=this.car.nativeFramePosition(panel.frame);if(!position)continue;
   const delta=pointDelta(this.worldOffset(position)),local:Vec=[delta[0]*axes.right[0]+delta[1]*axes.right[1]+delta[2]*axes.right[2],delta[0]*axes.forward[0]+delta[1]*axes.forward[1]+delta[2]*axes.forward[2],delta[0]*axes.up[0]+delta[1]*axes.up[1]+delta[2]*axes.up[2]];
   this.car.setFrameBasis(panel.frame,panel.process(local,timeStep));
  }
 }
 /** CPhysical::m_nNumEntitiesCollided: entities this car touched during the last step, wheels included. */
 entitiesCollided=0;
 /** Seconds since the body last touched another entity (from CPhysical::m_nLastCollisionTime). */
 collisionAge=Infinity;
 private countCollisions(){
  const body=this.car.body;if(!body.isEnabled()){this.entitiesCollided=0;return;}
  const touched=new Set<number>();
  for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   if(other.isSensor()||other.handle===this.sim.playerCollider.handle||other.parent()?.handle===body.handle)return;
   let touching=false;this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)touching=true;});
   if(touching)touched.add(other.parent()?.handle??other.handle);
  });}
  // Wheel line contacts record the entity they rest on, which for the road is the world.
  this.entitiesCollided=touched.size+(this.audio.contactWheels>0&&!touched.size?1:0);
  if(touched.size)this.collisionAge=0;
 }
 /** CAutomobile::BurstTyre (0x6A32B0) for an eCarWheel index. */
 onTyreBurst?:()=>void;
 /** CWeapon::DoBulletImpact's CEventVehicleDamageWeapon: a ped's bullet burst a tyre (the occupants hear it). */
 onTyreShot?:(shooter:'player'|'ped')=>void;
 burstTyre(wheel:number,physicalEffect=true,shotBy?:'player'|'ped'){
  if(this.modelId===432||this.wrecked||this.tyresDontBurst)return false;
  if(this.damageState.wheels[wheel])return false;
  this.damageState.wheels[wheel]=1;this.onTyreBurst?.();if(shotBy)this.onTyreShot?.(shotBy);
  if(physicalEffect){
   // ApplyMoveForce(right x rand(-0.03, 0.03) x mass), ApplyTurnForce(right x rand(-0.03, 0.03) x turnMass, forward).
   const body=this.car.body,r=body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w);
   const right=new Vector3(1,0,0).applyQuaternion(q),forward=new Vector3(0,0,-1).applyQuaternion(q);
   const move=(Math.random()*2-1)*.03,turn=(Math.random()*2-1)*.03;
   const v=body.linvel(),w=body.angvel(),spin=new Vector3().crossVectors(forward,right.clone().multiplyScalar(turn));
   body.setLinvel({x:v.x+right.x*move*50,y:v.y+right.y*move*50,z:v.z+right.z*move*50},true);
   body.setAngvel({x:w.x+spin.x*50,y:w.y+spin.y*50,z:w.z+spin.z*50},true);
  }
  return true;
 }
 /** Speed along the car's forward axis in native units per frame. */
 private forwardSpeedUnits(){
  const r=this.car.body.rotation(),forward=new Vector3(0,0,-1).applyQuaternion(new Quaternion(r.x,r.y,r.z,r.w)),v=this.car.body.linvel();
  return (v.x*forward.x+v.y*forward.y+v.z*forward.z)/50;
 }
 /** CAutomobile::SetUpWheelColModel (0x6A3060): a sphere of half the IDE wheel size at each wheel
  * frame, with the wheel piece; bullets test these so tyres can be shot. Renderer frame. */
 wheelSpheres(){
  const out:{wheel:number;center:Vector3;radius:number}[]=[];
  const front=(this.assets.vehicle.frontWheelSize??.7)/2,rear=(this.assets.vehicle.rearWheelSize??.7)/2;
  this.car.root.updateWorldMatrix(true,true);
  for(const [name,wheel,radius] of [['wheel_lf_dummy',0,front],['wheel_lb_dummy',1,rear],['wheel_rf_dummy',2,front],['wheel_rb_dummy',3,rear]] as const){
   const dummy=this.car.root.getObjectByName(name);if(dummy)out.push({wheel,center:dummy.getWorldPosition(new Vector3()),radius});
  }
  return out;
 }
 /** Car colliders skip solver contact with pedestrians, whose impacts are native. */
 private groupedColliders=0;
 private groupColliders(){
  const body=this.car.body,n=body.numColliders();if(n===this.groupedColliders)return;
  for(let i=0;i<n;i++)body.collider(i).setSolverGroups(CAR_SOLVER_GROUPS);
  this.groupedColliders=n;
 }
 /** Handling mass and turn mass with the collision model's bounds (native units). */
 private nativeBodyCache?:{mass:number;turnMass:number;boundsMin:{x:number;y:number;z:number};boundsMax:{x:number;y:number;z:number}};
 /** Mass, turn mass and the collision model's bounds, built once: hot per-ped checks read it every step. */
 get nativeBody(){if(!this.nativeBodyCache){const b=this.assets.collision.bounds;this.nativeBodyCache={mass:this.mass,turnMass:this.turnMass,boundsMin:{x:b.min[0],y:b.min[1],z:b.min[2]},boundsMax:{x:b.max[0],y:b.max[1],z:b.max[2]}};}return this.nativeBodyCache;}
 /** Distance from the car's origin to the farthest corner of its collision bounds, for cheap range culls. */
 get boundRadius(){const b=this.assets.collision.bounds;return Math.hypot(Math.max(-b.min[0],b.max[0]),Math.max(-b.min[1],b.max[1]),Math.max(-b.min[2],b.max[2]));}
 /** CPhysical::ApplyCollision's static-object branch for OBJECT.DAT props. The
  * browser resolves the prop as a fixed body during the step. When the impact
  * destroys it, the native response is only intensity / (2 x multiplier) along
  * the normal; when it exceeds the uproot limit, the prop turns dynamic and the
  * same impact resolves through the general two-body branch. In both cases the
  * pre-step motion is restored and the native impulses applied instead. Props
  * that hold keep the fixed-body wall response. Velocities are native units per
  * 1/50 s frame; the browser's y-up frame is a proper rotation of the native one,
  * so dot and cross products carry over, and vectors are converted only where
  * the native code reads a Z component. */
 private resolveProps(){
  const body=this.car.body,pre=this.stepVelocity,preTurn=this.stepTurn;
  if(!this.propFor||!pre||!preTurn||!body.isEnabled()||this.wrecked)return;
  const handled=new Set<number>(),com=body.worldCom(),position=body.translation();
  let move={x:pre.x/50,y:pre.y/50,z:pre.z/50},turn={x:preTurn.x/50,y:preTurn.y/50,z:preTurn.z/50},changed=0,otherImpact=false;
  type V={x:number;y:number;z:number};
  const toNative=(v:V):V=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:V):V=>({x:v.x,y:v.z,z:-v.y});
  for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   const owner=other.parent();if(!owner||other.isSensor()||owner.handle===body.handle||other.handle===this.sim.playerCollider.handle)return;
   this.sim.world.contactPair(collider,other,(manifold,flipped)=>{
    if(!manifold.numSolverContacts())return;
    const n=manifold.normal(),normal=flipped?{x:n.x,y:n.y,z:n.z}:{x:-n.x,y:-n.y,z:-n.z},point=manifold.solverContactPoint(0);
    if(!point)return;
    const closing=pre.x*normal.x+pre.y*normal.y+pre.z*normal.z<-1;
    const prop=this.propFor!(other);
    // One ApplyCollision per prop, even when several car colliders touch it.
    if(prop&&handled.has(owner.handle))return;
    // Uprooted props are ordinary moving bodies to the solver.
    if(prop&&!prop.state.destroyed&&owner.isDynamic()){if(closing)otherImpact=true;return;}
    if(!prop||prop.state.destroyed){if(closing)otherImpact=true;return;}
    handled.add(owner.handle);
    const offset={x:point.x-com.x,y:point.y-com.y,z:point.z-com.z};
    // Each ApplyCollision reads the move and turn speed left by the previous one's ApplyForce.
    const outcome=vehicleHitsObject({mass:this.mass,turnMass:this.turnMass,offset,normal,moveSpeed:move,turnSpeed:turn},prop.state,prop);
    if(outcome.separating)return;
    if(outcome.damage)prop.damaged({result:outcome.damage,damage:outcome.objectDamage!,point:{x:point.x,y:point.y,z:point.z},normal});
    if(outcome.damage?.removed){
     changed++;this.propsSmashed++;
     const dv=impulseVelocityChange(outcome.impulse!,offset,this.mass,this.turnMass);
     move={x:move.x+dv.move.x,y:move.y+dv.move.y,z:move.z+dv.move.z};turn={x:turn.x+dv.turn.x,y:turn.y+dv.turn.y,z:turn.z+dv.turn.z};
     return;
    }
    if(!outcome.uprooted){if(closing)otherImpact=true;return;}
    const objectAt=owner.translation(),zero={x:0,y:0,z:0};
    const result=vehicleUprootsObject(
     {mass:this.mass,turnMass:this.turnMass,elasticity:VEHICLE_ELASTICITY,offset:toNative(offset),moveSpeed:toNative(move),turnSpeed:toNative(turn),player:this.occupied,
      armFromPosition:toNative({x:point.x-position.x,y:point.y-position.y,z:point.z-position.z}),com:toNative({x:com.x-position.x,y:com.y-position.y,z:com.z-position.z})},
     {mass:prop.mass,turnMass:prop.turnMass,elasticity:prop.elasticity,offset:toNative({x:point.x-objectAt.x,y:point.y-objectAt.y,z:point.z-objectAt.z}),moveSpeed:zero,turnSpeed:zero},
     toNative(normal),outcome.intensity,prop.uprootLimit);
    const objectMove=fromNative(result.object.move),objectTurn=fromNative(result.object.turn);
    if(!prop.uproot({x:objectMove.x*50,y:objectMove.y*50,z:objectMove.z*50},{x:objectTurn.x*50,y:objectTurn.y*50,z:objectTurn.z*50}))return;
    changed++;this.propsUprooted++;
    move=fromNative(result.car.move);turn=fromNative(result.car.turn);
   });
  });}
  // A simultaneous wall or car impact keeps the solver's response this step.
  if(!changed||otherImpact)return;
  // Collision damage below then measures only the native impulse, as natively.
  body.setLinvel({x:move.x*50,y:move.y*50,z:move.z*50},true);body.setAngvel({x:turn.x*50,y:turn.y*50,z:turn.z*50},true);
 }
 /** Contact manifolds after the world step, reported once per touching collider pair. */
 private reportCollisions(){
  const body=this.car.body;if(!this.onCollision||!body.isEnabled())return;
  for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   if(other.isSensor()||other.handle===this.sim.playerCollider.handle||other.parent()?.handle===body.handle)return;
   this.sim.world.contactPair(collider,other,(manifold,flipped)=>{
    let impulse=0;for(let c=0;c<manifold.numContacts();c++)impulse+=manifold.contactImpulse(c);
    const point=manifold.numSolverContacts()?manifold.solverContactPoint(0):null;if(impulse<=0||!point)return;
    const n=manifold.normal(),normal=flipped?{x:n.x,y:n.y,z:n.z}:{x:-n.x,y:-n.y,z:-n.z},pre=this.stepVelocity;
    // ApplyCollision only runs for bodies closing on each other; resting contacts are not reported.
    if(pre&&pre.x*normal.x+pre.y*normal.y+pre.z*normal.z>=0)return;
    this.onCollision!({other,point:{x:point.x,y:point.y,z:point.z},normal,impulse:impulse/this.mass/50});
   });
  });}
 }
 afterStep(seconds=1/60){
  if(this.alpha<255&&!this.disposed){this.alpha=Math.min(255,this.alpha+16*seconds*60);this.car.setAlpha(this.alpha/255);}
  this.resolveProps();this.reportCollisions();this.countCollisions();this.collisionDamage();this.upsideDownDamage(seconds);this.processComponents(seconds);this.debris.step(seconds);this.debris.sync();
  if(!this.occupied)return;const p=this.car.body.translation(),q=this.car.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={x:p.x,y:p.y,z:p.z};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=Math.hypot(this.car.body.linvel().x,this.car.body.linvel().z);player.grounded=true;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});
 }
 setLighting(worldAmbient:readonly number[]|undefined,objectAmbient:readonly number[]|undefined,sunMultiplier:number,night:number){
  const contact=worldAmbient?nativeContactLightMultiplier(worldAmbient,nativeCarContactBrightness(this.collisionLighting,night)):1;
  this.car.setAmbient(objectAmbient,sunMultiplier*contact,contact);
  this.car.setLightState(this.input.pedals.brake>0||this.input.pedals.handbrake,night>0.5);
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.debris.dispose();this.car.dispose();}
}
