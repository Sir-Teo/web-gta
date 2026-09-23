import RAPIER from '@dimforge/rapier3d-compat';
import {boatDriverNeedsBreath} from './playerBreath';
import {Group,Quaternion,Vector3,type Scene} from 'three';
import type {Simulation} from './Simulation';
import type {openStaticWorldVehicles} from '../assets/staticWorldVehicles';
import {readBoatHandling,type BoatHandlingData} from '../assets/boatHandling';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
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
 readonly body:RAPIER.RigidBody;readonly root=new Group();readonly name:string;readonly modelId:number;
 readonly boatHandling:BoatHandlingData;
 /** Native-coordinate water height query (WATER.DAT). */
 waterLevel?:(x:number,y:number)=>number|undefined;
 private water={touching:false,buoyancy:0};inWater=false;immersion=0;
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
 private stepVelocity?:{x:number;y:number;z:number};
 /** Weapon damage: bullets subtract directly; returns true only when wrecked. */
 damage(amount:number){
  if(this.wrecked)return false;
  this.health=Math.max(0,this.health-amount);
  if(this.health===0){this.blowUp();return true;}
  return false;
 }
 /** CBoat::BlowUpCar: the occupant is killed with the hull. */
 blowUp(){
  if(this.wrecked)return;this.wrecked=true;this.health=0;this.pendingExplosion=true;
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
 constructor(private sim:Simulation,scene:Scene,readonly assets:Assets,position:{x:number;y:number;z:number},heading=0){
  requireAsset(PLAYABLE_BOATS[assets.vehicle.id]&&assets.collision,'Unresolved boat resources.');
  const boat=readBoatHandling(assets.supplements).get(assets.vehicle.handling);
  requireAsset(boat,`Unresolved boat handling: ${assets.vehicle.handling}.`);
  this.boatHandling=boat!;
  this.modelId=assets.vehicle.id;this.name=PLAYABLE_BOATS[this.modelId];
  // The table index only feeds unused gear/speed outputs for hulls (no drivetrain).
  this.handling=prepareHandling(assets.handling,0);this.water.buoyancy=this.handling.buoyancy;
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,this.handling,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.05,restitution:0});this.body=this.physical.body;
  if(assets.model&&!assets.missingTextures.length){
   try{this.visual=modelObject(assets.model,assets.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient});this.root.add(this.visual.root);}catch{this.visual=undefined;}
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
  this.sim.setCrouched(false);this.occupied=true;this.driverPose='car_sit';this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S throttle · A/D steer · Space brake · F exit`;
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
  // CBoat::ProcessControl fire section: below 250 health the hull burns out after 5 s.
  if(this.onFire){this.burnTimer+=dt;if(this.burnTimer>5)this.blowUp();}else this.burnTimer=0;
  this.floatOnWater(dt);
  this.stepVelocity={...this.body.linvel()};
  pruneWakeTrail(this.wake,dt*50);
  const v=this.body.linvel(),speed=Math.hypot(v.x,v.z)/50;
  this.engine01=Math.min(1,Math.abs(this.throttle)*0.7+Math.min(1,speed/20)*0.3);
  if(this.inWater&&speed>.05){const p=this.body.translation();addWakePoint(this.wake,{x:p.x,y:-p.z},speed);}
 }
 occupied=false;throttle=0;steer=0;brake=false;waveVolume=0;
 private floatOnWater(dt:number){
  const level=this.waterLevel;if(!level){this.inWater=false;return;}
  const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation()),v=this.body.linvel(),w=this.body.angvel(),h=this.handling.values;
  const native=(x:number,y:number,z:number):NativeVec=>[x,-z,y],axis=(x:number,y:number,z:number)=>{const a=new Vector3(x,y,z).applyQuaternion(q);return native(a.x,a.y,a.z);};
  const b=this.assets.collision!.bounds;
  const state:NativeBoatBody={position:native(p.x,p.y,p.z),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:[...b.min] as NativeVec,boundsMax:[...b.max] as NativeVec,modelId:this.modelId,touchingWater:this.water.touching,mass:h.mass,turnMass:h.turnMass,centerOfMass:[h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ],buoyancyConstant:this.water.buoyancy,moveSpeed:native(v.x/50,v.y/50,v.z/50),turnSpeed:native(w.x/50,w.y/50,w.z/50),suspensionDamping:h.suspensionDamping};
  const sample:{sample?:{points:NativeVec[][];min:NativeVec;max:NativeVec}}={},moveSpeed=[...state.moveSpeed] as NativeVec;
  const result=applyNativeBoatBuoyancy(state,level,dt*50,sample,9.81/20);
  if(this.occupied&&this.sim.player.health>0&&result.inWater&&boatDriverNeedsBreath(result.force,state.mass,dt*50,state.up[2],moveSpeed[0],moveSpeed[1]))this.sim.handlePlayerBreath(dt);
  // Bow spray from partly submerged edges once per native 30 fps frame.
  this.splashClock+=dt;
  if(sample.sample&&this.splashClock>=1/30){
   this.splashClock%=1/30;
   for(const edge of nativeBuoyancySplashEdges(sample.sample)){const particles=nativeSplashParticles({...state,moveSpeed},edge.from,edge.to);if(particles){this.splashes.push(...particles);this.splashReport=moveSpeed;}}
  }
  this.water.touching=state.touchingWater;this.inWater=result.inWater;this.immersion=result.immersion;
  if(!result.inWater){
   // Browser gravity alone while airborne or beached.
   this.body.setLinvel({x:v.x,y:v.y-9.81*dt,z:v.z},true);return;
  }
  // ProcessBoatControl drive forces over the post-buoyancy state (authored
  // throttle/steer mapping; engine-speed ramp and Skimmer branches omitted).
  const drive=nativeBoatDrive({
   gasPedal:this.throttle,steerAngle:this.steer*.6,handbrake:this.brake,player:this.occupied,
   collidedWithWorld:false,postCollision:false,onWater:true,
   upZ:state.up[2],immersionDepth:result.immersion,lastImmersionDepth:this.lastImmersion,
   buoyancyForceZ:result.force,buoyancyTurn:result.turnPoint??[0,0,0] as NativeVec,
   move:[...state.moveSpeed] as NativeVec,turn:[...state.turnSpeed] as NativeVec,
   forward:state.forward,right:state.right,up:state.up,
   mass:state.mass,turnMass:state.turnMass,centerOfMass:state.centerOfMass,
   boundsMinY:b.min[1],boundsMinZ:b.min[2],
   position:state.position,level,timeStep:dt*50,boat:this.boatHandling,
   car:{tractionBias:h.tractionBias,tractionMultiplier:h.tractionMultiplier,tractionLoss:h.tractionLoss,suspensionLowerLimit:h.suspensionLowerLimit,suspensionForceLevel:h.suspensionForce,suspensionBiasBetweenFrontAndRear:h.suspensionBias,brakeDeceleration:h.brakeDeceleration,brakeBias:h.brakeBias,engineAcceleration:h.engineAcceleration},
  });
  this.lastImmersion=result.immersion;this.waveVolume=drive.waveVolume;
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
  const power=this.handling.values.mass*change/50*this.handling.values.collisionDamageMultiplier;
  if(power<=25)return;
  this.damage(this.occupied?(power-25)/2:(power-25)/4);
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual?.setNight(night);}
  snapshot(){return {inWater:this.inWater,immersion:+this.immersion.toFixed(3),modelId:this.modelId,name:this.name,health:this.health,wrecked:this.wrecked,onFire:this.onFire,occupied:this.occupied,wake:this.wake.coords.length,splashes:this.splashes.length,position:{...this.body.translation()},velocity:{...this.body.linvel()}};}
 dispose(){this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
