import {CHEATS} from './nativeCheats';
import {collisionHealthLoss} from './nativeCarDamage';
import {bindNativeCarDirt} from '../render/nativeCarDirt';
import {NativeCarReflection} from '../assets/nativeCarEnvMap';
import {resolveVehicleProps,type VehicleProp} from './vehiclePropContacts';
import {randomSeed} from './nativeVehicleLights';
import {vehicleDestroyed} from './vehicleDestroyed';
import {bikeWheelSupports} from '../vehicle/nativeBikeWheels';
import {bindNativeCarLod} from '../render/nativeCarLod';
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
import {nativePedals} from './nativePedals';
import {controlsOffSpeedScale,rawSteerTowards,steerFraction} from './nativeQuadSteer';
import {knockOffForce,knocksOffRider} from './nativeBikeKnockOff';
import {browserLocalDirection} from '../combat/nativeDamageAnim';
import {CAR_SOLVER_GROUPS} from './solverGroups';
import {bikeTooFastToBoard} from './BikeMount';
import {applyNativeBikeBuoyancy,type NativeBuoyancyBody,type NativeVec} from './nativeBuoyancy';
import {NATIVE_GRAVITY_MS2} from './nativeGravity';
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
 /** The player's CantBeKnockedOffBike, which the script sets (the host reads it). */
 static riderStaysOn?:()=>boolean;
 /** CCullZones::CamStairsForPlayer and FindZoneWithStairsAttributeForPlayer: the player stands in a stairs zone. */
 static playerOnStairs?:()=>boolean;
 /** CEventKnockOffBike's response for the player: the host plays the fall clip CalcForcesAndAnims picked and the
  * get-up after it (CTaskComplexFallAndGetUp). */
 static onKnockedOff?:(clip:string)=>void;
 private nativeBodyCache?:{mass:number;turnMass:number;boundsMin:{x:number;y:number;z:number};boundsMax:{x:number;y:number;z:number}};
 /** Handling mass and turn mass with the collision model's bounds (native units), as WorldCar gives them: the ped
  * strike pass reads all of it, the driving AI the width. */
 get nativeBody(){if(!this.nativeBodyCache){const b=this.assets.collision.bounds,h=this.assets.handling.values;this.nativeBodyCache={mass:h.mass,turnMass:h.turnMass,boundsMin:{x:b.min[0],y:b.min[1],z:b.min[2]},boundsMax:{x:b.max[0],y:b.max[1],z:b.max[2]}};}return this.nativeBodyCache;}
 /** Distance from the bike's origin to the farthest corner of its collision bounds, for cheap range culls. */
 get boundRadius(){const b=this.assets.collision.bounds;return Math.hypot(Math.max(-b.min[0],b.max[0]),Math.max(-b.min[1],b.max[1]),Math.max(-b.min[2],b.max[2]));}
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
 readonly body:RAPIER.RigidBody;readonly root=new Group();
 /** CCustomCarEnvMapPipeline's reflection state (every vehicle model uses the car pipeline). */
 readonly reflection=new NativeCarReflection();readonly name:string;readonly modelId:number;
 private physical:ReturnType<typeof installNativeVehicleBody>;
 private visual:ReturnType<typeof modelObject>|undefined;private ambient=nativeAmbientState();
 /** Native hull health: 1000, burning below 250, then BlowUpCar after 5000 ms (authored same-as-boat; CBike::BlowUpCar is not reversed). */
 health=1000;burnTimer=0;wrecked=false;
 /** Set by blowUp until the weapon system spawns its explosion. */
 pendingExplosion=false;
 occupied=false;throttle=0;steer=0;brake=false;message?:string;
 /** CAutoPilot's pedals while a script drives the bike (ScriptCarMissions), and whether the player's own bike is on a
  * script's driving task. */
 autopilot?:import('./WorldCar').WorldCar['autopilot'];scriptDriven?:boolean;
 /** FREEZE_CAR_POSITION: the body held where it is. */
 frozen=false;
 /** The rider's controls from the autopilot. Its native wheel angle (radians, left positive) over the handling's
  * lock is the bike's steer (right positive); gas is the pedal; any brake or the handbrake squeezes the brake.
  * Without native pedals (a stuck car's recovery) the pad's throttle, brake-to-reverse and steering are used. */
 autopilotInput(){
  const a=this.autopilot;if(!a)return undefined;
  if(!a.native)return {throttle:a.throttle-a.brake,steer:a.steering,brake:false};
  const lock=this.assets.handling.values.steeringLock*Math.PI/180||1;
  return {throttle:a.native.gas,steer:Math.max(-1,Math.min(1,-a.native.steerAngle/lock)),brake:a.native.handbrake||a.native.brake>.05&&a.native.gas<=0};
 }
 /** CEntity::m_nRandomSeed, and whether the lamps are lit this frame (GetVehicleLightsStatus; the host decides). */
 readonly randomSeed=randomSeed();lightsOn=false;
 /** Visual lean roll in radians (positive leans right); the body stays upright like the native render matrix. */
 lean=0;
 /** Jumpon mount timer. */
 mountTimer=0;
 /** CQuadBike's m_sRideAnimData.LeanAngle, in radians (positive leans right): the quad's body stays level, so only
  * the rider leans. */
 riderLean=0;
 /** The quad's CAutomobile::m_fRawSteerAngle (right positive) and m_GasPedal, kept between frames for the smoothing
  * and the brake-before-reverse rule. */
 rawSteer=0;gasPedal=0;
 /** CBmx::m_fControlJump (0 to 25 steps of charge) and the time left before the hop launches. */
 controlJump=0;hopLaunch?:number;pillion?:{modelRef:number|string};
 /** The hop button's state last frame: CBmx::ProcessBunnyHop starts a charge on a press (IsLeftShoulder1Pressed), not on a hold. */
 private hopHeld=false;
 /** Engine speed for audio (pedal cadence on bicycles, rpm on motorbikes). */
 engine01=0;
 /** Head/tail lamp glows (bike lamp pass): additive sprites at the hull ends, lit at night. */
 private lamp?:Sprite;private tailLamp?:Sprite;private night=0;
 private stepVelocity?:{x:number;y:number;z:number};
 /** The tyre balls, which stand in for CBike's suspension lines rather than its collision model. */
 private readonly wheelColliders=new Set<number>();
 private stepTurn?:{x:number;y:number;z:number};
 /** OBJECT.DAT props the bike can damage and uproot (CPhysical::ApplyCollision's static-object branch, triple
  * damage for a bike), as the fleet's cars have. */
 propFor?:(other:RAPIER.Collider)=>VehicleProp|undefined;
 /** Props destroyed or knocked loose by this bike, for diagnostics. */
 propsSmashed=0;propsUprooted=0;
 private previous:{x:number;y:number;z:number};private previousRotation:RAPIER.Rotation;
 /** CVehicleModelInfo's detail switch: chassis_vlo stands in for the full model only past the LOD distance. */
 private lod?:ReturnType<typeof bindNativeCarLod>;
 /** The camera's squared distance this frame, which picks the bike's detail (as for cars). */
 setViewDistance(distanceSquared:number,generationMultiplier:number){return this.lod?.update(distanceSquared,generationMultiplier);}
 constructor(private sim:Simulation,scene:Scene,readonly assets:NativeBikeAssets,position:{x:number;y:number;z:number},heading=0){
  requireAsset(PLAYABLE_BIKES[assets.vehicle.id]&&assets.collision,'Unresolved bike resources.');
  requireAsset(assets.bike,`Unresolved bike handling: ${assets.vehicle.handling}.`);
  this.modelId=assets.vehicle.id;this.name=PLAYABLE_BIKES[this.modelId];
  // Minimal contact friction: the arcade controller presets horizontal velocity
  // each step (lateral grip comes free), so tire friction would only fight the
  // drive the way hull friction would fight a boat.
  this.physical=installNativeVehicleBody(sim.world,assets.collision!,assets.handling,{position,rotation:{x:0,y:Math.sin(heading/2),z:0,w:Math.cos(heading/2)}},
   // beforeStep sets the bike's ground velocity itself each step (the handling's acceleration, braking and coasting), so
   // contact friction is only drag: the wheel spheres are fixed to the body and slide rather than roll, and against the
   // ground's own friction they cost a hundred-kilo BMX about as much as its full pedalling. None of it is taken.
   {friction:0,restitution:.05,frictionCombineRule:RAPIER.CoefficientCombineRule.Min});this.body=this.physical.body;this.car={body:this.body,root:this.root};
  // The tyres carry it (nativeBikeWheels): a ball per wheel on the same frictionless contact.
  for(const w of bikeWheelSupports(assets.model,assets.wheelFrames,assets.vehicle.frontWheelSize,assets.vehicle.rearWheelSize))
   this.wheelColliders.add(sim.world.createCollider(RAPIER.ColliderDesc.ball(w.radius).setTranslation(w.center.x,w.center.z,-w.center.y).setDensity(0).setFriction(0).setRestitution(.05).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min),this.body).handle);
  // A car's solver group: peds are kinematic capsules that would stop the bike dead, so, as for cars, the ped strike
  // pass (CPhysical::ApplyCollision between the two) settles a bike meeting a ped instead of the solver.
  for(let i=0;i<this.body.numColliders();i++)this.body.collider(i).setSolverGroups(CAR_SOLVER_GROUPS);
  if(assets.model&&assets.textures){
   try{this.visual=modelObject(assets.model,assets.textures,undefined,undefined,{worldLighting:true,ambient:this.ambient,carEnv:this.reflection.state});bindNativeCarDirt(this.visual.materialBindings).setLevel(randomSeed()%15);try{this.lod=bindNativeCarLod(this.visual.root,assets.model,[...assets.wheelFrames.front,...assets.wheelFrames.rear]);}catch{this.lod=undefined;}this.root.add(this.visual.root);}catch{this.visual=undefined;}
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
  if(this.wrecked||!this.motorbike)return;this.wrecked=true;this.health=0;this.pendingExplosion=true;vehicleDestroyed.report?.('road',this.modelId);
  if(this.occupied){this.occupied=false;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.vehicleOccupantDied();}
 }
 /** Set upright at its heading, still, just clear of the ground: the end of a pick-up (CBike's bGettingPickedUp). */
 standUpright(){
  const h=this.heading(),p=this.body.translation();
  this.body.setRotation({x:0,y:Math.sin(h/2),z:0,w:Math.cos(h/2)},true);this.body.setTranslation({x:p.x,y:p.y+.3,z:p.z},true);
  this.body.setLinvel({x:0,y:0,z:0},true);this.body.setAngvel({x:0,y:0,z:0},true);this.lean=0;
 }
 /** A burning motorbike blows up after 5 s; a pedal bike has no engine to catch. */
 get onFire(){return !this.wrecked&&this.motorbike&&this.health<250;}
 /** The crime victim key the wanted system knows this bike by. */
 get crimeKey(){return `bike:${this.body.handle}`;}
 /** '' when the player may board, otherwise the refusal reason. */
 enterCheck(){
  if(this.sim.player.health<=0)return '';
  if(this.wrecked)return 'This bike is destroyed.';
  if(this.distance()>Math.max(4,this.assets.collision!.bounds.radius))return `Move closer to the ${this.name}.`;
  // CTaskComplexEnterCar's TASK_SIMPLE_BIKE_PICK_UP (0x63EDAB): the player gives up on a bike moving over 0.2 units a frame.
  if(bikeTooFastToBoard(this))return `The ${this.name} is moving too fast.`;
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
  this.leave(spot);this.sim.player.speed=0;this.sim.player.verticalSpeed=0;this.sim.player.grounded=true;return 'On foot';
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
  // A body out of the world (far off, frozen, or waiting for collision) takes none of the step: its speed would be
  // worked on with nothing to move it.
  const nearby=this.distance()<250,active=nearby&&!this.frozen&&this.collisionLoaded(dt);this.body.setEnabled(active);this.root.visible=nearby;if(!active)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};
  this.throttle=input.throttle;this.steer=input.steer;this.brake=input.brake;
  // CAutomobile::ProcessControlInputs for the quad: the raw steer follows the pad a fifth of the way a frame, and the
  // steer angle is the lock times its square.
  if(this.quad){this.rawSteer=rawSteerTowards(this.rawSteer,input.steer,dt);this.steer=steerFraction(this.rawSteer);}
  if(this.wrecked){this.throttle=0;}
  this.bunnyHop(dt,!!input.hop,input.disabled);
  if(this.onFire){this.burnTimer+=dt;if(this.burnTimer>5)this.blowUp();}else this.burnTimer=0;
  const h=this.assets.handling.values,q=this.body.rotation(),v=this.body.linvel();
  // CAutomobile::ProcessControl: the player's quad with the controls disabled is held to 0.28 units a frame.
  if(this.quad&&input.disabled){const f=controlsOffSpeedScale(Math.hypot(v.x,v.y,v.z));if(f<1){v.x*=f;v.y*=f;v.z*=f;}}
  const forward=rotate(q,{x:0,y:0,z:-1}),speed=v.x*forward.x+v.y*forward.y+v.z*forward.z;
  // Prepared native per-step magnitudes become browser per-second rates at 50 Hz (×50 units × 50 steps).
  const top=this.assets.handling.maxFlatVelocity*50,reverse=this.assets.handling.maxReverseVelocity*50;
  const accelRate=h.engineAcceleration*2500,brakeRate=h.brakeDeceleration*2500;
  let want=speed,gas=this.throttle,braking=this.brake?1:0;
  // The quad's pedals are CAutomobile::ProcessControlInputs's: the reverse button brakes a quad still rolling
  // forward and only reverses it once it has all but stopped (nativePedals); the handbrake is the brake button.
  if(this.quad){
   const pedals=nativePedals({accelerate:Math.round(Math.max(0,Math.min(1,this.throttle))*255),brake:Math.round(Math.max(0,Math.min(1,-this.throttle))*255),forwardSpeed:speed/50,previousGas:this.gasPedal,
    automaticallyHandbrake:!!input.disabled,handbrake:this.brake,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true});
   this.gasPedal=gas=pedals.gas;braking=Math.max(pedals.brake,pedals.handbrake?1:0);
  }
  if(gas>.05)want=Math.min(top,speed+accelRate*dt*gas);
  else if(gas<-.05)want=Math.max(reverse,speed+accelRate*dt*gas);
  else want=speed>0?Math.max(0,speed-COAST_DECEL*dt):Math.min(0,speed+COAST_DECEL*dt);
  if(braking>0)want=speed>0?Math.max(0,speed-brakeRate*dt*braking):Math.min(0,speed+brakeRate*dt*braking);
  // Authored variable-ratio steering: SpeedSteer scales the handling lock with speed.
  const lock=h.steeringLock*Math.PI/180,speedF=Math.min(1,Math.abs(speed)/15);
  const effLock=lock*(1+(this.assets.bike.speedSteer-1)*speedF);
  // Positive steer (D) turns right, which is negative yaw about world up.
  let yaw=-speed*Math.tan(Math.max(-1,Math.min(1,this.steer))*effLock)/WHEELBASE;
  yaw=Math.max(-2.5,Math.min(2.5,yaw));
  const horizontal={x:forward.x*want,y:forward.y*want,z:forward.z*want};
  this.body.setLinvel({x:horizontal.x,y:v.y-NATIVE_GRAVITY_MS2*dt,z:horizontal.z},true);
  // A ridden bike's body stays upright about its forward axis (the lean is the render matrix's, CalculateLeanMatrix):
  // the rider balances it. Zeroing the roll rate alone kept whatever roll a knock gave it, and a bike tipped onto its
  // side rode on lying there, full throttle and going nowhere. The roll is taken out at a rate; pitch (a hill) stays.
  let roll=0;
  if(!this.quad&&!(this as {wrecked?:boolean}).wrecked&&(this.occupied||!!this.autopilot))roll=uprightRollRate(q,forward);
  this.body.setAngvel({x:forward.x*roll,y:yaw+forward.y*roll,z:forward.z*roll},true);
  // CPhysical::ApplySpeed: an abandoned bike lying on its side (|up.z| < 0.707) that is all but still (move speed
  // under 0.05, turn speed under 0.01 a frame) has its move speed halved every frame.
  if(!this.occupied&&!this.quad){const up=rotate(q,{x:0,y:1,z:0}),m=this.body.linvel(),w=this.body.angvel();
   if(Math.abs(up.y)<.707&&(m.x*m.x+m.y*m.y+m.z*m.z)/2500<.0025&&(w.x*w.x+w.y*w.y+w.z*w.z)/2500<.0001){const k=Math.pow(.5,dt*50);this.body.setLinvel({x:m.x*k,y:m.y*k,z:m.z*k},true);}}
  this.lastCollisionSeconds+=dt;
  // Native lean caps with an authored rate; quads stay level.
  const target=this.quad?0:bikeLeanTarget(this.steer,Math.abs(speed),this.assets.bike.maxLean);
  this.lean=approachBikeLean(this.lean,target,this.assets.bike.desLean,dt);
  if(this.quad)this.riderLean=quadRiderLean(this.riderLean,this.steer,this.assets.bike.fullAnimLean,this.assets.bike.desLean,dt);
  this.floatOnWater(dt);
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
  const pressed=held&&!this.hopHeld;this.hopHeld=held;
  if(disabled&&this.hopLaunch===undefined)this.controlJump=0;
  if(!BMX_MODELS.has(this.modelId)||!this.occupied){this.controlJump=0;this.hopLaunch=undefined;return;}
  if(this.hopLaunch!==undefined){
   this.hopLaunch-=dt;
   if(this.hopLaunch<=0){
    // CBmx::LaunchBunnyHopCB: the Huge Bunny Hop cheat multiplies the hop's power by 5.
    const power=(Math.min(this.controlJump/25,1)+1)*(CHEATS.isActive('hugeBunnyHop')?5:1);this.controlJump=0;this.hopLaunch=undefined;
    // A front wheel and a rear wheel must both be touching (m_WheelCounts); GetFatAndMuscleModifier(STAT_MOD_6) is a
    // retail stub, taken as 1.
    if(this.wheelsDown(.5)&&this.wheelsDown(-.5)){const up=rotate(this.body.rotation(),{x:0,y:1,z:0}),v=this.body.linvel(),dv=.06*power*50;this.body.setLinvel({x:v.x+up.x*dv,y:v.y+up.y*dv,z:v.z+up.z*dv},true);}
   }
  }else if(held&&(this.controlJump>0||pressed&&!disabled))this.controlJump=Math.min(25,this.controlJump+dt*50);
  // On release the bunny-hop clip jumps to (0.2 − t)/0.2 × (T − 0.2) + 0.2, t being the charge's 0..0.2 hold time, and
  // plays out at speed 1.5, so the launch comes (T − 0.2) × charge/25 / 1.5 later: a tap hops at once.
  else if(this.controlJump>0){const clip=WorldBike.hopClipSeconds?.(this.modelId);this.hopLaunch=clip!==undefined?Math.max(0,clip-.2)*(this.controlJump/25)/1.5:HOP_RELEASE_SECONDS;}
  if(this.controlJump>0)this.throttle=0;
 }
 /** CColStore::HasCollisionLoaded for the bike's spot: a vehicle out where the world's collision has not streamed in
  * waits for it (bIsStaticWaitingForCollision) rather than falling through the map. Asked twice a second, as fixed
  * ground under the bike, anywhere below it. */
 private groundCheck={seconds:0,loaded:true};
 private collisionLoaded(dt:number){
  // Looked at every tenth of a second while it moves (a ridden bike covers six units in half a second), and only forty
  // units down: a ray five hundred long found a structure far under a road not yet streamed in, and a homie's BMX
  // rode off the window's edge and fell to it. Water under it counts as somewhere to be. The player's own bike is
  // always inside the window (the terrain hold sees to that) and may fall far off a roof, so it looks all the way.
  const g=this.groundCheck,v=this.body.linvel();g.seconds-=dt;if(g.seconds>0)return g.loaded;g.seconds=Math.hypot(v.x,v.z)>1?.1:.5;
  const p=this.body.translation();
  g.loaded=!!this.sim.world.castRay(new RAPIER.Ray({x:p.x,y:p.y+2,z:p.z},{x:0,y:-1,z:0}),this.occupied?500:40,true,RAPIER.QueryFilterFlags.ONLY_FIXED)||this.waterLevel?.(p.x,-p.z)!==undefined;
  return g.loaded;
 }
 /** Whether the ground is under the bike (a short ray down from the body), `along` units ahead of its centre. */
 private wheelsDown(along=0){
  const p=this.body.translation(),f=rotate(this.body.rotation(),{x:0,y:0,z:-1});
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:p.x+f.x*along,y:p.y+.2+f.y*along,z:p.z+f.z*along},{x:0,y:-1,z:0}),1.4,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.body);
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
 /** WATER.DAT's level at a native (x, y), which the fleet hands its bikes. */
 waterLevel?:(x:number,y:number)=>number|undefined;
 private water={touching:false};inWater=false;drowning=false;
 /** CBike::ProcessBuoyancy over WATER.DAT surfaces, at native gravity (unscaled). The controller keeps the
  * bike from pitching or rolling, so of the turn force only the yaw damping stays. Drowning with CJ on board, he loses
  * breath (HandlePlayerBreath) while a wheel still touches the bottom, and is knocked off (KNOCK_OFF_TYPE_FALL) once
  * none does; a bike with no rider has its engine cut. */
 private floatOnWater(dt:number){
  const level=this.waterLevel;if(!level){this.inWater=this.drowning=false;return;}
  const p=this.body.translation(),q=this.body.rotation(),v=this.body.linvel(),w=this.body.angvel(),h=this.assets.handling.values,b=this.assets.collision.bounds;
  const native=(a:{x:number;y:number;z:number}):NativeVec=>[a.x,-a.z,a.y],axis=(x:number,y:number,z:number)=>native(rotate(q,{x,y,z})),offGround=!this.wheelsDown();
  const state:NativeBuoyancyBody={position:native(p),right:axis(1,0,0),forward:axis(0,0,-1),up:axis(0,1,0),boundsMin:[...b.min] as NativeVec,boundsMax:[...b.max] as NativeVec,modelId:this.modelId,heli:false,anyWheelOffGround:offGround,touchingWater:this.water.touching,mass:h.mass,turnMass:h.turnMass,centerOfMass:[h.centerOfMassX,h.centerOfMassY,h.centerOfMassZ],buoyancyConstant:this.assets.handling.buoyancy,moveSpeed:native({x:v.x/50,y:v.y/50,z:v.z/50}),turnSpeed:native({x:w.x/50,y:w.y/50,z:w.z/50})};
  const result=applyNativeBikeBuoyancy(state,level,dt*50,{},1);
  this.water.touching=state.touchingWater;this.inWater=result.inWater;this.drowning=result.drowning;
  if(!result.inWater)return;
  const [mx,my,mz]=state.moveSpeed;this.body.setLinvel({x:mx*50,y:mz*50,z:-my*50},true);this.body.setAngvel({x:w.x,y:state.turnSpeed[2]*50,z:w.z},true);
  if(!result.drowning)return;
  if(!this.occupied){this.throttle=0;return;}
  if(this.sim.player.health<=0)return;
  this.sim.handlePlayerBreath(dt);
  if(offGround)this.fallOff();
 }
 /** CEventKnockOffBike with KNOCK_OFF_TYPE_FALL: the rider drops off with a fifth of the bike's flat move speed and
  * FALL_FALL, which the in-air fall plays until he lands or swims. */
 private fallOff(){
  const v=this.body.linvel(),spot=this.knockOffSpot();if(!spot)return;
  this.leave(spot);
  this.sim.collisionPush={x:v.x*.2,z:v.z*.2};this.sim.player.verticalSpeed=0;this.sim.player.grounded=false;this.sim.player.speed=0;
 }
 /** Knock-off from the velocity change the contact solver applied during the world step. */
 private collisionKnockOff(){
  const before=this.stepVelocity;this.stepVelocity=undefined;
  if(!before||!this.body.isEnabled())return;
  const v=this.body.linvel(),dx=v.x-before.x,dy=v.y-before.y,dz=v.z-before.z,change=Math.hypot(dx,dy,dz);
  if(change<.5)return;
  this.lastCollisionSeconds=0;
  const hit=this.strongestCollision();
  // CBike::DamageKnockOffRider: a rider the script keeps on (CANT_BE_KNOCKED_OFF_NEVER) is never thrown, and the
  // force is zeroed for the player on stairs (CamStairsForPlayer and a stairs zone holding him).
  const mass=this.assets.handling.values.mass;let knocked=false;
  if(hit&&this.occupied&&!WorldBike.riderStaysOn?.()&&!WorldBike.playerOnStairs?.()){
   const q=this.body.rotation(),right=rotate(q,{x:1,y:0,z:0}),forward=rotate(q,{x:0,y:0,z:-1}),up=rotate(q,{x:0,y:1,z:0}),n=hit.normal;
   const dir={fwd:n.x*forward.x+n.y*forward.y+n.z*forward.z,up:n.x*up.x+n.y*up.y+n.z*up.z,right:n.x*right.x+n.y*right.y+n.z*right.z};
   const force=knockOffForce({intensity:hit.intensity,mass,player:true,skill:WorldBike.ridingSkill?.()??0,dir,worldZ:n.y,upZ:up.y,sanchez:this.modelId===468,quad:this.quad});
   knocked=knocksOffRider(force);
  }
  // CQuadBike is a CAutomobile: CAutomobile::VehicleDamage returns as soon as DamageKnockOffRider throws the rider,
  // before the health loss; otherwise the collision comes out of its health, ridden or not (half of it with CJ
  // aboard, a quarter otherwise), and the hit that would empty it leaves 1.
  if(hit&&this.quad&&!this.wrecked&&!knocked){
   const h=this.assets.handling.values,loss=collisionHealthLoss({intensity:hit.intensity,mass:h.mass,collisionDamageMultiplier:h.collisionDamageMultiplier,playerVehicle:this.occupied,hitByPlayerVehicle:false,modelId:this.modelId});
   if(loss>0){const previous=this.health;this.health-=loss;if(this.health<=0&&previous>0)this.health=1;}
  }
  if(knocked)this.knockOff(v,{x:dx,y:dy,z:dz},change);
 }
 /** CPhysical's m_fDamageIntensity and m_vecLastCollisionImpactVelocity: of the step's contacts, the one with the
  * largest impulse (mass times units a frame: the solver's kg·m/s over 50) and its normal into the bike. Only the
  * collision model counts. CBike's wheels are suspension lines, which raise no collision, so a tyre ball's contact
  * is ground the suspension takes (a kerb or bump it climbs) unless it meets the tyre side-on, below 0.3 of the
  * bike's up (an obstacle as tall as the axle: a wall, a car), where the frame's spheres would have struck. */
 private strongestCollision(){
  const up=rotate(this.body.rotation(),{x:0,y:1,z:0});let best:{intensity:number;normal:{x:number;y:number;z:number}}|undefined;
  for(let i=0;i<this.body.numColliders();i++){
   const collider=this.body.collider(i),wheel=this.wheelColliders.has(collider.handle);
   this.sim.world.contactPairsWith(collider,other=>{
    if(other.isSensor()||other.handle===this.sim.playerCollider.handle||other.parent()?.handle===this.body.handle)return;
    this.sim.world.contactPair(collider,other,(manifold,flipped)=>{
     if(!manifold.numContacts())return;
     const m=manifold.normal(),normal=flipped?{x:m.x,y:m.y,z:m.z}:{x:-m.x,y:-m.y,z:-m.z};
     if(wheel&&normal.x*up.x+normal.y*up.y+normal.z*up.z>=.3)return;
     let impulse=0;for(let c=0;c<manifold.numContacts();c++)impulse+=manifold.contactImpulse(c);
     const intensity=impulse/50;
     if(intensity>0&&(!best||intensity>best.intensity))best={intensity,normal};
    });
   });
  }
  return best;
 }
 /** Seconds since the last collision the contact solver registered (m_nLastCollisionTime). */
 lastCollisionSeconds=Infinity;
 /** CVehicle::CanPedJumpOutCar's automobile branch for the quad: tipped past up.z 0.3 and hit within the last second,
  * the plain speed window gives way to a roll-off at any speed from 0.1 units a frame. */
 get tippedAfterCrash(){return this.quad&&rotate(this.body.rotation(),{x:0,y:1,z:0}).y<.3&&this.lastCollisionSeconds<1;}
 /** CEventKnockOffBike with KNOCK_OFF_TYPE_SKIDBACKFRONT (the only type CBike::DamageKnockOffRider raises). The rider
  * keeps the bike's move speed and takes -0.3 (a BMX -0.2) of the collision's velocity change flat, plus 3 to 5 (a
  * BMX 6) / 70 units a frame up; the clip is the one for the side the hit came from (GetLocalDirection of the
  * reversed impact: KO_SKID_BACK in front, KD_RIGHT left, KO_SKID_FRONT behind, KD_LEFT right). A rider with nowhere
  * clear to go (SetPedSafePosition fails) stays on. */
 private knockOff(velocity:{x:number;y:number;z:number},impact:{x:number;y:number;z:number},change:number){
  const spot=this.knockOffSpot();if(!spot)return;
  this.leave(spot);
  const factor=this.motorbike?-.3:-.2,up=(3+Math.random()*((this.motorbike?5:6)-3))/70*50,player=this.sim.player;
  this.sim.collisionPush={x:velocity.x+factor*impact.x,z:velocity.z+factor*impact.z};
  player.verticalSpeed=velocity.y+up;player.grounded=false;player.speed=0;this.sim.exitCarriesSpeed=true;
  // Thrown from where he sat: the bike is not met until he is clear of it (m_pEntityIgnoredCollision).
  this.sim.ignoreVehicleOnExit(this.body);
  const direction=change>0?browserLocalDirection(player.heading,-impact.x,-impact.z):0;
  WorldBike.onKnockedOff?.((['ko_skid_back','kd_right','ko_skid_front','kd_left'] as const)[direction]);
  this.message='Knocked off the bike!';
 }
 /** CTaskSimpleBikeJacked on the rider, after its BIKE_HIT (BikeMount.jacked): BIKE_FALL_OFF (the jacker is at a
  * front door) and a forced CEventKnockOffBike of type 55 (KNOCK_OFF_TYPE_NONE_1): he leaves with the bike's move
  * speed and no push of his own. */
 pulledOff(){
  if(!this.occupied)return false;
  const spot=this.knockOffSpot();if(!spot)return false;
  const v={...this.body.linvel()};this.leave(spot);
  const player=this.sim.player;
  this.sim.collisionPush={x:v.x,z:v.z};player.verticalSpeed=v.y;player.grounded=false;player.speed=0;this.sim.exitCarriesSpeed=true;
  this.sim.ignoreVehicleOnExit(this.body);
  WorldBike.onKnockedOff?.('bike_fall_off');
  return true;
 }
 /** CEventKnockOffBike with KNOCK_OFF_TYPE_EXPLOSION, which CWorld::TriggerExplosionSectorList gives a BMX's rider.
  * Its knock-off direction is 0: BIKE_FALLR, and on a bike moving under 0.3 units a frame a push of 6 back along the
  * bike and 5 up it over his 70 kg (ApplyMoveForce); faster, he keeps the ride's speed. It is not forced, so a rider
  * the script keeps on stays on. Returns whether he came off. */
 explosionKnockOff(){
  if(!this.occupied||WorldBike.riderStaysOn?.())return false;
  const spot=this.knockOffSpot();if(!spot)return false;
  const v={...this.body.linvel()};this.leave(spot);
  if(Math.hypot(v.x,v.y,v.z)/50<.3){
   const q=this.body.rotation(),forward=rotate(q,{x:0,y:0,z:-1}),up=rotate(q,{x:0,y:1,z:0}),k=50/70;
   v.x+=(forward.x*-6+up.x*5)*k;v.y+=(forward.y*-6+up.y*5)*k;v.z+=(forward.z*-6+up.z*5)*k;
  }
  const player=this.sim.player;
  this.sim.collisionPush={x:v.x,z:v.z};player.verticalSpeed=v.y;player.grounded=false;player.speed=0;this.sim.exitCarriesSpeed=true;
  this.sim.ignoreVehicleOnExit(this.body);
  WorldBike.onKnockedOff?.('bike_fallr');
  this.message='Knocked off the bike!';
  return true;
 }
 /** CEventKnockOffBike::SetPedSafePosition: the seat, lifted half a unit when that is clear too, else 0.6 up or
  * down, else a clear spot beside the bike (PositionPedOutOfCollision); each must leave the ped clear of the world
  * and in sight of the bike past buildings and objects. */
 private knockOffSpot(){
  const p=this.body.translation(),seat={x:p.x,y:p.y,z:p.z};
  const clear=(foot:{x:number;y:number;z:number})=>{
   const center={x:foot.x,y:foot.y+.9,z:foot.z};
   if(this.sim.world.intersectionWithShape(center,{x:0,y:0,z:0,w:1},new RAPIER.Capsule(.6,.3),RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.body))return false;
   const dx=center.x-p.x,dy=center.y-p.y,dz=center.z-p.z,length=Math.hypot(dx,dy,dz);
   return length<1e-3||!this.sim.world.castRay(new RAPIER.Ray(p,{x:dx/length,y:dy/length,z:dz/length}),length,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS|RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,this.sim.playerCollider,this.body);
  };
  if(clear(seat)){const lifted={...seat,y:seat.y+.5};return clear(lifted)?lifted:seat;}
  for(const dy of [.6,-.6]){const tried={...seat,y:seat.y+dy};if(clear(tried))return tried;}
  return this.exitFoot();
 }
 /** CTaskSimpleCarSetPedOut: the rider is off the bike at `spot`. */
 private leave(spot:{x:number;y:number;z:number}){
  this.occupied=false;this.throttle=0;this.steer=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=spot;this.sim.player.previous={...spot};this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});this.sim.playerCollider.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z});
 }
 update(alpha:number){
  interpolateVehiclePose(this.root,{body:this.body,previous:this.previous,previousRotation:this.previousRotation},alpha);
  const lit=this.lightsOn&&!this.wrecked;
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
 /** SetupLightingForEntity's multiplier, GetLightingFromCol(true) × 0.95 + 0.05: the object ambient's mean with a
  * contact brightness of 0.5 stands in (this vehicle keeps no contact lighting). */
 private updateReflection(rgb:readonly number[]|undefined){
  // A blown-up vehicle's atomics lose their reflection passes.
  this.reflection.state.enabled.value=!(this as {wrecked?:boolean}).wrecked;
  const mean=rgb?(rgb[0]+rgb[1]+rgb[2])/3:.5;
  this.reflection.update(Math.min(1.05,(mean+.5)*.95+.05),this.body.translation(),this.body.rotation());
 }
 setLighting(rgb:readonly number[]|undefined,multiplier:number,night:number){if(this.reflection)this.updateReflection(rgb);if(rgb)this.ambient.color.value.set(rgb[0]*multiplier,rgb[1]*multiplier,rgb[2]*multiplier);this.ambient.enabled.value=!!rgb;this.night=night;this.visual?.setNight(night);}
 snapshot(){return {modelId:this.modelId,name:this.name,health:this.health,wrecked:this.wrecked,onFire:this.onFire,occupied:this.occupied,lean:+this.lean.toFixed(3),speed:+this.speed().toFixed(2),heading:+this.heading().toFixed(3),position:{...this.body.translation()},velocity:{...this.body.linvel()}};}
 /** What the script's vehicle host reads of any vehicle: the body under `car`, and whether it has gone (heading() is
  * the bike's own). */
 readonly car:{body:RAPIER.RigidBody;root:Group};disposed=false;
 /** A script's vehicle (CVehicle's MISSION_VEHICLE creation): the population never removes it; the script lets it go. */
 missionCar=false;
 /** CVehicle::bConsideredByPlayer, which SET_VEHICLE_IS_CONSIDERED_BY_PLAYER clears: the player's enter search passes it over. */
 consideredByPlayer=true;
 dispose(){this.disposed=true;this.root.removeFromParent();this.visual?.dispose();this.physical.dispose();}
}
/** The roll rate (rad/s, about the forward axis) that brings a body's up axis back to the vertical plane through its
 * forward axis within about a fifth of a second: the signed angle from its up to world up with the forward part taken
 * out, times five a second. */
export function uprightRollRate(q:{x:number;y:number;z:number;w:number},forward:{x:number;y:number;z:number}){
 const up=rotate(q as RAPIER.Rotation,{x:0,y:1,z:0});
 let ux=-forward.x*forward.y,uy=1-forward.y*forward.y,uz=-forward.z*forward.y;const l=Math.hypot(ux,uy,uz);if(l<1e-6)return 0;ux/=l;uy/=l;uz/=l;
 // sin: forward · (up × wanted); cos: up · wanted.
 const cx=up.y*uz-up.z*uy,cy=up.z*ux-up.x*uz,cz=up.x*uy-up.y*ux;
 const angle=Math.atan2(forward.x*cx+forward.y*cy+forward.z*cz,up.x*ux+up.y*uy+up.z*uz);
 return Math.abs(angle)<.002?0:angle*5;
}
function rotate(q:RAPIER.Rotation,v:{x:number;y:number;z:number}){
 const {x,y,z}=v,qx=q.x,qy=q.y,qz=q.z,qw=q.w;
 return {x:(1-2*(qy*qy+qz*qz))*x+2*(qx*qy-qz*qw)*y+2*(qx*qz+qy*qw)*z,y:2*(qx*qy+qz*qw)*x+(1-2*(qx*qx+qz*qz))*y+2*(qy*qz-qx*qw)*z,z:2*(qx*qz-qy*qw)*x+2*(qy*qz+qx*qw)*y+(1-2*(qx*qx+qy*qy))*z};
}
