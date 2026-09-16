import RAPIER from '@dimforge/rapier3d-compat';
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
import {nativeBoatDrive} from './nativeBoatDrive';
export const PLAYABLE_BOATS:Readonly<Record<number,string>>={430:'Predator',446:'Squalo',452:'Speeder',453:'Reefer',454:'Tropic',472:'Coastguard',473:'Dinghy',484:'Marquis',493:'Jetmax',595:'Launch'};
type Assets=Awaited<ReturnType<Awaited<ReturnType<typeof openStaticWorldVehicles>>['load']>>;
/** Drivable hulls over WATER.DAT. Buoyancy, wake trail, spray, drive forces and
 * immediate entry follow the reversed boat sources; entry clips, damage, wakes
 * FX and engine audio arrive in later slices. */
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
  if(this.distance()>Math.max(5,this.assets.collision!.bounds.radius))return `Move closer to the ${this.name}.`;
  return '';
 }
 /** '' when the player may disembark, otherwise the refusal reason. Swimming is
  * unfinished, so leaving is only offered in shallow water the player can wade. */
 exitCheck(){
  if(this.sim.player.health<=0)return '';
  const p=this.body.translation(),level=this.waterLevel?.(p.x,-p.z);
  if(level===undefined||p.y-level>1.2)return 'Swimming is unfinished; beach the boat first.';
  const v=this.body.linvel();
  if(Math.hypot(v.x,v.z)>2)return 'Slow down before leaving the boat.';
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
 /** Immediate boarding warp (no boat entry clips exist in the archive). */
 finishEnter(){
  this.sim.setCrouched(false);this.occupied=true;this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S throttle · A/D steer · Space brake · F exit`;
 }
 finishExit(foot?:{x:number;y:number;z:number}){
  const spot=foot??this.exitFoot();if(!spot)return 'No clear ground beside the boat.';
  this.occupied=false;this.throttle=0;this.steer=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=spot;this.sim.player.previous={...spot};this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});return 'On foot';
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
  this.floatOnWater(dt);
  pruneWakeTrail(this.wake,dt*50);
  const v=this.body.linvel(),speed=Math.hypot(v.x,v.z)/50;
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
 /** Pin the embarked player to the hull. */
 afterStep(){
  if(!this.occupied)return;const p=this.body.translation(),q=this.body.rotation(),player=this.sim.player;player.previous={...player.position};player.position={...p};player.heading=Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));player.speed=Math.hypot(this.body.linvel().x,this.body.linvel().z);player.grounded=true;this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual?.setNight(night);}
 snapshot(){return {inWater:this.inWater,immersion:+this.immersion.toFixed(3),modelId:this.modelId,name:this.name,wake:this.wake.coords.length,splashes:this.splashes.length,position:{...this.body.translation()},velocity:{...this.body.linvel()}};}
 dispose(){this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
