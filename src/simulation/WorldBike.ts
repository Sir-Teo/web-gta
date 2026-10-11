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
import {bikeLeanTarget,approachBikeLean} from './nativeBikeLean';
import {bikeLeanDrop,bikeRiderLean,quadRiderLean} from './nativeBikeLean';
import {nativePedals} from './nativePedals';
import {stepNativeTransmission} from './nativeTransmission';
import {controlsOffSpeedScale,rawSteerTowards,steerFraction} from './nativeQuadSteer';
import {bikePedals,bikeSteerFraction} from './nativeBikeControls';
import {knockOffForce,knocksOffRider} from './nativeBikeKnockOff';
import {browserLocalDirection} from '../combat/nativeDamageAnim';
import {vehicleSolverGroups} from './solverGroups';
import {bikeTooFastToBoard} from './BikeMount';
import {applyNativeBikeBuoyancy,type NativeBuoyancyBody,type NativeVec} from './nativeBuoyancy';
import {NATIVE_GRAVITY_MS2} from './nativeGravity';
import {blastBombTimerMs,firesExplodesOrShoots,notePlayerVehicleHarm,playerVehicleDamage} from './carDamageHost';
import {stepBombTimer} from '../vehicle/nativeCarBomb';
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
/** LaunchBunnyHopCB's g_hopCooldown (iOS only, 0x10045a3f0 = 0.5 s). */
const HOP_COOLDOWN_SECONDS=.5;
/** CBmx::ProcessAI's airborne spin: 0x10058fd38 = 0.002 rad a step per step at full stick, to 0.04 rad a step. */
const BMX_AIR_SPIN_RATE=.002,BMX_AIR_SPIN_CAP=.04;
/** CBike::ProcessControl on the side stand (iOS 0x100451f48 at rest, 0x1004537e4 under physics): the drawn lean eases to
 * 15 degrees left of the body's own roll, keeping 0.97 of the old lean a frame; the stand comes up past a roll of
 * 0.35 (right.z) or a pitch of 0.5 (forward.z) (iOS 0x1004518a0). */
const SIDE_STAND_LEAN=.2617994,SIDE_STAND_KEEP=.97,SIDE_STAND_ROLL=.35,SIDE_STAND_PITCH=.5;
/** The rider gets off onto the stand only with the bike all but stopped: under 0.1 a frame along x and y (iOS
 * 0x1003e0df8), in metres a second. */
const SIDE_STAND_SPEED=5;
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
 /** Whether a ped of the script's sits on the bike's saddle: such a bike is not abandoned, so it never rests. */
 static hasDriverPed?:(bike:WorldBike)=>boolean;
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
 /** Whether the ground is under the front wheel and under the rear (the rays half a unit ahead and behind). */
 wheelContacts(){return {front:this.wheelsDown(.5),rear:this.wheelsDown(-.5)};}
 /** CPhysical::m_nNumEntitiesCollided this step: the bodies it touches, or the ground its wheels rest on. */
 entitiesCollided(){
  const body=this.body,touched=new Set<number>();
  for(const [collider,other] of this.contactPairs()){
   if((other as {removed?:boolean}).removed||other.isSensor()||other.handle===this.sim.playerCollider.handle||other.parent()?.handle===body.handle)continue;
   let touching=false;this.sim.world.contactPair(collider,other,manifold=>{if(manifold.numContacts()>0)touching=true;});
   if(touching)touched.add(other.parent()?.handle??other.handle);
  }
  return touched.size+(!touched.size&&this.wheelsDown()?1:0);
 }
 /** The bike's collider pairs in contact, read once a step (World.contactPairsWith) for the props pass and for what it
  * touched, which the frame asks after the step: read when first asked for after each step. */
 private stepPairs:(readonly [RAPIER.Collider,RAPIER.Collider])[]=[];private stepPairsRead=false;
 private readStepPairs(){
  const pairs=this.stepPairs,body=this.body;pairs.length=0;this.stepPairsRead=true;if(!body.isEnabled())return;
  for(let i=0;i<body.numColliders();i++){const collider=body.collider(i);this.sim.world.contactPairsWith(collider,other=>{if(other)pairs.push([collider,other]);});}
 }
 private contactPairs(){if(!this.stepPairsRead)this.readStepPairs();return this.stepPairs;}
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
 /** m_autoPilot.m_vehicleRecordingId and the pedals a playback sets (CVehicleRecording plays on any vehicle: TWAR7's
  * Ballas rider leaves on his PCJ-600 along recording 30). recordingBody.ts drives the body through these. */
 recordingSlot=-1;recordingControls?:{steerAngle:number;gas:number;brake:number;handbrake:boolean};
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
 /** CBike's bOnSideStand (iOS +0x800 bit 0x10): GetNewVehicleDependingOnCarModel (iOS 0x10018ce38) sets it on every new
  * bike and BMX, and a rider getting off a bike all but stopped puts it back down. The stand's 20 degree turn of the
  * front wheel is not drawn (the fork is not turned for any steer here). */
 onSideStand=true;
 private wasRidden=false;
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
 /** cTransmission's m_nCurrentGear, which the engine sound reads. CBike::ProcessControl (unreversed) runs
  * CalculateDriveAcceleration as CAutomobile's does; this drive does not, so the gear is stepped beside it from the
  * bike's speed and pedal (stepNativeTransmission), and only the gear is kept. */
 gear=1;
 /** The CBike fields CAEVehicleAudioEntity reads: the front (0) and rear (1) wheel states and counts, the wheels and
  * drive wheels on the ground, m_fWheelSpinForAudio and m_GasPedal. AUTHORED, CBike::ProcessControl being unreversed:
  * the counts are the front and rear ground probes; the rear wheel is driven; a brake at speed locks the rear wheel
  * (WHEEL_STATE_FIXED); the spin rate is CAutomobile::ProcessControl's for one driven wheel. Kept only while ridden. */
 /** m_HornCounter / m_HornPattern and bSirenOrAlarm, as a car's (CBike::PlayHornIfNecessary, the horn input). */
 readonly horn={counter:0,pattern:0};siren=false;
 /** CBmx::m_bIsFreewheeling, which the bicycle's sound reads. CBmx::ProcessDrivingAnims sets it in the iOS executable
  * (0x100458ddc: cleared each frame, set with a wheel down and the brake off as the rider coasts or hops); the rider's
  * clips here are the port's, so AUTHORED: a BMX with a wheel down, not braking and not pedalled. */
 freewheeling=false;
 /** For the quad, an automobile to the audio: CAutomobile's four wheels (front left, rear left, front right, rear right),
  * their states and counts. AUTHORED like the bike's: the left and right wheels share the front and rear probes, the
  * brake at speed locks the rear pair, and the spin rate is CAutomobile::ProcessControl's for the handling's drive. */
 readonly quadWheels={states:['normal','normal','normal','normal'] as ('normal'|'spinning'|'skidding'|'fixed')[],counts:[0,0,0,0],burst:[false,false,false,false]};
 readonly audio={states:['normal','normal'] as ('normal'|'spinning'|'skidding'|'fixed')[],counts:[0,0],contactWheels:0,driveOnGround:0,driveOnGroundLastFrame:0,spinForAudio:0,burst:[false,false],brake:0};
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
  for(let i=0;i<this.body.numColliders();i++){const c=this.body.collider(i);c.setSolverGroups(vehicleSolverGroups(c));}
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
 /** The pillion's place, the model's ped_backseat dummy (none on a BMX or a mountain bike). */
 backSeat(){const frame=this.assets.model.frames.find(f=>f.name.toLowerCase()==='ped_backseat');return frame?{x:frame.matrix[12],y:frame.matrix[13],z:frame.matrix[14]}:undefined;}
 heading(){const q=this.body.rotation();return Math.atan2(-2*(q.x*q.z+q.w*q.y),-(1-2*(q.x*q.x+q.y*q.y)));}
 distance(){const p=this.sim.player.position,b=this.body.translation();return Math.hypot(p.x-b.x,p.y-b.y,p.z-b.z);}
 speed(){const v=this.body.linvel(),q=this.body.rotation(),f=rotate(q,{x:0,y:0,z:-1});return v.x*f.x+v.y*f.y+v.z*f.z;}
 /** CVehicle::InflictDamage (iOS 0x1004781b4) for a bike (a BMX too, though CBmx's BlowUpCar does nothing), with WorldCar.damage's arguments:
  * - the player's own one, once burning under 250, refuses blasts, rounds and the molotov (CanVehicleBeDamaged), and
  *   otherwise takes playerVehicleDamage's share;
  * - only health left is taken. Damage that takes the last of it destroys the vehicle and returns true. A blast's
  *   victim waits on the bomb timer; anything else blows it up at once (BlowUpCar). */
 damage(amount:number,_collider?:number,explosive=false,_shotDir?:unknown,options:{kind?:'bullet'|'fire'|'melee';byPlayer?:boolean;weapon?:number}={}){
  if(this.wrecked)return false;
  if(this.occupied){
   if(this.health<250&&(explosive||(options.weapon!==undefined?firesExplodesOrShoots(options.weapon):(options.kind??'bullet')==='bullet')))return false;
   amount=playerVehicleDamage(amount);
  }
  notePlayerVehicleHarm(amount,options.byPlayer);
  if(this.health<=0)return false;
  if(this.health>amount){this.health-=amount;return false;}
  this.health=0;
  if(explosive)this.bombTimerMs=blastBombTimerMs();else this.blowUp();
  return true;
 }
 /** m_wBombTimer (ms): a blast's victim blows up when ProcessDelayedExplosion has counted it down. */
 bombTimerMs=0;
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
  // ProcessDelayedExplosion, which CBike::ProcessControl runs too, whether or not the body is in the world: a blast's
  // victim carried out of range still goes up on time.
  if(stepBombTimer(this,dt*50))this.blowUp();
  // A body out of the world (far off, frozen, or waiting for collision) takes none of the step: its speed would be
  // worked on with nothing to move it.
  const nearby=this.distance()<250,active=nearby&&!this.frozen&&this.collisionLoaded(dt);this.body.setEnabled(active);this.root.visible=nearby;if(!active)return;
  this.previous={...this.body.translation()};this.previousRotation={...this.body.rotation()};
  // Attached to another vehicle (ATTACH_CAR_TO_CAR): a kinematic body the host sets on it after the step.
  if(this.body.bodyType()===RAPIER.RigidBodyType.KinematicPositionBased)return;
  // A playback without car AI owns the body (bDisableCollisionForce, a velocity-driven body here): the bike's own
  // pedals and balance would fight the recording's speeds.
  if(this.recordingSlot>=0&&this.body.bodyType()===RAPIER.RigidBodyType.KinematicVelocityBased)return;
  if(this.skipPhysics(dt)){this.standLean(dt);return;}
  this.throttle=input.throttle;this.steer=input.steer;this.brake=input.brake;
  // The ride clip's clock: the pedal cycle turns while the rider pedals and holds while he coasts.
  if(Math.abs(input.throttle)>.05)this.rideTime+=dt;
  // The raw steer follows the pad a fifth of the way a frame: CAutomobile::ProcessControlInputs for the quad, whose
  // steer angle is the lock times its square, and CBike::ProcessControlInputs (iOS 0x100456178) for every other bike,
  // whose angle is the lock times the raw steer itself. A key press is not full lock at once: taken raw, each tap threw
  // the bike into its full turn and its full 48 degree lean, and it would not ride straight.
  this.rawSteer=rawSteerTowards(this.rawSteer,input.steer,dt);this.steer=this.quad?steerFraction(this.rawSteer):bikeSteerFraction(this.rawSteer);
  if(this.wrecked){this.throttle=0;}
  this.bunnyHop(dt,!!input.hop,input.disabled);
  if(this.onFire){this.burnTimer+=dt;if(this.burnTimer>5)this.blowUp();}else this.burnTimer=0;
  const h=this.assets.handling.values,q=this.body.rotation(),v=this.body.linvel();
  // CAutomobile::ProcessControl for the quad and CBike::ProcessControlInputs for the rest: the player's bike with the
  // controls disabled is held to 0.28 units a frame.
  if(input.disabled){const f=controlsOffSpeedScale(Math.hypot(v.x,v.y,v.z));if(f<1){v.x*=f;v.y*=f;v.z*=f;}}
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
  }else{
   // CBike::ProcessControlInputs's pedals: the reverse button brakes a bike rolling forward (and the throttle one
   // rolling back), and reverses it only from all but a standstill; the handbrake is the brake button.
   const pedals=bikePedals({accelerate:Math.round(Math.max(0,Math.min(1,this.throttle))*255),brake:Math.round(Math.max(0,Math.min(1,-this.throttle))*255),forwardSpeed:speed/50,bmx:!this.motorbike,controlsDisabled:!!input.disabled});
   gas=pedals.gas;braking=Math.max(pedals.brake,this.brake||pedals.handbrake?1:0);
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
  // With no wheel touching (CBike's four wheel ratios all 1) no tyre turns the bike: it keeps the spin it left the
  // ground with. A ridden CBmx spins with the stick (CBmx::ProcessAI, iOS 0x100458ddc): ApplyTurnForce(R × x/128 ×
  // 0.002 × dt × turnMass, F) turns it 0.002 rad a step faster each step, toward the stick, until it spins at 0.04.
  if(!this.wheelsDown()&&!this.wheelsDown(.5)&&!this.wheelsDown(-.5)){
   yaw=this.body.angvel().y;
   if(!this.motorbike&&this.occupied){
    const x=Math.max(-1,Math.min(1,input.steer)),spin=yaw/50;
    if(spin<BMX_AIR_SPIN_CAP&&x<0||spin>-BMX_AIR_SPIN_CAP&&x>0)yaw-=BMX_AIR_SPIN_RATE*x*dt*50*50;
   }
  }
  const horizontal={x:forward.x*want,y:forward.y*want,z:forward.z*want};
  this.body.setLinvel({x:horizontal.x,y:v.y-NATIVE_GRAVITY_MS2*dt,z:horizontal.z},true);
  // A ridden bike's body stays upright about its forward axis (the lean is the render matrix's, CalculateLeanMatrix):
  // the rider balances it. Zeroing the roll rate alone kept whatever roll a knock gave it, and a bike tipped onto its
  // side rode on lying there, full throttle and going nowhere. The roll is taken out at a rate; pitch (a hill) stays.
  if(gas>.05&&speed>-.5&&!this.quad&&(this.occupied||!!this.autopilot))this.stepUp(forward,Math.max(0,speed)*dt);
  let roll=0;
  if(!this.quad&&!(this as {wrecked?:boolean}).wrecked&&(this.occupied||!!this.autopilot))roll=uprightRollRate(q,forward);
  this.body.setAngvel({x:forward.x*roll,y:yaw+forward.y*roll,z:forward.z*roll},true);
  // CPhysical::ApplySpeed: an abandoned bike lying on its side (|up.z| < 0.707) that is all but still (move speed
  // under 0.05, turn speed under 0.01 a frame) has its move speed halved every frame.
  if(!this.occupied&&!this.quad){const up=rotate(q,{x:0,y:1,z:0}),m=this.body.linvel(),w=this.body.angvel();
   if(Math.abs(up.y)<.707&&(m.x*m.x+m.y*m.y+m.z*m.z)/2500<.0025&&(w.x*w.x+w.y*w.y+w.z*w.z)/2500<.0001){const k=Math.pow(.5,dt*50);this.body.setLinvel({x:m.x*k,y:m.y*k,z:m.z*k},true);}}
  this.lastCollisionSeconds+=dt;
  // Native lean caps with an authored rate; quads stay level.
  if(!this.standLean(dt)){
   const target=this.quad?0:bikeLeanTarget(this.steer,Math.abs(speed),this.assets.bike.maxLean);
   this.lean=approachBikeLean(this.lean,target,this.assets.bike.desLean,dt);
  }
  if(this.quad)this.riderLean=quadRiderLean(this.riderLean,this.steer,this.assets.bike.fullAnimLean,this.assets.bike.desLean,dt);
  this.floatOnWater(dt);
  this.stepVelocity={...this.body.linvel()};this.stepTurn={...this.body.angvel()};
  this.mountTimer=Math.max(0,this.mountTimer-dt);
  this.engine01=(this.modelId===481||this.modelId===510||this.modelId===509)?Math.min(1,Math.abs(this.throttle)):Math.min(1,Math.abs(want)/Math.max(1,top));
  if(this.occupied||this.autopilot)this.stepAudioState(dt,speed,gas,braking);
 }
 private stepAudioState(dt:number,speed:number,gas:number,braking:number){
  const a=this.audio,front=this.wheelsDown(.5)?1:0,rear=this.wheelsDown(-.5)?1:0,timeStep=dt*50,locked=braking>.5&&rear&&Math.abs(speed)>.04*50;
  let rate:number;a.driveOnGroundLastFrame=a.driveOnGround;
  if(this.quad){
   // CAutomobile::ProcessControl's rate over four wheels: a driven wheel off the ground under more than half gas races.
   const q=this.quadWheels,drive=this.assets.handling.values.driveType;rate=0;a.driveOnGround=0;
   for(let i=0;i<4;i++){
    const isFront=i===0||i===2,down=isFront?front:rear,driven=drive==='4'||isFront&&drive==='F'||!isFront&&drive==='R';
    q.counts[i]=down;q.states[i]=!isFront&&locked?'fixed':'normal';
    if(down&&driven)a.driveOnGround++;
    if(!down&&Math.abs(gas)>.5&&(isFront?drive!=='R':drive!=='F'))rate+=10;
   }
   rate*=drive==='4'?.25:.5;a.contactWheels=2*(front+rear);
  }else{
   a.counts[0]=front;a.counts[1]=rear;
   a.states[0]='normal';a.states[1]=locked?'fixed':'normal';
   // CAutomobile::ProcessControl's rate for the one driven wheel: off the ground under more than half gas it races.
   rate=(!rear&&Math.abs(gas)>.5?10:0)*.5;a.driveOnGround=rear;a.contactWheels=front+rear;
  }
  const k=Math.pow(rate>=a.spinForAudio?.95:.7,timeStep);a.spinForAudio=a.spinForAudio*k+(1-k)*rate;a.brake=braking;
  this.freewheeling=!this.motorbike&&front+rear>0&&braking<=.5&&Math.abs(gas)<=.05;
  if(!this.quad)this.gasPedal=Math.max(-1,Math.min(1,gas));
  const velocity=speed/50,h=this.assets.handling;
  if(velocity>=h.maxReverseVelocity&&velocity<=h.values.maxVelocity&&timeStep<=3){
   try{this.gear=stepNativeTransmission(h,{gear:this.gear},{velocity,throttle:Math.max(-1,Math.min(1,gas)),timeStep,hasDriveWheelContact:rear>0}).state.gear;}catch{/* The gear stays. */}
  }
 }
 /** CBmx::ProcessBunnyHop (0x6C0590) and LaunchBunnyHopCB (0x6C0390): holding the hop button charges up to 25 steps,
  * letting go plays the hop out, and then, with a front and a rear wheel down, the bike jumps
  * 0.06 x (1 + charge/25) units a frame along its up axis. The gas is cut while the hop pose holds. The turn force
  * that tips the nose is left out: this controller keeps the bike from pitching. */
 /** The ANIM_ID_BIKE_BUNNYHOP clip's length for a CBmx model's ride group, once loaded. */
 static hopClipSeconds?:(modelId:number)=>number|undefined;
 /** CBmx::ProcessBunnyHop. Under DisablePlayerControls the press is refused and the charge dropped. */
 /** iOS g_hopCooldown (0x100aacc58), seconds: LaunchBunnyHopCB sets it to 0.5, and each CBmx's ProcessControl takes
  * its frame off it (one counter for every BMX); while it runs ProcessBunnyHop is not called at all. */
 static hopCooldown=0;
 private bunnyHop(dt:number,held:boolean,disabled=false){
  if(BMX_MODELS.has(this.modelId))WorldBike.hopCooldown=Math.max(0,Math.min(HOP_COOLDOWN_SECONDS,WorldBike.hopCooldown-dt));
  if(WorldBike.hopCooldown>0&&this.hopLaunch===undefined){this.hopHeld=held;return;}
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
    WorldBike.hopCooldown=HOP_COOLDOWN_SECONDS;
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
 /** CBike's wheels ride on suspension lines, which climb a step as the line shortens; this bike's wheels are balls,
  * and a sheer step a sixth of a unit high (a sliver where two of the map's collision meshes meet, across a lane
  * near Market Station) stopped a ridden bike dead. Pushing forward into static world no higher than MAX_STEP over
  * the bottom of the bike, it is lifted onto the top of it. */
 private stepUp(forward:{x:number;y:number;z:number},ahead:number){
  // The road it stands on, straight down from the body (the collision bounds reach below the tyres).
  const MAX_STEP=.35,p=this.body.translation(),b=this.assets.collision.bounds;
  const under=this.sim.world.castRay(new RAPIER.Ray({x:p.x,y:p.y,z:p.z},{x:0,y:-1,z:0}),1.5,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!under)return;
  const bottom=p.y-under.timeOfImpact;
  // From the tail of the bike to just past its nose: the rear wheel catches on a step the front has climbed.
  const h=Math.hypot(forward.x,forward.z);if(h<.5)return;const fx=forward.x/h,fz=forward.z/h,reach=b.max[1]-b.min[1]+ahead+.15;
  const o={x:p.x+fx*b.min[1],z:p.z+fz*b.min[1]};
  const ray=(y:number)=>this.sim.world.castRayAndGetNormal(new RAPIER.Ray({x:o.x,y,z:o.z},{x:fx,y:0,z:fz}),reach,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
  // A face near vertical is a step; a hill's road is not.
  const low=ray(bottom+.05);if(!low||Math.abs(low.normal.y)>.5)return;
  // How high it reaches: the forward ray raised five hundredths at a time until it passes over (a sliver has no top
  // face to find from above); still blocked at MAX_STEP, it is a wall.
  let lift=0;
  for(let rise=.1;rise<=MAX_STEP+1e-6;rise+=.05){const r=ray(bottom+rise);if(!r||r.timeOfImpact>low.timeOfImpact+.2){lift=rise;break;}}
  if(!lift)return;
  this.body.setTranslation({x:p.x,y:p.y+lift+.02,z:p.z},true);
 }
 /** Whether the ground is under the bike (a short ray down from the body), `along` units ahead of its centre. */
 /** CBike::ProcessControl's fake physics (iOS 0x100451b3c, its limits at 0x100595eb0), as CAutomobile's: a bike that is
  * STATUS_ABANDONED or WRECKED (nobody riding or driving it) whose move and turn speed, averaged into m_vecForce and
  * m_vecTorque, stay within 0.003 and 0.0009 units a frame (0.006 and 0.0015 wrecked) times the timestep, and whose
  * speed stays under 0.005 (0.015), for more than 10 frames stops its physics: the speeds are reset and the body sleeps
  * until something touches it. An idle bike (move speed exactly nought, a tyre on the ground and no collision to
  * process: CREATE_CAR leaves one so) stops at once. The port had none of it: an empty bike on a slope rolled away, as
  * TWAR7's PCJ-600 did from behind the Ballas' house, out of its rider's reach. */
 /** The side stand's part of a step: it comes up while the bike is ridden or tipped, goes down when the last rider leaves
  * it all but stopped, and while it is down with no one on, the drawn lean eases to the stand's. False when it is up. */
 private standLean(dt:number){
  if(this.quad)return false;
  const ridden=this.occupied||!!this.autopilot||!!this.scriptDriven||this.recordingSlot>=0||!!WorldBike.hasDriverPed?.(this);
  if(ridden){this.wasRidden=true;this.onSideStand=false;return false;}
  if(this.wasRidden){this.wasRidden=false;const v=this.body.linvel();if(Math.abs(v.x)<SIDE_STAND_SPEED&&Math.abs(v.z)<SIDE_STAND_SPEED)this.onSideStand=true;}
  if(!this.onSideStand)return false;
  const q=this.body.rotation(),right=rotate(q,{x:1,y:0,z:0}),forward=rotate(q,{x:0,y:0,z:-1});
  if(Math.abs(right.y)>SIDE_STAND_ROLL||Math.abs(forward.y)>SIDE_STAND_PITCH){this.onSideStand=false;return false;}
  const keep=Math.pow(SIDE_STAND_KEEP,dt*50);
  this.lean=keep*this.lean-(1-keep)*(Math.asin(right.y)+SIDE_STAND_LEAN);
  return true;
 }
 private fakeForce={x:0,y:0,z:0};private fakeTorque={x:0,y:0,z:0};private fakeFrames=0;
 /** physicalFlags.bCarriedByRope: a crane's hook holds it. */
 carriedByRope=false;
 private get abandoned(){return !(this.occupied||this.autopilot||this.scriptDriven||this.mountTimer>0||WorldBike.hasDriverPed?.(this)||this.inWater);}
 /** CPlaceable::SetHeading or SetPosn on a bike at rest (SET_CAR_HEADING turning a script's bike where it stands): the
  * new matrix is all there is to it, as its physics stay skipped, though a wheel the turn sinks a little into a slope
  * would have the solver throw a woken body out of it. TWAR7's PCJ-600, turned in the yard behind the Ballas' house,
  * was thrown up and rolled away so. A bike someone rides or drives is placed and goes on. */
 place(position:{x:number;y:number;z:number},rotation:{x:number;y:number;z:number;w:number}){
  const body=this.body;
  body.setTranslation(position,false);body.setRotation(rotation,false);body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);
  // Idle needs a wheel on the ground (the suspension not at full stretch): one set down in the air comes down first.
  if(this.abandoned&&!this.wrecked&&this.tyreOnGround()){this.fakeFrames=10;this.stepVelocity={x:0,y:0,z:0};this.stepTurn={x:0,y:0,z:0};body.sleep();}
  else{this.fakeFrames=0;body.wakeUp();}
 }
 private skipPhysics(dt:number){
  const body=this.body;
  // physicalFlags.bCarriedByRope: on a crane's hook it never rests. Natively the gravity ProcessControl adds is in the
  // speed the fake physics averages, before the rope takes it off; here the rope's speed is all the body has.
  if(!this.abandoned||this.carriedByRope){this.fakeFrames=0;if(body.isSleeping())body.wakeUp();return false;}
  if(body.isSleeping()){this.stepVelocity={x:0,y:0,z:0};this.stepTurn={x:0,y:0,z:0};return true;}
  const v=body.linvel(),w=body.angvel(),f=this.fakeForce,t=this.fakeTorque,ts=dt*50;
  const idle=v.x===0&&v.y===0&&v.z===0&&this.tyreOnGround();
  f.x=(f.x+v.x/50)/2;f.y=(f.y+v.y/50)/2;f.z=(f.z+v.z/50)/2;t.x=(t.x+w.x/50)/2;t.y=(t.y+w.y/50)/2;t.z=(t.z+w.z/50)/2;
  const [force,torque,moving]=this.wrecked?[.006,.0015,.015]:[.003,.0009,.005];
  const rest=(force*ts)**2>=f.x*f.x+f.y*f.y+f.z*f.z&&(torque*ts)**2>=t.x*t.x+t.y*t.y+t.z*t.z&&Math.hypot(v.x,v.y,v.z)/50<moving;
  if(!rest&&!idle){this.fakeFrames=0;return false;}
  this.fakeFrames+=dt*50;
  if(this.fakeFrames<=10&&!idle)return false;
  this.fakeFrames=Math.min(this.fakeFrames,10);body.setLinvel({x:0,y:0,z:0},false);body.setAngvel({x:0,y:0,z:0},false);body.sleep();
  this.stepVelocity={x:0,y:0,z:0};this.stepTurn={x:0,y:0,z:0};return true;
 }
 /** A tyre on the ground (its suspension not at full stretch): the ground within a few centimetres under a wheel ball,
  * which the idle rest asks for. wheelsDown's reach is a ride's (it finds the road a metre under a bike in a hop). */
 private tyreOnGround(){
  // The wheels from the body's own pose: a collider's world place lags a body just set down until the next step.
  const p=this.body.translation(),q=this.body.rotation();
  for(const handle of this.wheelColliders){
   const c=this.sim.world.getCollider(handle);if(!c)continue;
   // As a suspension line, from above the wheel to a little under the tyre: a tyre sunk into a slope it was set down on
   // is on the ground too.
   const o=rotate(q,c.translationWrtParent()??{x:0,y:0,z:0}),t={x:p.x+o.x,y:p.y+o.y,z:p.z+o.z},r=(c.shape as RAPIER.Ball).radius??.3;
   if(this.sim.world.castRay(new RAPIER.Ray({x:t.x,y:t.y+r,z:t.z},{x:0,y:-1,z:0}),2*r+.15,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.body))return true;
  }
  return false;
 }
 private wheelsDown(along=0){
  const p=this.body.translation(),f=rotate(this.body.rotation(),{x:0,y:0,z:-1});
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:p.x+f.x*along,y:p.y+.2+f.y*along,z:p.z+f.z*along},{x:0,y:-1,z:0}),1.4,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.body);
  return !!hit;
 }
 /** Pin the embarked player to the bike; knock-offs eject through the reversed force formula. */
 afterStep(){
  // A new step: its pairs are read when first asked for (a resting bike with no step speed has no props pass).
  this.stepPairsRead=false;
  if(this.body.isEnabled()){
   const props=!!this.propFor&&!!this.stepVelocity&&!!this.stepTurn&&!this.wrecked;
   const out=resolveVehicleProps({world:this.sim.world,body:this.body,playerColliderHandle:this.sim.playerCollider.handle,pre:this.stepVelocity,preTurn:this.stepTurn,
    mass:this.assets.handling.values.mass,turnMass:this.assets.handling.values.turnMass,occupied:this.occupied,wrecked:this.wrecked,bike:true,propFor:this.propFor,pairs:props?this.contactPairs():undefined});
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
 waterLevel?:(x:number,y:number,z?:number,touchingWater?:boolean,normal?:number[])=>number|undefined;
 private water={touching:false};inWater=false;drowning=false;
 /** CBike::ProcessBuoyancy over WATER.DAT surfaces, at native gravity (unscaled). The controller keeps the
  * bike from pitching or rolling, so of the turn force only the yaw damping stays. Drowning with CJ on board, he loses
  * breath (HandlePlayerBreath) while a wheel still touches the bottom, and is knocked off (KNOCK_OFF_TYPE_FALL) once
  * none does; a bike with no rider has its engine cut. */
 private floatOnWater(dt:number){
  // cBuoyancy asks GetWaterLevel at the body's own height with its bTouchingWater (iOS 0x10045f9f0), so
  // limited-depth water far over it, or water far under it, is none.
  const hook=this.waterLevel;if(!hook){this.inWater=this.drowning=false;return;}
  const waterHeight=this.body.translation().y,level=(x:number,y:number)=>hook(x,y,waterHeight,this.water.touching);
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
  // CBike::VehicleDamage (iOS 0x100450e04): a collision of 1 or more, which ScalePlayerVehicleDamage leaves as it is for
  // any bike but the player's own, knocks the bike off its side stand past 20, and it goes over.
  if(hit&&this.onSideStand&&hit.intensity>=1&&(this.occupied?playerVehicleDamage(hit.intensity):hit.intensity)>20)this.onSideStand=false;
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
   // The player's own quad: iOS ScalePlayerVehicleDamage on the intensity, as for a car.
   const h=this.assets.handling.values,loss=collisionHealthLoss({intensity:this.occupied?playerVehicleDamage(hit.intensity):hit.intensity,mass:h.mass,collisionDamageMultiplier:h.collisionDamageMultiplier,playerVehicle:this.occupied,hitByPlayerVehicle:false,modelId:this.modelId});
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
    if(!other||other.isSensor()||other.handle===this.sim.playerCollider.handle||other.parent()?.handle===this.body.handle)return;
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
  this.occupied=false;this.throttle=0;this.steer=0;this.rawSteer=0;this.sim.cameraExcludedBody=undefined;this.sim.playerCollider.setEnabled(true);this.sim.player.position=spot;this.sim.player.previous={...spot};this.sim.playerBody.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z},true);this.sim.playerBody.setNextKinematicTranslation({x:spot.x,y:spot.y+.9,z:spot.z});this.sim.playerCollider.setTranslation({x:spot.x,y:spot.y+.9,z:spot.z});
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
 /** Seconds into the ride clip (BIKE_PEDAL, BIKE_RIDE): it runs while the rider is on the pedals. Held on one frame, a
  * BMX rider sat frozen mid-stroke with one knee up, leaning to the side. */
 rideTime=0;
 riderPose(){
  const prefix=this.assets.vehicle.animation,bicycle=BICYCLES.has(prefix),speed=Math.abs(this.speed());
  const idle=speed>.5?(bicycle?`${prefix}_pedal`:`${prefix}_ride`):`${prefix}_still`;
  const lean=this.quad?this.riderLean:this.lean,amount=bikeRiderLean(lean,this.assets.bike.fullAnimLean),right=this.quad?lean>0:this.steer>0;
  return {block:prefix,seat:this.seat(),time:this.rideTime,idle:prefix?idle.toLowerCase():idle,overlay:amount>.05?{clip:`${prefix}_${right?'right':'left'}`.toLowerCase(),amount}:undefined};
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
