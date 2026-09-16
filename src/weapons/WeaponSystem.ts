import {Vector3,Quaternion} from 'three';
import type {WorldPlane} from '../simulation/WorldPlane';
import RAPIER from '@dimforge/rapier3d-compat';
import {WeaponInventory} from './Inventory';
import {weaponById,type WeaponDefinition} from './catalog';
import {WEAPON_FLAG,hasWeaponFlag,nativeAimOffset,nativeWeaponInfo,nativeWeaponRadiusOnScreen,type NativeWeaponData,type NativeWeaponInfo} from './weaponData';
import type {Simulation} from '../simulation/Simulation';
import type {WorldPedestrians} from '../simulation/WorldPedestrians';
import type {WorldFleet} from '../simulation/WorldFleet';
import type {Vec3} from '../core/math';
import {CRIME} from '../simulation/nativeWanted';
import type {WeaponFxHost} from '../simulation/fx/WorldFx';
/** Native handheld IDs usable one-handed from a car (authored set; the gang task is not reversed). */
const DRIVEBY_WEAPONS=new Set([22,23,24,26,28,29,30,32]);
/** eExplosionType values the weapon system raises (CExplosion::AddExplosion). */
const EXPLOSION_TYPE={grenade:0,molotov:1,rocket:2,car:4,aircraft:7} as const;
/** How the player damaged something, for native crime reporting. */
export type DamageKind='melee'|'bullet'|'explosion'|'fire'|'spray';
/** A pedestrian hit reported back to the weapon system. */
export interface PedestrianVictim {id:number;officer:boolean}
export interface WeaponEffect {id:number;kind:'tracer'|'impact'|'explosion'|'flame'|'gas'|'spray'|'extinguisher';from:Vec3;to:Vec3;life:number;radius:number;}
export interface Projectile {id:number;weapon:number;position:Vec3;velocity:Vec3;fuse:number;stuck:boolean;target?:number;owner?:number;}
interface Hazard {kind:'flame'|'gas';position:Vec3;remaining:number;tick:number;radius:number;}
/** CShotInfo: native area-effect particles for the flamethrower, spray can and extinguisher. */
export interface AreaShot {weapon:number;origin:Vec3;velocity:Vec3;range:number;remaining:number;executed:boolean;age:number;}
const add=(a:Vec3,b:Vec3,s=1):Vec3=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s});
const distance=(a:Vec3,b:Vec3)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const normalize=(a:Vec3):Vec3=>{const l=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/l,y:a.y/l,z:a.z/l};};
/** Native simulation steps are 1/50 s; CShotInfo speeds are per step. */
const NATIVE_STEP=1/50;
/** Half the 64-unit crosshair sprite in a 640-unit screen at the 70-degree aiming field of view. */
const CROSSHAIR_TANGENT=32/320*Math.tan(35*Math.PI/180);
/** SetUpPelletCol accepts at most 15 pellet lines. */
const PELLETS=15;
/** CShotInfo::ms_afRandTable: -0.05 to 0.045 in 0.005 steps. */
const randTable=()=>-.05+.005*Math.floor(Math.random()*20);
export class WeaponSystem {
 readonly inventory=new WeaponInventory();
 effects:WeaponEffect[]=[];projectiles:Projectile[]=[];hazards:Hazard[]=[];shots:AreaShot[]=[];
 vision:'nightvision'|'infrared'|null=null;parachute=false;photoRequested=false;ready=true;aiming=false;
 hits=0;explosions=0;aircraftShots=0;private aircraftCooldown=0;private serial=0;
 /** Twin pistols alternate hands; true when the next shot leaves the left gun. */
 leftHand=false;lastHand:'right'|'left'='right';
 muzzle?:(left?:boolean)=>Vec3|undefined;
 /** CAECollisionAudioEntity::ReportBulletHit: the struck collider, the hit point and asin(-dir·normal) in degrees. */
 onBulletHit?:(hit:RAPIER.RayColliderIntersection,point:Vec3,angle:number)=>void;
 onSound?:(event:import('../assets/nativeCombatAudio').CombatSound,weapon:number,position:Vec3,source?:'player'|'npc'|'aircraft'|'stealth')=>void;
 private reloadSoundId=-1;private reloadSoundA=false;private reloadSoundB=false;
 onUse?:(w:WeaponDefinition)=>void;
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
 /** The knife's weapon.dat row names the stealth_kn association group. */
 stealthTarget(){
  const info=this.inventory.info();if(!this.aiming||this.stealth||!info||info.animGroup!=='stealth_kn'||this.sim.player.health<=0||!this.sim.player.grounded||this.sim.player.speed>=3)return undefined;
  return this.pedestrians()?.stealthTarget?.(this.sim.player.position);
 }
 npcShot(from:Vec3,to:Vec3,weapon=22,hit=true){this.effect('tracer',from,to,.09);if(hit)this.effect('impact',to);this.fx?.gunshot(from,normalize(add(to,from,-1)),weapon,false);}
 /** Native FX (effects.fxp); the sphere effects remain as the fallback while it loads or when it is unavailable. */
 fx?:WeaponFxHost;
  constructor(readonly sim:Simulation,private pedestrians:()=>({damageCollider(handle:number,damage:number,direction:{x:number;z:number},kind?:DamageKind):boolean|PedestrianVictim}&Pick<WorldPedestrians,'targets'|'frighten'>&Partial<Pick<WorldPedestrians,'stealthTarget'|'stealthKill'>>)|undefined,private fleet:()=>(Pick<WorldFleet,'cars'|'boats'>&Partial<Pick<WorldFleet,'planes'>>)|undefined){}
 installNative(data:NativeWeaponData){this.inventory.installNative(data);}
 get native(){return this.inventory.native;}
 snapshot(){return {...this.inventory.snapshot(),native:!!this.native,ready:this.ready,aircraftShots:this.aircraftShots,hits:this.hits,explosions:this.explosions,projectiles:this.projectiles.length,hazards:this.hazards.length,areaShots:this.shots.length,hand:this.lastHand,satchels:this.projectiles.filter(p=>p.weapon===39).length,vision:this.vision,parachute:this.parachute};}
 private effect(kind:WeaponEffect['kind'],from:Vec3,to=from,life=.12,radius=.1){this.effects.push({id:this.serial++,kind,from:{...from},to:{...to},life,radius});if(this.effects.length>128)this.effects.shift();}
 private ray(from:Vec3,direction:Vec3,range:number,body=this.sim.playerBody){return this.sim.world.castRayAndGetNormal(new RAPIER.Ray(from,direction),range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,body);}
 private damage(handle:number,amount:number,direction:Vec3,explosive=false,kind:DamageKind=explosive?'explosion':'bullet'){
  const victim=this.pedestrians()?.damageCollider(handle,amount,direction,kind);
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
   for(const car of this.fleet()?.cars??[]){for(let i=0;i<car.car.body.numColliders();i++)if(car.car.body.collider(i).handle===handle&&!car.wrecked){this.hits++;if(car.damage(amount,handle,explosive))this.onCrime?.(CRIME.destroyVehicle,`car:${car.car.body.handle}`);this.releaseExplosions();return true;}}
   for(const boat of this.fleet()?.boats??[])if(!boat.wrecked&&boat.body.numColliders()&&[...Array(boat.body.numColliders()).keys()].some(i=>boat.body.collider(i).handle===handle)){this.hits++;if(boat.damage(amount))this.onCrime?.(CRIME.destroyVehicle,`boat:${boat.body.handle}`);return true;}
  for(const plane of this.fleet()?.planes??[])for(let i=0;i<plane.body.numColliders();i++)if(plane.body.collider(i).handle===handle&&plane.health>0){this.hits++;if(plane.damage(amount)){this.onCrime?.(plane.helicopter?CRIME.destroyHeli:CRIME.destroyPlane,`plane:${plane.body.handle}`);this.explode(plane.body.translation(),12,220,EXPLOSION_TYPE.aircraft);}return true;}
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
 private explode(position:Vec3,radius=8,damage=180,type:number=EXPLOSION_TYPE.grenade){this.explosions++;this.onSound?.('explosion',0,position);this.effect('explosion',position,position,.8,radius);this.fx?.explosion(type,position);this.pedestrians()?.frighten(position,45);this.radial(position,radius,damage);}
 private hazard(kind:Hazard['kind'],position:Vec3,radius:number,remaining=kind==='flame'?6:9){if(this.hazards.length>=16)this.hazards.shift();this.hazards.push({kind,position:{...position},radius,remaining,tick:0});}
 vehicleExplosion(position:Vec3){this.explode(position,12,220,EXPLOSION_TYPE.aircraft);}
 /** Cars blown up by damage or burning spawn their EXPLOSION_CAR blast here. */
 private releaseExplosions(){for(const car of this.fleet()?.cars??[])if(car.pendingExplosion){car.pendingExplosion=false;this.explode(car.car.body.translation(),7,140,EXPLOSION_TYPE.car);}}
  /** Authored drive-by approximation (CTaskSimpleGangDriveBy is not reversed): one-handed
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
   this.pedestrians()?.frighten(source,35);
   this.onCrime?.(CRIME.fireWeapon,'player');
  const info=this.inventory.info();
  if(info&&(w.kind==='bullet'||w.kind==='shotgun'))return this.fireInstantHit(w,info,source,resolved,vehicle.body);
  const hit=this.ray(source,resolved,range,vehicle.body),end=add(source,resolved,hit?.timeOfImpact??range);
  this.effect('tracer',source,end,.065);
  if(hit){this.effect('impact',end);if(this.damage(hit.collider.handle,w.damage,resolved))this.onHit?.(w.id);}
  return true;
 }
 fireAircraft(plane:WorldPlane,rocket=false){
  if(!plane.occupied||plane.health<=0||!plane.armed||this.aircraftCooldown>0||this.sim.player.health<=0)return false;
  if(rocket&&(plane.modelId===476||plane.rockets<=0||this.projectiles.length>=24)||!rocket&&plane.gunAmmo<=0)return false;
  this.aircraftCooldown=rocket?.8:.1;this.aircraftShots++;const q=new Quaternion().copy(plane.body.rotation()),direction=new Vector3(0,0,-1).applyQuaternion(q),position=plane.body.translation(),from=new Vector3(0,0,-Math.min(6,plane.assets.collision!.bounds.radius)).applyQuaternion(q).add(position);
  if(rocket){plane.rockets--;this.projectiles.push({id:this.serial++,weapon:35,position:from,velocity:direction.clone().multiplyScalar(55).add(plane.body.linvel()),fuse:8,stuck:false,owner:plane.body.handle});}
  else{plane.gunAmmo--;const hit=this.ray(from,direction,400,plane.body),end=from.clone().addScaledVector(direction,hit?.timeOfImpact??400);this.effect('tracer',from,end,.1);this.fx?.gunshot(from,direction,38,true);if(hit){this.hitFx(hit,end,8,direction);this.damage(hit.collider.handle,35,direction);}}
  this.onSound?.('fire',rocket?35:38,from,'aircraft');this.onCrime?.(rocket?CRIME.explosion:CRIME.fireWeapon,'player');return true;
 }
 /** Random offset inside the native free-aim crosshair circle (CPlayerPed::GetWeaponRadiusOnScreen). */
 private aimSpread(direction:Vec3,info:NativeWeaponInfo){
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
  if(w.kind==='melee'&&this.stealthReady>=1/16){
   const target=this.stealthTarget();
   // Pressing attack with KILL_Partial blended past 0.5 starts the stealth kill instead of a melee swing.
   if(target&&this.pedestrians()?.stealthKill?.(target.id,this.sim.player.position)){this.stealth={id:target.id,remaining:this.stealthClipSeconds,target:target.position};this.stealthReady=0;this.onSound?.('impact',w.id,this.sim.player.position,'stealth');this.onCrime?.(target.officer?CRIME.stabCop:CRIME.stabPed,`ped:${target.id}`);this.onStealth?.(this.stealthClipSeconds);this.onHit?.(w.id);return true;}
  }
  if(!this.inventory.fire())return false;this.onUse?.(w);this.onSound?.('fire',w.id,this.sim.player.position);
  // CTaskComplexUseGoggles: goggles_put_on runs first; PutOnGoggles/TakeOffGoggles apply when it finishes.
  if(w.kind==='nightvision'||w.kind==='infrared'){if(!this.goggles)this.goggles={kind:w.kind,remaining:this.gogglesClipSeconds};return true;}
  if(w.kind==='parachute'){this.parachute=true;return true;}
  if(w.kind==='camera'){this.photoRequested=true;return true;}
  if(w.kind==='detonator'){const bombs=this.projectiles.filter(p=>p.weapon===39);this.projectiles=this.projectiles.filter(p=>p.weapon!==39);for(const b of bombs)this.explode(b.position,8,180);return true;}
  const left=twin&&this.leftHand;this.lastHand=left?'left':'right';if(twin)this.leftHand=!this.leftHand;else this.leftHand=false;
  let source={...this.sim.player.position,y:this.sim.player.position.y+(this.sim.player.crouched?.9:1.3)};
  const muzzle=w.kind==='bullet'||w.kind==='shotgun'||info?.fire==='area'?this.muzzle?.(left):undefined;
  if(muzzle&&distance(source,muzzle)<3&&!this.ray(source,normalize(add(muzzle,source,-1)),distance(source,muzzle)))source={...muzzle};
  const range=info&&info.fire!=='melee'?info.weaponRange:w.range;
  let direction=normalize(camera.direction);
  if(w.kind==='melee')direction={x:Math.sin(this.sim.player.heading),y:0,z:Math.cos(this.sim.player.heading)};
  else {const sight=this.ray(camera.origin,direction,range),target=add(camera.origin,direction,sight?.timeOfImpact??range);direction=normalize(add(target,source,-1));}
  if(w.kind==='melee'){
   const hit=this.sim.world.castShape(source,{x:0,y:0,z:0,w:1},direction,new RAPIER.Ball(.45),.01,w.range,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,this.sim.playerBody);
   if(hit){this.damage(hit.collider.handle,w.damage,direction,false,'melee');this.onSound?.('impact',w.id,source);this.effect('impact',add(source,direction,hit.time_of_impact));}return true;
  }
  this.pedestrians()?.frighten(source,w.id===23?8:35);
  // CWeapon::Fire reports FIRE_WEAPON for every shot; CWeapon::FireProjectile reports an EXPLOSION crime.
  if(!['spray','extinguisher'].includes(w.kind))this.onCrime?.(['rocket','guided','grenade','molotov','satchel'].includes(w.kind)?CRIME.explosion:CRIME.fireWeapon,'player');
  if(info&&(w.kind==='bullet'||w.kind==='shotgun'))return this.fireInstantHit(w,info,source,direction);
  if(['bullet','shotgun'].includes(w.kind)){
   const right=normalize({x:-direction.z,y:0,z:direction.x}),up=normalize({x:-direction.y*direction.x,y:direction.x**2+direction.z**2,z:-direction.y*direction.z});
   for(let i=0;i<w.pellets;i++){const angle=i*2.399963+(this.inventory.shots%11)*.3,r=w.spread*(1-this.inventory.proficiency*.25)*(w.pellets>1?Math.sqrt((i+.5)/w.pellets):this.aiming?.2:1),dir=normalize(add(add(direction,right,Math.cos(angle)*r),up,Math.sin(angle)*r));const hit=this.ray(source,dir,w.range),end=add(source,dir,hit?.timeOfImpact??w.range);this.effect('tracer',source,end,.065);if(hit){this.effect('impact',end);if(this.damage(hit.collider.handle,w.damage,dir))this.onHit?.(w.id);}}
   return true;
  }
  if(info?.fire==='area'){this.addAreaShot(w.id,info,source,add(source,direction,range));this.fx?.areaEffect(w.id,source,direction);return true;}
  if(['flame','spray','extinguisher'].includes(w.kind)){
   const hit=this.ray(source,direction,w.range),end=add(source,direction,hit?.timeOfImpact??w.range);this.effect(w.kind as 'flame'|'spray'|'extinguisher',source,end,.25,.45);
   if(hit&&w.damage)this.damage(hit.collider.handle,w.damage,direction);
   if(w.kind==='extinguisher')this.hazards=this.hazards.filter(h=>h.kind!=='flame'||distance(h.position,end)>4);
   return true;
  }
  const rocket=w.kind==='rocket'||w.kind==='guided';
  const projectile:Projectile={id:this.serial++,weapon:w.id,position:{...source},velocity:add({x:0,y:rocket?0:5,z:0},direction,rocket?38:15),fuse:rocket?8:w.kind==='satchel'?Infinity:3,stuck:false};
  if(w.kind==='guided'){
   const target=[...(this.fleet()?.cars??[])].filter(c=>!c.wrecked).map(c=>({c,p:c.car.body.translation()})).filter(t=>{const d=normalize(add(t.p,source,-1));return d.x*direction.x+d.y*direction.y+d.z*direction.z>.94&&distance(t.p,source)<250;}).sort((a,b)=>distance(a.p,source)-distance(b.p,source))[0];projectile.target=target?.c.car.body.handle;
  }
  this.projectiles.push(projectile);return true;
 }
 /** CWeapon::DoBulletImpact FX for a ray hit: blood on pedestrians, sparks on vehicles, the surface BULLET_FX elsewhere. */
 private hitFx(hit:RAPIER.RayColliderIntersection,point:Vec3,amount:number,direction?:Vec3){
  const handle=hit.collider.handle;
  if(direction)this.onBulletHit?.(hit,point,Math.asin(Math.max(-1,Math.min(1,-(direction.x*hit.normal.x+direction.y*hit.normal.y+direction.z*hit.normal.z))))*180/Math.PI);
  if(!this.fx?.ready)return;
   const ped=this.pedestrians()?.targets().some(t=>t.handle===handle),vehicle=[...(this.fleet()?.cars??[])].some(c=>{for(let i=0;i<c.car.body.numColliders();i++)if(c.car.body.collider(i).handle===handle)return true;return false;})||[...(this.fleet()?.boats??[])].some(b=>{for(let i=0;i<b.body.numColliders();i++)if(b.body.collider(i).handle===handle)return true;return false;});
  this.fx.bulletHit({point,normal:{x:hit.normal.x,y:hit.normal.y,z:hit.normal.z},collider:handle,featureType:hit.featureType,featureId:hit.featureId,ped:ped?{head:false,dead:false}:undefined,vehicle},amount);
 }
 /** Native instant hits: weapon range, crosshair spread, WEAPON.DAT damage, the 150-point
  * point-blank player shot and shotgun pellets counted against the first victim. */
 private fireInstantHit(w:WeaponDefinition,info:NativeWeaponInfo,source:Vec3,aim:Vec3,exclude?:RAPIER.RigidBody){
  const shotgun=w.id===25||w.id===26||w.id===27,direction=this.aimSpread(aim,info),hit=this.ray(source,direction,info.weaponRange,exclude),end=add(source,direction,hit?.timeOfImpact??info.weaponRange);
  if(!shotgun){
   this.effect('tracer',source,end,.065);this.fx?.gunshot(source,direction,w.id,false);if(!hit)return true;this.effect('impact',end);
   const target=this.pedestrians()?.targets().find(t=>t.handle===hit.collider.handle),pointBlank=!!target&&distance(target.position,source)<=1;
   this.hitFx(hit,end,8,direction);
   if(this.damage(hit.collider.handle,pointBlank?150:info.damage,direction))this.onHit?.(w.id);return true;
  }
  // SetUpPelletCol: pellet lines spread with distance to the first victim; hits on that victim accumulate.
  const spreadRate=.05/info.accuracy,depth=Math.max(.05,(hit?.timeOfImpact??info.weaponRange)*spreadRate*1.3),right=normalize({x:-direction.z,y:0,z:direction.x}),up=normalize({x:-direction.y*direction.x,y:direction.x**2+direction.z**2,z:-direction.y*direction.z});
  let pellets=0;
  for(let i=0;i<PELLETS;i++){
   const angle=(Math.random()*2-1)*Math.PI,spread=i===0?0:Math.random()*depth*.8,target=add(add(end,right,Math.cos(angle)*spread),up,Math.sin(angle)*spread),dir=normalize(add(target,source,-1)),reach=distance(target,source)+depth*2;
   const pellet=this.ray(source,dir,reach,exclude),stop=add(source,dir,pellet?.timeOfImpact??Math.min(reach,info.weaponRange));
   if(i<8)this.effect('tracer',source,stop,.065);
   if(pellet&&hit&&pellet.collider.handle===hit.collider.handle)pellets++;
  }
  this.fx?.gunshot(source,direction,w.id,false);
  if(hit){this.effect('impact',end);this.hitFx(hit,end,8,direction);if(pellets&&this.damage(hit.collider.handle,pellets*info.damage,direction))this.onHit?.(w.id);}
  return true;
 }
 /** CShotInfo::AddShot. */
 private addAreaShot(weapon:number,info:NativeWeaponInfo,origin:Vec3,target:Vec3){
  if(this.shots.length>=100)this.shots.shift();
  let offset=add(target,origin,-1);
  if(info.spread!==0)offset=add(offset,{x:randTable()*info.spread,y:randTable(),z:randTable()*info.spread});
  const speed=(info.speed+(hasWeaponFlag(info,WEAPON_FLAG.randSpeed)?randTable():0))/NATIVE_STEP;
  this.shots.push({weapon,origin:{...origin},velocity:add({x:0,y:0,z:0},normalize(offset),speed),range:info.radius,remaining:info.lifespan/1000,executed:false,age:0});
  // CWeapon::FireAreaEffect: a flamethrower shot has a one-in-three chance to start creeping fire ahead.
  if(weapon===37&&Math.random()<1/3){const dir=normalize(offset);const spot=add(add(origin,dir,3.5+Math.random()*2.5),{x:0,y:.5,z:0});const ground=this.sim.world.castRay(new RAPIER.Ray(spot,{x:0,y:-1,z:0}),3,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(ground)this.hazard('flame',{...spot,y:spot.y-ground.timeOfImpact+.1},1.5,4);}
 }
 /** Burning actors: CFireManager::StartFire lasts 7000 ms. */
 readonly burning=new Map<number,number>();
 private burningCars=new Map<import('../simulation/WorldCar').WorldCar,number>();
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
    if(shot.weapon===37){if(!this.burning.has(person.handle))this.burning.set(person.handle,7);continue;}
    if(shot.executed)continue;this.damage(person.handle,info.damage,normalize(shot.velocity),false,shot.weapon===41?'spray':'fire');shot.executed=true;
   }
   if(shot.weapon===42&&!shot.executed){
    const before=this.hazards.length+this.burning.size;this.hazards=this.hazards.filter(h=>h.kind!=='flame'||distance(h.position,shot.origin)>=reach+h.radius);
    for(const person of people)if(distance(person.position,shot.origin)<reach+.5)this.burning.delete(person.handle);
    if(this.hazards.length+this.burning.size!==before)shot.executed=true;
   }
   // CWorld::SetCarsOnFire uses a four-metre radius.
   if(shot.weapon===37)for(const car of this.fleet()?.cars??[])if(!car.wrecked&&!this.burningCars.has(car)&&distance(car.car.body.translation(),shot.origin)<4)this.burningCars.set(car,7);
  }
  this.shots=this.shots.filter(s=>s.remaining>0);
  // CTaskComplexOnFire::ComputeFireDamage: 0.5 per native step; CFire::ProcessFire: 1.2 per step on vehicles.
  for(const [handle,remaining] of this.burning){const left=remaining-dt;if(left<=0||!people.some(p=>p.handle===handle)){this.burning.delete(handle);continue;}this.burning.set(handle,left);this.damage(handle,.5*dt/NATIVE_STEP,{x:0,y:0,z:1},false,'fire');}
  for(const [car,remaining] of this.burningCars){const left=remaining-dt;if(left<=0||car.wrecked){this.burningCars.delete(car);continue;}this.burningCars.set(car,left);car.damage(1.2*dt/NATIVE_STEP);}
 }
 tick(dt:number){
  this.aircraftCooldown=Math.max(0,this.aircraftCooldown-dt);
  this.inventory.crouched=this.sim.player.crouched;
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
  this.updateAreaShots(dt);this.releaseExplosions();
  for(const h of this.hazards){h.remaining-=dt;h.tick-=dt;if(h.tick<=0){h.tick=.5;this.effect(h.kind,h.position,h.position,.7,h.radius);this.radial(h.position,h.radius,h.kind==='flame'?12:4,h.kind==='flame');this.pedestrians()?.frighten(h.position,15);}}
  this.hazards=this.hazards.filter(h=>h.remaining>0);
  const survivors:Projectile[]=[];
  for(const p of this.projectiles){
   const w=weaponById(p.weapon)!,rocket=w.kind==='rocket'||w.kind==='guided';p.fuse-=dt;
   if(p.target!==undefined){const car=[...(this.fleet()?.cars??[])].find(c=>c.car.body.handle===p.target&&!c.wrecked);if(car){const wanted=normalize(add(car.car.body.translation(),p.position,-1)),blend=Math.min(1,dt*3);p.velocity=add({x:p.velocity.x*(1-blend),y:p.velocity.y*(1-blend),z:p.velocity.z*(1-blend)},wanted,38*blend);}}
   let impact=false;
   if(!p.stuck){if(!rocket)p.velocity.y-=9.81*dt;const length=Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)*dt,dir=normalize(p.velocity),hit=this.ray(p.position,dir,length+.06,p.owner===undefined?this.sim.playerBody:this.sim.world.getRigidBody(p.owner)??this.sim.playerBody);
    if(hit){p.position=add(p.position,dir,Math.max(0,hit.timeOfImpact-.07));impact=true;
     if(w.kind==='satchel'){p.stuck=true;p.velocity={x:0,y:0,z:0};}
     else if(!rocket&&w.kind!=='molotov'){const n=hit.normal,dot=p.velocity.x*n.x+p.velocity.y*n.y+p.velocity.z*n.z;p.velocity={x:(p.velocity.x-2*dot*n.x)*.4,y:(p.velocity.y-2*dot*n.y)*.4,z:(p.velocity.z-2*dot*n.z)*.4};if(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)<1)p.stuck=true;}
    }else p.position=add(p.position,p.velocity,dt);
   }
   if(p.fuse<=0||impact&&(rocket||w.kind==='molotov')){const spot={...p.position,y:p.position.y+.12};if(w.kind==='gas')this.hazard('gas',spot,5);else if(w.kind==='molotov'){this.hazard('flame',spot,4);this.fx?.explosion(EXPLOSION_TYPE.molotov,spot);}else this.explode(spot,rocket?9:8,w.damage,rocket?EXPLOSION_TYPE.rocket:EXPLOSION_TYPE.grenade);}
   else survivors.push(p);
  }
  this.projectiles=survivors;
 }
 dispose(){this.projectiles=[];this.effects=[];this.hazards=[];this.shots=[];this.burning.clear();this.burningCars.clear();}
}
