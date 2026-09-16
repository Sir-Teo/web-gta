import RAPIER from '@dimforge/rapier3d-compat';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {worldPaths} from '../assets/worldPaths';
import {nativeShouldStopForLight} from '../world/nativeSignalStop';
import {trafficLinks,trafficSteering,type TrafficLink} from './trafficRoute';
import {currentShapeCast} from './currentShapeCast';
import type {Simulation} from './Simulation';
import type {WorldFleet} from './WorldFleet';
import type {WorldCar} from './WorldCar';
interface Driver {car:WorldCar;link:TrafficLink;stopped:string|null;distance:number;last:{x:number;z:number};gone?:boolean;stalledReason?:string|null;stalledAt?:number}
/** Traffic recovery (authored): terminal stops clear the car so a fresh one spawns
 * elsewhere. Lights and brief obstacle waits never recover; dead ends clear after
 * 8 s and long jams after 20 s. Returns 0 when the car should keep waiting. */
export function recoveryLimit(stopped:string|null){
 if(stopped==='obstacle')return 20;
 if(stopped==='end of route'||stopped==='off route'||stopped==='unloaded road')return 8;
 return 0;
}
/** Small, physics-driven ambient traffic population. No direct pose driving. */
export class WorldTraffic {
 private paths?:ReturnType<typeof worldPaths>;
 private drivers:Driver[]=[];
 private nextCheck=0;
 private busy=false;
 private disposed=false;
 private serial=0;
 private elapsed=0;
 private error?:string;
 constructor(private sim:Simulation,private fleet:WorldFleet,base:string){
  void openStaticWorld(base).then(source=>{if(!this.disposed)this.paths=worldPaths(source);}).catch(e=>{this.error=String(e);});
 }
 snapshot(){return {ready:!!this.paths,pending:this.busy,error:this.error??null,cars:this.drivers.map(d=>({modelId:d.car.modelId,position:{...d.car.car.body.translation()},speed:Math.hypot(d.car.car.body.linvel().x,d.car.car.body.linvel().z),laneError:Math.abs((d.car.car.body.translation().x-d.link.start.x)*d.link.dz-(d.car.car.body.translation().z-d.link.start.z)*d.link.dx),stopped:d.stopped,honk:{car:d.car.honkAtCar,ped:d.car.honkAtPed,counter:d.car.horn.counter},distance:d.distance,active:!!d.car.autopilot,from:d.link.from.address,to:d.link.to.address}))};}
 update(now:number){
  if(this.disposed||this.busy||!this.paths||now<this.nextCheck)return;this.nextCheck=now+2000;
  const player=this.sim.player.position;
  this.drivers=this.drivers.filter(d=>{if(d.car.occupied||Math.hypot(d.car.car.body.translation().x-player.x,d.car.car.body.translation().z-player.z)<120&&d.car.car.body.translation().y>player.y-25)return true;this.fleet.removeTrafficCar(d.car);return false;});
  const paths=this.paths;this.busy=true;
  void paths.loadAround(player.x,player.z).then(async()=>{
   if(this.disposed||this.drivers.length>=3||this.fleet.cars.size>=9)return;
   const p=this.sim.player.position;
   const candidates=[...paths.areas.values()].flatMap(a=>a.nodes).filter(n=>Math.hypot(n.position[0]-p.x,-n.position[1]-p.z)>25&&Math.hypot(n.position[0]-p.x,-n.position[1]-p.z)<75).flatMap(n=>trafficLinks(paths.areas,n));
   for(let i=0;i<candidates.length;i++){
    const link=candidates[(i+this.serial*17)%candidates.length],{x,z}=link.start;
    if([...this.fleet.cars].some(c=>Math.hypot(c.car.body.translation().x-x,c.car.body.translation().z-z)<12))continue;
    const top=link.from.position[2]+3,hit=this.sim.world.castRayAndGetNormal(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),6,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
    if(!hit||hit.normal.y<.8)continue;
    const foot=top-hit.timeOfImpact,rotation={x:0,y:Math.sin(Math.atan2(-link.dx,-link.dz)/2),z:0,w:Math.cos(Math.atan2(-link.dx,-link.dz)/2)};
    if(this.sim.world.intersectionWithShape({x,y:foot+1,z},rotation,new RAPIER.Cuboid(1,.8,2.5)))continue;
    const car=await this.fleet.spawnTrafficCar(this.fleet.trafficModel(),{x,y:foot,z},Math.atan2(-link.dx,-link.dz));
    if(!car)continue;
    if(this.disposed||Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>100){this.fleet.removeTrafficCar(car);return;}
    this.error=undefined;car.autopilot={throttle:0,brake:0,steering:0,handbrake:true};
    this.drivers.push({car,link,stopped:null,distance:0,last:{x,z}});this.serial++;break;
   }
  }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
 }
 beforeStep(dt:number){
  this.elapsed+=dt;
  for(const driver of this.drivers){
   const car=driver.car;car.honkAtCar=car.honkAtPed=false;if(car.occupied||!car.autopilot)continue;
   if(car.holdForEntry){const v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z);car.autopilot={steering:0,throttle:0,brake:1,handbrake:speed<.3};continue;}
   const body=car.car.body,p=body.translation(),q=body.rotation(),v=body.linvel(),speed=Math.hypot(v.x,v.z);
   driver.distance+=Math.hypot(p.x-driver.last.x,p.z-driver.last.z);driver.last={x:p.x,z:p.z};
   let link=driver.link,along=(p.x-link.start.x)*link.dx+(p.z-link.start.z)*link.dz;
   if(along>link.length-3){
    const next=this.paths&&trafficLinks(this.paths.areas,link.to).filter(n=>(n.to.address.area!==link.from.address.area||n.to.address.node!==link.from.address.node)&&n.dx*link.dx+n.dz*link.dz>-.35).sort((a,b)=>(b.dx*link.dx+b.dz*link.dz)-(a.dx*link.dx+a.dz*link.dz))[0];
    if(next){driver.link=link=next;along=(p.x-link.start.x)*link.dx+(p.z-link.start.z)*link.dz;}
   }
   const look=Math.min(link.length,Math.max(0,along)+6),target={x:link.start.x+link.dx*look-p.x,z:link.start.z+link.dz*look-p.z};
   const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y)),control=trafficSteering(heading,target);
   const forward={x:-Math.sin(heading),y:0,z:-Math.cos(heading)};
   const gap=3+speed*.7+speed*speed/7;
   const blocker:{body?:RAPIER.RigidBody}={},obstacle=currentShapeCast(this.sim.world,{x:p.x+forward.x*2.4,y:p.y+.2,z:p.z+forward.z*2.4},q,forward,new RAPIER.Ball(.65),.1,gap,body,undefined,blocker);
   const atSignal=nativeShouldStopForLight({position:[p.x,-p.z],appearance:'car',physicsStatus:true,current:{navigation:link.navigation,routeAddress:link.to.address,travelSign:link.dx*link.navigation.direction[0]-link.dz*link.navigation.direction[1]>=0?1:-1}},Math.floor(this.elapsed*1000)>>>0);
   const road=this.sim.world.castRay(new RAPIER.Ray({x:p.x+forward.x*(4+speed),y:p.y+3,z:p.z+forward.z*(4+speed)},{x:0,y:-1,z:0}),7,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   // CCarCtrl slowing for another car (dynamic body) or a pedestrian or the player (kinematic body) raises the honk flags; walls do not.
   car.honkAtCar=obstacle!==undefined&&!!blocker.body?.isDynamic();car.honkAtPed=obstacle!==undefined&&!!blocker.body?.isKinematic();car.stoppedForLight=atSignal;
    driver.stopped=!road?'unloaded road':obstacle!==undefined?'obstacle':atSignal?'traffic light':along>=link.length-1?'end of route':Math.abs(p.x-link.start.x-link.dx*along)+Math.abs(p.z-link.start.z-link.dz*along)>10?'off route':null;
    const limit=recoveryLimit(driver.stopped);
    if(limit>0){
     if(driver.stalledReason!==driver.stopped){driver.stalledReason=driver.stopped;driver.stalledAt=this.elapsed;}
     if(this.elapsed-(driver.stalledAt??this.elapsed)>limit){this.fleet.removeTrafficCar(car);driver.gone=true;continue;}
    }else driver.stalledReason=undefined;
    const targetSpeed=driver.stopped?0:Math.abs(control.error)>.7?2.5:5.5;
    car.autopilot={steering:control.steering,throttle:speed<targetSpeed-.3?.45:0,brake:speed>targetSpeed+.3?1:0,handbrake:targetSpeed===0&&speed<.3};
   }
   if(this.drivers.some(d=>d.gone))this.drivers=this.drivers.filter(d=>!d.gone);
 }
 dispose(){this.disposed=true;for(const d of this.drivers)this.fleet.removeTrafficCar(d.car);this.drivers=[];}
}
