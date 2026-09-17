import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {openStaticWorld} from '../../assets/staticWorldArchive';
import {readFxProject} from '../../assets/fxProject';
import {decodeNamedTextures} from '../../assets/modelTextures';
import {nativeTexture} from '../../assets/nativeTexture';
import type {SurfaceInfoRecord} from '../../assets/surfaceInfo';
import type {Vec3} from '../../core/math';
import {NativeFxRenderer} from '../../render/NativeFxRenderer';
import type {Simulation} from '../Simulation';
import type {WorldCar} from '../WorldCar';
import type {WorldPlane} from '../WorldPlane';
import type {WorldBoat} from '../WorldBoat';
import type {InstalledCollisionSource} from '../nativeScene';
import {nativeCollisionSurface} from '../nativeWheelSurface';
import {nativeContactBrightness} from '../../assets/collisionLighting';
import {NativeFxManager,fxPrtMult,type FxMatrix,type FxVec,type NativeFxSystem} from './NativeFx';
import {EXPLOSION,NativeFxEffects,type BulletFx} from './nativeFxEffects';
/** Browser (x, y up, z) to native (x, y north, z up). */
export const toNative=(v:Vec3):FxVec=>[v.x,-v.z,v.y];
/** Wading-foot splashes (Fx_c::TriggerFootSplash port): one water_splsh_sml
 * per stride travelled in 2–60 cm of water, with native gait-scaled stride
 * length (0.34 + 0.12 × speed: 0.7 m at 3 m/s). */
export const WADE={minDepth:.02,maxDepth:.6,stride:.7,minSpeed:.5} as const;
export function wadeStride(speed:number){return 0.34+Math.max(0,speed)*0.12;}
export function wadeStep(state:{distance:number},dt:number,speed:number,grounded:boolean,depth:number|undefined){
 if(!grounded||speed<WADE.minSpeed||depth===undefined||depth<WADE.minDepth||depth>WADE.maxDepth){state.distance=0;return false;}
 state.distance+=speed*dt;
 if(state.distance>=wadeStride(speed)){state.distance=0;return true;}
 return false;
}
/** Airborne feet crossing into open water throw one big splash (authored trigger). */
export function waterEntrySplash(wasWet:boolean,grounded:boolean,depth:number|undefined){
 return !grounded&&!wasWet&&depth!==undefined&&depth>.1;
}
/** A weapon/world hit the FX layer turns into CWeapon::DoBulletImpact particles. */
export interface FxHit {point:Vec3;normal:Vec3;collider:number;featureType?:number;featureId?:number;ped?:{head:boolean;dead:boolean;light?:number};vehicle?:boolean}
/** The WeaponSystem's view of the native FX layer (browser coordinates). */
export interface WeaponFxHost {
 readonly ready:boolean;
 explosion(type:number,position:Vec3):void;
 gunshot(origin:Vec3,direction:Vec3,weapon:number,flash:boolean):void;
 bulletHit(hit:FxHit,amount:number):void;
 areaEffect(weapon:number,origin:Vec3,direction:Vec3):void;
}
/** CVehicleModelInfo model flags NO_EXHAUST and DOUBLE_EXHAUST. */
const MODEL_FLAG_NO_EXHAUST=0x1000,MODEL_FLAG_DOUBLE_EXHAUST=0x2000;
interface CarFx {overheat?:NativeFxSystem;fire?:NativeFxSystem;matrix:FxMatrix}
/** Per-ejector damage systems for one airframe. */
interface PlaneDamage {matrix:Float64Array;systems:{overheat?:NativeFxSystem;fire?:NativeFxSystem}[]}
interface FuelBurst {bursts:ReturnType<NativeFxEffects['fuelBursts']>;timer:number}
/** Damaged-aircraft smoke bands (per-engine ejectors): smoke below 65% health,
 * fire at or below 25%, in the car's 250–650 overheat window. */
export function planeDamageBand(health:number){return health<=0||health>=520?'none':health<=200?'fire':'smoke';}
/** Loads models/effects.fxp with effectsPC.txd and binds native FX systems to the playable world. */
export class WorldFx implements WeaponFxHost {
 manager?:NativeFxManager;effects?:NativeFxEffects;renderer?:NativeFxRenderer;error?:string;
 surfaces?:ReadonlyMap<number,SurfaceInfoRecord>;
 collisionSources:()=>ReadonlyMap<number,InstalledCollisionSource>|undefined=()=>undefined;
 waterLevel:(x:number,y:number)=>number|undefined=()=>undefined;
 private cars=new Map<WorldCar,CarFx>();
 private hazards=new Map<object,NativeFxSystem>();
 private area?:{system:NativeFxSystem;weapon:number;seconds:number};
 private fuel:FuelBurst[]=[];
 private frustum=new THREE.Frustum();private projection=new THREE.Matrix4();private sphere=new THREE.Sphere();
 private disposed=false;
 /** CCustomBuildingDNPipeline::m_fDNBalanceParam for CColLighting::GetCurrentLighting. */
 private dayNight=0;
 private frame=0;
 private visible(x:number,y:number,z:number,radius:number){this.projection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);this.sphere.set(new THREE.Vector3(x,y,z),radius);return this.frustum.intersectsSphere(this.sphere);}
 constructor(private scene:THREE.Scene,private sim:Simulation,private camera:THREE.PerspectiveCamera){}
 get ready(){return !!this.effects;}
 async load(base:string){
  const source=await openStaticWorld(base),find=(path:string)=>{const r=source.manifest.resources.find(r=>r.path===path);if(!r)throw new Error(`Missing ${path}.`);return r;};
  const [text,txd]=await Promise.all([(await source.resource(find('models/effects.fxp'))).text(),(async()=>new Uint8Array(await (await source.resource(find('models/effectsPC.txd'))).arrayBuffer()))()]);
  if(this.disposed)return;
  const blueprints=readFxProject(text),names=new Set(blueprints.flatMap(s=>s.prims.flatMap(p=>p.textures.filter((t):t is string=>!!t))));
  const textures=new Map(decodeNamedTextures(names,txd).map(t=>[t.name.toLowerCase(),nativeTexture(t)]));
  const manager=new NativeFxManager(blueprints,{
   random:Math.random,
   ground:(x,y,top,bottom)=>{const hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:top,z:-y},{x:0,y:-1,z:0}),Math.max(0,top-bottom),true,RAPIER.QueryFilterFlags.ONLY_FIXED);return hit?{z:top-hit.timeOfImpact,normal:[hit.normal.x,-hit.normal.z,hit.normal.y]}:undefined;},
   waterLevel:(x,y)=>this.waterLevel(x,y),
   sphereVisible:(x,y,z,radius)=>{this.camera.updateMatrixWorld();this.projection.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse);this.frustum.setFromProjectionMatrix(this.projection);this.sphere.set(new THREE.Vector3(x,z,-y),radius);return this.frustum.intersectsSphere(this.sphere);},
  });
  this.manager=manager;this.effects=new NativeFxEffects(manager,()=>toNative(this.camera.position));
  this.renderer=new NativeFxRenderer(this.scene,manager,textures);
 }
 /** CExplosion::AddExplosion's FX, and the fuel bursts CExplosion::Update adds for vehicle blasts. */
 explosion(type:number,position:Vec3){
  const effects=this.effects;if(!effects)return;const at=toNative(position);
  effects.explosion(type,at);
  if(type===EXPLOSION.car||type===EXPLOSION.quickCar||type===EXPLOSION.boat||type===EXPLOSION.aircraft)this.fuel.push({bursts:effects.fuelBursts(at),timer:0});
 }
 gunshot(origin:Vec3,direction:Vec3,weapon:number,flash:boolean){
  const effects=this.effects;if(!effects)return;const d=toNative(direction);
  effects.gunshot(toNative(origin),d,flash);
  // CWeapon::AddGunshell: the casing leaves to the right of the shot.
  const side=Math.hypot(d[0],d[1])>1e-4?[d[1]/Math.hypot(d[0],d[1]),-d[0]/Math.hypot(d[0],d[1])]:[1,0];
  if(weapon>=22&&weapon<=34||weapon===38)effects.gunshell(toNative(origin),[side[0]*.6,side[1]*.6],weapon===38?.5:.1,weapon>=25&&weapon<=27);
 }
 /** CWeapon::DoBulletImpact: blood on peds, sparks on vehicles, the surface BULLET_FX elsewhere. */
 bulletHit(hit:FxHit,amount:number){
  const effects=this.effects;if(!effects)return;
  const point=toNative(hit.point),normal=toNative(hit.normal);
  if(hit.ped){effects.blood(point,normal,hit.ped.head?hit.ped.dead?32:16:amount,hit.ped.light??1);return;}
  let bulletFx:BulletFx='SPARKS',light=1,glass=false;
  const source=hit.vehicle?undefined:this.collisionSources()?.get(hit.collider)?.source;
  if(source){const surface=nativeCollisionSurface(source,{featureType:hit.featureType as RAPIER.FeatureType,featureId:hit.featureId});if(surface){bulletFx=(this.surfaces?.get(surface.material)?.bulletFx as BulletFx|undefined)??'SPARKS';light=nativeContactBrightness(surface.light,this.dayNight);glass=this.surfaces?.get(surface.material)?.values.glass===1;}}
  effects.bulletImpact(point,normal,bulletFx,amount,light,glass);
 }
 /** CWeapon::DoWeaponEffect while an area weapon fires; StopWeaponEffect once it has not fired for a moment. */
 areaEffect(weapon:number,origin:Vec3,direction:Vec3){
  const effects=this.effects;if(!effects)return;
  if(this.area&&this.area.weapon!==weapon){this.area.system.kill();this.area=undefined;}
  const system=effects.weaponEffect(this.area?.system,weapon,toNative(origin),toNative(direction));
  this.area=system?{system,weapon,seconds:0}:undefined;
 }
 /** CFire FX for burning hazards and the tear gas cloud for gas grenades. */
 syncHazards(hazards:readonly {kind:'flame'|'gas';position:Vec3}[]){
  const effects=this.effects;if(!effects)return;
  const live=new Set<object>(hazards);
  for(const [hazard,system] of this.hazards)if(!live.has(hazard)){system.kill();this.hazards.delete(hazard);}
  for(const hazard of hazards)if(!this.hazards.has(hazard)){const system=hazard.kind==='flame'?effects.fire(toNative(hazard.position)):effects.fx.create('teargas',toNative(hazard.position),undefined,true)?.play();if(system)this.hazards.set(hazard,system);}
 }
 /** CVehicle::AddDamagedVehicleParticles and CAutomobile::ProcessCarOnFireAndExplode for every car. */
 private updateCars(cars:Iterable<WorldCar>){
  const effects=this.effects!,live=new Set<WorldCar>();
  for(const car of cars){
   live.add(car);let state=this.cars.get(car);if(!state){state={matrix:new Float64Array(12)};this.cars.set(car,state);}
   const body=car.car.body,p=body.translation(),q=new THREE.Quaternion(body.rotation().x,body.rotation().y,body.rotation().z,body.rotation().w);
   const axis=(x:number,y:number,z:number)=>new THREE.Vector3(x,z,-y).applyQuaternion(q);
   const r=axis(1,0,0),f=axis(0,1,0),u=axis(0,0,1);
   state.matrix.set([r.x,-r.z,r.y,f.x,-f.z,f.y,u.x,-u.z,u.y,p.x,-p.z,p.y]);
   const v=body.linvel(),velocity:FxVec=[v.x,-v.z,v.y],engine=car.car.nativeFramePosition('engine'),dummy:FxVec=engine?[engine.x,engine.y,engine.z]:[0,1.5,.3];
    state.overheat=effects.overheat(state.overheat,car.wrecked?0:car.health,car.assets.handling.values.engineType==='E',dummy,state.matrix,velocity,false);
    state.fire=effects.carFire(state.fire,car.onFire,dummy,state.matrix,velocity);
    // cBuoyancy::AddSplashParticles for cars in water (same prt_watersplash path as aircraft).
    for(const splash of car.splashes)effects.statics.prt_watersplash?.addParticle(splash.position,splash.velocity,0,fxPrtMult(1,1,1,.1,.5,1,.2));
    car.splashes.length=0;
   // CAutomobile::PreRender runs AddExhaustParticles for running engines.
   if(!car.wrecked&&(car.occupied||car.autopilot)&&!(car.modelFlags&MODEL_FLAG_NO_EXHAUST)&&this.visible(p.x,p.y,p.z,3)){
    const exhaust=car.car.nativeFramePosition('exhaust');
    if(exhaust)effects.exhaust({camera:toNative(this.camera.position),position:[p.x,-p.z,p.y],matrix:state.matrix,exhaust:[exhaust.x,exhaust.y,exhaust.z],doubleExhaust:(car.modelFlags&MODEL_FLAG_DOUBLE_EXHAUST)!==0,
     moveSpeed:[velocity[0]/50,velocity[1]/50,velocity[2]/50],gasPedal:car.gasPedal,gear:car.gear,frame:this.frame,modelId:car.modelId,brightness:car.contactBrightness(this.dayNight),waterLevel:(x,y)=>this.waterLevel(x,y)});
   }
  }
  for(const [car,state] of this.cars)if(!live.has(car)){state.overheat?.kill();state.fire?.kill();this.cars.delete(car);}
 }
  private dust=new Map<WorldPlane,{system?:NativeFxSystem;timeConst:number}>();
  private planeDamage=new Map<WorldPlane,PlaneDamage>();
 /** Helicopters (and the Hydra hovering) run DoHeliDustEffect; rotor speed follows the browser throttle. */
 private updateAircraft(planes:Iterable<WorldPlane>){
  const effects=this.effects!,live=new Set<WorldPlane>();
  for(const plane of planes){
   live.add(plane);let state=this.dust.get(plane);if(!state){state={timeConst:0};this.dust.set(plane,state);}
   const p=plane.body.translation(),hover=plane.helicopter||plane.modelId===520&&plane.vtol;
   let groundZ:number|undefined,sand=false;
   if(hover){const hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({x:p.x,y:p.y,z:p.z},{x:0,y:-1,z:0}),1000,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(hit){groundZ=p.y-hit.timeOfImpact;const source=this.collisionSources()?.get(hit.collider.handle)?.source,surface=source&&nativeCollisionSurface(source,hit);sand=!!surface&&(this.surfaces?.get(surface.material)?.values.sand??0)!==0;}}
   // CHeli rotor speed 0.1125 of a 0.22 maximum: about half throttle.
   effects.heliDust(state,{camera:toNative(this.camera.position),position:[p.x,-p.z,p.y],rotorOn:hover&&plane.health>0&&plane.throttle*.22>=.1125,groundZ,sand,waterLevel:this.waterLevel(p.x,-p.z)});
    // cBuoyancy::AddSplashParticles: FxPrtMult_c(1, 1, 1, 0.1, 0.5, 1, 0.2) on prt_watersplash.
    for(const splash of plane.splashes)effects.statics.prt_watersplash?.addParticle(splash.position,splash.velocity,0,fxPrtMult(1,1,1,.1,.5,1,.2));
    plane.splashes.length=0;
    // Damaged-aircraft smoke from the engine ejectors (one system per ejector).
    let damage=this.planeDamage.get(plane);if(!damage){damage={matrix:new Float64Array(12),systems:[]};this.planeDamage.set(plane,damage);}
    const body=plane.body,bp=body.translation(),bq=new THREE.Quaternion(body.rotation().x,body.rotation().y,body.rotation().z,body.rotation().w);
    const baxis=(x:number,y:number,z:number)=>new THREE.Vector3(x,z,-y).applyQuaternion(bq);
    const br=baxis(1,0,0),bf=baxis(0,1,0),bu=baxis(0,0,1);
    damage.matrix.set([br.x,-br.z,br.y,bf.x,-bf.z,bf.y,bu.x,-bu.z,bu.y,bp.x,-bp.z,bp.y]);
    const bv=body.linvel(),bvel:FxVec=[bv.x,-bv.z,bv.y],ejectors=plane.engineEjectors?.()??[{x:0,y:0,z:0}];
    while(damage.systems.length<ejectors.length)damage.systems.push({});
    damage.systems.length=ejectors.length;
    const dmatrix=damage.matrix,slots=damage.systems;
    ejectors.forEach((ejector,i)=>{
     const dummy:FxVec=[ejector.x,ejector.y,ejector.z],slot=slots[i];
     slot.overheat=effects.overheat(slot.overheat,plane.health*1.25,false,dummy,dmatrix,bvel,plane.inWater);
     slot.fire=effects.carFire(slot.fire,planeDamageBand(plane.health)==='fire',dummy,dmatrix,bvel);
    });
   }
   for(const [plane,state] of this.dust)if(!live.has(plane)){state.system?.kill();this.dust.delete(plane);}
   for(const [plane,state] of this.planeDamage)if(!live.has(plane)){for(const s of state.systems){s.overheat?.kill();s.fire?.kill();}this.planeDamage.delete(plane);}
  }
  /** Boat spray, stern spray, wake ribbon support and burn visuals (fire sits on the per-model fire dummy). */
  private boatDamage=new Map<WorldBoat,CarFx>();
  private updateBoats(boats:Iterable<WorldBoat>){
   const effects=this.effects!;if(!effects)return;
   const camera=toNative(this.camera.position),live=new Set<WorldBoat>();
   for(const boat of boats){
    live.add(boat);
    for(const splash of boat.splashes)effects.statics.prt_watersplash?.addParticle(splash.position,splash.velocity,0,fxPrtMult(1,1,1,.1,.5,1,.2));
    boat.splashes.length=0;
    const body=boat.body,p=body.translation(),q=new THREE.Quaternion(body.rotation().x,body.rotation().y,body.rotation().z,body.rotation().w);
    const axis=(x:number,y:number,z:number)=>new THREE.Vector3(x,z,-y).applyQuaternion(q);
    const r=axis(1,0,0),f=axis(0,1,0),u=axis(0,0,1);
    const matrix:Float64Array=new Float64Array([r.x,-r.z,r.y,f.x,-f.z,f.y,u.x,-u.z,u.y,p.x,-p.z,p.y]);
    const v=body.linvel(),velocity:FxVec=[v.x,-v.z,v.y],speedSq=(v.x*v.x+v.y*v.y+v.z*v.z)/2500,b=boat.assets.collision!.bounds;
    effects.boatSplash({matrix,origin:[p.x,-p.z,p.y],boundsMin:[...b.min] as FxVec,boundsMax:[...b.max] as FxVec,
     forward:[f.x,-f.z,f.y],right:[r.x,-r.z,r.y],up:[u.x,-u.z,u.y],speedSq,cameraDist:Math.hypot(p.x-camera[0],-p.z-camera[1])});
    let damage=this.boatDamage.get(boat);if(!damage){damage={matrix:new Float64Array(12)};this.boatDamage.set(boat,damage);}
    damage.matrix.set(matrix);
    const stern=boat.fireDummy?.()??{x:0,y:0,z:1},burn:FxVec=[stern.x,stern.y,stern.z];
    damage.overheat=effects.overheat(damage.overheat,boat.wrecked?0:boat.health,false,burn,damage.matrix,velocity,boat.inWater);
    damage.fire=effects.carFire(damage.fire,boat.onFire,burn,damage.matrix,velocity);
   }
   for(const [boat,state] of this.boatDamage)if(!live.has(boat)){state.overheat?.kill();state.fire?.kill();this.boatDamage.delete(boat);}
  }
 /** CWeather rain and sandstorm particles. CWeather::AddRain port (0x72A9A0): ground splashes around the camera
  * with the FxPrtMult the reversed ped and vehicle rain splashes use; AddSandStormParticles is native. */
 weather(input:{rain:number;sandstorm:number;wind:number;windDir:FxVec;noRain:boolean}){
  const manager=this.manager,effects=this.effects;if(!manager||!effects)return;
  manager.wind=input.wind;manager.windSpeed=input.wind;manager.rain=input.rain;manager.windDir=input.windDir;
  if(input.noRain)return;
  const camera=toNative(this.camera.position),forward=this.camera.getWorldDirection(new THREE.Vector3()),f:FxVec=[forward.x,-forward.z,forward.y];
  if(input.rain>0&&camera[2]<=900){
   const count=Math.trunc(input.rain*3+Math.random());
   for(let i=0;i<count;i++){
    const d=3+Math.random()*9,x=camera[0]+f[0]*d+(Math.random()*2-1)*8,y=camera[1]+f[1]*d+(Math.random()*2-1)*8,ground=manager.world.ground?.(x,y,camera[2]+5,camera[2]-30);
    if(ground)effects.statics.prt_splash?.addParticle([x,y,ground.z+.02],[0,0,0],0,{r:1,g:1,b:1,a:.35,size:.02,rot:0,life:.03});
   }
  }
  if(input.sandstorm>0&&Math.random()<input.sandstorm)effects.sandstorm(camera,f,input.windDir);
 }
  /** Fx_c::Update for one rendered frame (FX run on frame time, not the fixed simulation step). */
  step(dt:number,cars:Iterable<WorldCar>,hazards:readonly {kind:'flame'|'gas';position:Vec3}[],planes:Iterable<WorldPlane>=[],walkers:readonly {key?:object;position:Vec3;speed:number;grounded:boolean}[]=[],boats:Iterable<WorldBoat>=[]){
   const manager=this.manager;if(!manager||!(dt>0))return;
   this.frame++;this.syncHazards(hazards);this.updateCars(cars);this.updateAircraft(planes);this.updateBoats(boats);this.updateWade(walkers,dt);
  if(this.area){this.area.seconds+=dt;if(this.area.seconds>.2){this.area.system.kill();this.area=undefined;}}
  for(const burst of this.fuel){burst.timer+=dt*1000;if(burst.timer<=200)for(const b of burst.bursts)this.effects!.stepFuelBurst(b,burst.timer);}
  this.fuel=this.fuel.filter(b=>b.timer<=200);
  manager.update(toNative(this.camera.position),dt);
 }
  /** Wading feet, player plus pedestrians (authored TriggerFootSplash): small
   * splashes while walking through shallow water, one big splash per airborne entry. */
  private wadePlayer={distance:0,wasWet:false};
  private wadePeds=new Map<object,{distance:number;wasWet:boolean}>();
  private updateWade(walkers:readonly {key?:object;position:Vec3;speed:number;grounded:boolean}[],dt:number){
   const effects=this.effects;if(!effects)return;
   const seen=new Set<object>();
   for(const walker of walkers){
    let state:{distance:number;wasWet:boolean};
    if(walker.key){seen.add(walker.key);let entry=this.wadePeds.get(walker.key);if(!entry){entry={distance:0,wasWet:false};this.wadePeds.set(walker.key,entry);}state=entry;}
    else state=this.wadePlayer;
    const p=walker.position,level=this.waterLevel(p.x,-p.z),depth=level===undefined?undefined:level-p.y;
    if(waterEntrySplash(state.wasWet,walker.grounded,depth)&&level!==undefined)
     effects.waterSplash([p.x,-p.z,level],'big');
    state.wasWet=depth!==undefined&&depth>.1;
    if(wadeStep(state,dt,walker.speed,walker.grounded,depth))
     effects.waterSplash([p.x,-p.z,p.y+.05],'foot');
   }
   for(const key of [...this.wadePeds.keys()])if(!seen.has(key))this.wadePeds.delete(key);
  }
  /** Fx_c::Render after the camera is placed; `dayNightBalance` is 1 at night. */
 draw(dayNightBalance:number){this.dayNight=dayNightBalance;this.renderer?.update(this.camera,dayNightBalance);}
 snapshot(){return this.manager?{...this.manager.snapshot(),...this.renderer!.snapshot(),cars:[...this.cars.values()].filter(c=>c.overheat||c.fire).length,hazards:this.hazards.size,area:this.area?.system.name??null}:{error:this.error??null,loading:true};}
 dispose(){this.disposed=true;this.renderer?.dispose();this.manager?.clear();this.cars.clear();this.hazards.clear();for(const state of this.boatDamage.values()){state.overheat?.kill();state.fire?.kill();}this.boatDamage.clear();}
}
