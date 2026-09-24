import {resolveVehicleProps,type VehicleProp} from './vehiclePropContacts';
import RAPIER from '@dimforge/rapier3d-compat';
import {AdditiveBlending,CanvasTexture,Group,Quaternion,Sprite,SpriteMaterial,Vector3,type Scene} from 'three';
import type {Simulation} from './Simulation';
import {modelObject} from '../assets/ModelObjects';
import {nativeAmbientState} from '../assets/nativeMaterial';
import {installNativeVehicleBody} from './nativeVehicleBody';
import {composeVehicleRoot,interpolateVehiclePose} from '../render/vehiclePose';
import {requireAsset} from '../assets/binary';
import {bikeLeanTarget,approachBikeLean} from '../flight/aero';
import {bikeLeanDrop,bikeRiderLean,quadRiderLean} from './nativeBikeLean';
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
/** The CBmx models (vehicles.ide class bmx): the BMX, Chopper and Mountain Bike. */
const BMX_MODELS:ReadonlySet<number>=new Set([481,509,510]);
/** The rest of BIKE_BUNNYHOP after the charged pose, played at 1.5 speed until LaunchBunnyHopCB. The clip is not
 * published with the world, so its length is authored. */
const HOP_RELEASE_SECONDS=.3;
/** Rideable bikes: arcade drive over prepared handling magnitudes, native lean
 * caps with an authored lean rate, knock-off from the reversed force formula,
 * jumpon/getoff mount timing, bike drive-by
 * lean-fire and engine audio hooks. Pillion passengers share the rear seat. */
export class WorldBike {
 /** CPed::GetBikeRidingSkill for the player: STAT_BIKE_SKILL / 1000 (the host reads the stat). */
 static ridingSkill?:()=>number;
 /** A motorbike rather than a CBmx. */
 get motorbike(){return !BMX_MODELS.has(this.modelId);}
 /** No ground under the wheels. */
 get airborne(){return !this.wheelsDown();}
 /** CPhysical::m_nNumEntitiesCollided this step: the bodies it touches, or the ground its wheels rest on. */
 entitiesCollided(){
  const body=this.body,touched=new Set<number>();
  for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);this.sim.world.contactPairsWith(collider,other=>{
   if(other.isSensor()||other.handle===this.sim.playerCollider.handle||other.parent()?.handle===body.handle)return;
   let touching=false;this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)touching=true;});
   if(touching)touched.add(other.parent()?.handle??other.handle);
  });}
  return touched.size+(!touched.size&&this.wheelsDown()?1:0);
 }
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
 /** Jumpon mount timer. */
 mountTimer=0;
 /** CQuadBike's m_sRideAnimData.LeanAngle, in radians (positive leans right): the quad's body stays level, so only
  * the rider leans. */
 riderLean=0;
 /** CBmx::m_fControlJump (0 to 25 steps of charge) and the time left before the hop launches. */
 controlJump=0;hopLaunch?:number;pillion?:{modelRef:number|string};
 /** Engine speed for audio (pedal cadence on bicycles, rpm on motorbikes). */
 engine01=0;
 /** Head/tail lamp glows (bike lamp pass): additive sprites at the hull ends, lit at night. */
 private lamp?:Sprite;private tailLamp?:Sprite;private night=0;
 private stepVelocity?:{x:number;y:number;z:number};
 private stepTurn?:{x:number;y:number;z:number};
 /** OBJECT.DAT props the bike can damage and uproot (CPhysical::ApplyCollision's static-object branch, triple
  * damage for a bike), as the fleet's cars have. */
 propFor?:(other:RAPIER.Collider)=>VehicleProp|undefined;
 /** Props destroyed or knocked loose by this bike, for diagnostics. */
 propsSmashed=0;propsUprooted=0;
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
  // Bike TXDs carry no vehiclelights128 texture, so the lamp pass mounts glow
  // sprites at the hull ends instead of textured lamp atomics.
  if(typeof document!=='undefined'&&assets.collision){
   const glow=()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d')!;const grad=g.createRadialGradient(32,32,2,32,32,30);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.fillRect(0,0,64,64);return new CanvasTexture(c);};
   try{
    const map=glow(),fwd=assets.collision.bounds.max[1],up=assets.collision.bounds.max[2];
    this.lamp=new Sprite(new SpriteMaterial({map,color:0xfff2cc,blending:AdditiveBlending,depthWrite:false}));
    this.lamp.position.set(0,up*0.55+0.35,-(fwd+0.15));this.lamp.scale.setScalar(0.55);this.lamp.visible=false;this.root.add(this.lamp);
    this.tailLamp=new Sprite(new SpriteMaterial({map,color:0xff2211,blending:AdditiveBlending,depthWrite:false}));
    this.tailLamp.position.set(0,up*0.5+0.2,assets.collision.bounds.min[1]-0.1);this.tailLamp.scale.setScalar(0.3);this.tailLamp.visible=false;this.root.add(this.tailLamp);
   }catch{this.lamp=undefined;this.tailLamp=undefined;}
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
  if(this.health===0&&this.motorbike){this.blowUp();return true;}
  return false;
 }
 /** CBike::BlowUpCar; CBmx overrides it with a NOP, so the BMX, Chopper and Mountain Bike never explode (the
  * blow-up-cars cheat and a wreck included). */
 blowUp(){
  if(this.wrecked||!this.motorbike)return;this.wrecked=true;this.health=0;this.pendingExplosion=true;
  if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.vehicleOccupantDied();}
 }
 /** A burning motorbike blows up after 5 s; a pedal bike has no engine to catch. */
 get onFire(){return !this.wrecked&&this.motorbike&&this.health<250;}
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
 /** Boarding with a short jumpon mount (vault onto the saddle). */
 finishEnter(){
  this.sim.setCrouched(false);this.occupied=true;this.mountTimer=0.6;this.sim.playerCollider.setEnabled(false);this.sim.cameraExcludedBody=this.body;this.afterStep();return `${this.name} · W/S pedal · A/D steer · Space brake · F exit`;
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
 beforeStep(dt:number,input:{throttle:number;steer:number;brake:boolean;hop?:boolean;disabled?:boolean}={throttle:0,steer:0,brake:false}){
  const nearby=this.distance()<250;this.body.setEnabled(nearby);this.root.visible=nearby;if(!nearby)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};
  this.throttle=input.throttle;this.steer=input.steer;this.brake=input.brake;
  if(this.wrecked){this.throttle=0;}
  this.bunnyHop(dt,!!input.hop,input.disabled);
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
  if(this.quad)this.riderLean=quadRiderLean(this.riderLean,this.steer,this.assets.bike.fullAnimLean,this.assets.bike.desLean,dt);
  this.stepVelocity={...this.body.linvel()};this.stepTurn={...this.body.angvel()};
  this.mountTimer=Math.max(0,this.mountTimer-dt);
  this.engine01=(this.modelId===481||this.modelId===510||this.modelId===509)?Math.min(1,Math.abs(this.throttle)):Math.min(1,Math.abs(want)/Math.max(1,top));
 }
 /** CBmx::ProcessBunnyHop (0x6C0590) and LaunchBunnyHopCB (0x6C0390): holding the hop button charges up to 25 steps,
  * letting go plays the hop out, and then, with a front and a rear wheel down, the bike jumps
  * 0.06 x (1 + charge/25) units a frame along its up axis. The gas is cut while the hop pose holds. The turn force
  * that tips the nose is left out: this controller keeps the bike from pitching. */
 /** The ANIM_ID_BIKE_BUNNYHOP clip's length for a CBmx model's ride group, once loaded. */
 static hopClipSeconds?:(modelId:number)=>number|undefined;
 /** CBmx::ProcessBunnyHop. Under DisablePlayerControls the press is refused and the charge dropped. */
 private bunnyHop(dt:number,held:boolean,disabled=false){
  if(disabled&&this.hopLaunch===undefined)this.controlJump=0;
  if(!BMX_MODELS.has(this.modelId)||!this.occupied){this.controlJump=0;this.hopLaunch=undefined;return;}
  if(this.hopLaunch!==undefined){
   this.hopLaunch-=dt;
   if(this.hopLaunch<=0){
    const power=Math.min(this.controlJump/25,1)+1;this.controlJump=0;this.hopLaunch=undefined;
    if(this.wheelsDown()){const up=rotate(this.body.rotation(),{x:0,y:1,z:0}),v=this.body.linvel(),dv=.06*power*50;this.body.setLinvel({x:v.x+up.x*dv,y:v.y+up.y*dv,z:v.z+up.z*dv},true);}
   }
  }else if(held)this.controlJump=Math.min(25,this.controlJump+dt*50);
  // On release the bunny-hop clip jumps to (0.2 − t)/0.2 × (T − 0.2) + 0.2, t being the charge's 0..0.2 hold time, and
  // plays out at speed 1.5, so the launch comes (T − 0.2) × charge/25 / 1.5 later: a tap hops at once.
  else if(this.controlJump>0){const clip=WorldBike.hopClipSeconds?.(this.modelId);this.hopLaunch=clip!==undefined?Math.max(0,clip-.2)*(this.controlJump/25)/1.5:HOP_RELEASE_SECONDS;}
  if(this.controlJump>0)this.throttle=0;
 }
 /** Whether the ground is under the bike's wheels (a short ray down from the body). */
 private wheelsDown(){
  const p=this.body.translation(),hit=this.sim.world.castRay(new RAPIER.Ray({x:p.x,y:p.y+.2,z:p.z},{x:0,y:-1,z:0}),1.4,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.body);
  return !!hit;
 }
 /** Pin the embarked player to the bike; knock-offs eject through the reversed force formula. */
 afterStep(){
  if(this.body.isEnabled()){
   const out=resolveVehicleProps({world:this.sim.world,body:this.body,playerColliderHandle:this.sim.playerCollider.handle,pre:this.stepVelocity,preTurn:this.stepTurn,
    mass:this.assets.handling.values.mass,turnMass:this.assets.handling.values.turnMass,occupied:this.occupied,wrecked:this.wrecked,bike:true,propFor:this.propFor});
   this.propsSmashed+=out.smashed;this.propsUprooted+=out.uprooted;
  }
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
  // m_fDamageIntensity is the collision impulse, mass times the velocity change in units a frame (CPhysical's
  // ApplyCollision family); the contact solver's change for the whole step stands in for the strongest contact.
  const mass=this.assets.handling.values.mass;
  const force=knockOffForce({intensity:mass*change/50,mass,player:true,skill:WorldBike.ridingSkill?.()??0,dir,upZ:up.y,sanchez:this.modelId===468,quad:this.quad});
  if(knocksOffRider(force)){this.finishExit();this.message='Knocked off the bike!';}
 }
 update(alpha:number){
  interpolateVehiclePose(this.root,{body:this.body,previous:this.previous,previousRotation:this.previousRotation},alpha);
  const lit=this.night>0.4&&!this.wrecked;
  if(this.lamp)this.lamp.visible=lit;
  if(this.tailLamp){this.tailLamp.visible=lit;this.tailLamp.scale.setScalar(this.brake?0.45:0.3);}
  // CalculateLeanMatrix: GetMatrix() × RotateY(lean) × RotateX(−0.05·|lean|), so the nose dips a twentieth of the
  // lean before the roll about the forward axis, then the wheels drop (1-cos) × bbox min.
  this.root.quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),-this.lean)).multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),-.05*Math.abs(this.lean)));
  this.root.position.y+=bikeLeanDrop(this.lean,this.assets.collision!.bounds.min[2]);
  // interpolateVehiclePose owns the root matrix; the lean is added after it, so recompose.
  composeVehicleRoot(this.root);
 }
 /** Rider animation selection for the player model (IFP block + clip names). */
 riderPose(){
  const prefix=this.assets.vehicle.animation,bicycle=BICYCLES.has(prefix),speed=Math.abs(this.speed());
  const idle=speed>.5?(bicycle?`${prefix}_pedal`:`${prefix}_ride`):`${prefix}_still`;
  const lean=this.quad?this.riderLean:this.lean,amount=bikeRiderLean(lean,this.assets.bike.fullAnimLean),right=this.quad?lean>0:this.steer>0;
  return {block:prefix,seat:this.seat(),idle:prefix?idle.toLowerCase():idle,overlay:amount>.05?{clip:`${prefix}_${right?'right':'left'}`.toLowerCase(),amount}:undefined};
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.night=night;this.visual?.setNight(night);}
 snapshot(){return {modelId:this.modelId,name:this.name,health:this.health,wrecked:this.wrecked,onFire:this.onFire,occupied:this.occupied,lean:+this.lean.toFixed(3),speed:+this.speed().toFixed(2),heading:+this.heading().toFixed(3),position:{...this.body.translation()},velocity:{...this.body.linvel()}};}
 dispose(){this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
function rotate(q:RAPIER.Rotation,v:{x:number;y:number;z:number}){
 const {x,y,z}=v,qx=q.x,qy=q.y,qz=q.z,qw=q.w;
 return {x:(1-2*(qy*qy+qz*qz))*x+2*(qx*qy-qz*qw)*y+2*(qx*qz+qy*qw)*z,y:2*(qx*qy+qz*qw)*x+(1-2*(qx*qx+qz*qz))*y+2*(qy*qz-qx*qw)*z,z:2*(qx*qz-qy*qw)*x+2*(qy*qz+qx*qw)*y+(1-2*(qx*qx+qy*qy))*z};
}
