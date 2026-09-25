import {bindNativeCarDirt} from '../render/nativeCarDirt';
import {NativeCarReflection} from '../assets/nativeCarEnvMap';
import {randomSeed} from './nativeVehicleLights';
import {bindNativeCarPaint,type NativeCarColors} from '../render/nativeCarPaint';
import RAPIER from '@dimforge/rapier3d-compat';
import {NativeDrivingAnims} from './nativeDrivingAnims';
import {vehicleDestroyed} from './vehicleDestroyed';
import {boatDriverNeedsBreath} from './playerBreath';
import {Group,Quaternion,Vector3,type Scene} from 'three';
import type {Simulation} from './Simulation';
import type {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {readBoatHandling,type BoatHandlingData} from '../assets/boatHandling';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {nativeEnvCoefficients} from '../assets/nativeEnvMap';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {prepareHandling} from './nativeHandling';
import {interpolateVehiclePose} from '../render/vehiclePose';
import {requireAsset} from '../assets/binary';
import {addWakePoint,applyNativeBoatBuoyancy,createWakeTrail,pruneWakeTrail,nativeBuoyancySplashEdges,nativeSplashParticles,type NativeBoatBody,type NativeVec} from './nativeBuoyancy';
import {nativeBoatDrive} from '../flight/aero';
export const PLAYABLE_BOATS:Readonly<Record<number,string>>={430:'Predator',446:'Squalo',452:'Speeder',453:'Reefer',454:'Tropic',472:'Coastguard',473:'Dinghy',484:'Marquis',493:'Jetmax',595:'Launch'};
type Assets=Awaited<ReturnType<Awaited<ReturnType<typeof openStaticWorldVehicles>>['load']>>;
/** Drivable hulls over WATER.DAT. Buoyancy, wake trail, spray, drive forces,
 * seated driver pose, engine audio speed and swim-push boarding follow the
 * reversed boat sources; entry clips arrive with the animation set. */
export class WorldBoat {
 readonly body:RAPIER.RigidBody;readonly root=new Group();
 /** CCustomCarEnvMapPipeline's reflection state (every vehicle model uses the car pipeline). */
 readonly reflection=new NativeCarReflection();readonly name:string;readonly modelId:number;
 readonly boatHandling:BoatHandlingData;
 /** Native-coordinate water height query (WATER.DAT). */
 waterLevel?:(x:number,y:number)=>number|undefined;
 /** bTouchingWater, which CBoat's constructor sets and nothing clears, and m_fBuoyancyConstant. */
 private water={touching:true,buoyancy:0};inWater=false;immersion=0;
 private physical:ReturnType<typeof installNativeVehicleBody>;
 private handling:ReturnType<typeof prepareHandling>;
 private visual:ReturnType<typeof modelObject>|undefined;private ambient=nativeAmbientState();
 /** Stern wake trail (PruneWakeTrail/AddWakePoint) and buoyancy spray for FX/audio. */
 readonly wake=createWakeTrail();
 readonly splashes:{position:NativeVec;velocity:NativeVec}[]=[];splashReport?:NativeVec;private splashClock=0;
 /** Native hull health: 1000, burning below 250, then BlowUpCar after 5000 ms. */
 health=1000;burnTimer=0;wrecked=false;
 /** Set by BlowUpCar until the weapon system spawns its explosion. */
 pendingExplosion=false;
 /** Seated driver pose clip and engine speed for audio. */
 driverPose='car_sit';engine01=0;
 /** The ped_frontseat dummy in native model space, mirrored to the driver's side (GetSeatPositionInVehicle). */
 seat(){const frame=this.assets.model?.frames.find(f=>f.name.toLowerCase()==='ped_frontseat');return frame?{x:-Math.abs(frame.matrix[12]),y:frame.matrix[13],z:frame.matrix[14]}:undefined;}
 /** Handling's model flags (m_bSitInBoat is 0x400). */
 get modelFlags(){return this.assets.handling.values.modelFlags??0;}
 /** The driver's steering and look-back clips (ProcessDrivingAnims). */
 readonly driving=new NativeDrivingAnims();
 private stepVelocity?:{x:number;y:number;z:number};
 /** Weapon damage: bullets subtract directly; returns true only when wrecked. */
 damage(amount:number){
  if(this.wrecked)return false;
  this.health=Math.max(0,this.health-amount);
  if(this.health===0){this.blowUp();return true;}
  return false;
 }
 /** CBoat::BlowUpCar: the hull is scorched and thrown up 0.13 units a frame, and the occupant is killed with it. */
 blowUp(){
  if(this.wrecked)return;this.wrecked=true;this.health=0;this.pendingExplosion=true;vehicleDestroyed.report?.('boat',this.modelId);
  const v=this.body.linvel();this.body.setLinvel({x:v.x,y:v.y+.13*50,z:v.z},true);
  this.scorch();
  if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.vehicleOccupantDied();}
 }
 get onFire(){return !this.wrecked&&this.health<250;}
 /** Burn anchor (per-model fire dummy): the engine/exhaust frame, else the stern deck. */
 fireDummy():{x:number;y:number;z:number}{
  const dummy=this.assets.model?.frames.find(f=>/^(engine|exhaust)/i.test(f.name));
  if(dummy)return {x:dummy.matrix[12],y:dummy.matrix[13],z:dummy.matrix[14]};
  const b=this.assets.collision!.bounds;
  return {x:0,y:b.min[1]*0.7,z:b.max[2]*0.5};
 }
 private previous:{x:number;y:number;z:number};private previousRotation:RAPIER.Rotation;
 /** `colors`: CVehicleModelInfo::ChooseVehicleColour's paint for the hull's colour-coded materials, as for any vehicle. */
 constructor(private sim:Simulation,scene:Scene,readonly assets:Assets,position:{x:number;y:number;z:number},heading=0,colors?:NativeCarColors){
  requireAsset(PLAYABLE_BOATS[assets.vehicle.id]&&assets.collision,'Unresolved boat resources.');
  const boat=readBoatHandling(assets.supplements).get(assets.vehicle.handling);
  requireAsset(boat,`Unresolved boat handling: ${assets.vehicle.handling}.`);
  this.boatHandling=boat!;
  this.modelId=assets.vehicle.id;this.name=PLAYABLE_BOATS[this.modelId];
  // The table index only feeds unused gear/speed outputs for hulls (no drivetrain).
  this.handling=prepareHandling(assets.handling,0);this.water.buoyancy=this.handling.buoyancy;
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,this.handling,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.05,restitution:0});this.body=this.physical.body;
  if(assets.model&&!assets.missingTextures.length){
   try{this.visual=modelObject(assets.model,assets.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient,carEnv:this.reflection.state});bindNativeCarDirt(this.visual.materialBindings).setLevel(randomSeed()%15);if(colors)bindNativeCarPaint(this.visual.materialBindings,assets.textures.find(t=>t.name==='vehiclelights128')).setColors(colors);this.root.add(this.visual.root);}catch{this.visual=undefined;}
  }
  scene.add(this.root);
  this.previous={...position};this.previousRotation={...this.body.rotation()};this.update(1);
 }
 distance(){const p=this.sim.player.position,b=this.body.translation();return Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z);}
 /** '' when the player may board, otherwise the refusal reason. */
 enterCheck(){
  if(this.sim.player.health<=0)return '';
  if(this.wrecked)return 'This boat is destroyed.';
  if(this.distance()>Math.max(5,this.assets.collision!.bounds.radius))return `Move closer to the ${this.name}.`;
  return '';
 }
 /** '' when the player may disembark, otherwise the refusal reason. Deep-water
  * exits put the player overboard swimming (CTaskComplexInWater engages). */
 exitCheck(){
  if(this.sim.player.health<=0)return '';
  // CVehicle::CanPedStepOutCar: a boat can be left at any speed unless it lies on its side (|up.z| ≤ 0.1), when the
  // ordinary still-car limits apply.
  const v=this.body.linvel(),w=this.body.angvel(),s=1/50,q=this.body.rotation(),upY=1-2*(q.x*q.x+q.z*q.z);
  if(Math.abs(upY)<=.1&&(Math.hypot(v.x,v.z)*s>.01||Math.abs(v.y)*s>.05||(w.x*w.x+w.y*w.y+w.z*w.z)*s*s>.0004))return 'Wait for the boat to settle before leaving it.';
  return '';
 }
 /** Clear disembark spot beside the hull, or null when both sides are blocked. */
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
 /** Boarding warp with the seated driver pose (no boat entry clips exist in the archive). */
 finishEnter(){
  this.sim.setCrouched(false);this.occupied=true;this.driverPose='car_sit';this.driving.reset();this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S throttle · A/D steer · Space brake · F exit`;
 }
 finishExit(foot?:{x:number;y:number;z:number}){
  const spot=foot??this.exitFoot();
  this.occupied=false;this.throttle=0;this.steer=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);
  if(spot){this.sim.player.position=spot;this.sim.player.previous={...spot};this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});this.sim.playerCollider.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z});return 'On foot';}
  // No ground beside the hull: overboard into the water (swim engages on the next step).
  const p=this.body.translation(),level=this.waterLevel?.(p.x,-p.z);
  if(level===undefined)return 'No clear ground beside the boat.';
  const q=new Quaternion().copy(this.body.rotation()),side=new Vector3(this.assets.collision!.bounds.max[0]+1.2,0,0).applyQuaternion(q);
  const over={x:p.x+side.x,y:level-0.8,z:p.z+side.z};
  this.sim.player.position=over;this.sim.player.previous={...over};this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=false;
  this.sim.playerBody.setTranslation({x:over.x,y:over.y+.9,z:over.z},true);this.sim.playerBody.setNextKinematicTranslation({x:over.x,y:over.y+.9,z:over.z});this.sim.playerCollider.setTranslation({x:over.x,y:over.y+.9,z:over.z});
  return 'Swimming';
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
 /** CBoat::ProcessControl buoyancy section for a drifting hull (no throttle yet):
  * native float, browser gravity, stern wake points and bow spray. */
 beforeStep(dt:number,input:{throttle:number;steer:number;brake:boolean}={throttle:0,steer:0,brake:false}){
  const nearby=this.distance()<250;this.body.setEnabled(nearby);this.root.visible=nearby;if(!nearby)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};
  this.throttle=input.throttle;this.steer=input.steer;this.brake=input.brake;
  if(this.wrecked){this.throttle=0;}
  this.controlInputs(dt);
  // CBoat::ProcessControl: a scorched hull loses buoyancy each frame until it is down to 80% of its weight and sinks.
  // The loss is per game frame (30 fps), not scaled by the timestep.
  if(this.wrecked){const mass=this.handling.values.mass,floor=mass*.008*100/125;if(floor<this.water.buoyancy)this.water.buoyancy=Math.max(floor,this.water.buoyancy-mass*.001*.008*dt*30);}
  // CBoat::ProcessControl fire section: below 250 health the hull burns out after 5 s.
  if(this.onFire){this.burnTimer+=dt;if(this.burnTimer>5)this.blowUp();}else this.burnTimer=0;
  this.floatOnWater(dt);
  this.stepVelocity={...this.body.linvel()};
  pruneWakeTrail(this.wake,dt*50);
  const v=this.body.linvel(),speed=Math.hypot(v.x,v.z)/50;
  this.engine01=Math.min(1,Math.abs(this.throttle)*0.7+Math.min(1,speed/20)*0.3);
  // ProcessBoatControl: upright enough (up.z > −0.6), on the water, and moving over 0.05 a frame in 2D, which the gas
  // pedal past 0.05 stands in for; the wake takes the 3D speed, and a boat not the player's keeps 15 points.
  {const q=this.body.rotation(),upZ=1-2*(q.x*q.x+q.z*q.z),move=Math.abs(this.gasPedal)>.05?1:speed;
   if(upZ>-.6&&this.onWater&&move>.05){const p=this.body.translation();addWakePoint(this.wake,{x:p.x,y:-p.z},Math.hypot(v.x,v.y,v.z)/50,this.occupied?31:15);}}
 }
 occupied=false;throttle=0;steer=0;brake=false;waveVolume=0;
 /** bOnWater from the last ProcessBoatControl. */
 private onWater=false;
 /** m_GasPedal, m_BrakePedal, m_fRawSteerAngle and m_fSteerAngle as CBoat::ProcessControlInputs keeps them. */
 gasPedal=0;brakePedal=0;rawSteer=0;steerAngle=0;
 /** CBoat::ProcessControlInputs (0x6F0A10): the brake pedal eases toward the pad's brake a tenth a frame and, once
  * past 0.05, reverses at 0.3 of it; the steering eases toward the negated stick at 0.2 a step, and the lock is the
  * handling's, applied to the signed square. Keyboard steering (the mouse branch is not modelled). */
 private controlInputs(dt:number){
  const accelerate=this.occupied?Math.max(0,this.throttle):0,brake=this.occupied?Math.max(0,-this.throttle):0,steer=this.occupied?this.steer:0;
  // ProcessControlInputs eases the brake a tenth of the way once a game frame (30 fps), unscaled.
  this.brakePedal=Math.max(0,Math.min(1,this.brakePedal+(brake-this.brakePedal)*(1-Math.pow(.9,dt*30))));
  if(this.brakePedal>=.05)this.gasPedal=this.brakePedal*-.3;else{this.brakePedal=0;this.gasPedal=accelerate;}
  this.rawSteer=Math.max(-1,Math.min(1,this.rawSteer+(-steer-this.rawSteer)*.2*dt*50));
  this.steerAngle=this.handling.values.steeringLock*Math.PI/180*Math.sign(this.rawSteer)*this.rawSteer*this.rawSteer;
 }
 private floatOnWater(dt:number){
  this.onWater=false;
  const level=this.waterLevel;if(!level){this.inWater=false;return;}
  const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation()),v=this.body.linvel(),w=this.body.angvel(),h=this.handling.values;
  const native=(x:number,y:number,z:number):NativeVec=>[x,-z,y],axis=(x:number,y:number,z:number)=>{const a=new Vector3(x,y,z).applyQuaternion(q);return native(a.x,a.y,a.z);};
  const b=this.assets.collision!.bounds;
  const state:NativeBoatBody={position:native(p.x,p.y,p.z),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:[...b.min] as NativeVec,boundsMax:[...b.max] as NativeVec,modelId:this.modelId,touchingWater:this.water.touching,mass:h.mass,turnMass:h.turnMass,centerOfMass:[h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ],buoyancyConstant:this.water.buoyancy,moveSpeed:native(v.x/50,v.y/50,v.z/50),turnSpeed:native(w.x/50,w.y/50,w.z/50),suspensionDamping:h.suspensionDamping};
  const sample:{sample?:{points:NativeVec[][];min:NativeVec;max:NativeVec}}={},moveSpeed=[...state.moveSpeed] as NativeVec;
  // ProcessBoatControl hands GetHasHitWall to ProcessBuoyancyBoat's last argument: against the world, the hull points'
  // turn forces are held back, and the drive turns 0.4 of the whole force at the turn point instead.
  const result=applyNativeBoatBuoyancy(state,level,dt*50,sample,9.81/20,this.hitWall);
  if(this.occupied&&this.sim.player.health>0&&result.inWater&&boatDriverNeedsBreath(result.force,state.mass,dt*50,state.up[2],moveSpeed[0],moveSpeed[1]))this.sim.handlePlayerBreath(dt);
  // Bow spray from partly submerged edges once per native 30 fps frame.
  this.splashClock+=dt;
  if(sample.sample&&this.splashClock>=1/30){
   this.splashClock%=1/30;
   for(const edge of nativeBuoyancySplashEdges(sample.sample)){const particles=nativeSplashParticles({...state,moveSpeed},edge.from,edge.to);if(particles){this.splashes.push(...particles);this.splashReport=moveSpeed;}}
  }
  this.water.touching=state.touchingWater;this.inWater=result.inWater;this.immersion=result.inWater?result.immersion:0;
  // cBuoyancy::ProcessBuoyancyBoat answers for a boat whenever the water level is known, with no force when no hull
  // point is under, so the drive still runs in the air (thrust while the propeller is near the surface, the turn
  // damping, the handbrake). With no water polygon under it at all, ProcessBoatControl stops there. bOnWater needs more
  // lift than 0.0008 x mass a step: the force is the native one (only its application is scaled to browser gravity).
  if('noWater' in result&&result.noWater){
   this.lastImmersion=this.immersion;const [mx,my,mz]=state.moveSpeed,[tx,ty,tz]=state.turnSpeed;
   this.body.setLinvel({x:mx*50,y:mz*50-9.81*dt,z:-my*50},true);this.body.setAngvel({x:tx*50,y:tz*50,z:-ty*50},true);return;
  }
  const onWater=result.inWater&&result.force>dt*50*state.mass*.0008;this.onWater=onWater;
  // ProcessBoatControl drive forces over the post-buoyancy state (engine-speed ramp and Skimmer branches omitted).
  const drive=nativeBoatDrive({
   gasPedal:this.gasPedal,steerAngle:this.steerAngle,handbrake:this.brake,player:this.occupied,
   collidedWithWorld:this.hitWall,postCollision:this.postCollision,onWater,gravityScale:9.81/20,
   upZ:state.up[2],immersionDepth:this.immersion,lastImmersionDepth:this.lastImmersion,
   buoyancyForceZ:result.inWater?result.force:0,buoyancyTurn:(result.inWater&&result.turnPoint?result.turnPoint:[0,0,0]) as NativeVec,
   move:[...state.moveSpeed] as NativeVec,turn:[...state.turnSpeed] as NativeVec,
   forward:state.forward,right:state.right,up:state.up,
   mass:state.mass,turnMass:state.turnMass,centerOfMass:state.centerOfMass,
   boundsMinY:b.min[1],boundsMinZ:b.min[2],
   position:state.position,level,timeStep:dt*50,boat:this.boatHandling,
   car:{tractionBias:h.tractionBias,tractionMultiplier:h.tractionMultiplier,tractionLoss:h.tractionLoss,suspensionLowerLimit:h.suspensionLowerLimit,suspensionForceLevel:h.suspensionForce,suspensionBiasBetweenFrontAndRear:h.suspensionBias,brakeDeceleration:h.brakeDeceleration,brakeBias:h.brakeBias,engineAcceleration:h.engineAcceleration},
  });
  // Vehicle.cpp stores the immersion every step, 0 in the air, so a landing is measured against it.
  this.lastImmersion=this.immersion;this.waveVolume=drive.waveVolume;
  const [mx,my,mz]=drive.move,[tx,ty,tz]=drive.turn;
  this.body.setLinvel({x:mx*50,y:mz*50-9.81*dt,z:-my*50},true);this.body.setAngvel({x:tx*50,y:tz*50,z:-ty*50},true);
 }
 private lastImmersion=0;
 update(alpha:number){
  interpolateVehiclePose(this.root,{body:this.body,previous:this.previous,previousRotation:this.previousRotation},alpha);
 }
 /** Pin the embarked player to the hull; true when a blast must spawn. */
 afterStep(){
  this.collisionDamage();
  if(this.pendingExplosion){this.pendingExplosion=false;return true;}
  if(!this.occupied)return false;const p=this.body.translation(),q=this.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={...p};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=Math.hypot(this.body.linvel().x,this.body.linvel().z);player.grounded=true;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});return false;
 }
 /** Collision damage from the velocity change the contact solver applied during
  * the world step. CBoat player/non-player divisors; wrecked on exhaustion. */
 private collisionDamage(){
  const before=this.stepVelocity;this.stepVelocity=undefined;
  if(!before||this.wrecked||!this.body.isEnabled())return;
  const v=this.body.linvel(),change=Math.hypot(v.x-before.x,v.y-before.y,v.z-before.z);
  // bPostCollision: damage this step with the impact rising (m_vecLastCollisionImpactVelocity.z > 0.1).
  this.postCollision=change>0&&(v.y-before.y)/50>.1;
  // GetHasHitWall: the hull is touching fixed world geometry.
  let wall=false;for(let i=0;i<this.body.numColliders()&&!wall;i++)this.sim.world.contactPairsWith(this.body.collider(i),other=>{if(other.parent()?.isFixed()??true)wall=true;});
  this.hitWall=wall;
  const power=this.handling.values.mass*change/50*this.handling.values.collisionDamageMultiplier;
  // CBoat::ProcessControl: collisions only hurt a hull at 250 health or more, and never past 1; the fire below 250
  // then burns it out.
  if(power<=25||this.health<250)return;
  this.health-=this.occupied?(power-25)/2:(power-25)/4;
  if(this.health<=0)this.health=1;
 }
 /** GetHasHitWall and bPostCollision for the next ProcessBoatControl. */
 private hitWall=false;private postCollision=false;
 /** bRenderScorched: lit by a 0.18 grey ambient alone (WorldReplaceNormalLightsWithScorched), no reflection pass. */
 private scorch(){
  this.ambient.color.value.set(.18,.18,.18);this.ambient.enabled.value=true;this.ambient.directMultiplier.value=0;
  this.visual?.root.traverse(o=>{const m=(o as {material?:unknown}).material;for(const x of Array.isArray(m)?m:m?[m]:[]){const env=nativeEnvCoefficients.get(x);if(env)env.value=0;}});
 }
 /** SetupLightingForEntity's multiplier, GetLightingFromCol(true) × 0.95 + 0.05: the object ambient's mean with a
  * contact brightness of 0.5 stands in (this vehicle keeps no contact lighting). */
 private updateReflection(rgb:readonly number[]|undefined){
  // A blown-up vehicle's atomics lose their reflection passes.
  this.reflection.state.enabled.value=!(this as {wrecked?:boolean}).wrecked;
  const mean=rgb?(rgb[0]+rgb[1]+rgb[2])/3:.5;
  this.reflection.update(Math.min(1.05,(mean+.5)*.95+.05),this.body.translation(),this.body.rotation());
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(this.reflection)this.updateReflection(rgb);if(this.wrecked){this.visual?.setNight(night);return;}if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual?.setNight(night);}
  snapshot(){return {inWater:this.inWater,immersion:+this.immersion.toFixed(3),modelId:this.modelId,name:this.name,health:this.health,wrecked:this.wrecked,onFire:this.onFire,occupied:this.occupied,wake:this.wake.coords.length,splashes:this.splashes.length,position:{...this.body.translation()},velocity:{...this.body.linvel()}};}
 dispose(){this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
