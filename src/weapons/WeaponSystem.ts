import {Vector3,Quaternion} from 'three';
import type {WorldPlane} from '../simulation/WorldPlane';
import RAPIER from '@dimforge/rapier3d-compat';
import {WeaponInventory} from './Inventory';
import {weaponById,type WeaponDefinition} from './catalog';
import {WEAPON_FLAG,hasWeaponFlag,nativeAimOffset,nativeWeaponInfo,nativeWeaponRadiusOnScreen,CROSSHAIR_TANGENT,type NativeWeaponData,type NativeWeaponInfo} from './weaponData';
import type {Simulation} from '../simulation/Simulation';
import type {WorldPedestrians} from '../simulation/WorldPedestrians';
import type {WorldFleet} from '../simulation/WorldFleet';
import type {Vec3} from '../core/math';
import {bulletTyreHit,pushShotVehicle} from './bulletVehicle';
import {HeatSeekLock,pickHeatSeekTarget,type HeatSeekCandidate} from './nativeHeatSeeker';
import {CRIME} from '../simulation/nativeWanted';
import {meleeComboFor} from '../weapons/gunnery';
import {NativeFireManager,explosionFireCount,type FireTarget} from '../combat/nativeFire';
import {EXPLOSION,explosionDirection,explosionFalloff,explosionOnPed,explosionOnVehicle,explosionParams,type ExplosionParams} from '../combat/nativeExplosion';
import type {MeleeSwing} from '../simulation/nativeMelee';
import {launchVelocity,projectileTuning} from '../weapons/gunnery';
import type {WeaponFxHost} from '../simulation/fx/WorldFx';
import {firstPersonMode,isRocketMode,type FirstPersonMode} from './nativeFirstPerson';
/** CProjectileInfo launch helpers shared by player and aircraft fire. */
function projectileVelocity(kind:string,direction:Vec3):Vec3{try{return launchVelocity(kind,direction);}catch{return add(direction,{x:0,y:0,z:0});}}
function projectileFuse(kind:string,rocket:boolean){try{return projectileTuning(kind).fuse;}catch{return rocket?8:kind==='satchel'?Infinity:3;}}
/** Native handheld IDs usable one-handed from a car (authored set; the gang task is not reversed). */
const DRIVEBY_WEAPONS=new Set([22,23,24,26,28,29,30,32]);
/** eExplosionType values the weapon system raises (CExplosion::AddExplosion). */
const EXPLOSION_TYPE=EXPLOSION;
/** How the player damaged something, for native crime reporting. */
export type DamageKind='melee'|'bullet'|'explosion'|'fire'|'spray';
/** A pedestrian hit reported back to the weapon system. */
export interface PedestrianVictim {id:number;officer:boolean}
export interface WeaponEffect {id:number;kind:'tracer'|'impact'|'explosion'|'flame'|'gas'|'spray'|'extinguisher';from:Vec3;to:Vec3;life:number;radius:number;}
export interface Projectile {id:number;weapon:number;position:Vec3;velocity:Vec3;fuse:number;stuck:boolean;target?:number;owner?:number;}
/** CBulletInfo: a sniper bullet, with the peds it has already hit. */
interface SniperBullet {weapon:number;damage:number;position:Vec3;direction:Vec3;destroyAt:number;passed:Set<number>;}
interface Hazard {kind:'flame'|'gas';position:Vec3;remaining:number;tick:number;radius:number;}
/** CShotInfo: native area-effect particles for the flamethrower, spray can and extinguisher. */
export interface AreaShot {weapon:number;origin:Vec3;velocity:Vec3;range:number;remaining:number;executed:boolean;age:number;}
const add=(a:Vec3,b:Vec3,s=1):Vec3=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s});
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const normalize=(a:Vec3):Vec3=>{const l=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/l,y:a.y/l,z:a.z/l};};
/** Native simulation steps are 1/50 s; CShotInfo speeds are per step. */
const NATIVE_STEP=1/50;
/** SetUpPelletCol accepts at most 15 pellet lines. */
const PELLETS=15;
/** CShotInfo::ms_afRandTable: -0.05 to 0.045 in 0.005 steps. */
const randTable=()=>-.05+.005*Math.floor(Math.random()*20);
export class WeaponSystem {
 readonly inventory=new WeaponInventory();
 effects:WeaponEffect[]=[];projectiles:Projectile[]=[];hazards:Hazard[]=[];shots:AreaShot[]=[];
 vision:'nightvision'|'infrared'|null=null;parachute=false;photoRequested=false;ready=true;aiming=false;
 /** Melee combo chain (melee.dat hit/chain frames): stage and last landed hit. */
 private meleeStage=0;private meleeAt=-10;private meleeWeapon=-1;
 /** CTaskSimpleFight's pending strike: it lands on the move's melee.dat hit frame, from where the player stands then. */
 private strike?:{remaining:number;weapon:number;damage:number;move:number;range:number;target?:number;whip?:boolean};
 /** CTaskSimpleUseGun's m_LastCmd was PISTOLWHIP: the next whip waits for another command. */
 private lastWhip=false;
 /** GUN_BUTT starts (crouched or standing). */
 onPistolWhip?:(crouched:boolean)=>void;
 /** The held melee weapon's combo group and its victim clips (FIGHT_HIT_1..3), from the weapon view. */
 meleeClips?:()=>{group?:string;hits?:readonly import('../assets/ifp').NativeAnimation[];durations?:{attacks:readonly number[];ground?:number;moving?:number}}|undefined;
 /** An attack press during a move: the next move starts at this one's chain frame. */
 private meleeQueued=false;
 /** What the crosshair rests on while aiming a gun: m_p3rdPersonMouseTarget. With mouse and keys
  * (CCamera::m_bUseMouse3rdPerson), ProcessPlayerWeapon clears any weapon lock each frame, so shots follow the crosshair;
  * Compute3rdPersonMouseTarget is a stub, and the first ped or vehicle on the crosshair ray stands in for it. */
 lock?:{handle:number;position:Vec3};
 private lockCamera?:{origin:Vec3;direction:Vec3};
 /** CPlayerPed::GetWeaponRadiusOnScreen for the held gun: the crosshair's size and the shot's spread. */
 get crosshairRadius(){const info=this.inventory.info();return info&&info.fire!=='melee'?nativeWeaponRadiusOnScreen(info,0,this.sim.player.crouched):.2;}
 hits=0;explosions=0;aircraftShots=0;private aircraftCooldown=0;private serial=0;
 /** The camera's first-person weapon mode (the sniper, rocket or camera view), set by the caller each frame. */
 firstPerson?:FirstPersonMode;
 /** The heat seeker's lock in its camera (CPlayerPedData's HS missile fields), keyed by vehicle body handle. */
 private hsLock=new HeatSeekLock<number>();private hsCamera=false;
 /** CBulletInfo::aBulletInfos: at most eight sniper bullets in flight. */
 private bullets:SniperBullet[]=[];
 /** Twin pistols alternate hands; true when the next shot leaves the left gun. */
 leftHand=false;lastHand:'right'|'left'='right';
 muzzle?:(left?:boolean)=>Vec3|undefined;
 /** CAECollisionAudioEntity::ReportBulletHit: the struck collider, the hit point and asin(-dir·normal) in degrees. */
 onBulletHit?:(hit:RAPIER.RayColliderIntersection,point:Vec3,angle:number)=>void;
 onSound?:(event:import('../assets/nativeCombatAudio').CombatSound,weapon:number,position:Vec3,source?:'player'|'npc'|'aircraft'|'stealth')=>void;
 private reloadSoundId=-1;private reloadSoundA=false;private reloadSoundB=false;
 onUse?:(w:WeaponDefinition)=>void;
 /** Water surface height at a native x/y, when there is water there. */
 waterLevel?:(x:number,y:number)=>number|undefined;
 /** TriggerExplosion's object pass, for the scene's OBJECT.DAT props. Renderer-frame point. */
 onExplosion?:(point:Vec3,params:ExplosionParams)=>void;
 /** CWeapon::DoBulletImpact's object branch for a bullet hitting a non-ped, non-vehicle collider. `incremental` marks a shotgun pellet. */
 onObjectShot?:(hit:RAPIER.RayColliderIntersection,point:Vec3,incremental:boolean)=>void;
 /** The melee swing CTaskSimpleFight plays: a combo stage, the ground attack or the moving attack. */
 onMeleeSwing?:(w:WeaponDefinition,swing:MeleeSwing)=>void;
 onHit?:(weapon:number)=>void;
 /** CCrime::ReportCrime (`queued` false) and CWanted::RegisterCrime from CEventDamage::ReportCriminalEvent (`queued` true). */
 onCrime?:(type:number,victim:string|undefined,queued?:boolean)=>void;
 /** CTaskSimpleStealthKill (keepTargetAlive): the attacker's KILL_Knife_Player sequence. */
 stealth?:{id:number;remaining:number;target:Vec3};
 /** Seconds the KILL_Partial ready pose has been held on the current victim. */
 stealthReady=0;private stealthCandidate?:number;
 onStealth?:(seconds:number)=>void;
 stealthClipSeconds=2.67;
 /** Pending goggles_put_on animation before vision toggles. */
 goggles?:{kind:'nightvision'|'infrared';remaining:number};
 gogglesClipSeconds=.8;
 /** The player's move blend ratio and sprint state, from the movement associations. */
 playerMove?:()=>{blendRatio:number;sprinting:boolean}|undefined;
 /** ProcessPlayerWeapon's KILL_Partial gate: the target button held with a weapon whose anim group is loaded (only the
  * knife's row names one, stealth_kn), a move blend ratio under 1.9, no sprint and no attack task running. */
 stealthTarget(){
  const info=this.inventory.info();if(!this.aiming||this.stealth||!info||info.animGroup!=='stealth_kn'||this.sim.player.health<=0||!this.sim.player.grounded)return undefined;
  const move=this.playerMove?.();if(move?move.blendRatio>=1.9||move.sprinting:this.sim.player.speed>=3)return undefined;
  if(this.strike||this.inventory.cooldown>0)return undefined;
  return this.pedestrians()?.stealthTarget?.(this.sim.player.position,this.lockCamera);
 }
 npcShot(from:Vec3,to:Vec3,weapon=22,hit=true){this.tracer(from,to,'ped',.09);if(hit)this.effect('impact',to);this.fx?.gunshot(from,normalize(add(to,from,-1)),weapon,false);}
 /** Native FX (effects.fxp); the sphere effects remain as the fallback while it loads or when it is unavailable. */
 fx?:WeaponFxHost;
  constructor(readonly sim:Simulation,private pedestrians:()=>({damageCollider(handle:number,damage:number,direction:{x:number;z:number},kind?:DamageKind,hit?:{weapon?:number;point?:Vec3}):boolean|PedestrianVictim}&Pick<WorldPedestrians,'targets'|'frighten'>&Partial<Pick<WorldPedestrians,'stealthTarget'|'stealthKill'|'gunShot'|'pedPosition'>>)|undefined,private fleet:()=>(Pick<WorldFleet,'cars'|'boats'>&Partial<Pick<WorldFleet,'planes'|'bikes'>>)|undefined){}
 installNative(data:NativeWeaponData){this.inventory.installNative(data);}
 get native(){return this.inventory.native;}
 snapshot(){return {...this.inventory.snapshot(),native:!!this.native,ready:this.ready,aircraftShots:this.aircraftShots,hits:this.hits,explosions:this.explosions,projectiles:this.projectiles.length,bullets:this.bullets.length,hazards:this.hazards.length,heatSeek:{target:this.hsLock.marked??null,locked:this.hsLock.locked(this.nowMs)},fires:this.fires.active.length,pedFires:this.fires.active.flatMap(f=>f.target?.kind==='ped'?[f.target.key as number]:[]),areaShots:this.shots.length,shotProbe:this.shots.slice(-3).map(s=>({o:[+s.origin.x.toFixed(2),+s.origin.y.toFixed(2),+s.origin.z.toFixed(2)],v:+Math.hypot(s.velocity.x,s.velocity.y,s.velocity.z).toFixed(2),range:s.range,executed:s.executed,age:+s.age.toFixed(2)})),hand:this.lastHand,lock:this.lock?.handle??null,satchels:this.projectiles.filter(p=>p.weapon===39).length,vision:this.vision,parachute:this.parachute};}
 /** Every bullet line, as CWeapon's instant-hit fire hands it to CBirds::HandleGunShot. */
 onBulletLine?:(from:Vec3,to:Vec3)=>void;
 /** CBulletTraces::AddTrace for a bullet line: `player` and `ped` shots take the weapon wrapper (0x726AF0), aircraft guns
  * FireOneInstantHitRound's heavier streak. */
 onTrace?:(from:Vec3,to:Vec3,source:'player'|'ped'|'aircraft')=>void;
 /** CWorld::SprayPaintWorld for a spray-can shot at a native point, and the chime when it finished a tag. */
 onSprayPaint?:(point:[number,number,number],radius:number)=>'notFound'|'discovered'|'painted';onSprayPainted?:()=>void;
 private tracer(from:Vec3,to:Vec3,source:'player'|'ped'|'aircraft',life:number){this.onTrace?.(from,to,source);this.effect('tracer',from,to,life);}
 private effect(kind:WeaponEffect['kind'],from:Vec3,to=from,life=.12,radius=.1){if(kind==='tracer')this.onBulletLine?.(from,to);this.effects.push({id:this.serial++,kind,from:{...from},to:{...to},life,radius});if(this.effects.length>128)this.effects.shift();}
 private ray(from:Vec3,direction:Vec3,range:number,body=this.sim.playerBody){return this.sim.world.castRayAndGetNormal(new RAPIER.Ray(from,direction),range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,body);}
 private damage(handle:number,amount:number,direction:Vec3,explosive=false,kind:DamageKind=explosive?'explosion':'bullet',hit?:{weapon?:number;point?:Vec3;fight?:import('../simulation/WorldPedestrians').MeleeFight;pistolWhip?:boolean;push?:{x:number;z:number}}){
  // The weapon id and hit point feed CEventDamage::ComputeAnim for pedestrians.
  const victim=this.pedestrians()?.damageCollider(handle,amount,direction,kind,hit);
  if(victim){
   this.hits++;
   if(typeof victim==='object'){
    const id=`ped:${victim.id}`,cop=victim.officer;
    // CWeapon::FireInstantHit and the melee hit report with a witness check; every damage event also queues its crime.
    const type=kind==='melee'?cop?CRIME.damagedCop:CRIME.damagedPed:kind==='bullet'||kind==='spray'?cop?CRIME.damageCopCar:CRIME.damageCar:CRIME.none;
    if(type!==CRIME.none){if(kind!=='spray')this.onCrime?.(type,id);this.onCrime?.(type,id,true);}
   }
   return true;
  }
   for(const car of this.fleet()?.cars??[]){for(let i=0;i<car.car.body.numColliders();i++)if(car.car.body.collider(i).handle===handle&&!car.wrecked){this.hits++;if(car.damage(amount,handle,explosive,kind==='bullet'?direction:undefined))this.onCrime?.(CRIME.destroyVehicle,`car:${car.car.body.handle}`);this.releaseExplosions();return true;}}
   for(const boat of this.fleet()?.boats??[])if(!boat.wrecked&&boat.body.numColliders()&&[...Array(boat.body.numColliders()).keys()].some(i=>boat.body.collider(i).handle===handle)){this.hits++;if(boat.damage(amount))this.onCrime?.(CRIME.destroyVehicle,`boat:${boat.body.handle}`);return true;}
  for(const plane of this.fleet()?.planes??[])for(let i=0;i<plane.body.numColliders();i++)if(plane.body.collider(i).handle===handle&&plane.health>0){this.hits++;if(plane.damage(amount)){this.onCrime?.(plane.helicopter?CRIME.destroyHeli:CRIME.destroyPlane,`plane:${plane.body.handle}`);this.explode(plane.body.translation(),EXPLOSION_TYPE.aircraft,plane);}return true;}
  return false;
 }
 private radial(position:Vec3,radius:number,damage:number,ignitePeople=false){
  const people=this.pedestrians()?.targets()??[];
  // CFire spreads to nearby peds as a 7000 ms burn instead of direct blast damage.
  if(ignitePeople&&this.native)for(const person of people)if(distance(position,person.position)<radius&&!this.burning.has(person.handle))this.burning.set(person.handle,7);
   const targets=[...(ignitePeople&&this.native?[]:people),...[...(this.fleet()?.planes??[])].filter(p=>p.health>0).map(p=>({handle:p.body.collider(0).handle,position:{...p.body.translation()}})),...[...(this.fleet()?.cars??[])].filter(c=>!c.wrecked).map(c=>({handle:c.car.body.collider(0).handle,position:{...c.car.body.translation()}})),...[...(this.fleet()?.boats??[])].filter(b=>!b.wrecked).map(b=>({handle:b.body.collider(0).handle,position:{...b.body.translation()}}))];
  for(const target of targets){const d=distance(position,target.position);if(d>=radius)continue;const dir=normalize(add(target.position,position,-1));
   const wall=this.sim.world.castRay(new RAPIER.Ray(position,dir),Math.max(0,d-.1),true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(wall)continue;
   this.damage(target.handle,damage*(1-d/radius),dir,true);
  }
  if(this.sim.playerBody.isEnabled()&&this.sim.playerCollider.isEnabled()&&this.sim.player.health>0){const center=this.sim.playerBody.translation(),d=distance(position,center);if(d<radius&&!this.sim.world.castRay(new RAPIER.Ray(position,normalize(add(center,position,-1))),Math.max(0,d-.1),true,RAPIER.QueryFilterFlags.ONLY_FIXED))this.sim.damagePlayer(damage*(1-d/radius));}
 }
 /** CExplosion::AddExplosion: FX and sound, then CWorld::TriggerExplosion's one-shot damage and push. */
 private explode(position:Vec3,type:number=EXPLOSION_TYPE.grenade,victim?:object){
  const params=explosionParams(type);
  this.explosions++;this.onSound?.('explosion',0,position);this.effect('explosion',position,position,.8,params.radius);this.fx?.explosion(type,position);this.pedestrians()?.frighten(position,45);
  if(params.force>0)this.blast(position,params,victim);
  if(type===EXPLOSION_TYPE.molotov){
   // The molotov sits on the ground below it; underwater it lights nothing.
   const ground=this.sim.world.castRay(new RAPIER.Ray({...position,y:position.y+3},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   const at=ground?{...position,y:position.y+3-ground.timeOfImpact}:position,water=this.waterLevel?.(at.x,-at.z);
   if(water!==undefined&&at.y<water)return;
   this.molotovs.push({position:at,remaining:params.durationMs/1000});this.explosionFires(at,true);
  }else if(type===EXPLOSION_TYPE.rocket||type===EXPLOSION_TYPE.weakRocket||type===EXPLOSION_TYPE.object)this.explosionFires(position,false);
 }
 /** CWorld::TriggerExplosionSectorList over peds, the player, vehicles and (through onExplosion) props.
  * Everything whose position is inside the radius is hit; there is no line-of-sight test. */
 private blast(position:Vec3,params:ExplosionParams,victim?:object){
  const toNative=(v:Vec3)=>({x:v.x,y:-v.z,z:v.y}),fromNative=(v:Vec3)=>({x:v.x,y:v.z,z:-v.y}),point=toNative(position);
  for(const person of this.pedestrians()?.targets()??[]){
   const falloff=explosionFalloff(params.radius,distance(position,person.position));if(!falloff)continue;
   const dir=explosionDirection(point,toNative(person.position));
   const hit=explosionOnPed({falloff,force:params.force,direction:dir,moveSpeed:{x:0,y:0,z:0},standing:!person.down});
   // ApplyMoveForce on a 70 kg ped: the horizontal velocity change in m/s.
   const push=fromNative({x:hit.impulse.x/70*50,y:hit.impulse.y/70*50,z:0});
   this.damage(person.handle,hit.damage,normalize({x:push.x||1e-4,y:0,z:push.z}),true,'explosion',{weapon:51,push:{x:push.x,z:push.z}});
  }
  if(this.sim.playerBody.isEnabled()&&this.sim.playerCollider.isEnabled()&&this.sim.player.health>0){
   const falloff=explosionFalloff(params.radius,distance(position,this.sim.playerBody.translation()));
   if(falloff)this.sim.damagePlayer(250*falloff,false,{weapon:51,from:{x:position.x,z:position.z}});
  }
  for(const car of this.fleet()?.cars??[]){
   const body=car.car.body,at=body.translation(),falloff=explosionFalloff(params.radius,distance(position,at));if(!falloff)continue;
   const r=body.rotation(),q=new Quaternion(r.x,r.y,r.z,r.w),inv=q.clone().invert(),native=car.nativeBody;
   const localBrowser=new Vector3(position.x-at.x,position.y-at.y,position.z-at.z).applyQuaternion(inv);
   // The car model's axes: native x right, y forward (browser -z), z up (browser y).
   const local={x:localBrowser.x,y:-localBrowser.z,z:localBrowser.y};
   const toWorld=(v:Vec3)=>{const w=new Vector3(v.x,v.z,-v.y).applyQuaternion(q);return toNative({x:w.x,y:w.y,z:w.z});};
   const com=body.worldCom(),lin=body.linvel(),ang=body.angvel();
   const speedAt=(offset:Vec3)=>{const o=fromNative(offset),rel={x:at.x+o.x-com.x,y:at.y+o.y-com.y,z:at.z+o.z-com.z};return toNative({x:(lin.x+ang.y*rel.z-ang.z*rel.y)/50,y:(lin.y+ang.z*rel.x-ang.x*rel.z)/50,z:(lin.z+ang.x*rel.y-ang.y*rel.x)/50});};
   const hit=explosionOnVehicle({falloff,force:params.force,damagePercentage:params.damagePercentage,radius:params.radius,mass:native.mass,local,boundsMin:native.boundsMin,boundsMax:native.boundsMax,isVictim:car===victim,toWorld,speedAt});
   if(!car.wrecked&&car.damage(hit.damage,undefined,true))this.onCrime?.(CRIME.destroyVehicle,`car:${body.handle}`);
   // ApplyTurnForce(force, point): turn speed += (point - centre of mass) x force / turn mass.
   const f=fromNative(hit.turnForce),pw=fromNative(hit.point),arm={x:at.x+pw.x-com.x,y:at.y+pw.y-com.y,z:at.z+pw.z-com.z};
   const torque={x:arm.y*f.z-arm.z*f.y,y:arm.z*f.x-arm.x*f.z,z:arm.x*f.y-arm.y*f.x},tm=native.turnMass;
   body.setAngvel({x:ang.x+torque.x/tm*50,y:ang.y+torque.y/tm*50,z:ang.z+torque.z/tm*50},true);
  }
  for(const boat of this.fleet()?.boats??[]){if(boat.wrecked)continue;const falloff=explosionFalloff(params.radius,distance(position,boat.body.translation()));if(falloff&&boat.damage(1100*falloff*params.damagePercentage))this.onCrime?.(CRIME.destroyVehicle,`boat:${boat.body.handle}`);}
  for(const plane of this.fleet()?.planes??[]){if(plane.health<=0)continue;const falloff=explosionFalloff(params.radius,distance(position,plane.body.translation()));if(falloff&&plane.damage(1100*falloff*params.damagePercentage)){this.onCrime?.(plane.helicopter?CRIME.destroyHeli:CRIME.destroyPlane,`plane:${plane.body.handle}`);}}
  this.onExplosion?.(position,params);
 }
 private hazard(kind:Hazard['kind'],position:Vec3,radius:number,remaining=kind==='flame'?6:9){if(this.hazards.length>=16)this.hazards.shift();this.hazards.push({kind,position:{...position},radius,remaining,tick:0});}
 vehicleExplosion(position:Vec3){this.explode(position,EXPLOSION_TYPE.aircraft);}
 /** Development: add an explosion of a native type at a renderer-frame point. */
 debugExplosion(position:Vec3,type:number){this.explode(position,type);}
 /** CObject::Explode: EXPLOSION_OBJECT (radius 10) half a unit above the object. */
 objectExplosion(position:Vec3){this.explode({...position,y:position.y+.5},EXPLOSION_TYPE.object);}
 /** Cars blown up by damage or burning spawn their EXPLOSION_CAR blast here. */
 private releaseExplosions(){for(const car of this.fleet()?.cars??[])if(car.pendingExplosion){car.pendingExplosion=false;this.explode(car.car.body.translation(),EXPLOSION_TYPE.car,car);}}
  /** Drive-by fire (CTaskSimpleGangDriveBy port): one-handed
   * weapons fire from the side window the camera faces. The driver pose stays in its ride
   * clip because the chase camera hides the native character while driving. */
  fireDriveby(car:import('../simulation/WorldCar').WorldCar,camera:{origin:Vec3;direction:Vec3}){
   if(!car.occupied||car.wrecked)return false;
   return this.drivebyShot({half:car.assets.collision?.bounds.max[0]??1,body:car.car.body,position:car.car.body.translation()},camera);
  }
  /** Player drive-bys from boats (CVehicle::DoDriveByShootings runs for player
   * boats too): same one-handed set over the gunwale the camera faces. */
  fireDrivebyBoat(boat:import('../simulation/WorldBoat').WorldBoat,camera:{origin:Vec3;direction:Vec3}){
   if(!boat.occupied||boat.wrecked)return false;
   return this.drivebyShot({half:boat.assets.collision!.bounds.max[0],body:boat.body,position:boat.body.translation()},camera);
  }
  private drivebyShot(vehicle:{half:number;body:RAPIER.RigidBody;position:Vec3},camera:{origin:Vec3;direction:Vec3}){
   const w=this.inventory.weapon;
   if(this.sim.player.health<=0||!DRIVEBY_WEAPONS.has(w.id))return false;
   if(!this.inventory.fire())return false;
   this.onUse?.(w);
   const p=vehicle.position,q=vehicle.body.rotation(),quat=new Quaternion(q.x,q.y,q.z,q.w);
   const right=new Vector3(1,0,0).applyQuaternion(quat),dir=normalize(camera.direction);
   const side=dir.x*right.x+dir.y*right.y+dir.z*right.z>=0?1:-1;
   const source={x:p.x+right.x*side*(vehicle.half+.5),y:p.y+1.2,z:p.z+right.z*side*(vehicle.half+.5)};
   this.onSound?.('fire',w.id,{...p});
   const range=w.range,sight=this.ray(camera.origin,dir,range,vehicle.body),target=add(camera.origin,dir,sight?.timeOfImpact??range);
   const resolved=normalize(add(target,source,-1));
   this.pedestrians()?.gunShot?.(source,false);
   this.onCrime?.(CRIME.fireWeapon,'player');
  const info=this.inventory.info();
  if(info&&(w.kind==='bullet'||w.kind==='shotgun'))return this.fireInstantHit(w,info,source,resolved,vehicle.body);
  const hit=this.ray(source,resolved,range,vehicle.body),end=add(source,resolved,hit?.timeOfImpact??range);
  this.tracer(source,end,'player',.065);
  if(hit){this.effect('impact',end);if(this.damage(hit.collider.handle,w.damage,resolved,false,'bullet',{weapon:w.id,point:end}))this.onHit?.(w.id);}
  return true;
 }
 fireAircraft(plane:WorldPlane,rocket=false){
  if(!plane.occupied||plane.health<=0||!plane.armed||this.aircraftCooldown>0||this.sim.player.health<=0)return false;
  if(rocket&&(plane.modelId===476||plane.rockets<=0||this.projectiles.length>=24)||!rocket&&plane.gunAmmo<=0)return false;
  this.aircraftCooldown=rocket?.8:.1;this.aircraftShots++;const q=new Quaternion().copy(plane.body.rotation()),direction=new Vector3(0,0,-1).applyQuaternion(q),position=plane.body.translation(),from=new Vector3(0,0,-Math.min(6,plane.assets.collision!.bounds.radius)).applyQuaternion(q).add(position);
  if(rocket){plane.rockets--;this.projectiles.push({id:this.serial++,weapon:35,position:from,velocity:direction.clone().multiplyScalar(55).add(plane.body.linvel()),fuse:8,stuck:false,owner:plane.body.handle});}
  else{plane.gunAmmo--;const hit=this.ray(from,direction,400,plane.body),end=from.clone().addScaledVector(direction,hit?.timeOfImpact??400);this.tracer(from,end,'aircraft',.1);this.fx?.gunshot(from,direction,38,true);if(hit){this.hitFx(hit,end,8,direction);this.damage(hit.collider.handle,35,direction);}}
  this.onSound?.('fire',rocket?35:38,from,'aircraft');this.onCrime?.(rocket?CRIME.explosion:CRIME.fireWeapon,'player');return true;
 }
 /** Random offset inside the native free-aim crosshair circle (CPlayerPed::GetWeaponRadiusOnScreen). */
 private aimSpread(direction:Vec3,info:NativeWeaponInfo){
  // GetWeaponRadiusOnScreen from the skill row's accuracy, halved ducking. FireInstantHit is a stub, so the circle's
  // radius is taken as the shot's cone; m_fAttackButtonCounter is left at 0 (its growth is in a stubbed ProcessPed).
  const angle=Math.atan(nativeWeaponRadiusOnScreen(info,0,this.sim.player.crouched)*CROSSHAIR_TANGENT),r=angle*Math.sqrt(Math.random()),theta=Math.random()*Math.PI*2;
  const right=normalize({x:-direction.z,y:0,z:direction.x}),up=normalize({x:-direction.y*direction.x,y:direction.x**2+direction.z**2,z:-direction.y*direction.z});
  return normalize(add(add(direction,right,Math.cos(theta)*r),up,Math.sin(theta)*r));
 }
  /** Camera selects a target; a separate muzzle ray prevents firing through nearby walls. */
  fire(camera:{origin:Vec3;direction:Vec3}){
   const w=this.inventory.weapon;if(!this.ready||this.sim.player.health<=0||this.sim.player.swimming||!this.sim.playerBody.isEnabled()||!this.sim.playerCollider.isEnabled())return false;
  if(w.kind==='parachute'&&this.sim.player.grounded)return false;
  if(['grenade','gas','molotov','rocket','guided','satchel'].includes(w.kind)&&this.projectiles.length>=24)return false;
  const info=this.inventory.info(),twin=!!info&&hasWeaponFlag(info,WEAPON_FLAG.twinPistol);
  // A b1stPerson weapon only gets PlayerPassiveControlGun outside its camera weapon mode: it cannot fire.
  const mode=info?firstPersonMode(w.id,info):undefined;
  if(mode&&this.firstPerson!==mode)return false;
  if(w.kind==='melee'&&this.stealthReady>=1/16){
   const target=this.stealthTarget();
   // Pressing attack with KILL_Partial blended past 0.5 starts the stealth kill instead of a melee swing.
   if(target&&this.pedestrians()?.stealthKill?.(target.id,this.sim.player.position)){this.stealth={id:target.id,remaining:this.stealthClipSeconds,target:target.position};this.stealthReady=0;this.onSound?.('impact',w.id,this.sim.player.position,'stealth');this.onCrime?.(target.officer?CRIME.stabCop:CRIME.stabPed,`ped:${target.id}`);this.onStealth?.(this.stealthClipSeconds);this.onHit?.(w.id);return true;}
  }
  // ProcessPlayerWeapon: an instant-hit or area gun fired at a ped in reach swings the butt instead (PISTOLWHIP).
  if(info&&(info.fire==='instant'||info.fire==='area')&&this.inventory.cooldown<=0){
   const whip=this.lastWhip?undefined:this.pistolWhipTarget();
   if(whip){
    this.lastWhip=true;this.onPistolWhip?.(this.sim.player.crouched);
    // melee.dat PISTOL_WHIP: ATTACK1 hit frame 7, damage 10, reach 1.6; GUN_BUTT runs 0.433 s.
    this.strike={remaining:7/30,weapon:w.id,damage:10,move:-1,range:1.6,target:whip,whip:true};this.inventory.cooldown=.433;
    return true;
   }
   this.lastWhip=false;
  }
  // A press while a combo move plays waits for its chain frame (CTaskSimpleFight chains moves; ProcessPed is a stub).
  if(w.kind==='melee'&&this.inventory.cooldown>0&&info&&meleeComboFor(info.baseCombo)){this.meleeQueued=true;return false;}
  if(!this.inventory.fire())return false;this.onUse?.(w);this.onSound?.('fire',w.id,this.sim.player.position);
  // CTaskComplexUseGoggles: goggles_put_on runs first; PutOnGoggles/TakeOffGoggles apply when it finishes.
  if(w.kind==='nightvision'||w.kind==='infrared'){if(!this.goggles)this.goggles={kind:w.kind,remaining:this.gogglesClipSeconds};return true;}
  if(w.kind==='parachute'){this.parachute=true;return true;}
  if(w.kind==='camera'){this.photoRequested=true;return true;}
  if(w.kind==='detonator'){const bombs=this.projectiles.filter(p=>p.weapon===39);this.projectiles=this.projectiles.filter(p=>p.weapon!==39);for(const b of bombs)this.explode(b.position,EXPLOSION_TYPE.grenade);return true;}
  if(mode==='sniper'&&info)return this.fireSniper(w,info,camera);
  const left=twin&&this.leftHand;this.lastHand=left?'left':'right';if(twin)this.leftHand=!this.leftHand;else this.leftHand=false;
  let source={...this.sim.player.position,y:this.sim.player.position.y+(this.sim.player.crouched?.9:1.3)};
  const muzzle=w.kind==='bullet'||w.kind==='shotgun'||info?.fire==='area'?this.muzzle?.(left):undefined;
  if(muzzle&&distance(source,muzzle)<3&&!this.ray(source,normalize(add(muzzle,source,-1)),distance(source,muzzle)))source={...muzzle};
  const range=info&&info.fire!=='melee'?info.weaponRange:w.range;
  let direction=normalize(camera.direction);
  if(w.kind==='melee')direction={x:Math.sin(this.sim.player.heading),y:0,z:Math.cos(this.sim.player.heading)};
  else {const sight=this.ray(camera.origin,direction,range),target=add(camera.origin,direction,sight?.timeOfImpact??range);direction=normalize(add(target,source,-1));}
  if(w.kind==='melee'){
   // Native melee.dat combo resolved through the weapon.dat baseCombo row:
   // stage damage with the 1.6 m strike reach; only landed swings chain.
   // Sprinting swings use the AMOVING row instead of the staged damage.
   const combo=info?meleeComboFor(info.baseCombo):undefined;
   const now=this.nowMs/1000;
   const range=combo?.range??w.range,moving=this.sim.player.speed>6;
   // A downed ped in reach takes the AGROUND attack (FightA_G, a kick or stamp) instead of a standing swing.
   const downed=moving?undefined:this.pedestrians()?.targets().find(t=>{
    if(!t.down)return false;const dx=t.position.x-this.sim.player.position.x,dz=t.position.z-this.sim.player.position.z,d=Math.hypot(dx,dz);
    return d<range+.6&&Math.abs(t.position.y-this.sim.player.position.y)<1.5&&(dx*direction.x+dz*direction.z)>d*.5;
   });
   if(downed&&combo){
    const d=normalize({x:downed.position.x-this.sim.player.position.x,y:0,z:downed.position.z-this.sim.player.position.z});
    this.sim.player.heading=Math.atan2(d.x,d.z);this.meleeStage=0;this.meleeWeapon=w.id;this.meleeAt=now;
    this.onMeleeSwing?.(w,{kind:'ground'});this.inventory.cooldown=this.nextMoveAfter(combo.ground.chain,this.meleeClips?.()?.durations?.ground);
    this.strike={remaining:combo.ground.hit,weapon:w.id,damage:combo.ground.damage,move:3,range:range+.6,target:downed.handle};
    return true;
   }
   if(combo){
    // Presses before the chain frame carry the combo on; the strike itself waits for the hit frame.
    const chained=!moving&&w.id===this.meleeWeapon&&now-this.meleeAt<combo.stages[this.meleeStage].chain+0.25;
    this.meleeStage=chained?(this.meleeStage+1)%3:0;this.meleeWeapon=w.id;this.meleeAt=now;
    const move=moving?combo.moving:combo.stages[this.meleeStage];
    this.onMeleeSwing?.(w,moving?{kind:'moving'}:{kind:'attack',stage:this.meleeStage as 0|1|2});
    const durations=this.meleeClips?.()?.durations;
    this.inventory.cooldown=this.nextMoveAfter(move.chain,moving?durations?.moving:durations?.attacks[this.meleeStage]);
    this.strike={remaining:move.hit,weapon:w.id,damage:move.damage,move:moving?4:this.meleeStage,range};
    return true;
   }
   const hit=this.sim.world.castShape(source,{x:0,y:0,z:0,w:1},direction,new RAPIER.Ball(.45),.01,range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.sim.playerBody);
   // Without WEAPON.DAT there is no melee.dat combo: the swing cuts whatever is in front at once.
   if(hit){this.damage(hit.collider.handle,w.damage,direction,false,'melee',{weapon:w.id});this.onSound?.('impact',w.id,source);this.effect('impact',add(source,direction,hit.time_of_impact));}
   this.onMeleeSwing?.(w,{kind:'attack',stage:0});
   return true;
  }
  // CEventGunShot, with bHasNoSound for the silenced pistol.
  this.pedestrians()?.gunShot?.(source,w.id===23);
  // CWeapon::Fire reports FIRE_WEAPON for every shot; CWeapon::FireProjectile reports an EXPLOSION crime.
  if(!['spray','extinguisher'].includes(w.kind))this.onCrime?.(['rocket','guided','grenade','molotov','satchel'].includes(w.kind)?CRIME.explosion:CRIME.fireWeapon,'player');
  if(info&&(w.kind==='bullet'||w.kind==='shotgun'))return this.fireInstantHit(w,info,source,direction);
  if(['bullet','shotgun'].includes(w.kind)){
   const right=normalize({x:-direction.z,y:0,z:direction.x}),up=normalize({x:-direction.y*direction.x,y:direction.x**2+direction.z**2,z:-direction.y*direction.z});
   for(let i=0;i<w.pellets;i++){const angle=i*2.399963+(this.inventory.shots%11)*.3,r=w.spread*(1-this.inventory.proficiency*.25)*(w.pellets>1?Math.sqrt((i+.5)/w.pellets):this.aiming?.2:1),dir=normalize(add(add(direction,right,Math.cos(angle)*r),up,Math.sin(angle)*r));const hit=this.ray(source,dir,w.range),end=add(source,dir,hit?.timeOfImpact??w.range);this.tracer(source,end,'player',.065);if(hit){this.effect('impact',end);if(this.damage(hit.collider.handle,w.damage,dir,false,'bullet',{weapon:w.id,point:end}))this.onHit?.(w.id);}}
   return true;
  }
  if(info?.fire==='area'){this.addAreaShot(w.id,info,source,add(source,direction,range));this.fx?.areaEffect(w.id,source,direction);return true;}
  if(['flame','spray','extinguisher'].includes(w.kind)){
   const hit=this.ray(source,direction,w.range),end=add(source,direction,hit?.timeOfImpact??w.range);this.effect(w.kind as 'flame'|'spray'|'extinguisher',source,end,.25,.45);
   if(hit&&w.damage)this.damage(hit.collider.handle,w.damage,direction,false,'bullet',{weapon:w.id,point:end});
   // Without WEAPON.DAT there are no CShotInfo shots: put out fires within 4 of the spray's end.
   if(w.kind==='extinguisher')this.fires.extinguishPoint(this.toNative(end),4);
   return true;
  }
  const rocket=w.kind==='rocket'||w.kind==='guided';
  // CWeapon::FireProjectile starts the player's rocket one unit along the first-person camera's front.
  if(mode&&isRocketMode(mode)){direction=normalize(camera.direction);source=add(source,direction);}
  const projectile:Projectile={id:this.serial++,weapon:w.id,position:{...source},velocity:projectileVelocity(w.kind,direction),fuse:projectileFuse(w.kind,rocket),stuck:false};
  if(w.kind==='guided'&&this.hsLock.locked(this.nowMs)&&this.hsLock.pressedTime){
   // FireProjectile: once CWeaponEffects::IsLockedOn (the red crosshair's rotation), pick again from CJ's position
   // along his heading. Otherwise, or with nothing picked, a plain rocket.
   const feet=this.sim.player.position,h=this.sim.player.heading;
   projectile.target=pickHeatSeekTarget(this.heatSeekCandidates(),{x:feet.x,y:feet.y+1,z:feet.z},{x:Math.sin(h),y:0,z:Math.cos(h)},1.2,{preferred:this.hsLock.lastTarget});
  }
  this.projectiles.push(projectile);return true;
 }
 /** CWeapon::FireSniper (0x73AAC0): a CBulletInfo bullet from the camera along its front at 16 units a frame with the
  * STD row's damage, a FIRE_WEAPON crime and a gunshot event. The pad shake and CamShakeNoPos(0.2) are not reproduced. */
 private fireSniper(w:WeaponDefinition,info:NativeWeaponInfo,camera:{origin:Vec3;direction:Vec3}){
  const source={...camera.origin},direction=normalize(camera.direction);
  this.pedestrians()?.gunShot?.(source,false);
  this.onCrime?.(CRIME.fireWeapon,'player');
  // CBulletInfo::AddBullet takes the first free slot; with none free the shot is lost.
  if(this.bullets.length<8)this.bullets.push({weapon:w.id,damage:info.damage,position:source,direction,destroyAt:this.nowMs+1000,passed:new Set()});
  return true;
 }
 /** CBulletInfo::Update (0x7360D0): each frame a bullet moves velocity × TimeStep / 2 (400 m/s) and the first thing on
  * that stretch takes the hit, until its second is up.
  * - A ped takes the damage event (the hit point picks the body piece) and stops the bullet at the hit point for the frame.
  * - A car takes InflictDamage, or a wheel bursts; an object or building takes the impact.
  * - The bullet then flies on through what it hit. The original restarts the line on the ped's surface; here a ped
  *   already hit is skipped. */
 private updateBullets(dt:number){
  for(let i=this.bullets.length-1;i>=0;i--){
   const b=this.bullets[i];
   if(this.nowMs>b.destroyAt){this.bullets.splice(i,1);continue;}
   const reach=400*dt;let next=add(b.position,b.direction,reach);
   // CWorld::IsInWorldBounds: ±3000 across the map.
   if(Math.abs(next.x)>=3000||Math.abs(next.z)>=3000){this.bullets.splice(i,1);continue;}
   const hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray(b.position,b.direction),reach,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.sim.playerBody,c=>!b.passed.has(c.handle));
   const tyre=this.tyreHit(b.position,b.direction,hit?.timeOfImpact??reach);
   if(tyre){const at=add(b.position,b.direction,tyre.t);if(tyre.car.burstTyre(tyre.wheel))this.onHit?.(b.weapon);this.effect('impact',at);}
   else if(hit){
    const point=add(b.position,b.direction,hit.timeOfImpact),ped=this.pedestrians()?.targets().some(t=>t.handle===hit.collider.handle);
    this.hitFx(hit,point,8,b.direction);
    if(ped){b.passed.add(hit.collider.handle);next=point;}
    else this.pushShotVehicle(hit,point,b.weapon);
    if(this.damage(hit.collider.handle,b.damage,b.direction,false,'bullet',{weapon:b.weapon,point}))this.onHit?.(b.weapon);
   }
   b.position=next;
  }
 }
 /** CWeapon::DoBulletImpact FX for a ray hit: blood on pedestrians, sparks on vehicles, the surface BULLET_FX elsewhere. */
 private hitFx(hit:RAPIER.RayColliderIntersection,point:Vec3,amount:number,direction?:Vec3){
  const handle=hit.collider.handle;
  if(direction)this.onBulletHit?.(hit,point,Math.asin(Math.max(-1,Math.min(1,-(direction.x*hit.normal.x+direction.y*hit.normal.y+direction.z*hit.normal.z))))*180/Math.PI);
  this.onObjectShot?.(hit,point,amount<8);
  if(!this.fx?.ready)return;
   const ped=this.pedestrians()?.targets().some(t=>t.handle===handle),vehicle=[...(this.fleet()?.cars??[])].some(c=>{for(let i=0;i<c.car.body.numColliders();i++)if(c.car.body.collider(i).handle===handle)return true;return false;})||[...(this.fleet()?.boats??[])].some(b=>{for(let i=0;i<b.body.numColliders();i++)if(b.body.collider(i).handle===handle)return true;return false;});
  this.fx.bulletHit({point,normal:{x:hit.normal.x,y:hit.normal.y,z:hit.normal.z},collider:handle,featureType:hit.featureType,featureId:hit.featureId,ped:ped?{head:false,dead:false}:undefined,vehicle},amount);
 }
 /** Instant hits (CWeapon::FireInstantHit port): weapon range, crosshair spread, WEAPON.DAT damage, the 150-point
  * point-blank player shot and SetUpPelletCol pellets counted against the first victim. */
 private fireInstantHit(w:WeaponDefinition,info:NativeWeaponInfo,source:Vec3,aim:Vec3,exclude?:RAPIER.RigidBody){
  const shotgun=w.id===25||w.id===26||w.id===27,direction=this.aimSpread(aim,info),hit=this.ray(source,direction,info.weaponRange,exclude),end=add(source,direction,hit?.timeOfImpact??info.weaponRange);
  const tyre=this.tyreHit(source,direction,hit?.timeOfImpact??info.weaponRange);
  if(tyre){
   // DoBulletImpact on a wheel piece: BurstTyre instead of vehicle damage.
   const at=add(source,direction,tyre.t);this.tracer(source,at,'player',.065);this.fx?.gunshot(source,direction,w.id,false);this.effect('impact',at);
   if(tyre.car.burstTyre(tyre.wheel))this.onHit?.(w.id);
   return true;
  }
  if(!shotgun){
   this.tracer(source,end,'player',.065);this.fx?.gunshot(source,direction,w.id,false);if(!hit)return true;this.effect('impact',end);
   const target=this.pedestrians()?.targets().find(t=>t.handle===hit.collider.handle),pointBlank=!!target&&distance(target.position,source)<=1;
   this.hitFx(hit,end,8,direction);this.pushShotVehicle(hit,end,w.id);
   if(this.damage(hit.collider.handle,pointBlank?150:info.damage,direction,false,'bullet',{weapon:w.id,point:end}))this.onHit?.(w.id);return true;
  }
  // SetUpPelletCol: pellet lines spread with distance to the first victim; hits on that victim accumulate.
  const spreadRate=.05/info.accuracy,depth=Math.max(.05,(hit?.timeOfImpact??info.weaponRange)*spreadRate*1.3),right=normalize({x:-direction.z,y:0,z:direction.x}),up=normalize({x:-direction.y*direction.x,y:direction.x**2+direction.z**2,z:-direction.y*direction.z});
  let pellets=0;
  for(let i=0;i<PELLETS;i++){
   const angle=(Math.random()*2-1)*Math.PI,spread=i===0?0:Math.random()*depth*.8,target=add(add(end,right,Math.cos(angle)*spread),up,Math.sin(angle)*spread),dir=normalize(add(target,source,-1)),reach=distance(target,source)+depth*2;
   const pellet=this.ray(source,dir,reach,exclude),stop=add(source,dir,pellet?.timeOfImpact??Math.min(reach,info.weaponRange));
   if(i<8)this.tracer(source,stop,'player',.065);
   if(pellet&&hit&&pellet.collider.handle===hit.collider.handle)pellets++;
  }
  this.fx?.gunshot(source,direction,w.id,false);
  // DoBulletImpact's 150-point player shot within a unit spares only the shotgun and SPAS-12: the sawn-off gets it.
  const victim=hit&&this.pedestrians()?.targets().find(t=>t.handle===hit.collider.handle),pointBlank=w.id===26&&!!victim&&distance(victim.position,source)<=1;
  if(hit){this.effect('impact',end);this.hitFx(hit,end,8,direction);if(pellets)this.pushShotVehicle(hit,end,w.id);if(pellets&&this.damage(hit.collider.handle,pointBlank?150:pellets*info.damage,direction,false,'bullet',{weapon:w.id,point:end}))this.onHit?.(w.id);}
  return true;
 }
 /** CWeapon::DoBulletImpact's vehicle push on the car a ray hit (see bulletVehicle). */
 private pushShotVehicle(hit:RAPIER.RayColliderIntersection,point:Vec3,weapon:number){
  const car=[...(this.fleet()?.cars??[])].find(c=>hit.collider.parent()?.handle===c.car.body.handle);if(car)pushShotVehicle(car,hit.normal,point,weapon);
 }
 private tyreHit(source:Vec3,direction:Vec3,reach:number){return bulletTyreHit(this.fleet()?.cars??[],source,direction,reach);}
 /** CShotInfo::AddShot. */
 private addAreaShot(weapon:number,info:NativeWeaponInfo,origin:Vec3,target:Vec3){
  if(this.shots.length>=100)this.shots.shift();
  let offset=add(target,origin,-1);
  if(info.spread!==0)offset=add(offset,{x:randTable()*info.spread,y:randTable(),z:randTable()*info.spread});
  const speed=(info.speed+(hasWeaponFlag(info,WEAPON_FLAG.randSpeed)?randTable():0))/NATIVE_STEP;
  this.shots.push({weapon,origin:{...origin},velocity:add({x:0,y:0,z:0},normalize(offset),speed),range:info.radius,remaining:info.lifespan/1000,executed:false,age:0});
  // CWeapon::FireAreaEffect's one-in-three CCreepingFire attempt never starts a fire: the creeping-fire table starts at zero.
 }
 /** CFireManager: world fires and fires on peds, the player and vehicles. */
 readonly fires=new NativeFireManager();
 /** Milliseconds of simulated time, for fire burn times. */
 private nowMs=0;
 /** Molotov explosions still active (3000 ms): each frame they set peds, the world and cars alight. */
 private molotovs:{position:Vec3;remaining:number}[]=[];
 /** Pedestrian handles on fire with the seconds left to burn. */
 get burning(){const out=new Map<number,number>();for(const f of this.fires.active)if(f.target?.kind==='ped')out.set(f.target.key as number,Math.max(0,(f.timeToBurn-this.nowMs)/1000));return out;}
 private readonly toNative=(v:Vec3)=>({x:v.x,y:-v.z,z:v.y});
 private readonly fromNative=(v:Vec3)=>({x:v.x,y:v.z,z:-v.y});
 private fireClock(){return {nowMs:this.nowMs,random:Math.random};}
 /** CFireManager::StartFire on a ped (CShotInfo and CWorld::SetPedsOnFire). */
 private ignitePed(handle:number,position:Vec3,generations:number){this.fires.startFireOn({kind:'ped',key:handle},this.toNative(position),7000,generations,this.fireClock(),'player');}
 /** CWorld::SetCarsOnFire: cars inside the box of half-size `radius` (and 5 up or down). */
 private setCarsOnFire(position:Vec3,radius:number){
  const p=this.toNative(position);
  for(const car of this.fleet()?.cars??[]){if(car.wrecked)continue;const c=this.toNative(car.car.body.translation());
   if(Math.abs(c.x-p.x)<=radius&&Math.abs(c.y-p.y)<=radius&&Math.abs(c.z-p.z)<=5)this.fires.startFireOn({kind:'vehicle',key:car},c,7000,100,this.fireClock(),'player');}
 }
 /** CWorld::SetPedsOnFire: peds inside the box of half-size `radius`, set alight by the player. */
 private setPedsOnFire(position:Vec3,radius:number){
  const p=this.toNative(position);
  for(const person of this.pedestrians()?.targets()??[]){const c=this.toNative(person.position);if(Math.abs(c.x-p.x)<=radius&&Math.abs(c.y-p.y)<=radius&&Math.abs(c.z-p.z)<=5)this.ignitePed(person.handle,person.position,2);}
 }
 /** CWorld::SetWorldOnFire: a fire where a sphere of `radius` touches world geometry, unless one burns within 2. */
 private setWorldOnFire(position:Vec3,radius:number){
  if(this.fires.numFiresInRange(this.toNative(position),2))return;
  if(!this.sim.world.intersectionWithShape(position,{x:0,y:0,z:0,w:1},new RAPIER.Ball(Math.max(.05,radius)),RAPIER.QueryFilterFlags.ONLY_FIXED))return;
  this.fires.startFire(this.toNative(position),7000,100,this.fireClock());
 }
 /** AddExplosion's fires: 0 to 3 within 4 units, on ground no more than 10 below, burning (5.6 to 12.6 s) x 0.4. */
 private explosionFires(position:Vec3,molotov:boolean){
  const count=explosionFireCount(molotov?'molotov':'other',Math.trunc(Math.random()*32768));
  for(let i=0;i<count;i++){
   const spot={x:position.x+(Math.random()*8-4),y:position.y+3,z:position.z+(Math.random()*8-4)};
   const ground=this.sim.world.castRay(new RAPIER.Ray(spot,{x:0,y:-1,z:0}),13,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!ground)continue;
   const at={...spot,y:spot.y-ground.timeOfImpact};if(Math.abs(at.y-position.y)>=10)continue;
   this.fires.startFire(this.toNative(at),Math.trunc((5600+Math.random()*7000)*.4),3,this.fireClock(),'player');
  }
 }
 /** CFireManager::Update, ped burn damage (CTaskComplexOnFire) and the player's (CTaskSimplePlayerOnFire). */
 private updateFires(dt:number){
  const timeStep=dt/NATIVE_STEP,people=this.pedestrians()?.targets()??[];
  for(const m of this.molotovs){m.remaining-=dt;this.setPedsOnFire(m.position,6);this.setWorldOnFire(m.position,6);this.setCarsOnFire(m.position,.1);}
  this.molotovs=this.molotovs.filter(m=>m.remaining>0);
  const playerKey='player',playerOnFoot=this.sim.playerBody.isEnabled()&&this.sim.playerCollider.isEnabled()&&this.sim.player.health>0;
  this.fires.update({nowMs:this.nowMs,timeStep,random:Math.random,cameraPosition:this.toNative(this.sim.player.position),
   targetPosition:(t:FireTarget)=>{
    // A ped's fire burns on after it dies, a unit lower (targetDead), until the body is removed.
    if(t.kind==='ped'){const p=this.pedestrians()?.pedPosition?.(t.key as number)??people.find(q=>q.handle===t.key);return p&&this.toNative(p.position);}
    if(t.kind==='player')return playerOnFoot&&!this.sim.player.swimming?this.toNative(this.sim.player.position):undefined;
    if(t.kind==='vehicle'){const car=t.key as import('../simulation/WorldCar').WorldCar;return car.wrecked?undefined:this.toNative(car.car.body.translation());}
    return undefined;
   },
   targetDead:(t:FireTarget)=>t.kind==='ped'&&!!this.pedestrians()?.pedPosition?.(t.key as number)?.dead,
   damageVehicle:(t:FireTarget,amount:number)=>{const car=t.key as import('../simulation/WorldCar').WorldCar;if(car.damage(amount))this.onCrime?.(CRIME.destroyVehicle,`car:${car.car.body.handle}`);},
   ignitablePlayer:()=>playerOnFoot&&!this.sim.player.swimming&&!this.fires.fireOn(playerKey)?{key:playerKey,position:this.toNative(this.sim.player.position)}:undefined,
   vehiclesNear:(point,radius)=>[...(this.fleet()?.cars??[])].filter(c=>!c.wrecked&&Math.hypot(...Object.values(this.toNative(c.car.body.translation())).map((v,i)=>v-[point.x,point.y,point.z][i]))<radius).map(car=>({kind:'vehicle' as const,key:car}))});
  for(const fire of this.fires.active){
   const t=fire.target;if(!t)continue;
   // 0.5 x timeStep x m_fireDmgMult per frame.
   if(t.kind==='ped'){if(!this.pedestrians()?.pedPosition?.(t.key as number)?.dead)this.damage(t.key as number,.5*timeStep,{x:0,y:0,z:1},false,'fire');}
   else if(t.kind==='player')this.sim.damagePlayer(.5*timeStep);
  }
 }
 /** CShotInfo::Update, with the native squared-distance range test preserved. */
 private updateAreaShots(dt:number){
  const people=this.pedestrians()?.targets()??[];
  for(const shot of this.shots){
   shot.remaining-=dt;shot.age+=dt;
   const info=this.native&&nativeWeaponInfo(this.native,shot.weapon);if(!info){shot.remaining=0;continue;}
   if(hasWeaponFlag(info,WEAPON_FLAG.slowdown))shot.velocity=add({x:0,y:0,z:0},shot.velocity,Math.pow(.96,dt/NATIVE_STEP));
   const next=add(shot.origin,shot.velocity,dt),blocked=this.sim.world.castRay(new RAPIER.Ray(shot.origin,normalize(shot.velocity)),distance(shot.origin,next),true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   if(blocked){shot.origin=add(shot.origin,normalize(shot.velocity),Math.max(0,blocked.timeOfImpact-.05));shot.velocity={x:0,y:0,z:0};}else shot.origin=next;
   const kind=shot.weapon===37?'flame':shot.weapon===41?'spray':'extinguisher';this.effect(kind,shot.origin,shot.origin,dt*1.5,.15+Math.min(.6,shot.age*.9));
   const reach=Math.max(shot.range,1);
   for(const person of people){
    const d2=(person.position.x-shot.origin.x)**2+(person.position.y-shot.origin.y)**2+(person.position.z-shot.origin.z)**2;if(d2>=reach)continue;
    if(shot.weapon===37){this.ignitePed(person.handle,person.position,100);continue;}
    if(shot.executed)continue;
    // The damage response that lets an extinguisher douse a burning ped is a retail stub: a water shot reaching one puts its fire out.
    if(shot.weapon===42)this.fires.fireOn(person.handle)?.extinguish();
    // Spray can and extinguisher hits are sprays; only burning (the fire manager) is fire damage.
    this.damage(person.handle,info.damage,normalize(shot.velocity),false,'spray');shot.executed=true;
   }
   // CWorld::SprayPaintWorld: a spray-can shot that reaches a tag is spent; one that finishes a tag plays the
   // part-mission-complete chime for the player.
   if(shot.weapon===41&&!shot.executed){const state=this.onSprayPaint?.([shot.origin.x,-shot.origin.z,shot.origin.y],shot.range);if(state&&state!=='notFound'){shot.executed=true;if(state==='painted')this.onSprayPainted?.();}}
   // CFireManager::ExtinguishPointWithWater(origin, range, 2): water strength 2 per second.
   if(shot.weapon===42&&!shot.executed&&this.fires.extinguishPointWithWater(this.toNative(shot.origin),shot.range,2,dt))shot.executed=true;
   if(shot.weapon===37){
    // Every fourth frame SetCarsOnFire(origin, 4); every frame SetWorldOnFire(origin, 0.1).
    if(Math.trunc(shot.age/NATIVE_STEP)%4===0)this.setCarsOnFire(shot.origin,4);
    this.setWorldOnFire(shot.origin,.1);
   }
  }
  this.shots=this.shots.filter(s=>s.remaining>0);

 }
 /** CTaskSimpleUseGun::RequirePistolWhip (0x61E200): a living ped within 1 across the ground, in front within 30° of
  * the heading, whose head is between the player's position (one above the feet) and 1.5 above it, and not floored. */
 private pistolWhipTarget(){
  const p=this.sim.player.position,h=this.sim.player.heading,forward={x:Math.sin(h),z:Math.cos(h)},right={x:forward.z,z:-forward.x};
  return this.pedestrians()?.targets().find(t=>{
   if(t.down)return false;
   // The pedestrian body sits 0.9 above its feet; its head bone about 0.75 higher.
   const head=t.position.y+.75;if(p.y+1>=head||p.y+2.5<=head)return false;
   const dx=t.position.x-p.x,dz=t.position.z-p.z;if(dx*dx+dz*dz>=1)return false;
   const along=dx*forward.x+dz*forward.z;if(along<=0)return false;
   return Math.abs(dx*right.x+dz*right.z)/along<1/Math.sqrt(3);
  })?.handle;
 }
 /** The next move may start at this one's melee.dat chain frame, or when its swing clip ends if that comes first
  * (a chain frame of 99 never chains). */
 private nextMoveAfter(chain:number,duration?:number){return duration!==undefined?Math.min(chain,duration):chain;}
 /** CTaskSimpleFight::FightStrike at the move's hit frame: a 0.45 sphere swept along the player's heading, or the downed
  * ped a ground attack was aimed at. FightStrike is a retail stub, so the sweep stands in for its strike spheres. */
 private resolveStrike(s:NonNullable<WeaponSystem['strike']>){
  if(this.sim.player.health<=0||!this.sim.playerBody.isEnabled())return;
  const p=this.sim.player.position,source={...p,y:p.y+(this.sim.player.crouched?.9:1.3)},direction={x:Math.sin(this.sim.player.heading),y:0,z:Math.cos(this.sim.player.heading)};
  const clips=this.meleeClips?.(),fight={move:s.move,group:clips?.group,hits:clips?.hits};
  if(s.whip){
   const t=this.pedestrians()?.targets().find(t=>t.handle===s.target);
   if(!t||Math.hypot(t.position.x-p.x,t.position.z-p.z)>s.range)return;
   this.damage(t.handle,s.damage,normalize({x:t.position.x-p.x,y:0,z:t.position.z-p.z}),false,'melee',{weapon:s.weapon,pistolWhip:true});this.onSound?.('impact',0,source);this.effect('impact',t.position);
   return;
  }
  if(s.target!==undefined){
   const t=this.pedestrians()?.targets().find(t=>t.handle===s.target&&t.down);
   if(!t||Math.hypot(t.position.x-p.x,t.position.z-p.z)>s.range||Math.abs(t.position.y-p.y)>1.5)return;
   this.damage(t.handle,s.damage,normalize({x:t.position.x-p.x,y:0,z:t.position.z-p.z}),false,'melee',{weapon:s.weapon,fight});this.onSound?.('impact',s.weapon,source);this.effect('impact',t.position);
   return;
  }
  const hit=this.sim.world.castShape(source,{x:0,y:0,z:0,w:1},direction,new RAPIER.Ball(.45),.01,s.range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.sim.playerBody);
  if(!hit)return;
  this.damage(hit.collider.handle,s.damage,direction,false,'melee',{weapon:s.weapon,fight});this.onSound?.('impact',s.weapon,source);this.effect('impact',add(source,direction,hit.time_of_impact));
 }
 /** Every vehicle a heat seeker may pick (bVehicleCanBeTargettedByHS), by body handle; wrecks have no health. */
 private heatSeekCandidates():HeatSeekCandidate<number>[]{
  const f=this.fleet(),out:HeatSeekCandidate<number>[]=[];if(!f)return out;
  for(const c of f.cars)out.push({key:c.car.body.handle,position:c.car.body.translation(),health:c.wrecked?0:1});
  for(const b of f.boats)out.push({key:b.body.handle,position:b.body.translation(),health:b.wrecked?0:1});
  for(const b of f.bikes??[])out.push({key:b.body.handle,position:b.body.translation(),health:b.wrecked?0:1});
  for(const p of f.planes??[])out.push({key:p.body.handle,position:p.body.translation(),health:p.health,aircraft:true});
  return out;
 }
 /** The vehicle body a homing rocket chases, while it exists. */
 private heatSeekBody(handle:number){
  const f=this.fleet();if(!f)return undefined;
  for(const c of f.cars)if(c.car.body.handle===handle)return c.wrecked?undefined:c.car.body;
  for(const v of [...f.boats,...f.bikes??[]])if(v.body.handle===handle)return v.wrecked?undefined:v.body;
  for(const p of f.planes??[])if(p.body.handle===handle)return p.health>0?p.body:undefined;
  return undefined;
 }
 /** CCam::Process_Rocket's heat-seeker lock while the HS launcher's camera is up: PickTargetForHeatSeekingMissile from
  * the camera (tolerance 1.2, the last target preferred), and a line of sight from CJ to it once a second through
  * buildings, vehicles and objects but not peds. */
 private updateHeatSeek(){
  const camera=this.lockCamera;
  if(this.firstPerson!=='rocketHs'||!camera||this.sim.player.health<=0){if(this.hsCamera){this.hsCamera=false;this.hsLock.leave();}return;}
  if(!this.hsCamera){this.hsCamera=true;this.hsLock.enter(this.nowMs);}
  const direction=normalize(camera.direction),candidates=this.heatSeekCandidates();
  this.hsLock.update(this.nowMs,preferred=>pickHeatSeekTarget(candidates,camera.origin,direction,1.2,{preferred}),target=>{
   const body=this.heatSeekBody(target);if(!body)return false;
   // CPed::GetPosition is the root, about a unit above the feet this position holds.
   const feet=this.sim.player.position,from={x:feet.x,y:feet.y+1,z:feet.z},to=body.translation(),d=distance(from,to);if(d<1e-3)return true;
   return !this.sim.world.castRay(new RAPIER.Ray(from,normalize(add(to,from,-1))),d,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS|RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC,undefined,this.sim.playerCollider,body);
  });
 }
 /** The ped or vehicle the crosshair ray meets first within the gun's range (see `lock`). */
 private updateLock(){
  const camera=this.lockCamera,w=this.inventory.weapon;
  const aimed=this.aiming&&['bullet','shotgun','rocket'].includes(w.kind)&&this.sim.player.health>0&&this.sim.playerBody.isEnabled();
  if(!aimed||!camera){this.lock=undefined;return;}
  const info=this.inventory.info(),range=info&&info.fire!=='melee'?info.weaponRange:w.range,hit=this.ray(camera.origin,normalize(camera.direction),range);
  if(!hit){this.lock=undefined;return;}
  const ped=this.pedestrians()?.targets().find(p=>p.handle===hit.collider.handle);
  if(ped){this.lock={handle:ped.handle,position:{...ped.position}};return;}
  const body=hit.collider.parent();
  const vehicle=[...this.fleet()?.cars??[]].map(c=>c.car.body).concat([...this.fleet()?.boats??[]].map(b=>b.body),[...this.fleet()?.planes??[]].map(p=>p.body)).find(b=>b.handle===body?.handle);
  this.lock=vehicle?{handle:vehicle.collider(0).handle,position:{...vehicle.translation()}}:undefined;
 }
  tick(dt:number,camera?:{origin:Vec3;direction:Vec3}){
   this.aircraftCooldown=Math.max(0,this.aircraftCooldown-dt);
   this.inventory.crouched=this.sim.player.crouched;
   if(camera)this.lockCamera={origin:{...camera.origin},direction:{...camera.direction}};
  this.updateLock();this.updateHeatSeek();
  if(this.goggles){this.goggles.remaining-=dt;if(this.goggles.remaining<=0){this.vision=this.vision===this.goggles.kind?null:this.goggles.kind;this.goggles=undefined;}}
  const candidate=this.stealthTarget();if(candidate&&candidate.id===this.stealthCandidate)this.stealthReady+=dt;else{this.stealthReady=0;this.stealthCandidate=candidate?.id;}
  if(this.stealth){
   // The attacker turns to the victim and closes to one metre at up to 0.05 per native step.
   this.stealth.remaining-=dt;const p=this.sim.player.position,dx=this.stealth.target.x-p.x,dz=this.stealth.target.z-p.z,d=Math.hypot(dx,dz);
   if(d>.01)this.sim.player.heading=Math.atan2(dx,dz);
   const shift=d-1;if(Math.abs(shift)>.02&&d>.01&&this.sim.playerBody.isEnabled()){const step=Math.sign(shift)*Math.min(Math.abs(shift),.05*dt/NATIVE_STEP),center=this.sim.playerBody.translation(),next={x:center.x+dx/d*step,y:center.y,z:center.z+dz/d*step};const blocked=this.sim.world.castRay(new RAPIER.Ray(center,{x:dx/d*Math.sign(step),y:0,z:dz/d*Math.sign(step)}),Math.abs(step)+.3,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!blocked){this.sim.playerBody.setNextKinematicTranslation(next);this.sim.player.position={...this.sim.player.position,x:next.x,z:next.z};}}
   if(this.stealth.remaining<=0||this.sim.player.health<=0)this.stealth=undefined;
  }
  if(this.inventory.reloading){
   if(this.reloadSoundId!==this.inventory.selected){this.reloadSoundId=this.inventory.selected;this.reloadSoundA=false;this.reloadSoundB=false;}
   const info=this.inventory.info(),ao=info&&this.native?nativeAimOffset(this.native,info):undefined,elapsed=(this.inventory.reloadTotal-this.inventory.reloading)*1000;
   // CWeapon::Update reload audio: RLoadA/B (or the crouched pair) milliseconds into the reload.
   const a=ao?this.sim.player.crouched?ao.crouchReloadA:ao.reloadA:0,b=ao?this.sim.player.crouched?ao.crouchReloadB:ao.reloadB:this.inventory.reloadTotal*600;
   if(!this.reloadSoundA&&elapsed>=a){this.reloadSoundA=true;this.onSound?.('reloadA',this.inventory.selected,this.sim.player.position);}
   if(!this.reloadSoundB&&elapsed>=b){this.reloadSoundB=true;this.onSound?.('reloadB',this.inventory.selected,this.sim.player.position);}
  }else this.reloadSoundId=-1;
  this.inventory.tick(dt);this.effects=this.effects.filter(e=>(e.life-=dt)>0);
  if(this.sim.player.grounded||this.sim.player.health<=0)this.parachute=false;
  if(this.meleeQueued&&this.inventory.cooldown<=0){
   this.meleeQueued=false;
   const p=this.sim.player.position;this.fire({origin:{...p,y:p.y+1.3},direction:{x:Math.sin(this.sim.player.heading),y:0,z:Math.cos(this.sim.player.heading)}});
  }
  if(this.strike){this.strike.remaining-=dt;if(this.strike.remaining<=0){const strike=this.strike;this.strike=undefined;this.resolveStrike(strike);}}
  this.updateAreaShots(dt);this.updateBullets(dt);this.nowMs+=dt*1000;this.updateFires(dt);this.releaseExplosions();
  for(const h of this.hazards){h.remaining-=dt;h.tick-=dt;if(h.tick<=0){h.tick=.5;this.effect(h.kind,h.position,h.position,.7,h.radius);this.radial(h.position,h.radius,h.kind==='flame'?12:4,h.kind==='flame');this.pedestrians()?.frighten(h.position,15);}}
  this.hazards=this.hazards.filter(h=>h.remaining>0);
  const survivors:Projectile[]=[];
  for(const p of this.projectiles){
   const w=weaponById(p.weapon)!,rocket=w.kind==='rocket'||w.kind==='guided';
   const tune=projectileTuning(w.kind);
   if(p.target!==undefined){const body=this.heatSeekBody(p.target);if(body){const wanted=normalize(add(body.translation(),p.position,-1)),blend=Math.min(1,dt*3);p.velocity=add({x:p.velocity.x*(1-blend),y:p.velocity.y*(1-blend),z:p.velocity.z*(1-blend)},wanted,38*blend);}else p.fuse-=dt;}
   else p.fuse-=dt;
   // CProjectileInfo::Update: guided homing, gravity, drag and bounce.
   if(w.kind==='guided'&&p.target===undefined){/* unguided rocket flies flat */}
   let impact=false;
   if(!p.stuck){p.velocity.y-=tune.gravity*dt;const dragK=1-Math.min(0.5,tune.drag*dt*50);p.velocity={x:p.velocity.x*dragK,y:p.velocity.y*dragK,z:p.velocity.z*dragK};const length=Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)*dt,dir=normalize(p.velocity),hit=this.ray(p.position,dir,length+.06,p.owner===undefined?this.sim.playerBody:this.sim.world.getRigidBody(p.owner)??this.sim.playerBody);
    if(hit){p.position=add(p.position,dir,Math.max(0,hit.timeOfImpact-.07));impact=true;
     if(w.kind==='satchel'){p.stuck=true;p.velocity={x:0,y:0,z:0};}
     else if(!rocket&&w.kind!=='molotov'){const n=hit.normal,dot=p.velocity.x*n.x+p.velocity.y*n.y+p.velocity.z*n.z;p.velocity={x:(p.velocity.x-2*dot*n.x)*tune.bounce,y:(p.velocity.y-2*dot*n.y)*tune.bounce,z:(p.velocity.z-2*dot*n.z)*tune.bounce};if(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)<1)p.stuck=true;}
    }else p.position=add(p.position,p.velocity,dt);
   }
   if(p.fuse<=0||impact&&(rocket||w.kind==='molotov')){const spot={...p.position,y:p.position.y+.12};if(w.kind==='gas')this.hazard('gas',spot,5);else if(w.kind==='molotov')this.explode(spot,EXPLOSION_TYPE.molotov);else this.explode(spot,rocket?EXPLOSION_TYPE.rocket:EXPLOSION_TYPE.grenade);}
   else survivors.push(p);
  }
  this.projectiles=survivors;
 }
 dispose(){this.bullets=[];this.projectiles=[];this.effects=[];this.hazards=[];this.shots=[];this.fires.clear();this.molotovs=[];}
}
