import RAPIER from '@dimforge/rapier3d-compat';
import {Group,Quaternion,Vector3,type Scene} from 'three';
import type {Simulation} from './Simulation';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {interpolateVehiclePose} from '../render/vehiclePose';
import {requireAsset} from '../assets/binary';
import {bikeLeanTarget,approachBikeLean,bikeLeanDrop,bikeRiderLean} from './nativeBikeLean';
import {knockOffForce,knocksOffRider} from './nativeBikeKnockOff';
import type {NativeBikeAssets} from '../assets/fixedWorldBike';
/** Rideable bike/quad models by ID with HUD names. */
export const PLAYABLE_BIKES:Readonly<Record<number,string>>={448:'Pizzaboy',461:'PCJ-600',462:'Faggio',463:'Freeway',468:'Sanchez',471:'Quadbike',481:'BMX',509:'Chopper',510:'Mountain Bike',521:'FCR-900',522:'NRG-500',523:'HPV-1000',581:'BF-400',586:'Wayfarer'};
/** Bicycle classes pedal; the rest (and the quad) ride motor-driven. */
const BICYCLES=new Set(['bmx','mtb','choppa']);
/** Authored wheelbase for the bicycle steering model (native wheelbase is unreversed). */
const WHEELBASE=1.4;
/** Authored coast-down when neither pedaling nor braking. */
const COAST_DECEL=3;
/** Rideable bikes: arcade drive over prepared handling magnitudes, native lean
 * caps with an authored lean rate, knock-off from the reversed force formula.
 * Wheel spin, pedal-crank motion, wheelies/stoppies, the jumpon/getoff entry
 * sequence and pillion passengers arrive in later slices. */
export class WorldBike {
 readonly body:RAPIER.RigidBody;readonly root=new Group();readonly name:string;readonly modelId:number;
 private physical:ReturnType<typeof installNativeVehicleBody>;
 private visual:ReturnType<typeof modelObject>|undefined;private ambient=nativeAmbientState();
 /** Native hull health: 1000, burning below 250, then BlowUpCar after 5000 ms (authored same-as-boat; CBike::BlowUpCar is not reversed). */
 health=1000;burnTimer=0;wrecked=false;
 /** Set by blowUp until the weapon system spawns its explosion. */
 pendingExplosion=false;
 occupied=false;throttle=0;steer=0;brake=false;message?:string;
 /** Visual lean roll in radians (positive leans right); the body stays upright like the native render matrix. */
 lean=0;
 private stepVelocity?:{x:number;y:number;z:number};
 private previous:{x:number;y:number;z:number};private previousRotation:RAPIER.Rotation;
 constructor(private sim:Simulation,scene:Scene,readonly assets:NativeBikeAssets,position:{x:number;y:number;z:number},heading=0){
  requireAsset(PLAYABLE_BIKES[assets.vehicle.id]&&assets.collision,'Unresolved bike resources.');
  requireAsset(assets.bike,`Unresolved bike handling: ${assets.vehicle.handling}.`);
  this.modelId=assets.vehicle.id;this.name=PLAYABLE_BIKES[this.modelId];
  // Minimal contact friction: the arcade controller presets horizontal velocity
  // each step (lateral grip comes free), so tire friction would only fight the
  // drive the way hull friction would fight a boat.
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,assets.handling,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},{friction:.05,restitution:.05});this.body=this.physical.body;
  if(assets.model&&assets.textures){
   try{this.visual=modelObject(assets.model,assets.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient});this.root.add(this.visual.root);}catch{this.visual=undefined;}
  }
  scene.add(this.root);
  this.previous={...position};this.previousRotation={...this.body.rotation()};this.update(1);
 }
 get quad(){return this.assets.vehicle.type==='quad';}
 /** The ped_frontseat dummy in native model space. */
 seat(){const frame=this.assets.model.frames.find(f=>f.name.toLowerCase()==='ped_frontseat');return frame?{x:frame.matrix[12],y:frame.matrix[13],z:frame.matrix[14]}:undefined;}
 heading(){const q=this.body.rotation();return Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));}
 distance(){const p=this.sim.player.position,b=this.body.translation();return Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z);}
 speed(){const v=this.body.linvel(),q=this.body.rotation(),f=rotate(q,{x:0,y:0,z:-1});return v.x*f.x+v.y*f.y+v.z*f.z;}
 /** Weapon damage: bullets subtract directly; returns true only when wrecked. */
 damage(amount:number){
  if(this.wrecked)return false;
  this.health=Math.max(0,this.health-amount);
  if(this.health===0){this.blowUp();return true;}
  return false;
 }
 blowUp(){
  if(this.wrecked)return;this.wrecked=true;this.health=0;this.pendingExplosion=true;
  if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.damagePlayer(this.sim.player.health);}
 }
 get onFire(){return !this.wrecked&&this.health<250;}
 /** '' when the player may board, otherwise the refusal reason. */
 enterCheck(){
  if(this.sim.player.health<=0)return '';
  if(this.wrecked)return 'This bike is destroyed.';
  if(this.distance()>Math.max(4,this.assets.collision!.bounds.radius))return `Move closer to the ${this.name}.`;
  return '';
 }
 /** '' when the player may disembark, otherwise the refusal reason. */
 exitCheck(){
  if(this.sim.player.health<=0)return '';
  if(Math.abs(this.speed())>2)return 'Slow down before leaving the bike.';
  return '';
 }
 /** Clear disembark spot beside the bike, or null when both sides are blocked. */
 exitFoot(){
  const p=this.body.translation(),q=new Quaternion().copy(this.body.rotation());
  for(const side of [-1,1]){
   const out=new Vector3(side*1.2,1.5,0).applyQuaternion(q).add(new Vector3().copy(p));
   const hit=this.sim.world.castRay(new RAPIER.Ray(out,{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.body);if(!hit)continue;
   const foot={x:out.x,y:out.y-hit.timeOfImpact+.04,z:out.z},center={...foot,y:foot.y+.9};
   if(this.sim.world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3),undefined,undefined,this.sim.playerCollider,this.body))continue;
   return foot;
  }
  return null;
 }
 /** Immediate boarding warp (the jumpon entry sequence arrives in a later slice). */
 finishEnter(){
  this.sim.setCrouched(false);this.occupied=true;this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S pedal · A/D steer · Space brake · F exit`;
 }
 finishExit(foot?:{x:number;y:number;z:number}){
  const spot=foot??this.exitFoot();if(!spot)return 'No clear ground beside the bike.';
  this.occupied=false;this.throttle=0;this.steer=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=spot;this.sim.player.previous={...spot};this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});this.sim.playerCollider.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z});return 'On foot';
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
 beforeStep(dt:number,input:{throttle:number;steer:number;brake:boolean}={throttle:0,steer:0,brake:false}){
  const nearby=this.distance()<250;this.body.setEnabled(nearby);this.root.visible=nearby;if(!nearby)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};
  this.throttle=input.throttle;this.steer=input.steer;this.brake=input.brake;
  if(this.wrecked){this.throttle=0;}
  if(this.onFire){this.burnTimer+=dt;if(this.burnTimer>5)this.blowUp();}else this.burnTimer=0;
  const h=this.assets.handling.values,q=this.body.rotation(),v=this.body.linvel();
  const forward=rotate(q,{x:0,y:0,z:-1}),speed=v.x*forward.x+v.y*forward.y+v.z*forward.z;
  // Prepared native per-step magnitudes become browser per-second rates at 50 Hz (×50 units × 50 steps).
  const top=this.assets.handling.maxFlatVelocity*50,reverse=this.assets.handling.maxReverseVelocity*50;
  const accelRate=h.engineAcceleration*2500,brakeRate=h.brakeDeceleration*2500;
  let want=speed;
  if(this.throttle>.05)want=Math.min(top,speed+accelRate*dt*this.throttle);
  else if(this.throttle<-.05)want=Math.max(reverse,speed+accelRate*dt*this.throttle);
  else want=speed>0?Math.max(0,speed-COAST_DECEL*dt):Math.min(0,speed+COAST_DECEL*dt);
  if(this.brake)want=speed>0?Math.max(0,speed-brakeRate*dt):Math.min(0,speed+brakeRate*dt);
  // Authored variable-ratio steering: SpeedSteer scales the handling lock with speed.
  const lock=h.steeringLock*Math.PI/180,speedF=Math.min(1,Math.abs(speed)/15);
  const effLock=lock*(1+(this.assets.bike.speedSteer-1)*speedF);
  // Positive steer (D) turns right, which is negative yaw about world up.
  let yaw=-speed*Math.tan(Math.max(-1,Math.min(1,this.steer))*effLock)/WHEELBASE;
  yaw=Math.max(-2.5,Math.min(2.5,yaw));
  const horizontal={x:forward.x*want,y:forward.y*want,z:forward.z*want};
  this.body.setLinvel({x:horizontal.x,y:v.y-9.81*dt,z:horizontal.z},true);
  this.body.setAngvel({x:0,y:yaw,z:0},true);
  // Native lean caps with an authored rate; quads stay level.
  const target=this.quad?0:bikeLeanTarget(this.steer,Math.abs(speed),this.assets.bike.maxLean);
  this.lean=approachBikeLean(this.lean,target,this.assets.bike.desLean,dt);
  this.stepVelocity={...this.body.linvel()};
 }
 /** Pin the embarked player to the bike; knock-offs eject through the reversed force formula. */
 afterStep(){
  this.collisionKnockOff();
  if(this.pendingExplosion){this.pendingExplosion=false;return true;}
  if(!this.occupied)return false;
  const up=rotate(this.body.rotation(),{x:0,y:1,z:0});
  if(up.y<0){this.finishExit();this.message='The bike tipped over.';return false;}
  const p=this.body.translation(),player=this.sim.player;
  player.previous={...player.position};player.position={...p};player.heading=this.heading();player.speed=Math.abs(this.speed());player.grounded=true;
  this.sim.playerBody.setTranslation({x:p.x,y:p.y+.9,z:p.z},true);this.sim.playerBody.setNextKinematicTranslation({x:p.x,y:p.y+.9,z:p.z});return false;
 }
 /** Knock-off from the velocity change the contact solver applied during the world step. */
 private collisionKnockOff(){
  const before=this.stepVelocity;this.stepVelocity=undefined;
  if(!before||!this.occupied||!this.body.isEnabled())return;
  const v=this.body.linvel(),dx=v.x-before.x,dy=v.y-before.y,dz=v.z-before.z,change=Math.hypot(dx,dy,dz);
  if(change<.5)return;
  const q=this.body.rotation(),right=rotate(q,{x:1,y:0,z:0}),forward=rotate(q,{x:0,y:0,z:-1}),up=rotate(q,{x:0,y:1,z:0});
  const dir={fwd:(dx*forward.x+dy*forward.y+dz*forward.z)/change,up:(dx*up.x+dy*up.y+dz*up.z)/change,right:(dx*right.x+dy*right.y+dz*right.z)/change};
  // Authored intensity mapping: native collision damage is unreversed, so the
  // contact velocity change (m/s) stands in for damageIntensity.
  const force=knockOffForce({intensity:change,mass:this.assets.handling.values.mass,player:true,skill:0,dir,upZ:up.y,sanchez:this.modelId===468,quad:this.quad});
  if(knocksOffRider(force)){this.finishExit();this.message='Knocked off the bike!';}
 }
 update(alpha:number){
  interpolateVehiclePose(this.root,{body:this.body,previous:this.previous,previousRotation:this.previousRotation},alpha);
  // CalculateLeanMatrix: roll about the forward axis, dropping (1-cos) × bbox min.
  this.root.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-this.lean));
  this.root.position.y+=bikeLeanDrop(this.lean,this.assets.collision!.bounds.min[1]);
 }
 /** Rider animation selection for the player model (IFP block + clip names). */
 riderPose(){
  const prefix=this.assets.vehicle.animation,bicycle=BICYCLES.has(prefix),speed=Math.abs(this.speed());
  const idle=speed>.5?(bicycle?`${prefix}_pedal`:`${prefix}_ride`):`${prefix}_still`;
  const amount=bikeRiderLean(this.lean,this.assets.bike.fullAnimLean);
  return {block:prefix,seat:this.seat(),idle:prefix?idle.toLowerCase():idle,overlay:amount>.05?{clip:`${prefix}_${this.steer>0?'right':'left'}`.toLowerCase(),amount}:undefined};
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.visual?.setNight(night);}
 snapshot(){return {modelId:this.modelId,name:this.name,health:this.health,wrecked:this.wrecked,onFire:this.onFire,occupied:this.occupied,lean:+this.lean.toFixed(3),speed:+this.speed().toFixed(2),heading:+this.heading().toFixed(3),position:{...this.body.translation()},velocity:{...this.body.linvel()}};}
 dispose(){this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
function rotate(q:RAPIER.Rotation,v:{x:number;y:number;z:number}){
 const {x,y,z}=v,qx=q.x,qy=q.y,qz=q.z,qw=q.w;
 return {x:(1-2*(qy*qy+qz*qz))*x+2*(qx*qy-qz*qw)*y+2*(qx*qz+qy*qw)*z,y:2*(qx*qy+qz*qw)*x+(1-2*(qx*qx+qz*qz))*y+2*(qy*qz-qx*qw)*z,z:2*(qx*qz-qy*qw)*x+2*(qy*qz+qx*qw)*y+(1-2*(qx*qx+qy*qy))*z};
}
