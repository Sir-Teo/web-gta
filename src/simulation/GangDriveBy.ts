import RAPIER from '@dimforge/rapier3d-compat';
import {sitClip} from './nativeDoor';
import {DIE_IN_CAR_OFFSET_MS,canPedStepOutCar} from '../vehicle/nativeDieInCar';
import {Quaternion,Vector3} from 'three';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {readIfp,type NativeAnimation} from '../assets/ifp';
import {worldPaths} from '../assets/worldPaths';
import {trafficLinks} from './trafficRoute';
import {GAME_SPEED_TO_CARAI_SPEED,steerHeadingForTarget} from '../vehicle/nativeCarCtrl';
import {readPedGroups} from '../assets/pedGroups';
import {openWeaponAssets} from '../weapons/assets';
import {nativeWeaponInfo,nativeWeaponReloadMs,type NativeWeaponInfo} from '../weapons/weaponData';
import {stepNpcGun,npcAimSpread,npcInaccurateAim,type NpcGunState} from './npcGun';
import {bulletTyreHit,pushShotVehicle} from '../weapons/bulletVehicle';
import type {DffModel} from '../assets/dff';
import type {ModelTexture} from '../assets/modelTextures';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';
import type {WorldFleet} from './WorldFleet';
import type {OccupantPose} from '../render/VehicleOccupants';

/** Gang drive-by weapon (Micro SMG) and pacing. */
export const DRIVEBY_WEAPON = 28;
export const DRIVEBY_COOLDOWN = 50;
export const DRIVEBY_LIFETIME = 35;
export const DRIVEBY_ATTACK_RANGE = 26;
interface Shooter {
  model:string;gun:{model:DffModel;textures:ModelTexture[]}|undefined;
  gunState:NpcGunState;side:'left'|'right';seconds:number;aimPoint?:{x:number;y:number;z:number};shots:number;
}
interface AttackCar {car:WorldCar;gang:number;driver:string;shooter:Shooter;mission:'approach'|'attack'|'leave';seconds:number;leaveAt:number;
 /** CPed health under the player's bullets, the driver's 2000 ms coast after the fatal shot (CTaskComplexDieInCar) and the dead seats. */
 driverHealth:number;shooterHealth:number;driverDying?:{at:number};driverDead?:boolean;shooterDead?:boolean}
/** Rival turf drive-bys (CTaskSimpleGangDriveBy port): a gang car
 * cruises past the mark with a posed Micro SMG shooter working the passenger
 * window on muzzle rays; NPC traffic drivers join in when the mark is wanted. */
export class GangDriveBy {
  readonly units:AttackCar[]=[];
  private paths?:ReturnType<typeof worldPaths>;
  private gangs:string[][]=[];
  private clips=new Map<string,NativeAnimation>();
  private gunCache?:{asset:{model:DffModel;textures:ModelTexture[]};info:NativeWeaponInfo;reloadSeconds:number};
  private busy=false;private nextCheck=0;private disposed=false;private seconds=0;
  private lastAttack=-Infinity;
  onShot?:(from:{x:number;y:number;z:number},to:{x:number;y:number;z:number},weapon:number,hit:boolean)=>void;
  canSpawn:(point:{x:number;y:number;z:number},radius:number)=>boolean=()=>true;
  /** Rival turf with INITIAL strength, shared with the street population. */
  gangTurf?:(x:number,z:number)=>{gang:number;strength:number}|undefined;
  /** The gang's resident models (CStreaming keeps two per active gang); the whole group when unset. */
  gangResident?:(gang:number)=>string[];
  /** Whether the gang holding the turf hates the player (its ped type's acquaintance with PLAYER1): only then does
   * one of its cars come by shooting at him. */
  gangHatesPlayer?:(gang:number)=>boolean;
  error?:string;
  constructor(private sim:Simulation,private fleet:WorldFleet,base:string,private random:()=>number=Math.random){
   void openStaticWorld(base).then(async source=>{
    if(this.disposed)return;
    this.paths=worldPaths(source);
    const find=(path:string)=>source.manifest.resources.find(r=>r.path===path);
    const [ifp,groups,weapons]=await Promise.all([
     find('animations/drivebys.ifp')?readIfp(new Uint8Array(await (await source.resource(find('animations/drivebys.ifp')!)).arrayBuffer())):undefined,
     find('data/pedgrp.dat')?readPedGroups(await (await source.resource(find('data/pedgrp.dat')!)).text()):undefined,
     openWeaponAssets(base),
    ]);
    if(this.disposed)return;
    if(ifp)for(const clip of ifp.animations)this.clips.set(clip.name.toLowerCase(),clip);
    if(groups)this.gangs=groups.gangs;
    const data=await weapons.weaponData();
    const info=nativeWeaponInfo(data,DRIVEBY_WEAPON,1)??nativeWeaponInfo(data,DRIVEBY_WEAPON,3);
    if(info){const loaded=await weapons.load(DRIVEBY_WEAPON,info.animGroup);if(!this.disposed&&loaded.asset)this.gunCache={asset:{model:loaded.asset.model,textures:loaded.asset.textures},info,reloadSeconds:nativeWeaponReloadMs(data,info)/1000};}
   }).catch(e=>{this.error=String(e);});
  }
  /** A drive-by clip (drivebys.ifp) by its lower-case name, and the Micro SMG with its weapon info, once loaded: what
   * a script's drive-by rider shares with the gang cars. */
  clip(name:string){return this.clips.get(name);}
  get gun(){return this.gunCache;}
  /** Cars this manager drives (excluded from the civilian driver poses). */
  covers(car:WorldCar){return this.units.some(u=>u.car===car);}
  /** The gang member at the wheel of an attack car, for the ped the player drags out or who leaves it. */
  driverOf(car:WorldCar){const u=this.units.find(u=>u.car===car);return u&&{model:u.driver};}
  /** CTaskComplexLeaveCarAndDie for a shot driver once the car rests: the host plays his exit and lays him dead. */
  onCrewDiesOut?:(car:WorldCar,model:string)=>void;
  /** The seated crew a bullet line can reach: the driver (seat 0) and the shooter (seat 1), seat locals in car space. */
  crewSeats(){
   const out:{car:WorldCar;seat:number;local:{x:number;y:number;z:number}}[]=[];
   for(const u of this.units){
    if(u.car.wrecked||u.car.occupied)continue;
    const left=u.car.seat('left'),right=u.car.seat('right');
    if(left&&!u.driverDead&&!u.car.driverOut)out.push({car:u.car,seat:0,local:left});
    if(right&&!u.shooterDead)out.push({car:u.car,seat:1,local:right});
   }
   return out;
  }
  /** A bullet reaching the driver or the shooter: CPed damage; the fatal one coasts the driver 2000 ms (CTaskComplexDieInCar)
   * or kills the shooter in his seat. */
  crewShot(car:WorldCar,seat:number,damage:number):'hit'|'killed'|undefined{
   const u=this.units.find(u=>u.car===car);
   if(!u||car.wrecked||car.occupied)return undefined;
   if(seat===0){
    if(u.driverDead||car.driverOut)return undefined;if(u.driverDying)return 'hit';
    u.driverHealth=Math.max(0,u.driverHealth-damage);if(u.driverHealth>0)return 'hit';
    u.driverDying={at:u.seconds};return 'killed';
   }
   if(u.shooterDead)return undefined;
   u.shooterHealth=Math.max(0,u.shooterHealth-damage);if(u.shooterHealth>0)return 'hit';
   u.shooterDead=true;u.shooter.gunState.active=false;return 'killed';
  }
  /** Driver plus posed shooter per attack car for the occupant renderer. */
  poses():OccupantPose[]{
   const out:OccupantPose[]=[];
   for(const u of this.units){
    if(u.car.wrecked||u.car.occupied)continue;
    const seat=u.car.seat('left');
    // Dead in the seat: CAR_dead_LHS/RHS held on its last frame; a driver dead out of the door is gone from the car.
    if(seat&&!u.car.driverOut)out.push({key:`driveby-driver:${u.car.car.body.handle}`,car:u.car,model:u.driver,local:seat,clip:u.driverDead?'car_dead_lhs':sitClip(u.car.modelFlags,true),seconds:u.driverDead?1e6:0});
    const right=u.car.seat('right'),clipName=u.shooter.side==='left'?'gang_drivebylhs':'gang_drivebyrhs',clip=this.clips.get(clipName);
    if(right&&u.shooterDead)out.push({key:`driveby-shooter:${u.car.car.body.handle}`,car:u.car,model:u.shooter.model,local:right,clip:'car_dead_rhs',seconds:1e6});
    else if(right&&clip&&clip.duration>0)out.push({key:`driveby-shooter:${u.car.car.body.handle}`,car:u.car,model:u.shooter.model,local:right,clip:clipName,seconds:u.shooter.seconds%clip.duration,animation:clip,gun:u.shooter.gun});
   }
   return out;
  }
  update(now:number){
   if(this.disposed||this.busy||!this.paths||!this.gangs.length||!this.gunCache||now<this.nextCheck)return;this.nextCheck=now+1000;
   if(this.units.length||now-this.lastAttack<DRIVEBY_COOLDOWN*1000)return;
   if(this.fleet.occupiedPlane)return;
   const player=this.sim.player.position;
   if(this.sim.player.health<=0)return;
   const turf=this.gangTurf?.(player.x,player.z);
   if(!turf||!this.gangHatesPlayer?.(turf.gang)||this.random()*255>=turf.strength)return;
   const resident=this.gangResident?.(turf.gang);
   const members=resident&&resident.length>=2?resident:this.gangs[turf.gang]??[];
   if(members.length<2)return;
   const paths=this.paths;this.busy=true;
   void paths.loadAround(player.x,player.z).then(async()=>{
    if(this.disposed)return;
    const p=this.sim.player.position;
    const links=[...paths.areas.values()].flatMap(a=>a.nodes).filter(n=>{const d=Math.hypot(n.position[0]-p.x,-n.position[1]-p.z);return d>60&&d<90;}).flatMap(n=>trafficLinks(paths.areas,n));
    const scored=links.filter(link=>this.canSpawn({x:link.start.x,y:link.from.position[2]+1,z:link.start.z},6)).slice(0,12);
    for(const link of scored){
     const {x,z}=link.start;
     if([...this.fleet.cars].some(c=>Math.hypot(c.car.body.translation().x-x,c.car.body.translation().z-z)<12))continue;
     // The attack car is the gang's resident car (CPopulation::PickGangCar); any traffic car while none is resident.
     const modelId=this.fleet.gangCarModel(turf.gang)??this.fleet.trafficModel();
     const car=await this.fleet.spawnTrafficCar(modelId,{x,y:link.from.position[2],z},Math.atan2(-link.dx,-link.dz),()=>!this.disposed&&this.canSpawn({x,y:link.from.position[2]+1,z},6)).catch(()=>undefined);
     if(!car)continue;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
     car.gang=turf.gang;
     const driver=members[Math.floor(this.random()*members.length)];
     let shooter=members[Math.floor(this.random()*members.length)];
     if(shooter===driver)shooter=members[(members.indexOf(driver)+1)%members.length];
     car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;
     this.units.push({car,gang:turf.gang,driver,shooter:{model:shooter,gun:this.gunCache!.asset,gunState:{time:0,rounds:this.gunCache!.info.clip,reload:0,active:false},side:'right',seconds:0,shots:0},mission:'approach',seconds:0,leaveAt:Infinity,driverHealth:100,shooterHealth:100});
     this.lastAttack=now;
     break;
    }
   }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
  }
  /** Muzzle-ray firing sequence from the passenger window (officer routine,
   * here with street-cop dispersion: gang marksmanship has no native table). */
  private stepShooter(u:AttackCar,dt:number,target:{x:number;y:number;z:number},playerCar?:WorldCar){
   const car=u.car,s=u.shooter,info=this.gunCache!.info;
   const p=car.car.body.translation(),q=car.car.body.rotation();
   const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));
   const right={x:Math.cos(heading),z:-Math.sin(heading)},side=s.side==='right'?1:-1;
   const muzzle=new Vector3(p.x+right.x*side*1.0,p.y+0.75,p.z+right.z*side*1.0);
   const aim={x:target.x,y:target.y+1,z:target.z};
   const toAim=new Vector3(aim.x-muzzle.x,aim.y-muzzle.y,aim.z-muzzle.z),dist=toAim.length();
   const targetBody=playerCar?playerCar.car.body:undefined;
   let engaged=dist<info.weaponRange&&this.sim.player.health>0;
   if(engaged){
    const dir=toAim.clone().normalize();
    const probe=this.sim.world.castRay(new RAPIER.Ray(muzzle,dir),dist+.5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,car.car.body);
    engaged=!!probe&&(probe.collider.handle===this.sim.playerCollider.handle||!!targetBody&&probe.collider.parent()?.handle===targetBody.handle);
   }
   if(engaged&&!s.gunState.active&&!s.gunState.reload)s.aimPoint={...aim};
   const oldTime=s.gunState.time;
   const fire=stepNpcGun(s.gunState,info,this.gunCache!.reloadSeconds,dt,engaged);
   if(fire){
    const aimed=npcInaccurateAim(s.aimPoint??aim,60,Math.random,muzzle,true),direction=new Vector3(aimed.x,aimed.y,aimed.z).sub(muzzle).normalize();
    const scattered=npcAimSpread(direction,info,60);
    direction.set(scattered.vector.x,scattered.vector.y,scattered.vector.z);
    const shot=this.sim.world.castRayAndGetNormal(new RAPIER.Ray(muzzle,direction),info.weaponRange,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,car.car.body);
    // FireInstantHit includes car tyres for every shooter, the gang car's own excepted.
    const reach=shot?.timeOfImpact??info.weaponRange,tyre=bulletTyreHit([...this.fleet.cars].filter(c=>c!==car),muzzle,direction,reach);
    const end=muzzle.clone().addScaledVector(direction,tyre?tyre.t:reach);s.shots++;
    this.onShot?.(muzzle,end,info.type,!!shot||!!tyre);
    if(tyre)tyre.car.burstTyre(tyre.wheel,true,'ped');
    else if(shot?.collider.handle===this.sim.playerCollider.handle)this.sim.damagePlayer(info.damage,false,{weapon:info.type,from:{x:muzzle.x,z:muzzle.z}});
    else if(shot&&targetBody&&shot.collider.parent()?.handle===targetBody.handle){pushShotVehicle(playerCar!,shot.normal,end,info.type);playerCar!.damage(info.damage,undefined,false,undefined,{weapon:info.type,by:{ped:s}});}
   }
   if(s.gunState.active&&s.gunState.time<oldTime)s.aimPoint={...aim};
  }
  beforeStep(dt:number,playerCar?:WorldCar){
   this.seconds+=dt;
   const player=this.sim.player.position,target=playerCar?playerCar.car.body.translation():player,targetVelocity=playerCar?playerCar.car.body.linvel():{x:0,y:0,z:0};
   for(let i=this.units.length-1;i>=0;i--){
    const u=this.units[i],car=u.car;u.seconds+=dt;
    car.activeRadius=250;
    if(car.occupied||car.wrecked||u.seconds>DRIVEBY_LIFETIME+10||!this.fleet.cars.has(car)){this.units.splice(i,1);if(!car.occupied)this.fleet.removeTrafficCar(car);continue;}
    const p=car.car.body.translation(),q=car.car.body.rotation(),v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z),distance=Math.hypot(target.x-p.x,target.z-p.z);
    const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y));
    // CTaskComplexDieInCar: the shot driver coasts 2000 ms, then leaves dead if the car is still, else dies in his seat;
    // a car with a dead driver brakes to a halt and stays.
    if(u.driverDying){
     if(u.seconds>=u.driverDying.at+DIE_IN_CAR_OFFSET_MS/1000){
      u.driverDying=undefined;u.driverDead=true;car.driverDead=true;
      const w=car.car.body.angvel(),r=car.car.body.rotation(),upZ=1-2*(r.x*r.x+r.z*r.z);
      if(canPedStepOutCar(upZ,{x:v.x/50,y:-v.z/50,z:v.y/50},{x:w.x/50,y:-w.z/50,z:w.y/50})){this.onCrewDiesOut?.(car,u.driver);car.driverOut=true;}
     }
     car.autopilot={steering:0,throttle:0,brake:0,handbrake:false};continue;
    }
    if(u.driverDead){car.autopilot={steering:0,throttle:0,brake:1,handbrake:speed<.3};continue;}
    if(u.mission==='approach'&&distance<=DRIVEBY_ATTACK_RANGE)u.mission='attack';
    else if(u.mission==='attack'&&(distance>55||u.seconds>DRIVEBY_LIFETIME)){u.mission='leave';u.leaveAt=u.seconds;}
    if(u.mission==='leave'){
     if(this.canSpawn(p,6)||u.seconds-u.leaveAt>8){this.units.splice(i,1);this.fleet.removeTrafficCar(car);continue;}
     car.autopilot={steering:0,throttle:.8,brake:0,handbrake:false};
     continue;
    }
    u.shooter.seconds+=dt;
    // Window side facing the mark for the pose and the muzzle.
    const toTarget={x:target.x-p.x,z:target.z-p.z};
    u.shooter.side=toTarget.x*Math.cos(heading)-toTarget.z*Math.sin(heading)>=0?'right':'left';
    let aim={x:target.x-p.x,z:target.z-p.z};
    if(u.mission==='attack')aim={x:target.x+targetVelocity.x*.4-p.x,z:target.z+targetVelocity.z*.4-p.z};
    // SteerAICarWithPhysicsHeadingForTarget at the mission's speed (12 m/s approaching, 8 m/s alongside), in CarAI units.
    const want=u.mission==='attack'?8:12,f=new Vector3(0,0,-1).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w)),fl=Math.hypot(f.x,f.z)||1;
    const pedals=steerHeadingForTarget({position:{x:p.x,y:-p.z},forward:{x:f.x/fl,y:-f.z/fl},moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50}},{x:p.x+aim.x,y:-(p.z+aim.z)},want*GAME_SPEED_TO_CARAI_SPEED/50);
    car.autopilot={steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
    if(!u.shooterDead)this.stepShooter(u,dt,{x:target.x,y:target.y,z:target.z},playerCar);
   }
  }
  snapshot(){return {ready:!!this.paths&&!!this.gangs.length&&!!this.gunCache,pending:this.busy,error:this.error??null,lastAttack:this.lastAttack,units:this.units.map(u=>({handle:u.car.car.body.handle,gang:u.gang,mission:u.mission,driverHealth:u.driverHealth,shooterHealth:u.shooterHealth,driverDying:!!u.driverDying,driverDead:!!u.driverDead,shooterDead:!!u.shooterDead,shooter:u.shooter.model,weapon:DRIVEBY_WEAPON,rounds:u.shooter.gunState.rounds,shots:u.shooter.shots,side:u.shooter.side,position:{...u.car.car.body.translation()},speed:Math.hypot(u.car.car.body.linvel().x,u.car.car.body.linvel().z)}))};}
  dispose(){this.disposed=true;for(const u of this.units)if(!u.car.occupied)this.fleet.removeTrafficCar(u.car);this.units.length=0;}
}
