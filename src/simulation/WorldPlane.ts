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
import {hoverFlight} from '../flight/aero';
import {planeFlight,type PlaneControls} from '../flight/aero';
import {requireAsset} from '../assets/binary';
import {stepPlaneWheelRoll,type PlaneWheelRoll} from './planeWheelRoll';
import {applyNativeBuoyancy,nativeBuoyancySplashEdges,nativeSplashParticles,type NativeBuoyancyBody,type NativeVec} from './nativeBuoyancy';
import type {NativeAnimation} from '../assets/ifp';
import {vehicleAnimation,VEHICLE_ANIM,type VehicleAnimGroupData} from '../assets/vehicleAnimGroups';
export const PLAYABLE_PLANES:Readonly<Record<number,string>>={476:'Rustler',511:'Beagle',512:'Cropduster',513:'Stuntplane',519:'Shamal',553:'Nevada',593:'Dodo',417:'Leviathan',425:'Hunter',447:'Seasparrow',469:'Sparrow',487:'Maverick',488:'News Maverick',497:'Police Maverick',548:'Cargobob',563:'Raindance',520:'Hydra'};
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
/** CVehicle::HeightAboveCeiling (0x6D2600): metres above the flight ceiling, or -1 below it. The RC Baron's ceiling
 * is 500 m with a band between 950 and 1500 m; everything else ceils at 800 m. `height` is the world height. */
export function heightAboveCeiling(height:number,model:'baron'|'aircraft'){
 if(model==='baron'){if(height>=500&&height<950)return height-500;if(height>=1500)return height-1000+500;return -1;}
 return height<800?-1:height-800;
}
/** A helicopter's rotor speed at full throttle (CAEVehicleAudioEntity divides the native rotor speed by 0.22). */
const HELI_MAX_ROTOR_SPEED=.22;
/** How fast a helicopter's rotor spins up while its engine runs and winds down after, per second: authored, since
 * CHeli::ProcessControl is unreversed (the slow-rotor branch in FlyingControl implies a rotor that winds down). */
const HELI_ROTOR_SPIN_UP=.1,HELI_ROTOR_SPIN_DOWN=.04;
export class WorldPlane {
 readonly body:RAPIER.RigidBody;readonly root=new Group();
 /** CCustomCarEnvMapPipeline's reflection state (every vehicle model uses the car pipeline). */
 readonly reflection=new NativeCarReflection();readonly name:string;readonly modelId:number;
 /** CVehicle's constructor: every vehicle starts at 1000 health. */
 health=1000;vtol=true;
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
 damage(amount:number){if(this.health<=0)return false;this.health=Math.max(0,this.health-amount);if(this.health===0){this.throttle=0;if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.vehicleOccupantDied();}return true;}return false;}
 toggleVtol(){if(this.modelId!==520)return '';this.vtol=!this.vtol;return this.vtol?'Hydra: vertical lift':'Hydra: forward flight';}
 /** physicalFlags.bMakeMassTwiceAsBig (SET_CAR_HEAVY): the water's drag ×1.5. */
 heavy=false;
 /** CHeli::m_fHeliRotorSpeed, 0 to 0.22: the dust, the water gates and the rotor sound read it. */
 rotorSpeed=0;
 occupied=false;gearUp=false;throttle=0;grounded=true;stall=false;airspeed=0;altitude=0;
 /** Scripted collective/cyclic input while no player sits aboard (police pursuit). */
 autopilot?:PlaneControls;
 /** Law-enforcement air unit: the fleet never retires it as ambient traffic. */
 policeHeli=false;
 private physical:ReturnType<typeof installNativeVehicleBody>;private handling:ReturnType<typeof prepareHandling>;
 /** Native-coordinate water height query (WATER.DAT). */
 waterLevel?:(x:number,y:number)=>number|undefined;
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
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,this.handling,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.05,restitution:0});this.body=this.physical.body;this.car={body:this.body};
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
    this.wheels.push(sim.world.createCollider(RAPIER.ColliderDesc.ball(radius).setTranslation(p.x,p.y,p.z).setDensity(0).setFriction(.02).setRestitution(0),this.body));
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
 toggleGear(){if(!this.retractableGear)return 'This aircraft has fixed landing gear.';if(this.grounded)return 'Take off before retracting the landing gear.';this.gearUp=!this.gearUp;for(const c of this.wheels)c.setEnabled(!this.gearUp);return `Landing gear ${this.gearUp?'up':'down'}`;}
 beforeStep(dt:number,input:{throttle:number;pitch:number;roll:number;rudder:number;brake:boolean}){
  const nearby=this.occupied||this.distance()<250;this.body.setEnabled(nearby);this.root.visible=nearby;if(!nearby)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};this.stepDt=dt;
  const p=this.body.translation(),hit=this.sim.world.castRay(new RAPIER.Ray(p,{x:0,y:-1,z:0}),3000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  this.altitude=hit?hit.timeOfImpact:Math.max(0,p.y);const clearance=Math.max(1.5,-this.assets.collision!.bounds.min[2]+.8);this.grounded=!!hit&&hit.timeOfImpact<clearance;
   const auto=!this.occupied&&this.health>0?this.autopilot:undefined;
   if(auto)this.throttle=Math.max(0,Math.min(1,auto.throttle));
   else if(this.occupied&&this.health>0&&!(this.drowning&&this.water.buoyancy<this.handling.values.mass/125))this.throttle=Math.max(0,Math.min(1,this.throttle+input.throttle*dt*.4));else this.throttle=0;
   // CHeli::m_fHeliRotorSpeed runs on its own: up to 0.22 while the engine runs, whatever the collective. A heli the
   // game flies itself was made already flying, with its rotor at speed.
   if(this.helicopter){
    const running=this.health>0&&(!!auto||this.occupied&&!(this.drowning&&this.water.buoyancy<this.handling.values.mass/125));
    this.rotorSpeed=auto?HELI_MAX_ROTOR_SPEED:running?Math.min(HELI_MAX_ROTOR_SPEED,this.rotorSpeed+HELI_ROTOR_SPIN_UP*dt):Math.max(0,this.rotorSpeed-HELI_ROTOR_SPIN_DOWN*dt);
   }
   this.inputs={throttle:this.throttle,pitch:this.occupied?input.pitch:auto?.pitch??0,roll:this.occupied?input.roll:auto?.roll??0,rudder:this.occupied?input.rudder:auto?.rudder??0,brake:auto?auto.brake:!this.occupied||input.brake};
  // CVehicle::HeightAboveCeiling (gta-reversed ead3051): the flight ceiling is 800 m for planes and helicopters
  // (500 m for the RC Baron); FlyingControl's response above it is a retail stub, so this is authored from play:
  // the nose is held down and the aircraft is pushed down harder the further above the ceiling it is.
  const above=heightAboveCeiling(this.body.translation().y,this.modelId===464?'baron':'aircraft');
  if(above>0&&!this.helicopter)this.inputs={...this.inputs,pitch:Math.min(this.inputs.pitch,-.5)};
  const result=this.helicopter||this.modelId===520&&this.vtol?hoverFlight(this.body.linvel(),this.body.rotation(),{...this.inputs,brake:this.occupied&&input.brake},this.helicopter?this.rotorSpeed/HELI_MAX_ROTOR_SPEED:1):planeFlight(this.body.linvel(),this.body.rotation(),this.inputs,this.assets.flyingHandling!,this.gearUp,this.grounded);this.airspeed=result.speed;this.stall=result.stall;
  const forwardSpeed=-new Vector3().copy(this.body.linvel()).applyQuaternion(new Quaternion().copy(this.body.rotation()).invert()).z;
  for(const wheel of this.rollingWheels){wheel.previous=wheel.roll.angle;wheel.roll=stepPlaneWheelRoll(wheel.roll,forwardSpeed,wheel.radius,this.grounded&&!this.gearUp,dt);}
  let ay=result.acceleration.y;
  if(above>0){ay-=9.81*Math.min(3,above/40);const vy=this.body.linvel().y;if(vy>0)ay-=vy/Math.max(dt,1e-3)*.5;}
  const v=this.body.linvel();this.body.setLinvel({x:v.x+result.acceleration.x*dt,y:v.y+ay*dt,z:v.z+result.acceleration.z*dt},true);
  this.impactVelocity.copy(this.body.linvel());
  this.body.setAngvel(result.angular,true);this.propAngle=(this.propAngle+dt*(this.helicopter?this.rotorSpeed/HELI_MAX_ROTOR_SPEED*95:5+this.throttle*90))%(Math.PI*2);
  this.floatOnWater(dt);
 }
 /** CAutomobile::ProcessBuoyancy for aircraft over WATER.DAT surfaces. Browser flight gravity is 9.81 m/s²
  * against native 0.008 per 50 Hz step (20 m/s²), so buoyancy force is scaled to keep native immersion. */
 private floatOnWater(dt:number){
  const level=this.waterLevel;if(!level){this.inWater=this.drowning=false;return;}
  const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation()),v=this.body.linvel(),w=this.body.angvel(),h=this.handling.values;
  const native=(x:number,y:number,z:number):NativeVec=>[x,-z,y],axis=(x:number,y:number,z:number)=>{const a=new Vector3(x,y,z).applyQuaternion(q);return native(a.x,a.y,a.z);};
  const b=this.assets.collision!.bounds;
  const state:NativeBuoyancyBody={position:native(p.x,p.y,p.z),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:[...b.min] as NativeVec,boundsMax:[...b.max] as NativeVec,modelId:this.modelId,heli:this.helicopter,plane:!this.helicopter,touchingWater:this.water.touching,mass:h.mass,turnMass:h.turnMass,centerOfMass:[h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ],heavy:this.heavy,buoyancyConstant:this.water.buoyancy,moveSpeed:native(v.x/50,v.y/50,v.z/50),turnSpeed:native(w.x/50,w.y/50,w.z/50)};
  const rotor:Parameters<typeof applyNativeBuoyancy>[3]={rotorSpeed:this.helicopter?this.rotorSpeed:0,initialBuoyancy:this.handling.buoyancy},moveSpeed=[...state.moveSpeed] as NativeVec;
  const result=applyNativeBuoyancy(state,level,dt*50,rotor,9.81/20);
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
 afterStep(){let destroyed=this.pendingExplosion;this.pendingExplosion=false;
  if(!this.occupied)this.exitPending=false;
  else if(this.exitPending&&this.leaveMode()==='wait')this.slowForExit(this.stepDt);
  const change=new Vector3().copy(this.body.linvel()).sub(this.impactVelocity).length();
  if(this.health>0&&change>12){let contact=false;for(let i=0;i<this.body.numColliders();i++)this.sim.world.contactPairsWith(this.body.collider(i),c=>{if(!c.parent()||c.parent()!.isFixed())contact=true;});if(contact)destroyed=this.damage((change-10)*45);}
  // CAutomobile::ProcessControl's crash-and-burn: the player's plane or helicopter burning (under 250 health, where its
  // fire starts) whose fire started in the air (m_fireParticleCounter 2) blows up at once when it strikes something
  // rising or is down, unless it is still sinking.
  if(!destroyed)destroyed=this.burn(this.stepDt);
  if(!destroyed&&this.occupied&&this.health>0&&this.health<250&&this.fireCounter===2){
   let contact=false;for(let i=0;i<this.body.numColliders();i++)this.sim.world.contactPairsWith(this.body.collider(i),c=>{if(!c.parent()||c.parent()!.isFixed())contact=true;});
   const v=this.body.linvel(),rising=contact&&v.y-this.impactVelocity.y>0;
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
  this.reflection.state.enabled.value=!(this as {wrecked?:boolean}).wrecked;
  const mean=rgb?(rgb[0]+rgb[1]+rgb[2])/3:.5;
  this.reflection.update(Math.min(1.05,(mean+.5)*.95+.05),this.body.translation(),this.body.rotation());
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(this.reflection)this.updateReflection(rgb);if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual.setNight(night);}
 snapshot(){return {inWater:this.inWater,drowning:this.drowning,health:this.health,vtol:this.modelId===520?this.vtol:null,helicopter:this.helicopter,modelId:this.modelId,name:this.name,occupied:this.occupied,gearUp:this.gearUp,throttle:this.throttle,grounded:this.grounded,stall:this.stall,airspeed:this.airspeed,altitude:this.altitude,position:{...this.body.translation()},rotation:{...this.body.rotation()},velocity:{...this.body.linvel()}};}
 /** What the script's vehicle host reads of any vehicle: the body under `car`, the heading as WorldCar's (the
  * body's yaw turned half round), and whether it has gone. */
 readonly car:{body:RAPIER.RigidBody};disposed=false;
 /** A script's vehicle (CVehicle's MISSION_VEHICLE creation): the population never removes it; the script lets it go. */
 missionCar=false;
 /** CVehicle::bConsideredByPlayer, which SET_VEHICLE_IS_CONSIDERED_BY_PLAYER clears: the player's enter search passes it over. */
 consideredByPlayer=true;
 heading(){const q=this.body.rotation();return Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));}
 dispose(){this.disposed=true;this.root.removeFromParent();this.visual.dispose();this.physical.dispose();}
}
