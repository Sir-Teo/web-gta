import {initialCarCollisionLighting,nativeCarContactBrightness} from './nativeCarContactLighting';
import {nativeContactLightMultiplier} from './nativeContactLighting';
import {NATIVE_CAR_WHEELS} from './nativeDriveContacts';
import {nativeSurfaceGrip,nativeWetGripByte} from './nativeSurfaceGrip';
import type {loadWorldRoadMaterials} from '../assets/worldRoadMaterials';
import RAPIER from '@dimforge/rapier3d-compat';
import {Vector3,type Scene} from 'three';
import type {Simulation} from './Simulation';
import {installNativeCar,type NativeCarAssets} from './installNativeCar';
import type {NativeRaycastPlayerInput} from './NativeRaycastVehicle';
import type {NativeCollisionSource} from './nativeCollision';
import {CAR_BURN_SECONDS,CAR_FIRE_HEALTH,COLLISION_COMPONENT,DAMSTATE,DOOR_FRAMES,PANEL_FRAMES,applyCollisionComponents,collisionHealthLoss,createCarDamage,type ComponentChange} from './nativeCarDamage';
import {DOOR,MODEL_FLAG,createCarDoors,type CarAxes,type Vec} from './nativeDoor';
import {NativeBouncingPanel} from './nativeBouncingPanel';
import {FLYING,FlyingComponents} from './flyingComponents';
import type {VehicleAnimGroupData} from '../assets/vehicleAnimGroups';
export interface TrafficControls {throttle:number;brake:number;steering:number;handbrake:boolean;}
/** handling.cfg `^ 0` (STDCARAMIMS) for cars loaded without their anim group rows. */
export const DEFAULT_VEHICLE_ANIM_GROUP:VehicleAnimGroupData={id:0,first:0,second:0,flags:0,special:0,times:{getIn:.5,jumpOut:0,getOut:-.5,jackedOut:-.3,fallOut:.3},openOut:[.41,.8],closeIn:[.3,.45],openIn:[.06,.43],closeOut:[.2,.43]};
type V3={x:number;y:number;z:number};
/** Browser (x, y up, z south) to native (x, y north, z up). */
const native=(v:V3):Vec=>[v.x,-v.z,v.y];
const rotate=(q:{x:number;y:number;z:number;w:number},v:V3)=>new Vector3(v.x,v.y,v.z).applyQuaternion(q as never);
/** Native car lifecycle in the streamed world. Entry and exit sequencing lives in CarEntry; `interact` is the direct seat warp. */
export class WorldCar {
 readonly car:ReturnType<typeof installNativeCar>;
 readonly modelId:number;
 readonly name:string;
 /** Native vehicle health: 1000, burning below 250, then CAutomobile::BlowUpCar after 5000 ms. */
 health=1000;
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
 private previousMotion?:{linear:V3;angular:V3};
 private damageIntensity=0;
 private panels:NativeBouncingPanel[]=[];
 private visual:Record<string,number>={};
 /** The player's car, used for native rammed-by-player damage divisors. */
 playerVehicle?:()=>WorldCar|undefined;
 occupied=false;
 trafficOrigin=false;
 autopilot?:TrafficControls;
 private latch=false;
 private collisionLighting=initialCarCollisionLighting();
 private lastRoad=new Map<string,{normal:{x:number;y:number;z:number};groundSpeed:{x:number;y:number;z:number}}>();
 private input:NativeRaycastPlayerInput;
 private sourceOwner?:ReadonlyMap<number,{source:NativeCollisionSource}>;
 private sources=new Map<number,NativeCollisionSource>();
 constructor(private sim:Simulation,scene:Scene,readonly assets:NativeCarAssets,position:{x:number;y:number;z:number},road:Awaited<ReturnType<typeof loadWorldRoadMaterials>>,heading=0){
  this.modelId=assets.vehicle.id;this.name=assets.vehicle.id===492?'Greenwood':assets.vehicle.model;
  this.car=installNativeCar(sim.world,scene,assets,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.4,restitution:0});
  const h=assets.handling.values;this.mass=h.mass;this.collisionDamageMultiplier=h.collisionDamageMultiplier;this.boundsMaxX=Math.max(.5,assets.collision.bounds.max[0]);
  this.modelFlags=h.modelFlags;this.animGroup=assets.animGroup??DEFAULT_VEHICLE_ANIM_GROUP;this.doors=createCarDoors(h.modelFlags,this.modelId);this.debris=new FlyingComponents(sim.world,scene);
  // CAutomobile::SetupModelNodes: cars without doors have every side door not present.
  if(h.modelFlags&MODEL_FLAG.noDoors){for(const door of [DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear])this.damageState.doors[door]=DAMSTATE.notPresent;this.refreshVisuals(true);}
  this.input={gravity:{applyGravity:true,disableMoveForce:false,usesCollision:true},airResistance:{},
   pedals:{accelerate:0,brake:0,automaticallyHandbrake:false,handbrake:true,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true},
   steering:{steeringAxis:0,mouseDeltaX:0,mouseThirdPerson:false,mouseSteeringEnabled:false,vehicleMouseLook:false},steeringControl:{playerStatus:true,tarmacAdhesion:1},
   suspension:{mode:'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2},
   tires:{velocityFrequency:1,playerControlled:true,vehicleGrip:{physicsStatus:false,perfectHandling:false,extraPerfectHandling:false,extraHandlingNitros:false,isPlayerVehicle:true,vortex:false,vortexAccelerationBrakeStatus:0},wheelParameters:{coastBrake:0,wheelDamageEffect:1,playerCollisions:false}},
   // Exact native collision material and adhesion matrix. DoBurstAndSoftGroundRatios sinks non-Rhino wheels on SAND surfaces
   // (less as CWeather::WetRoads rises), and the player's wet multiplier comes from the road's SURFINFO.DAT wet grip.
   resolveWheel:(wheel,contact)=>{
    const material=contact?.surface?.material??0,record=road.records.get(material);
    if(contact){this.lastRoad.set(wheel,{normal:{...contact.normal},groundSpeed:{...contact.groundSpeed}});this.audio.contactSurface=material;}
    return {ground:{status:'normal',sandGroup:record?.adhesionGroup==='SAND',railTrack:material===178,rhino:this.modelId===432,wetRoads:this.wetRoads,rotation:0,wheelSpeed:0},suspension:{forceLevel:h.suspensionForce,bias:wheel.startsWith('front')?h.suspensionBias:1-h.suspensionBias,damping:h.suspensionDamping},surface:nativeSurfaceGrip(material,road.records,road.rows,nativeWetGripByte(record?.wetGrip??0),this.wetRoads,{burst:false}),fallback:this.lastRoad.get(wheel)};
   }};
 }
 /** Weapon damage: health loss plus CAutomobile::VehicleDamage component progression for the hit COL piece.
  * CVehicle::InflictDamage is not reversed; bullets subtract their WEAPON.DAT damage directly. Returns true only when the car is wrecked. */
 damage(amount:number,collider?:number,explosive=false){
  if(this.wrecked)return false;
  // Bullets leave a destroyed car at 1 health to burn out; blasts that exhaust its health blow it up at once.
  this.health=Math.max(explosive?0:1,this.health-amount);
  const piece=collider===undefined?undefined:this.pieceOf(collider);
  if(piece!==undefined&&amount>25)this.applyComponents(applyCollisionComponents(this.damageState,piece,amount,this.mass,{localDir:0,dirDotRight:0},Math.random,true));
  if(this.health===0){this.blowUp();return true;}
  return false;
 }
 /** COL spheres and boxes carry the eVehicleCollisionComponent piece byte; mesh faces do not. */
 private pieceOf(handle:number){const source=this.car.sources.get(handle);return source&&source.kind!=='mesh'?source.surface.flags:undefined;}
 private axes():CarAxes{const q=this.car.body.rotation();return {right:native(rotate(q,{x:1,y:0,z:0})),forward:native(rotate(q,{x:0,y:0,z:-1})),up:native(rotate(q,{x:0,y:1,z:0}))};}
 /** Native component offset (car-space frame position) rotated into browser world axes. */
 private worldOffset(local:{x:number;y:number;z:number}){return rotate(this.car.body.rotation(),{x:local.x,y:local.z,z:-local.y});}
 private spawnFlying(frame:string,type:number){
  const source=this.car.cloneComponent(frame);if(!source)return;
  const q=this.car.body.rotation();
  this.debris.spawn(source,type,{position:this.car.body.translation(),velocity:this.car.body.linvel(),angularVelocity:this.car.body.angvel(),up:rotate(q,{x:0,y:1,z:0}),wrecked:this.wrecked,camera:this.camera?.()});
 }
 /** CAutomobile::SetBumperDamage/SetPanelDamage/SetDoorDamage visual responses to component state changes. */
 private applyComponents(changes:readonly (ComponentChange|true)[]){
  if(!changes.length)return;
  for(const change of changes){
   if(change===true)continue;
   if(change.kind==='panel'){
    const frame=PANEL_FRAMES[change.index],node=`${frame}_dummy`;
    if(change.state===DAMSTATE.damaged&&!(this.modelFlags&MODEL_FLAG.bouncePanels)&&this.car.hasFrame(node)&&!this.panels.some(p=>p.frame===node)&&this.panels.length<3){
     if(change.index>=5)this.panels.push(new NativeBouncingPanel(node,0,-.5+Math.random()*.3));
     else if(change.index!==4&&change.index>1)this.panels.push(new NativeBouncingPanel(node,1,-.5+Math.random()*.3));
    }
    if(change.state===DAMSTATE.openedDamaged&&(this.visual[frame]??0)!==DAMSTATE.openedDamaged)this.spawnFlying(node,change.index>=5?FLYING.bumper:FLYING.panel);
   }else if(change.kind==='door'){
    const door=this.doors[change.index],frame=DOOR_FRAMES[change.index];
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
 blowUp(){
  if(this.wrecked)return;this.wrecked=true;this.health=0;this.autopilot=undefined;this.pendingExplosion=true;
  const doors:ComponentChange[]=[];
  for(let i=0;i<this.damageState.doors.length;i++){if(this.damageState.doors[i]!==DAMSTATE.notPresent){this.damageState.doors[i]=DAMSTATE.notPresent;doors.push({kind:'door',index:i,state:DAMSTATE.notPresent});}}
  // FuckCarCompletely resets every panel status to OK afterwards, so bumper and panel atomics keep their earlier damage.
  for(let i=0;i<this.damageState.panels.length;i++)this.damageState.panels[i]=DAMSTATE.ok;
  this.applyComponents(doors);
  this.spawnFlying('wheel_lf_dummy',FLYING.wheel);
  this.car.setColors([[24,24,24],[24,24,24],[24,24,24],[24,24,24]]);
  const v=this.car.body.linvel();this.car.body.setLinvel({x:v.x,y:v.y+.13*50,z:v.z},true);
  if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.damagePlayer(this.sim.player.health);}
 }
 get onFire(){return !this.wrecked&&this.health<CAR_FIRE_HEALTH;}
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
 /** CVehicle::CanPedJumpOutCar for automobiles: 0.1 ≤ v2D² ≤ 0.5 when upright (or no recent collision), else v² ≥ 0.1. */
 canJumpOut(){const v=this.car.body.linvel(),s=1/50,v2=(v.x*v.x+v.z*v.z)*s*s,up=rotate(this.car.body.rotation(),{x:0,y:1,z:0});return up.y>.3?v2>=.1&&v2<=.5:v2+v.y*v.y*s*s>=.1;}
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
 setPedInAsDriver(){this.autopilot=undefined;this.driverless=false;this.holdForEntry=false;this.sim.setCrouched(false);this.occupied=true;this.driverInput=true;this.exitHandbrake=false;this.sim.cameraExcludedBody=this.car.body;this.sim.playerCollider.setEnabled(false);}
 /** CTaskSimpleCarSetPedOut: the driver leaves the seat and stands at `foot`. */
 setPedOut(foot:V3,heading=this.sim.player.heading){
  this.occupied=false;this.driverInput=true;this.exitHandbrake=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);
  const center={...foot,y:foot.y+.9};this.sim.player.position={...foot};this.sim.player.previous={...foot};this.sim.player.heading=heading;
  this.sim.playerBody.setTranslation(center,true);this.sim.playerBody.setNextKinematicTranslation(center);this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;
 }
 beforeStep(seconds:number,axes:{x:number;y:number},handbrake:boolean,sources?:ReadonlyMap<number,{source:NativeCollisionSource}>){
  if(sources!==this.sourceOwner){this.sourceOwner=sources;this.sources=new Map([...(sources??[])].map(([id,value])=>[id,value.source]));}
  const nearby=this.occupied||this.distance()<this.activeRadius;this.car.body.setEnabled(nearby);this.car.root.visible=nearby;if(!nearby)return;
  const driving=this.occupied&&this.driverInput;
  // CEntity::TreatAsPlayerForCollisions (STATUS_PLAYER): wet grip, suspension load and off-road adhesion apply to the player's car only.
  this.input.tires.wheelParameters.playerCollisions=this.occupied;
  const p=this.input.pedals,ai=this.occupied?undefined:this.autopilot;p.accelerate=driving?(axes.y>0?255:0):Math.round((ai?.throttle??0)*255);p.brake=driving?(axes.y<0?255:0):Math.round((ai?.brake??0)*255);
  p.handbrake=this.occupied?(driving&&handbrake)||this.exitHandbrake:ai?.handbrake??!this.driverless;this.input.steering.steeringAxis=driving?axes.x*128:Math.round((ai?.steering??0)*128);
  if(this.wrecked){p.accelerate=0;p.brake=255;p.handbrake=true;}
  // CAutomobile::ProcessCarOnFireAndExplode for ordinary cars.
  if(this.onFire){this.burnTimer+=seconds;if(this.burnTimer>CAR_BURN_SECONDS)this.blowUp();}else this.burnTimer=0;
  const result=this.car.stepPlayer(seconds,this.input,this.latch,{sources:this.sources,filter:c=>c.handle!==this.sim.playerCollider.handle});this.latch=result.alreadySkidding;
  this.steerAngle=result.steeringInput.angle;this.gasPedal=result.pedals.gas;this.gear=result.state.drivetrain.transmission.gear;
  this.updateAudioState(seconds*50,result.state.drivetrain.contacts,result.state.wheels,result.pedals);
  for(const wheel of NATIVE_CAR_WHEELS){const lighting=result.sampled.geometry[wheel]?.surface?.light;if(lighting!==undefined)this.collisionLighting[wheel]=lighting;}
  this.stepVelocity={...this.car.body.linvel()};
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
 /** CWeather::WetRoads. */
 wetRoads=0;
 /** A car abandoned by a jump-out keeps rolling: STATUS_ABANDONED has no handbrake. */
 driverless=false;
 /** PrepareVehicleForPedEnter: the NPC driver stops while someone lines up with the car. */
 holdForEntry=false;
 /** The NPC driver was dragged out or left; the car keeps no autopilot. */
 driverOut=false;
 /** Collision damage from the velocity change the contact solver applied during the world step (native impulse = mass × Δv per 50 Hz step). */
 private collisionDamage(){
  const before=this.stepVelocity;this.stepVelocity=undefined;this.damageIntensity=0;if(!before||this.wrecked||!this.car.body.isEnabled())return;
  const v=this.car.body.linvel(),dv={x:v.x-before.x,y:v.y-before.y,z:v.z-before.z},change=Math.hypot(dv.x,dv.y,dv.z),intensity=this.mass*change/50;
  if(intensity<=this.mass/1500*25)return;
  const q=this.car.body.rotation(),up={x:2*(q.x*q.y-q.w*q.z),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.w*q.x)},right={x:1-2*(q.y*q.y+q.z*q.z),y:2*(q.x*q.y+q.w*q.z),z:2*(q.x*q.z-q.w*q.y)};
  let piece:number=COLLISION_COMPONENT.default,point:{x:number;y:number;z:number}|undefined,building=true,rammedByPlayer=false;
  const player=this.playerVehicle?.();
  for(let i=0;i<this.car.body.numColliders();i++){const collider=this.car.body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   if(other.isSensor()||other.handle===this.sim.playerCollider.handle)return;const parent=other.parent();
   let touching=false;this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)touching=true;});if(!touching)return;
   if(parent&&!parent.isFixed()){building=false;if(player&&player!==this&&parent.handle===player.car.body.handle)rammedByPlayer=true;}
   const flags=this.pieceOf(collider.handle);if(flags!==undefined&&flags!==COLLISION_COMPONENT.default||!point){piece=flags??piece;point={...collider.translation()};}
  });}
  if(!point)return;
  // Hits from below by buildings (ground) do not damage: DotProduct(direction, up) > 0.6.
  const direction={x:dv.x/change,y:dv.y/change,z:dv.z/change};
  if(building&&direction.x*up.x+direction.y*up.y+direction.z*up.z>.6)return;
  this.damageIntensity=intensity;
  const p=this.car.body.translation(),localDir=((point.x-p.x)*right.x+(point.y-p.y)*right.y+(point.z-p.z)*right.z)/this.boundsMaxX,dirDotRight=direction.x*right.x+direction.y*right.y+direction.z*right.z;
  if(up.y>0||change>.3*50)this.applyComponents(applyCollisionComponents(this.damageState,piece,intensity,this.mass,{localDir,dirDotRight},Math.random));
  this.health=Math.max(0,this.health-collisionHealthLoss({intensity,mass:this.mass,collisionDamageMultiplier:this.collisionDamageMultiplier,playerVehicle:this.occupied,hitByPlayerVehicle:rammedByPlayer}));
  // CAutomobile::VehicleDamage keeps a crash-killed car at 1 health so it burns before exploding.
  if(this.health<=0)this.health=1;
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
   if(closedStatus&&(this.damageIntensity<=100||i===DOOR.bonnet))continue;
   const delta=pointDelta(this.worldOffset(position));
   if(closedStatus&&door.processImpact(delta,axes,Math.random))this.setDoorOpen(i);
   if(!(this.damageState.doors[i]===DAMSTATE.opened||this.damageState.doors[i]===DAMSTATE.openedDamaged))continue;
   if(i===DOOR.bonnet&&(door.dirn&0x0f)===1)door.angVel+=Math.sin(door.angle+.1)*.05*forwardSpeed*timeStep;
   if(door.process(delta,axes,timeStep)){this.setDoorClosed(i);this.onDoorEvent?.('close',i);}
   this.car.setDoorAngle(i,door.axis,door.angle);
   // A bonnet that hits its open stop while the car moves forward faster than 0.4 units/frame tears off.
   if(i===DOOR.bonnet&&door.hitOpenStop&&forwardSpeed>.4){this.damageState.doors[i]=DAMSTATE.notPresent;this.applyComponents([{kind:'door',index:i,state:DAMSTATE.notPresent}]);}
  }
  for(const panel of this.panels){
   const position=this.car.nativeFramePosition(panel.frame);if(!position)continue;
   const delta=pointDelta(this.worldOffset(position)),local:Vec=[delta[0]*axes.right[0]+delta[1]*axes.right[1]+delta[2]*axes.right[2],delta[0]*axes.forward[0]+delta[1]*axes.forward[1]+delta[2]*axes.forward[2],delta[0]*axes.up[0]+delta[1]*axes.up[1]+delta[2]*axes.up[2]];
   this.car.setFrameBasis(panel.frame,panel.process(local,timeStep));
  }
 }
 /** CPhysical::m_nNumEntitiesCollided: entities this car touched during the last step, wheels included. */
 entitiesCollided=0;
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
  this.reportCollisions();this.countCollisions();this.collisionDamage();this.processComponents(seconds);this.debris.step(seconds);this.debris.sync();
  if(!this.occupied)return;const p=this.car.body.translation(),q=this.car.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={x:p.x,y:p.y,z:p.z};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=Math.hypot(this.car.body.linvel().x,this.car.body.linvel().z);player.grounded=true;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});
 }
 setLighting(worldAmbient:readonly number[]|undefined,objectAmbient:readonly number[]|undefined,sunMultiplier:number,night:number){
  const contact=worldAmbient?nativeContactLightMultiplier(worldAmbient,nativeCarContactBrightness(this.collisionLighting,night)):1;
  this.car.setAmbient(objectAmbient,sunMultiplier*contact,contact);
 }
 dispose(){this.debris.dispose();this.car.dispose();}
}
