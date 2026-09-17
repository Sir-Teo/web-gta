import RAPIER from '@dimforge/rapier3d-compat';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {worldPaths} from '../assets/worldPaths';
import {worldLevelAt,type WorldZones} from '../assets/worldZones';
import {VEHICLE_ANIM,VEHICLE_ANIM_SPECIAL,nativeDoorAnimRatio} from '../assets/vehicleAnimGroups';
import type {VehicleAnimationLibrary} from '../assets/vehicleAnimations';
import type {NativeAnimation} from '../assets/ifp';
import {angleDelta} from '../core/math';
import {clipRootEnd,nativeDoorPoint} from './CarEntry';
import {DOOR} from './nativeDoor';
import {findTrafficRoute,trafficLinks,trafficSteering,type TrafficLink} from './trafficRoute';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';
import type {WorldPlane} from './WorldPlane';
import {POLICE_HELI_MODEL,helisRequired,heliHeading,heliOrbitPoint,policeHeliInputs,rappelWindow,searchlightTarget} from './policeHeli';
import type {WorldFleet} from './WorldFleet';
import type {WantedSystem} from './WantedSystem';
type V3={x:number;y:number;z:number};
/** CStreaming::ms_aDefaultCopCarModel by m_CurrLevel: countryside, Los Santos, San Fierro, Las Venturas. */
export const DEFAULT_COP_CAR=[599,596,597,598] as const;
/** CStreaming::ms_aDefaultCopModel by level (csher, lapd1, sfpd1, lvpd1). */
export const DEFAULT_COP_MODEL=['csher','lapd1','sfpd1','lvpd1'] as const;
/** CCarCtrl::ChoosePoliceCarModel: Enforcer 1 in 3 at four stars, FBI Rancher at five, Rhino or Barracks at six. */
export function choosePoliceCarModel(level:number,wanted:number,random:()=>number){
 if(wanted===4){if(Math.floor(random()*3)===2)return 427;}
 else{if(wanted===5)return 490;if(wanted===6)return random()<.5?432:433;}
 return DEFAULT_COP_CAR[Math.max(0,Math.min(3,level))];
}
/** CPopulation::AddPedInCar crews and CCopPed loadouts (weapon, model, shooting
 * accuracy) per law vehicle: street 60, SWAT 68, FBI 76, army 84. */
export function policeCrew(modelId:number,level:number,wanted:number,random:()=>number){
 const city={model:DEFAULT_COP_MODEL[Math.max(0,Math.min(3,level))],weapon:22,accuracy:60};
 switch(modelId){
  case 427:return {seats:4,member:{model:'swat',weapon:28,accuracy:68}};
  case 490:return {seats:4,member:{model:'fbi',weapon:29,accuracy:76}};
  case 432:return {seats:1,member:{model:'army',weapon:31,accuracy:84}};
  case 433:return {seats:wanted>=2?2:1,member:{model:'army',weapon:31,accuracy:84}};
  default:return {seats:wanted>=2||random()<.5?2:1,member:city};
 }
}
/** CCarAI::FindPoliceCarSpeedForWantedLevel in car AI speed units (60 × units per frame). */
export function policeCruiseSpeed(wanted:number,maxFlatVelocity:number,random:()=>number){
 switch(wanted){case 0:return 12+Math.floor(random()*4);case 1:return 25;case 2:return 34;case 3:return Math.trunc(maxFlatVelocity*60*.9);case 4:return Math.trunc(maxFlatVelocity*60*1.2);case 5:return Math.trunc(maxFlatVelocity*60*1.25);default:return Math.trunc(maxFlatVelocity*60*1.3);}
}
/** CRoadBlocks::GenerateRoadBlocks candidate choice (authored placement): the longest link
 * ahead of the player's car (40–100 units along its velocity, within 12 units of its line),
 * with the across-road heading for the blocking car. */
export function chooseRoadblock(links:TrafficLink[],player:{x:number;z:number},velocity:{x:number;z:number}){
 const speed=Math.hypot(velocity.x,velocity.z);if(speed<5||!Number.isFinite(speed))return undefined;
 const vx=velocity.x/speed,vz=velocity.z/speed;let best:{link:TrafficLink;heading:number}|undefined;
 for(const link of links){
  if(link.length<15)continue;
  const mx=link.start.x+link.dx*link.length/2,my=link.start.z+link.dz*link.length/2;
  const along=(mx-player.x)*vx+(my-player.z)*vz;if(along<40||along>100)continue;
  const lateral=Math.abs((mx-player.x)*vz-(my-player.z)*vx);if(lateral>12)continue;
  if(best&&link.length<=best.link.length)continue;
  best={link,heading:Math.atan2(-link.dz,link.dx)};
 }
 return best;
}
/** Bust pull from a stopped suspect car (CTaskSimpleCarSetPedOut drag-out):
 * an officer beside the car holds the door for BUST_PULL_SECONDS. */
export const BUST_PULL_RANGE = 3.5;
export const BUST_PULL_SECONDS = 1.5;
/** Accumulate door-hold progress; any gap resets the drag-out. */
export function bustPullProgress(progress:number,dt:number,ready:boolean){return ready?progress+dt:0;}
/** Paired roadblock placement (CreateRoadBlockBetween2Points): the second car
 * stands one lane over so the pair spans the road. */
export const ROADBLOCK_PAIR_OFFSET = 7;
export function roadblockPairSpot(mx:number,mz:number,link:{dx:number;dz:number},offset=ROADBLOCK_PAIR_OFFSET){
 const length=Math.hypot(link.dx,link.dz)||1;
 return {x:mx-link.dz/length*offset,z:mz+link.dx/length*offset};
}
/** CCarAI::MellowOutChaseSpeed for one and two stars. */
export function mellowChaseSpeed(wanted:number,distance:number,playerInCar:boolean,playerSpeed:number,cruise:number){
 let speed=cruise;
 if(wanted===1)speed=playerInCar?distance<10?15:distance<20?22:25:distance<20?5:distance<40?13:25;
 else if(wanted===2)speed=playerInCar?distance<10?27:distance<20?30:34:distance<20?5:distance<40?18:34;
 return !playerInCar&&speed>=10&&distance<=30&&playerSpeed<.07?10:speed;
}
/** Car AI speed units to metres per second (1 unit = 1/60 unit per frame at 50 Hz). */
const aiToMetres=(speed:number)=>speed/60*50;
interface Leaving {seat:number;clip:NativeAnimation;key:string;time:number;door:number}
/** CTaskComplexEnterCarAsDriver's simple tasks for a returning cop: align, open the door, get in, close it from inside. */
interface Entering {seat:number;door:number;phase:'align'|'open'|'getIn'|'closeInside';clip:NativeAnimation;key:string;group:number;time:number}
/** CTaskComplexGoToCarDoorAndStandStill for a cop heading back to a seat (radius 0.5, walk within 4, 50 units, 30 s). */
interface Returning {seat:number;time:number;best:number;stall:number}
/** A cop on foot who left one of this unit's seats (CPed::m_pVehicle). */
export interface FootCrew {id:number;seat:number;position:V3;down:boolean}
/** CTaskComplexCopInCar::ControlSubTask (0x68FD50) and CreateNextSubTask (0x68FA50) for a cop on foot beside the car it arrived in:
 * while the suspect drives another vehicle the cop gets back in when within 4 units of the car, unless that vehicle is crawling
 * (|m_vecMoveSpeed|² × TimeStep × 50 ≤ 1 at 30 fps) within 10 units of the cop. The car must be intact, not burning and not on its
 * side. CTaskComplexPolicePursuit sends cops back to their vehicles once the wanted level is clear (within the go-to-door task's 50 units). */
export function copReturnsToCar(o:{wanted:number;copToCar:number;carUsable:boolean;suspectCar?:{speed:number;distanceToCop:number}}){
 if(!o.carUsable)return false;
 if(!o.wanted)return o.copToCar<50;
 if(!o.suspectCar)return false;
 const crawling=(o.suspectCar.speed/50)**2*(50/30)*50<=1&&o.suspectCar.distanceToCop<=10;
 return !crawling&&o.copToCar<4;
}
interface Unit {
 car:WorldCar;wanted:number;member:{model:string;weapon:number;accuracy:number};seats:boolean[];
 mission:'far'|'close'|'stopped'|'cruise'|'roadblock';siren:boolean;cruise:number;
 slowTimer:number;pullTimer:number;driverExitAt?:number;leaving:Leaving[];entering:Entering[];returning:Map<number,Returning>;
 stuck:number;recovery?:{kind:number;remaining:number};recoveryMode:number;lastRecovery:number;
 aim?:{x:number;z:number};link?:TrafficLink;route:TrafficLink[];routeAt:number;routeGoal?:{x:number;y:number;z:number};seconds:number;
}
export interface PolicePose {car:WorldCar;model:string;local:V3;clip:string;seconds:number;animation?:NativeAnimation}
/** Law vehicles in pursuit: CCarAI police missions, speeds and switch distances, crew exits and recovery. Spawning comes from the
 * unreversed CCarCtrl::GenerateOneRandomCar. The browser uses car path nodes 60–110 units away,
 * with a strict visibility guard checked again after asset loading. */
export class WorldPolice {
  readonly units:Unit[]=[];
  /** Law-enforcement air units (CHeli pursuit with searchlight; SWAT rappel). */
  readonly helis:WorldPlane[]=[];
  /** Helicopter searchlight state per airframe (locked/illuminated). */
  readonly searchlights=new Map<object,{locked:boolean;illuminated:boolean;distance:number}>();
  private paths?:ReturnType<typeof worldPaths>;private busy=false;private nextCheck=0;private disposed=false;private seconds=0;
  private heliBusy=false;
  private lastRappel=-Infinity;
  private roadblockBusy=false;private lastRoadblock=-Infinity;
 zones?:WorldZones;
 camera:()=>{position:V3;forward:V3}=()=>({position:this.sim.player.position,forward:{x:0,y:0,z:-1}});
 canSpawn:(point:V3,radius:number)=>boolean=()=>true;
 spawnOfficer?:(model:string,weapon:number,position:V3,heading:number,crew?:{unit:object;seat:number},accuracy?:number)=>void;
 /** The street population's cops on foot: list a unit's crew, send one toward a door point (undefined resumes the pursuit), or take one into the car. */
 crew?:{list:(unit:object)=>FootCrew[];goTo:(id:number,point?:{x:number;z:number},walk?:boolean)=>void;board:(id:number)=>boolean};
 /** A stopped unit's crew holds the suspect's door: the host drags the player out so the foot arrest can proceed. */
 onPullFromCar?:(car:WorldCar)=>void;
 error?:string;
 constructor(private sim:Simulation,private fleet:WorldFleet,private law:WantedSystem,private clips:VehicleAnimationLibrary,base:string,private random:()=>number=Math.random){
  void openStaticWorld(base).then(source=>{if(!this.disposed)this.paths=worldPaths(source);}).catch(e=>{this.error=String(e);});
 }
 private level(){const p=this.sim.player.position;return this.zones?worldLevelAt(this.zones,[p.x,-p.z,p.y]):1;}
 /** CWanted::WorkOutPolicePresence contribution: law vehicles that still have a driver or crew. */
 presence(point:V3,radius:number){return this.units.filter(u=>{if(u.car.wrecked||u.car.occupied||!u.seats.some(Boolean))return false;const p=u.car.car.body.translation();return Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z)<radius;}).length+this.helis.filter(h=>{if(h.health<=0||h.occupied)return false;const p=h.body.translation();return Math.hypot(p.x-point.x,p.z-point.z)<Math.max(radius,45);}).length;}
 /** Airborne observers keep the pursuit alive (CWanted::NumOfHelisRequired). */
 get heliActive(){return this.helis.some(h=>h.health>0&&!h.occupied);}
 /** Cops still inside their cars, which count against CWanted::m_MaxCopsInPursuit. */
 get seatedCrew(){return this.units.reduce((n,u)=>n+u.seats.filter(Boolean).length,0);}
 update(now:number){
  if(this.disposed||this.busy||!this.paths||now<this.nextCheck)return;this.nextCheck=now+1000;
  const player=this.sim.player.position;
  for(let i=this.units.length-1;i>=0;i--){
   const u=this.units[i],p=u.car.car.body.translation(),far=Math.hypot(p.x-player.x,p.z-player.z);
   if(u.car.occupied){this.units.splice(i,1);continue;}
   if(far>(this.law.level?220:120)&&this.canSpawn(p,6)||!this.fleet.cars.has(u.car)){this.units.splice(i,1);this.fleet.removeTrafficCar(u.car);}
  }
  const wanted=this.law.level,active=this.units.filter(u=>!u.car.wrecked&&u.seats[0]&&u.mission!=='cruise').length;
  if(!wanted||active>=this.law.native.maxCopCarsInPursuit||this.fleet.cars.size>=12)return;
  const paths=this.paths;this.busy=true;
  void paths.loadAround(player.x,player.z).then(async()=>{
   if(this.disposed)return;
   const camera=this.camera(),p=this.sim.player.position;
   const links=[...paths.areas.values()].flatMap(a=>a.nodes).filter(n=>{const d=Math.hypot(n.position[0]-p.x,-n.position[1]-p.z);return d>60&&d<110;}).flatMap(n=>trafficLinks(paths.areas,n));
   const scored=links.map(link=>{const dx=link.start.x-camera.position.x,dz=link.start.z-camera.position.z,l=Math.hypot(dx,dz)||1,ahead=(dx*camera.forward.x+dz*camera.forward.z)/l,toward=((p.x-link.start.x)*link.dx+(p.z-link.start.z)*link.dz)/Math.max(1,Math.hypot(p.x-link.start.x,p.z-link.start.z));return {link,score:(ahead>.3?1:0)-toward*.5+this.random()*.2};}).sort((a,b)=>a.score-b.score);
   for(const {link} of scored.filter(({link})=>this.canSpawn({x:link.start.x,y:link.from.position[2]+1,z:link.start.z},6)).slice(0,12)){
    const {x,z}=link.start;if([...this.fleet.cars].some(c=>Math.hypot(c.car.body.translation().x-x,c.car.body.translation().z-z)<12))continue;
    const level=this.level();let modelId=choosePoliceCarModel(level,this.law.level,this.random);
    let car=await this.fleet.spawnTrafficCar(modelId,{x,y:link.from.position[2],z},Math.atan2(-link.dx,-link.dz),()=>!this.disposed&&this.law.level>0&&Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>45&&this.canSpawn({x,y:link.from.position[2]+1,z},6)).catch(()=>undefined);
    if(!car&&modelId!==DEFAULT_COP_CAR[level]){modelId=DEFAULT_COP_CAR[level];car=await this.fleet.spawnTrafficCar(modelId,{x,y:link.from.position[2],z},Math.atan2(-link.dx,-link.dz),()=>!this.disposed&&this.law.level>0&&Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>45&&this.canSpawn({x,y:link.from.position[2]+1,z},6)).catch(()=>undefined);}
    if(!car)continue;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
    const crew=policeCrew(modelId,level,this.law.level,this.random);
    car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};void this.clips.load(car.animGroup).catch(()=>{});
    this.units.push({car,wanted:this.law.level,member:crew.member,seats:Array.from({length:4},(_,i)=>i<crew.seats),mission:'far',siren:false,cruise:policeCruiseSpeed(this.law.level,car.assets.handling.maxFlatVelocity,this.random),slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,link,route:[],routeAt:-Infinity,seconds:0});car.activeRadius=250;
    break;
   }
   }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
   this.roadblock(now);
  }
  /** CRoadBlocks::GenerateRoadBlocks (authored placement): at three or more stars, one unit
   * parks across the road ahead of the driven car and its crew exits to hold the block.
   * The block dissolves when the wanted level drops below three or the player leaves. */
  roadblock(now:number){
   if(this.disposed||this.roadblockBusy||!this.paths||this.units.some(u=>u.mission==='roadblock'))return;
   if(this.law.level<3||now-this.lastRoadblock<15000)return;
   const driven=this.fleet.occupied;if(!driven||driven.wrecked)return;
   const lv=driven.car.body.linvel(),player=this.sim.player.position;
   if(Math.hypot(lv.x,lv.z)<5)return;
   const paths=this.paths;this.roadblockBusy=true;
   void paths.loadAround(player.x,player.z).then(async()=>{
    if(this.disposed||this.units.some(u=>u.mission==='roadblock'))return;
    const p=this.sim.player.position,dv=driven.car.body.linvel(),links=[...paths.areas.values()].flatMap(a=>a.nodes).flatMap(n=>trafficLinks(paths.areas,n));
    const choice=chooseRoadblock(links,{x:p.x,z:p.z},{x:dv.x,z:dv.z});
    if(!choice)return;
    const {link,heading}=choice,mx=link.start.x+link.dx*link.length/2,mz=link.start.z+link.dz*link.length/2;
    if(!this.canSpawn({x:mx,y:link.from.position[2]+1,z:mz},6))return;
    if([...this.fleet.cars].some(c=>Math.hypot(c.car.body.translation().x-mx,c.car.body.translation().z-mz)<12))return;
    const level=this.level();let modelId=choosePoliceCarModel(level,this.law.level,this.random);
    let car=await this.fleet.spawnTrafficCar(modelId,{x:mx,y:link.from.position[2],z:mz},heading,()=>!this.disposed&&this.law.level>=3&&this.canSpawn({x:mx,y:link.from.position[2]+1,z:mz},6)).catch(()=>undefined);
    if(!car&&modelId!==DEFAULT_COP_CAR[level]){modelId=DEFAULT_COP_CAR[level];car=await this.fleet.spawnTrafficCar(modelId,{x:mx,y:link.from.position[2],z:mz},heading,()=>!this.disposed&&this.law.level>=3&&this.canSpawn({x:mx,y:link.from.position[2]+1,z:mz},6)).catch(()=>undefined);}
    if(!car||this.disposed){if(car)this.fleet.removeTrafficCar(car);return;}
    const crew=policeCrew(modelId,level,this.law.level,this.random);
    car.autopilot={throttle:0,brake:1,steering:0,handbrake:true};void this.clips.load(car.animGroup).catch(()=>{});
    const unit:Unit={car,wanted:this.law.level,member:crew.member,seats:Array.from({length:4},(_,i)=>i<crew.seats),mission:'roadblock',siren:true,cruise:0,slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,link,route:[],routeAt:-Infinity,seconds:0};
    this.units.push(unit);car.activeRadius=250;this.lastRoadblock=now;
    for(let seat=0;seat<4;seat++)this.beginExit(unit,seat);
    // Native pairs span the road: a second unit holds the next lane over with
    // a two-officer crew when the fleet has room.
    if(this.fleet.cars.size<11){
     const spot=roadblockPairSpot(mx,mz,link);
     const clear=[...this.fleet.cars].every(c=>Math.hypot(c.car.body.translation().x-spot.x,c.car.body.translation().z-spot.z)>=12);
     if(clear&&this.canSpawn({x:spot.x,y:link.from.position[2]+1,z:spot.z},6)){
      const pair=await this.fleet.spawnTrafficCar(modelId,{x:spot.x,y:link.from.position[2],z:spot.z},heading,()=>!this.disposed&&this.law.level>=3&&this.canSpawn({x:spot.x,y:link.from.position[2]+1,z:spot.z},6)).catch(()=>undefined);
      if(pair&&!this.disposed){
       pair.autopilot={throttle:0,brake:1,steering:0,handbrake:true};void this.clips.load(pair.animGroup).catch(()=>{});
       const pairCrew=policeCrew(modelId,level,this.law.level,this.random);
       const pairUnit:Unit={car:pair,wanted:this.law.level,member:pairCrew.member,seats:Array.from({length:4},(_,i)=>i<Math.min(2,pairCrew.seats)),mission:'roadblock',siren:true,cruise:0,slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,link,route:[],routeAt:-Infinity,seconds:0};
       this.units.push(pairUnit);pair.activeRadius=250;
       for(let seat=0;seat<2;seat++)this.beginExit(pairUnit,seat);
      }else if(pair)this.fleet.removeTrafficCar(pair);
     }
    }
   }).catch(e=>{this.error=String(e);}).finally(()=>{this.roadblockBusy=false;});
  }
 private exitSlot(seat:number){return [VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS,VEHICLE_ANIM.getoutRearLHS,VEHICLE_ANIM.getoutRearRHS][seat];}
 /** Native car-space door point for a seat's exit door (front seats use ped_frontseat, rear seats ped_backseat). */
 private doorPoint(car:WorldCar,seat:number){
  const getIn=this.clips.slot(car.animGroup,VEHICLE_ANIM.getinLHS),frame=car.car.nativeFramePosition(seat<2?'ped_frontseat':'ped_backseat');if(!getIn||!frame)return undefined;
  return nativeDoorPoint({x:frame.x,y:frame.y,z:frame.z},clipRootEnd(getIn.clip),car.assets.handling.values.seatOffset,seat%2===0?'left':'right',1);
 }
 private beginExit(u:Unit,seat:number){
  if(!u.seats[seat]||u.leaving.some(l=>l.seat===seat))return;
  const found=this.clips.slot(u.car.animGroup,this.exitSlot(seat));
  if(!found){this.finishExit(u,seat);return;}
  u.leaving.push({seat,clip:found.clip,key:found.key,time:0,door:[DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear][seat]});
 }
 private finishExit(u:Unit,seat:number){
  u.seats[seat]=false;const local=this.doorPoint(u.car,seat);
  const world=local?u.car.worldPoint(local):new RAPIER.Vector3(u.car.car.body.translation().x,u.car.car.body.translation().y,u.car.car.body.translation().z);
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:world.x,y:world.y+1,z:world.z},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,u.car.car.body);
  this.spawnOfficer?.(u.member.model,u.member.weapon,{x:world.x,y:(hit?world.y+1-hit.timeOfImpact:world.y-1)+.03,z:world.z},u.car.heading(),{unit:u,seat},u.member.accuracy);
 }
 private entrySlot(seat:number,phase:Entering['phase']){
  const left=seat%2===0,rear=seat>=2;
  switch(phase){
   case 'align':return left?VEHICLE_ANIM.alignLHS:VEHICLE_ANIM.alignRHS;
   case 'open':return rear?left?VEHICLE_ANIM.openRearLHS:VEHICLE_ANIM.openRearRHS:left?VEHICLE_ANIM.openLHS:VEHICLE_ANIM.openRHS;
   case 'getIn':return rear?left?VEHICLE_ANIM.getinRearLHS:VEHICLE_ANIM.getinRearRHS:left?VEHICLE_ANIM.getinLHS:VEHICLE_ANIM.getinRHS;
   case 'closeInside':return rear?left?VEHICLE_ANIM.closedoorRearLHS:VEHICLE_ANIM.closedoorRearRHS:left?VEHICLE_ANIM.closedoorLHS:VEHICLE_ANIM.closedoorRHS;
  }
 }
 /** Start the phase's clip, or skip to what follows when this car's anim group has none. */
 private enterPhase(u:Unit,seat:number,phase:Entering['phase']){
  const found=this.clips.slot(u.car.animGroup,this.entrySlot(seat,phase)),i=u.entering.findIndex(e=>e.seat===seat);if(i>=0)u.entering.splice(i,1);
  if(found){u.entering.push({seat,door:[DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear][seat],phase,clip:found.clip,key:found.key,group:found.group,time:0});return;}
  this.afterEntryPhase(u,seat,phase);
 }
 /** The CarEntry sequence for NPC cops: open unless the door is open or missing, close it from inside unless it is closed or missing. */
 private afterEntryPhase(u:Unit,seat:number,phase:Entering['phase']){
  const car=u.car,door=[DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear][seat];
  if(phase==='align'){
   if(!car.doorMissing(door)&&!car.doorFullyOpen(door)){
    if(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noOpenDoor){car.setDoorOpen(door);car.openDoor(door,1);}
    else if(this.clips.slot(car.animGroup,this.entrySlot(seat,'open'))){this.enterPhase(u,seat,'open');return;}
    else car.openDoor(door,1);
   }
   this.enterPhase(u,seat,'getIn');return;
  }
  if(phase==='open'){this.enterPhase(u,seat,'getIn');return;}
  if(phase==='getIn'&&!car.doorMissing(door)&&!car.doors[door].closed){
   if(car.animGroup.special&VEHICLE_ANIM_SPECIAL.noCloseAfterIn)car.openDoor(door,0);
   else if(this.clips.slot(car.animGroup,this.entrySlot(seat,'closeInside'))){this.enterPhase(u,seat,'closeInside');return;}
   else car.openDoor(door,0);
  }
  // CTaskSimpleCarSetPedInAsDriver: the driver takes CTaskComplexCarDriveMission (FindPoliceCarMissionForWantedLevel) at once.
  u.seats[seat]=true;
  if(seat===0){car.driverOut=false;u.mission=this.law.level?'far':'cruise';u.siren=false;u.slowTimer=0;u.driverExitAt=undefined;}
 }
 /** Cops on foot heading back to, or deciding to return to, the car they arrived in. */
 private recallCrew(u:Unit,dt:number,playerCar?:WorldCar){
  const crew=this.crew;if(!crew)return;
  const list=crew.list(u);for(const id of [...u.returning.keys()])if(!list.some(c=>c.id===id))u.returning.delete(id);
  if(!list.length)return;
  const car=u.car,p=car.car.body.translation(),q=car.car.body.rotation();
  // CVehicle::IsOnItsSide: the car's right vector within 0.8 of vertical.
  const usable=!car.wrecked&&car.health>0&&!car.onFire&&Math.abs(2*(q.x*q.y+q.w*q.z))<.8;
  const suspect=playerCar&&playerCar!==car?playerCar:undefined,sv=suspect?.car.body.linvel(),sp=suspect?.car.body.translation();
  const taken=(seat:number)=>u.seats[seat]||u.leaving.some(l=>l.seat===seat)||u.entering.some(e=>e.seat===seat)||[...u.returning.values()].some(r=>r.seat===seat);
  // Cops nearest the driver's door are considered first, so the one beside it takes the wheel.
  const driverDoor=this.doorPoint(car,0),driverWorld=driverDoor&&car.worldPoint(driverDoor);
  if(driverWorld)list.sort((a,b)=>Math.hypot(a.position.x-driverWorld.x,a.position.z-driverWorld.z)-Math.hypot(b.position.x-driverWorld.x,b.position.z-driverWorld.z));
  for(const c of list){
   const back=u.returning.get(c.id);
   if(back){
    const local=this.doorPoint(car,back.seat);back.time+=dt;
    const world=local&&car.worldPoint(local),distance=world?Math.hypot(world.x-c.position.x,world.z-c.position.z):Infinity;
    if(!world||!usable||c.down||back.time>30||distance>50){u.returning.delete(c.id);crew.goTo(c.id);continue;}
    if(distance<back.best-.05){back.best=distance;back.stall=0;}else back.stall+=dt;
    if((distance<=.5||back.stall>1.2&&distance<1.2)&&crew.board(c.id)){u.returning.delete(c.id);this.enterPhase(u,back.seat,'align');continue;}
    crew.goTo(c.id,{x:world.x,z:world.z},distance<4);continue;
   }
   if(c.down)continue;
   const decision=copReturnsToCar({wanted:this.law.level,carUsable:usable,copToCar:Math.hypot(p.x-c.position.x,p.y-c.position.y,p.z-c.position.z),
    suspectCar:sv&&sp?{speed:Math.hypot(sv.x,sv.y,sv.z),distanceToCop:Math.hypot(sp.x-c.position.x,sp.y-c.position.y,sp.z-c.position.z)}:undefined});
   // ENTER_CAR_AS_DRIVER. Who takes the wheel when both cops return is not in the reversed tasks: the other cop takes its own seat,
   // or another passenger seat with a door, instead of jacking the driver.
   const passenger=[c.seat,1,2,3].find(seat=>seat>0&&!taken(seat)&&(seat<2||!car.doorMissing([DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear][seat])));
   const seat=!decision?-1:!taken(0)?0:passenger??-1;
   if(seat>=0)u.returning.set(c.id,{seat,time:0,best:Infinity,stall:0});
  }
 }
 /** CHeli pursuit: required airframes orbit the suspect; extras and wrecks retire. */
 /** Break-in alarm response: a nearby officer on foot walks to the sounding car. */
 private alarmClock=0;
 private updateAlarms(dt:number){
  this.alarmClock+=dt;if(this.alarmClock<3||!this.crew)return;
  const sounding=[...this.fleet.cars].filter(c=>c.alarm>0&&!c.wrecked);
  if(!sounding.length){this.alarmClock=0;return;}
  this.alarmClock=0;
  for(const car of sounding){
   const p=car.car.body.translation();
   let best:{id:number;d:number}|undefined;
   for(const u of this.units)for(const cop of this.crew.list(u)??[]){
    if(cop.down)continue;
    const d=Math.hypot(cop.position.x-p.x,cop.position.z-p.z);
    if(d<45&&(!best||d<best.d))best={id:cop.id,d};
   }
   if(best)this.crew.goTo(best.id,{x:p.x,z:p.z},true);
  }
 }
 private updateHelis(playerCar?:WorldCar){
  const need=helisRequired(this.law.level);
  for(let i=this.helis.length-1;i>=0;i--){
   const h=this.helis[i];
   if(h.health<=0||!this.fleet.planes.has(h)){if(this.fleet.planes.has(h)){this.fleet.planes.delete(h);h.dispose();}this.helis.splice(i,1);}
  }
  while(this.helis.length>need){const h=this.helis.pop()!;this.fleet.planes.delete(h);h.dispose();}
  if(this.helis.length<need&&!this.heliBusy&&!this.disposed){
   this.heliBusy=true;
   const p=this.sim.player.position;
   void this.fleet.spawnPlane(POLICE_HELI_MODEL,p.x+80,p.z+80,0).then(heli=>{
    if(this.disposed||helisRequired(this.law.level)<=this.helis.length){this.fleet.planes.delete(heli);heli.dispose();return;}
    heli.policeHeli=true;this.helis.push(heli);
   }).catch(e=>{this.error=String(e);}).finally(()=>{this.heliBusy=false;});
  }
  const suspect=playerCar?playerCar.car.body.translation():this.sim.player.position;
  for(const h of this.helis){
   if(h.occupied){h.autopilot=undefined;continue;}
   const position=h.body.translation(),velocity=h.body.linvel();
   h.autopilot=policeHeliInputs({position,velocity,heading:heliHeading(h.body.rotation())},heliOrbitPoint({x:suspect.x,y:suspect.y,z:suspect.z},this.seconds));
   const eye={...position,y:position.y-1},to={x:suspect.x-eye.x,y:(suspect.y+1)-eye.y,z:suspect.z-eye.z},dist=Math.hypot(to.x,to.y,to.z);
   const blocked=dist>1?this.sim.world.castRay(new RAPIER.Ray(eye,{x:to.x/dist,y:to.y/dist,z:to.z/dist}),dist,true,RAPIER.QueryFilterFlags.ONLY_FIXED,undefined,undefined,h.body)!==null:false;
   const night=this.sim.timeMinutes<360||this.sim.timeMinutes>1140?1:0;
   this.searchlights.set(h,searchlightTarget(eye,suspect,night,this.law.level,blocked));
  }
  // SWAT rappel at five stars: a low airframe grounds a two-officer stick.
  if(!this.disposed){
   const heli=this.helis.find(h=>!h.occupied&&h.health>0);
   if(heli){
    const hp=heli.body.translation();
    if(rappelWindow({level:this.law.level,sinceRappel:this.seconds-this.lastRappel,lateral:Math.hypot(hp.x-suspect.x,hp.z-suspect.z),altitude:hp.y-suspect.y})){
     this.lastRappel=this.seconds;
     for(let i=0;i<2;i++){
      const gx=hp.x+(i?2:-2),gz=hp.z+(i?-2:2);
      const hit=this.sim.world.castRay(new RAPIER.Ray({x:gx,y:hp.y,z:gz},{x:0,y:-1,z:0}),hp.y-suspect.y+30,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,heli.body);
      const gy=hit?hp.y-hit.timeOfImpact+.03:suspect.y;
      if(!Number.isFinite(gy))continue;
      this.spawnOfficer?.('swat',28,{x:gx,y:gy,z:gz},Math.atan2(suspect.x-gx,suspect.z-gz),undefined,68);
     }
    }
   }
  }
 }
 beforeStep(dt:number,playerCar?:WorldCar){
  this.seconds+=dt;
  this.updateHelis(playerCar);
  this.updateAlarms(dt);
  const player=this.sim.player.position,target=playerCar?playerCar.car.body.translation():player,targetVelocity=playerCar?playerCar.car.body.linvel():{x:0,y:0,z:0};
  const playerSpeed=playerCar?Math.hypot(targetVelocity.x,targetVelocity.z)/50:this.sim.player.speed/50;
  for(const u of this.units){
   const car=u.car;u.seconds+=dt;
   if(car.occupied||car.wrecked){car.autopilot=undefined;continue;}
   // Crew exiting: CTaskSimpleCarGetOut clips at the door, then CTaskSimpleCarSetPedOut.
   for(let i=u.leaving.length-1;i>=0;i--){
    const l=u.leaving[i];l.time+=dt;
    const ratio=nativeDoorAnimRatio(car.animGroup,'getOut',l.time,car.doors[l.door].ratio,0);if(ratio!==undefined&&!car.doorMissing(l.door))car.openDoor(l.door,ratio);
    if(l.time>=l.clip.duration){u.leaving.splice(i,1);this.finishExit(u,l.seat);}
   }
   // Roadblock crews hold the block instead of reboarding while it stands.
   if(u.mission!=='roadblock')this.recallCrew(u,dt,playerCar);
   for(let i=u.entering.length-1;i>=0;i--){
    const e=u.entering[i];e.time+=dt;
    if(e.phase==='open'||e.phase==='closeInside'){const ratio=nativeDoorAnimRatio(car.animGroup,e.phase,e.time,car.doors[e.door].ratio,e.group);if(ratio!==undefined&&!car.doorMissing(e.door))car.openDoor(e.door,ratio);}
    if(e.time>=e.clip.duration){u.entering.splice(i,1);this.afterEntryPhase(u,e.seat,e.phase);}
   }
   // Bust pull: a stopped unit's crew at the suspect's door drags the driver
   // out so the foot arrest (CTaskSimpleArrestPed) can proceed. Roadblock
   // crews hold their block the same way when the suspect stops at it.
   if(this.law.level>0&&(u.mission==='stopped'||u.mission==='roadblock')&&playerCar&&!playerCar.wrecked){
    const pv=playerCar.car.body.linvel(),pp=playerCar.car.body.translation();
    const carStopped=Math.hypot(pv.x,pv.z)<2;
    const atDoor=(this.crew?.list(u)??[]).some(c=>!c.down&&Math.hypot(c.position.x-pp.x,c.position.z-pp.z)<BUST_PULL_RANGE);
    u.pullTimer=bustPullProgress(u.pullTimer,dt,carStopped&&atDoor);
    if(u.pullTimer>=BUST_PULL_SECONDS){u.pullTimer=0;this.onPullFromCar?.(playerCar);}
   }else u.pullTimer=0;
   // Roadblock units hold across the road with their crew out; the block dissolves below
   // three stars or once the player leaves, and the crew then reboards through recallCrew.
   if(u.mission==='roadblock'){
    car.autopilot={throttle:0,brake:1,steering:0,handbrake:true};
    const p0=car.car.body.translation();
    if(this.law.level<3||Math.hypot(target.x-p0.x,target.z-p0.z)>120){u.mission='far';u.siren=false;}
    continue;
   }
   if(!u.seats[0]&&!u.leaving.some(l=>l.seat===0)){car.autopilot=undefined;car.driverOut=true;continue;}
   const p=car.car.body.translation(),q=car.car.body.rotation(),v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z),distance=Math.hypot(target.x-p.x,target.z-p.z);
   const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y)),forward={x:-Math.sin(heading),z:-Math.cos(heading)};
   if(!this.law.level){u.mission='cruise';u.siren=false;}
   else if(u.mission==='cruise')u.mission='far';
   // CCarAI::UpdateCarAI switch distances: close within the straight-line distance 20, or head-on within 40; far beyond 50.
   const playerForward=playerCar?(()=>{const r=playerCar.car.body.rotation(),h=Math.atan2(2*(r.w*r.y+r.x*r.z),1-2*(r.x*r.x+r.y*r.y));return {x:-Math.sin(h),z:-Math.cos(h)};})():undefined;
   const headOn=!!playerForward&&forward.x*playerForward.x+forward.z*playerForward.z<=-.8&&distance<40;
   if(u.mission==='far'&&(distance<=20||headOn)){u.mission='close';u.siren=true;}
   else if(u.mission==='close'&&distance>50){u.mission='far';u.siren=false;}
   // RAM/BLOCK close: the crew gets out beside a player on foot, flipped, or stopped in a car for 2500 ms.
   const playerStopped=!playerCar||playerSpeed*playerSpeed<.04*.04;
   u.slowTimer=playerStopped?u.slowTimer+dt:0;
   const upsideDown=!!playerCar&&(()=>{const r=playerCar.car.body.rotation();return 1-2*(r.x*r.x+r.z*r.z)<0;})();
   if(u.mission!=='stopped'&&u.mission!=='cruise'&&distance<=10&&car.modelId!==432&&(!playerCar||upsideDown||u.slowTimer>2.5)){
    u.mission='stopped';for(let seat=1;seat<4;seat++)this.beginExit(u,seat);
    // CTaskComplexCopInCar: the driver waits 3000–5000 ms the first time.
    u.driverExitAt=u.seconds+3+this.random()*2;
   }
   if(u.mission==='stopped'){
    car.autopilot={throttle:0,brake:1,steering:0,handbrake:speed<.5};
    if(u.driverExitAt!==undefined&&u.seconds>=u.driverExitAt){u.driverExitAt=undefined;this.beginExit(u,0);}
    if(distance>50&&u.seats[0]&&!u.leaving.length){u.mission='far';u.driverExitAt=undefined;}
    continue;
   }
   // CCarAI::FindPoliceCarSpeedForWantedLevel with CCarAI::MellowOutChaseSpeed.
   const cruise=u.mission==='cruise'?12:mellowChaseSpeed(this.law.level,Math.hypot(target.x-p.x,target.y-p.y,target.z-p.z),!!playerCar,playerSpeed,policeCruiseSpeed(this.law.level,car.assets.handling.maxFlatVelocity,()=>.5));
   let aim={x:target.x-p.x,z:target.z-p.z},cornerSpeed=Infinity;
   if(u.mission==='close'&&playerCar)aim={x:target.x+targetVelocity.x*.5-p.x,z:target.z+targetVelocity.z*.5-p.z};
   else if(u.mission!=='close'&&this.paths&&u.link){
    // FARAWAY missions route over the car path network to the node nearest the player, refreshed every 3 s or when the player moves 20 units.
    if(u.mission==='far'&&(this.seconds-u.routeAt>3||!u.routeGoal||Math.hypot(u.routeGoal.x-target.x,u.routeGoal.z-target.z)>20)){u.routeAt=this.seconds;u.routeGoal={x:target.x,y:target.y,z:target.z};u.route=findTrafficRoute(this.paths.areas,u.link.to,u.routeGoal)??[];}
    let link=u.link,along=(p.x-link.start.x)*link.dx+(p.z-link.start.z)*link.dz;
    if(along>link.length-4){
     const next=u.mission==='far'&&u.route.length?u.route.shift():trafficLinks(this.paths.areas,link.to,u.mission==='far').filter(n=>n.to!==link.from).sort((a,b)=>b.length-a.length)[0];
     if(next&&next.from===link.to){u.link=link=next;along=(p.x-link.start.x)*link.dx+(p.z-link.start.z)*link.dz;}else u.routeAt=-Infinity;
    }
    // Look ahead along the route (6 units plus half a second), and brake for the turn onto the next link.
    let look=Math.max(0,along)+6+speed*.5;const next=u.mission==='far'?u.route[0]:undefined;
    if(look>link.length&&next){const over=Math.min(next.length,look-link.length);aim={x:next.start.x+next.dx*over-p.x,z:next.start.z+next.dz*over-p.z};}
    else{look=Math.min(link.length,look);aim={x:link.start.x+link.dx*look-p.x,z:link.start.z+link.dz*look-p.z};}
    if(next){const turn=Math.acos(Math.max(-1,Math.min(1,link.dx*next.dx+link.dz*next.dz))),toCorner=Math.max(0,link.length-along);cornerSpeed=Math.sqrt(2*7*toCorner)+Math.max(6,22*(1-turn/Math.PI*1.6));}
    if(Math.abs((p.x-link.start.x)*link.dz-(p.z-link.start.z)*link.dx)>12){aim={x:target.x-p.x,z:target.z-p.z};u.routeAt=-Infinity;}
    // With no road left toward the player (end of the route), drive straight at him.
    if(u.mission==='far'&&!u.route.length&&along>=link.length-4&&distance<60)aim={x:target.x-p.x,z:target.z-p.z};
   }
   u.aim={x:+(p.x+aim.x).toFixed(1),z:+(p.z+aim.z).toFixed(1)};
   const control=trafficSteering(heading,aim),wantSpeed=Math.min(cornerSpeed,aiToMetres(cruise)*(Math.abs(control.error)>1?.4:1));
   // CCarAI stuck recovery: under 0.012 units/frame for 1000 ms reverses 1500, 4000 ms, then left and right for 2500 ms.
   if(u.recovery){
    u.recovery.remaining-=dt;car.autopilot={throttle:0,brake:1,steering:u.recovery.kind===2?-1:u.recovery.kind===3?1:0,handbrake:false};
    if(u.recovery.remaining<=0)u.recovery=undefined;continue;
   }
   if(speed/50<=.012&&u.mission!=='cruise'){u.stuck+=dt;if(u.stuck>1){u.stuck=0;u.recoveryMode=this.seconds-u.lastRecovery>=10?0:(u.recoveryMode+1)%4;u.lastRecovery=this.seconds;u.recovery={kind:u.recoveryMode,remaining:[1.5,4,2.5,2.5][u.recoveryMode]};}}
   else u.stuck=0;
   const facingAway=Math.abs(angleDelta(heading,Math.atan2(-aim.x,-aim.z)))>2.4;
   car.autopilot={steering:control.steering,throttle:speed<wantSpeed?facingAway?.6:1:0,brake:speed>wantSpeed+2?1:0,handbrake:false};
  }
 }
 /** Seated and leaving crews for the occupant renderer. */
 poses():PolicePose[]{
  const out:PolicePose[]=[];
  for(const u of this.units){
   if(u.car.wrecked||u.car.occupied)continue;
   for(let seat=0;seat<4;seat++){
    const leaving=u.leaving.find(l=>l.seat===seat)??u.entering.find(e=>e.seat===seat);
    if(leaving){const local=this.doorPoint(u.car,seat);if(local)out.push({car:u.car,model:u.member.model,local,clip:leaving.key,seconds:leaving.time,animation:leaving.clip});continue;}
    if(!u.seats[seat])continue;
    const frame=u.car.car.nativeFramePosition(seat<2?'ped_frontseat':'ped_backseat');if(!frame)continue;
    out.push({car:u.car,model:u.member.model,local:{x:seat%2===0?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z},clip:seat===0?'car_sit':'car_sitp',seconds:0});
   }
  }
  return out;
 }
 snapshot(){return {ready:!!this.paths,pending:this.busy,error:this.error??null,lastRappel:this.lastRappel,helis:this.helis.map(h=>({modelId:h.modelId,position:{...h.body.translation()},speed:Math.hypot(h.body.linvel().x,h.body.linvel().z),occupied:h.occupied,searchlight:this.searchlights.get(h)??{locked:false,illuminated:false,distance:0}})),units:this.units.map(u=>({modelId:u.car.modelId,mission:u.mission,siren:u.siren,crew:u.seats.filter(Boolean).length,leaving:u.leaving.length,entering:u.entering.map(e=>({seat:e.seat,phase:e.phase})),returning:u.returning.size,position:{...u.car.car.body.translation()},speed:Math.hypot(u.car.car.body.linvel().x,u.car.car.body.linvel().z),recovery:u.recovery?.kind??null,route:u.route.length,link:u.link?{from:u.link.from.position,to:u.link.to.position}:null,aim:u.aim??null}))};}
 dispose(){this.disposed=true;for(const u of this.units)this.fleet.removeTrafficCar(u.car);this.units.length=0;for(const h of this.helis){this.fleet.planes.delete(h);h.dispose();}this.helis.length=0;}
}
