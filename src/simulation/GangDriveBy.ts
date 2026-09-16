import {openStaticWorld} from '../assets/staticWorldArchive';
import {readIfp,type NativeAnimation} from '../assets/ifp';
import {worldPaths} from '../assets/worldPaths';
import {trafficLinks,trafficSteering} from './trafficRoute';
import {readPedGroups} from '../assets/pedGroups';
import {openWeaponAssets} from '../weapons/assets';
import {nativeWeaponInfo,nativeWeaponReloadMs,type NativeWeaponInfo} from '../weapons/weaponData';
import type {NpcGunState} from './npcGun';
import {GANG_RIVALS} from './nativePopulation';
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
  gunState:NpcGunState;side:'left'|'right';seconds:number;
}
interface AttackCar {car:WorldCar;gang:number;driver:string;shooter:Shooter;mission:'approach'|'attack'|'leave';seconds:number;leaveAt:number}
/** Rival turf drive-bys (CTaskSimpleGangDriveBy is not reversed): a gang car
 * cruises past the mark with a posed shooter in the passenger seat. */
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
  /** Cars this manager drives (excluded from the civilian driver poses). */
  covers(car:WorldCar){return this.units.some(u=>u.car===car);}
  /** Driver plus posed shooter per attack car for the occupant renderer. */
  poses():OccupantPose[]{
   const out:OccupantPose[]=[];
   for(const u of this.units){
    if(u.car.wrecked||u.car.occupied)continue;
    const seat=u.car.seat('left');
    if(seat)out.push({key:`driveby-driver:${u.car.car.body.handle}`,car:u.car,model:u.driver,local:seat,clip:'car_sit',seconds:0});
    const right=u.car.seat('right'),clipName=u.shooter.side==='left'?'gang_drivebylhs':'gang_drivebyrhs',clip=this.clips.get(clipName);
    if(right&&clip&&clip.duration>0)out.push({key:`driveby-shooter:${u.car.car.body.handle}`,car:u.car,model:u.shooter.model,local:right,clip:clipName,seconds:u.shooter.seconds%clip.duration,animation:clip,gun:u.shooter.gun});
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
   if(!turf||!GANG_RIVALS.has(turf.gang)||this.random()*255>=turf.strength)return;
   const members=this.gangs[turf.gang]??[];
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
     const modelId=this.fleet.trafficModel();
     const car=await this.fleet.spawnTrafficCar(modelId,{x,y:link.from.position[2],z},Math.atan2(-link.dx,-link.dz),()=>!this.disposed&&this.canSpawn({x,y:link.from.position[2]+1,z},6)).catch(()=>undefined);
     if(!car)continue;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
     const driver=members[Math.floor(this.random()*members.length)];
     let shooter=members[Math.floor(this.random()*members.length)];
     if(shooter===driver)shooter=members[(members.indexOf(driver)+1)%members.length];
     car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.activeRadius=250;
     this.units.push({car,gang:turf.gang,driver,shooter:{model:shooter,gun:this.gunCache!.asset,gunState:{time:0,rounds:this.gunCache!.info.clip,reload:0,active:false},side:'right',seconds:0},mission:'approach',seconds:0,leaveAt:Infinity});
     this.lastAttack=now;
     break;
    }
   }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
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
    if(u.mission==='approach'&&distance<=DRIVEBY_ATTACK_RANGE)u.mission='attack';
    else if(u.mission==='attack'&&(distance>55||u.seconds>DRIVEBY_LIFETIME)){u.mission='leave';u.leaveAt=u.seconds;}
    if(u.mission==='leave'){
     if(this.canSpawn(p,6)||u.seconds-u.leaveAt>8){this.units.splice(i,1);this.fleet.removeTrafficCar(car);continue;}
     car.autopilot={steering:0,throttle:.8,brake:0,handbrake:false};
     continue;
    }
    u.shooter.seconds+=dt;
    // Window side facing the mark for the pose (muzzle rays in the next pass).
    const toTarget={x:target.x-p.x,z:target.z-p.z};
    u.shooter.side=toTarget.x*Math.cos(heading)-toTarget.z*Math.sin(heading)>=0?'right':'left';
    let aim={x:target.x-p.x,z:target.z-p.z};
    if(u.mission==='attack')aim={x:target.x+targetVelocity.x*.4-p.x,z:target.z+targetVelocity.z*.4-p.z};
    const control=trafficSteering(heading,aim),want=u.mission==='attack'?8:12;
    car.autopilot={steering:control.steering,throttle:speed<want?.8:0,brake:speed>want+2?1:0,handbrake:false};
   }
  }
  snapshot(){return {ready:!!this.paths&&!!this.gangs.length&&!!this.gunCache,pending:this.busy,error:this.error??null,lastAttack:this.lastAttack,units:this.units.map(u=>({gang:u.gang,mission:u.mission,shooter:u.shooter.model,weapon:DRIVEBY_WEAPON,rounds:u.shooter.gunState.rounds,side:u.shooter.side,position:{...u.car.car.body.translation()},speed:Math.hypot(u.car.car.body.linvel().x,u.car.car.body.linvel().z)}))};}
  dispose(){this.disposed=true;for(const u of this.units)if(!u.car.occupied)this.fleet.removeTrafficCar(u.car);this.units.length=0;}
}
