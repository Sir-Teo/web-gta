import type {SetPieceCar} from './nativeSetPieces';
import {nativeCarSeatPose} from '../vehicle/nativeSeatPosition';
import {pedEnteredVehicleLeaveDelay} from './nativePedEnteredVehicle';
import {DIE_IN_CAR_OFFSET_MS,canPedStepOutCar} from '../vehicle/nativeDieInCar';
import RAPIER from '@dimforge/rapier3d-compat';
import {openStaticWorld} from '../assets/staticWorldArchive';
import {worldPaths} from '../assets/worldPaths';
import {readRoadblox} from '../assets/roadblox';
import {NativeRoadBlocks} from '../police/nativeRoadBlocks';
import {worldLevelAt,type WorldZones} from '../assets/worldZones';
import {VEHICLE_ANIM,VEHICLE_ANIM_SPECIAL,nativeDoorAnimRatio} from '../assets/vehicleAnimGroups';
import type {VehicleAnimationLibrary} from '../assets/vehicleAnimations';
import type {NativeAnimation} from '../assets/ifp';
import {clipRootEnd,nativeDoorPoint} from './CarEntry';
import {DOOR,sitClip} from './nativeDoor';
import {findTrafficRoute,joinCarWithRoadSystem,trafficLinks,travelLink as travel,type TrafficLink} from './trafficRoute';
import {Quaternion,Vector3} from 'three';
import {pathDirection} from '../assets/pathDirection';
import {nativeShouldStopForLight} from '../world/nativeSignalStop';
import {BLOCK_TO_STOP_DISTANCE,STOP_TO_BLOCK_DISTANCE,blockPlayerTarget,lanePoint,slowCarDownForCars,nextLaneOnLink,shouldPickNextNode,steerFollowPath,steerHeadingForTarget,type Pedals} from '../vehicle/nativeCarCtrl';
import type {Simulation} from './Simulation';
import type {WorldCar} from './WorldCar';
import type {WorldPlane} from './WorldPlane';
import {POLICE_HELI_MODEL,heliHeading,heliOrbitPoint,policeHeliInputs,rappelWindow,searchlightTarget} from './policeHeli';
import { roadblockAllowed } from '../police/nativeRoadBlocks';
import type {WorldFleet} from './WorldFleet';
import type {WorldBike} from './WorldBike';
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
  // CCarAI::AddPoliceCarOccupants: the Barracks shares the city cars' case. A partner rides above one star, else one
  // time in two; above two stars the driver carries a shotgun one time in four, or else the partner.
  case 433:default:{const seats=wanted>=2||random()<.5?2:1,shotgunSeat=wanted>2?random()<.25?0:seats>1&&random()<.25?1:undefined:undefined;return {seats,member:modelId===433?{model:'army',weapon:31,accuracy:84}:city,shotgunSeat};}
 }
}
/** CCarAI::FindPoliceCarSpeedForWantedLevel in car AI speed units (60 × units per frame). */
export function policeCruiseSpeed(wanted:number,maxFlatVelocity:number,random:()=>number){
 switch(wanted){case 0:return 12+Math.floor(random()*4);case 1:return 25;case 2:return 34;case 3:return Math.trunc(maxFlatVelocity*60*.9);case 4:return Math.trunc(maxFlatVelocity*60*1.2);case 5:return Math.trunc(maxFlatVelocity*60*1.25);default:return Math.trunc(maxFlatVelocity*60*1.3);}
}
/** Bust pull from a stopped suspect car (CTaskSimpleCarSetPedOut drag-out):
 * an officer beside the car holds the door for BUST_PULL_SECONDS. */
export const BUST_PULL_RANGE = 3.5;
export const BUST_PULL_SECONDS = 1.5;
/** Accumulate door-hold progress; any gap resets the drag-out. */
/** CTaskComplexArrestPed::CreateFirstSubTask for a suspect in a car: TASK_COMPLEX_CAR_OPEN_DRIVER_DOOR, unless the car
 * IsUpsideDown (up.z <= -0.9) or IsOnItsSide (|right.z| >= 0.8), which gets TASK_COMPLEX_DESTROY_CAR. `rotation` is
 * the browser body's quaternion (y up). */
export function arrestOpensDriverDoor(q:{x:number;y:number;z:number;w:number}){
 const upZ=1-2*(q.x*q.x+q.z*q.z),rightZ=2*(q.x*q.y+q.w*q.z);
 return upZ>-.9&&Math.abs(rightZ)<.8;
}
export function bustPullProgress(progress:number,dt:number,ready:boolean){return ready?progress+dt:0;}
/** CRoadBlocks::GenerateRoadBlockPedsForCar's PLACEMENTS (city cops) and SPECIAL_COP_PLACEMENTS (SWAT, army, FBI and
 * the SF cop car), in native car space (x right, y forward), indexed 2 × positions type + ped, scaled by the car's
 * bounding radius over the default cop car's. */
export const ROADBLOCK_PLACEMENTS:readonly (readonly [number,number])[]=[[-1.5,1.9],[-1.5,-2.6],[1.5,1.9],[1.5,-2.6],[-1.5,0],[1.5,0]];
export const ROADBLOCK_SPECIAL_PLACEMENTS:readonly (readonly [number,number])[]=[[0,3.2],[1.5,-1.8],[0,3.2],[-1.5,-1.8],[-1.5,0],[1.5,0]];
/** copcarla's collision bounding radius (authored constant; the placements scale by radius over it). */
export const DEFAULT_COP_CAR_RADIUS=2.7;
/** Enforcer, Barracks, FBI Rancher and the SF cop car take the special placements. */
export const SPECIAL_COP_CARS:ReadonlySet<number>=new Set([427,433,490,599]);
export function roadblockCrewPlacements(positionsType:0|1|2,count:number,radiusRatio:number,special:boolean){
 const table=special?ROADBLOCK_SPECIAL_PLACEMENTS:ROADBLOCK_PLACEMENTS,out:{x:number;y:number}[]=[];
 for(let i=0;i<count;i++){const slot=table[2*positionsType+i];if(!slot)break;out.push({x:slot[0]*radiusRatio,y:slot[1]*radiusRatio});}
 return out;
}
/** CCarAI::MellowOutChaseSpeed for one and two stars. */
/** CCarAI::UpdateCarAI's hand-over between land and water (0x420445): whether a law vehicle after the wanted player
 * takes TEMPACT_WAIT (a second at a time). A land unit waits while he swims or is in a boat; a boat waits while he is
 * on foot out of the water or in a car or bike. An aircraft of his changes nothing. */
export function lawVehicleWaits(o:{wanted:number;unitBoat:boolean;player:'land'|'swimming'|'boat'|'aircraft'}){
 if(o.wanted<=0||o.player==='aircraft')return false;
 return o.player==='land'?o.unitBoat:!o.unitBoat;
}
/** CCarAI::FindPoliceCarMissionForWantedLevel: MISSION_BLOCKPLAYER_FARAWAY at one star or none; above that
 * BLOCKPLAYER_HANDBRAKESTOP instead one time in four at two stars, one in two at three, three in four from four. */
export function blockHandbrakeStop(wanted:number,random:()=>number){
 if(wanted<=1)return false;
 const chance=wanted===2?.75:wanted===3?.5:.25;
 return random()>=chance;
}
/** The cars whose crews get CTaskComplexCopInCar (CCarAI::AddPoliceCarOccupants): the city cop cars and the Barracks,
 * crewed above one star. An Enforcer, FBI Rancher or Rhino, or any car crewed at one star or none, has no such task. */
export const COP_IN_CAR_MODELS:ReadonlySet<number>=new Set([596,597,598,599,433]);
export function hasCopInCarTask(modelId:number,wantedWhenCrewed:number){return wantedWhenCrewed>1&&COP_IN_CAR_MODELS.has(modelId);}
/** CTaskComplexCopInCar's driver told to leave beside the stopped suspect waits 3000–5000 ms the first time and
 * 250–1500 ms after a chase resumed; a driver without the task leaves at once (CTaskComplexLeaveCar). Seconds. */
export function copDriverExitDelay(o:{copInCar:boolean;firstStop:boolean;random:()=>number}){
 if(!o.copInCar)return 0;
 return o.firstStop?3+o.random()*2:.25+o.random()*1.25;
}
/** The stopped suspect car CTaskComplexCopInCar's waiting driver stays for: |moveSpeed|² × TimeStep × 50 at or under
 * 1 (5.48 m/s at 30 fps) within 10 units of him. Speed in units a frame. */
export function suspectCarCrawling(speed:number,distance:number){return speed*speed*(50/30)*50<=1&&distance<=10;}
export function mellowChaseSpeed(wanted:number,distance:number,playerInCar:boolean,playerSpeed:number,cruise:number){
 let speed=cruise;
 if(wanted===1)speed=playerInCar?distance<10?15:distance<20?22:25:distance<20?5:distance<40?13:25;
 else if(wanted===2)speed=playerInCar?distance<10?27:distance<20?30:34:distance<20?5:distance<40?18:34;
 return !playerInCar&&speed>=10&&distance<=30&&playerSpeed<.07?10:speed;
}
interface Leaving {seat:number;clip:NativeAnimation;key:string;time:number;door:number;
 /** CTaskComplexLeaveCar's delay, seconds still to wait before the door (the passengers CJ did not drag out). */
 wait?:number}
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
const toNative=(v:{x:number;y:number;z:number})=>({x:v.x,y:-v.z,z:v.y});
interface Unit {
 car:WorldCar;wanted:number;member:{model:string;weapon:number;accuracy:number};seats:boolean[];
 /** The seat whose cop was handed a shotgun, if one was. */
 shotgunSeat?:number;
 /** CPed health per seat under the player's bullets, seats whose cop died in them (CTaskSimpleDieInCar), and the dying driver's 2000 ms coast (CTaskComplexDieInCar). */
 seatHealth:number[];deadSeats:boolean[];driverDying?:{at:number};
 mission:'far'|'close'|'stopped'|'cruise'|'roadblock'|'slowly1'|'slowly2';siren:boolean;cruise:number;
 /** A set piece's MISSION_SLOWLY_DRIVE_TOWARDS_PLAYER destination (native) and its TEMPACT_GOFORWARD end. */
 goal?:{x:number;y:number};goForwardUntil?:number;
 slowTimer:number;pullTimer:number;driverExitAt?:number;leaving:Leaving[];entering:Entering[];returning:Map<number,Returning>;
 /** CTaskComplexCopInCar's m_flag0x4: no chase resumed yet, so the driver's first stop waits the long time. */
 firstStop?:boolean;
 /** MISSION_BLOCKPLAYER_HANDBRAKESTOP rather than BLOCKPLAYER_CLOSE, from the mission roll and the block distances. */
 blockStop?:boolean;
 stuck:number;recovery?:{kind:number;remaining:number};recoveryMode:number;lastRecovery:number;
 /** When JoinCarWithRoadSystem last put the unit back on a link. */
 joinedAt?:number;
 aim?:{x:number;z:number};link?:TrafficLink;route:TrafficLink[];routeAt:number;routeGoal?:{x:number;y:number;z:number};seconds:number;
 /** CAutoPilot lanes on the current and next links, CVehicle::m_nRandomSeed and a TEMPACT_TURNLEFT/RIGHT in progress. */
 lane?:number;nextLane?:number;cruiseNext?:TrafficLink;seed?:number;turn?:{dir:'left'|'right';until:number};
 /** The player has climbed into the car: the crew still aboard are getting out, and nobody boards it again. */
 taken?:boolean;
}
export interface PolicePose {car:WorldCar;seat:number;model:string;local:V3;headingOffset?:number;clip:string;seconds:number;animation?:NativeAnimation}
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
  private roadblockBusy=false;
  /** CRoadBlocks' node table and statics, once ROADBLOX.DAT has loaded; the frame counter it slices the table by; and
   * the roadblocks it asked for that the host has yet to build. */
  roadBlocks?:NativeRoadBlocks;private frame=0;private roadblockQueue:{a:{x:number;y:number;z:number};b:{x:number;y:number;z:number}}[]=[];
  /** CHeli::bPoliceHelisAllowed, which SWITCH_POLICE_HELIS sets. */
  policeHelisAllowed=true;
 zones?:WorldZones;
 camera:()=>{position:V3;forward:V3}=()=>({position:this.sim.player.position,forward:{x:0,y:0,z:-1}});
 canSpawn:(point:V3,radius:number)=>boolean=()=>true;
 /** A unit the police stop tracking (its car taken, gone or culled): its crew on foot are ordinary peds from then on. */
 onUnitDropped?:(unit:object)=>void;
 spawnOfficer?:(model:string,weapon:number,position:V3,heading:number,crew?:{unit:object;seat:number;roadblock?:boolean},accuracy?:number,lying?:{key:string;clip:NativeAnimation})=>void;
 /** The street population's cops on foot: list a unit's crew, send one toward a door point (undefined resumes the pursuit), or take one into the car. */
 crew?:{list:(unit:object)=>FootCrew[];goTo:(id:number,point?:{x:number;z:number},walk?:boolean)=>void;board:(id:number)=>boolean};
 /** CTaskComplexLeaveCarAndDie for a unit's shot driver once the car rests: the host plays his exit and lays him dead. */
 onCrewDiesOut?:(car:WorldCar,model:string)=>void;
 /** The seated crew a bullet line can reach (CWorld::ProcessLineOfSight on seated peds): seat locals in car space. */
 crewSeats(){
  const out:{car:WorldCar;seat:number;local:V3;headingOffset:number}[]=[];
  for(const u of this.units){
   if(u.car.wrecked||u.car.occupied)continue;
   for(let seat=0;seat<4;seat++){
    if(!u.seats[seat]||u.deadSeats[seat]||u.leaving.some(l=>l.seat===seat)||u.entering.some(e=>e.seat===seat))continue;
    const frame=u.car.car.nativeFramePosition(seat<2?'ped_frontseat':'ped_backseat');if(!frame)continue;
    const pose=nativeCarSeatPose({x:seat%2===0?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z},seat===0?'driver':seat-1,u.car.animGroup.id);
    out.push({car:u.car,seat,...pose});
   }
  }
  return out;
 }
 /** A bullet reaching a seated cop: CPed damage; the fatal one starts the driver's 2000 ms coast (CTaskComplexDieInCar)
  * or kills a passenger in his seat. */
 crewShot(car:WorldCar,seat:number,damage:number):'hit'|'killed'|undefined{
  const u=this.units.find(u=>u.car===car);
  if(!u||car.wrecked||car.occupied||!u.seats[seat]||u.deadSeats[seat])return undefined;
  if(seat===0&&u.driverDying)return 'hit';
  u.seatHealth[seat]=Math.max(0,u.seatHealth[seat]-damage);
  if(u.seatHealth[seat]>0)return 'hit';
  if(seat===0){u.driverDying={at:u.seconds};u.siren=false;}
  else u.deadSeats[seat]=true;
  return 'killed';
 }
 /** A stopped unit's crew holds the suspect's door: the host drags the player out so the foot arrest can proceed. */
 onPullFromCar?:(car:WorldCar)=>void;
 /** A crew cop pulls the player off his stopped bike. */
 onPullFromBike?:(bike:WorldBike)=>void;
 error?:string;
 constructor(private sim:Simulation,private fleet:WorldFleet,private law:WantedSystem,private clips:VehicleAnimationLibrary,base:string,private random:()=>number=Math.random){
  void openStaticWorld(base).then(async source=>{
   if(this.disposed)return;this.paths=worldPaths(source);
   // CRoadBlocks::Init reads data\paths\roadblox.dat.
   const found=source.manifest.resources.find(r=>r.path==='data/paths/roadblox.dat');
   if(found)this.roadBlocks=new NativeRoadBlocks(readRoadblox(new Uint8Array(await (await source.resource(found)).arrayBuffer())));
  }).catch(e=>{this.error=String(e);});
 }
 private level(){const p=this.sim.player.position;return this.zones?worldLevelAt(this.zones,[p.x,-p.z,p.y]):1;}
 /** CWanted::WorkOutPolicePresence contribution: law vehicles that still have a driver or crew, and police
  * helicopters, each by its 3D distance. */
 presence(point:V3,radius:number){return this.units.filter(u=>{if(u.car.disposed||u.car.wrecked||u.car.occupied||!u.seats.some(Boolean))return false;const p=u.car.car.body.translation();return Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z)<radius;}).length+this.helis.filter(h=>{if(h.disposed||h.health<=0||h.occupied)return false;const p=h.body.translation();return Math.hypot(p.x-point.x,p.y-point.y,p.z-point.z)<radius;}).length;}
 /** Airborne observers keep the pursuit alive (CWanted::NumOfHelisRequired). */
 /** Lets go of the helicopters that crashed or that something else took out of the fleet (the script's clears), with
  * their searchlights. */
 dropLostHelis(){
  for(let i=this.helis.length-1;i>=0;i--){
   const h=this.helis[i];
   if(h.disposed||h.health<=0||!this.fleet.planes.has(h)){if(this.fleet.planes.has(h)){this.fleet.planes.delete(h);h.dispose();}this.helis.splice(i,1);this.searchlights.delete(h);}
  }
 }
 get heliActive(){return this.helis.some(h=>!h.disposed&&h.health>0&&!h.occupied);}
 /** Cops still inside their cars, which count against CWanted::m_MaxCopsInPursuit. */
 get seatedCrew(){return this.units.reduce((n,u)=>n+u.seats.filter(Boolean).length,0);}
 update(now:number){
  if(this.disposed||this.busy||!this.paths||now<this.nextCheck)return;this.nextCheck=now+1000;
  const player=this.sim.player.position;
  for(let i=this.units.length-1;i>=0;i--){
   const u=this.units[i];
   if(u.car.disposed||!this.fleet.cars.has(u.car)){this.units.splice(i,1);this.onUnitDropped?.(u);continue;}
   const p=u.car.car.body.translation(),far=Math.hypot(p.x-player.x,p.z-player.z);
   // A car the player took is let go once the crew he left aboard are out of it.
   if(u.car.occupied){if(!u.leaving.length){this.units.splice(i,1);this.onUnitDropped?.(u);}continue;}
   if(far>(this.law.level?220:120)&&this.canSpawn(p,6)||!this.fleet.cars.has(u.car)){this.units.splice(i,1);this.fleet.removeTrafficCar(u.car);this.onUnitDropped?.(u);}
  }
  // ThePaths keeps the areas around the player loaded, which the roadblock nodes are looked up in whatever the
  // pursuit's car count.
  if(this.law.native.chanceOnRoadBlock)void this.paths.loadAround(player.x,player.z).catch(e=>{this.error=String(e);});
  const wanted=this.law.level,active=this.units.filter(u=>!u.car.wrecked&&u.seats[0]&&!u.deadSeats[0]&&u.mission!=='cruise').length;
  if(!wanted||active>=this.law.native.maxCopCarsInPursuit||this.fleet.cars.size>=12)return;
  const paths=this.paths;this.busy=true;
  void paths.loadAround(player.x,player.z).then(async()=>{
   if(this.disposed)return;
   const camera=this.camera(),p=this.sim.player.position;
   const links=[...paths.areas.values()].flatMap(a=>a.nodes).filter(n=>{const d=Math.hypot(n.position[0]-p.x,-n.position[1]-p.z);return d>60&&d<110;}).flatMap(n=>trafficLinks(paths.areas,n));
   const scored=links.map(link=>{const dx=link.start.x-camera.position.x,dz=link.start.z-camera.position.z,l=Math.hypot(dx,dz)||1,ahead=(dx*camera.forward.x+dz*camera.forward.z)/l,toward=((p.x-link.start.x)*link.dx+(p.z-link.start.z)*link.dz)/Math.max(1,Math.hypot(p.x-link.start.x,p.z-link.start.z));return {link,score:(ahead>.3?1:0)-toward*.5+this.random()*.2};}).sort((a,b)=>a.score-b.score);
   // Browser policy (the unreversed generator picks its node by other means): of the spawnable links, those the car can
   // reach the suspect from by a road route under twice and a half their straight distance (and 40) go first. A car put
   // 55 units from a cul-de-sac's only entrance by road but 450 by the route there drove off round the block at the
   // one-star cruise, and was gone before it came back.
   const road=(link:TrafficLink)=>{const route=findTrafficRoute(paths.areas,link.to,{x:p.x,y:p.y,z:p.z},1500);return route?route.reduce((n,l)=>n+l.length,link.length):Infinity;};
   const direct=(link:TrafficLink)=>Math.hypot(link.start.x-p.x,link.start.z-p.z);
   const candidates=scored.filter(({link})=>this.canSpawn({x:link.start.x,y:link.from.position[2]+1,z:link.start.z},6)).slice(0,40)
    .map(c=>({...c,detour:road(c.link)>direct(c.link)*2.5+40})).sort((a,b)=>Number(a.detour)-Number(b.detour)||a.score-b.score).slice(0,12);
   for(const {link} of candidates){
    const {x,z}=link.start;if([...this.fleet.cars].some(c=>Math.hypot(c.car.body.translation().x-x,c.car.body.translation().z-z)<12))continue;
    const level=this.level();let modelId=choosePoliceCarModel(level,this.law.level,this.random);
    let car=await this.fleet.spawnTrafficCar(modelId,{x,y:link.from.position[2],z},Math.atan2(-link.dx,-link.dz),()=>!this.disposed&&this.law.level>0&&Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>45&&this.canSpawn({x,y:link.from.position[2]+1,z},6)).catch(()=>undefined);
    if(!car&&modelId!==DEFAULT_COP_CAR[level]){modelId=DEFAULT_COP_CAR[level];car=await this.fleet.spawnTrafficCar(modelId,{x,y:link.from.position[2],z},Math.atan2(-link.dx,-link.dz),()=>!this.disposed&&this.law.level>0&&Math.hypot(x-this.sim.player.position.x,z-this.sim.player.position.z)>45&&this.canSpawn({x,y:link.from.position[2]+1,z},6)).catch(()=>undefined);}
    if(!car)continue;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
    const crew=policeCrew(modelId,level,this.law.level,this.random);
    car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};void this.clips.load(car.animGroup).catch(()=>{});
    this.units.push({car,wanted:this.law.level,blockStop:blockHandbrakeStop(this.law.level,this.random),member:crew.member,shotgunSeat:(crew as {shotgunSeat?:number}).shotgunSeat,seats:Array.from({length:4},(_,i)=>i<crew.seats),seatHealth:[100,100,100,100],deadSeats:[false,false,false,false],mission:'far',siren:false,cruise:policeCruiseSpeed(this.law.level,car.assets.handling.maxFlatVelocity,this.random),slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,link,route:[],routeAt:-Infinity,seconds:0});car.activeRadius=250;
    break;
   }
   }).catch(e=>{this.error=String(e);}).finally(()=>{this.busy=false;});
  }
  /** An ambient patrol car (the popcycle's cop share of traffic): the level's cop car with AddPoliceCarOccupants'
   * crew cruising the road network (CCarAI MISSION_CRUISE, stop-for-cars style, traffic lights); once the player is
   * wanted UpdateCarAI gives it the pursuit mission like any law enforcer. */
  async spawnPatrol(position:V3,heading:number):Promise<WorldCar|undefined>{
   if(this.disposed||this.fleet.cars.size>=12)return undefined;
   const level=this.level(),modelId=DEFAULT_COP_CAR[level];
   const car=await this.fleet.spawnTrafficCar(modelId,position,heading,()=>!this.disposed&&this.canSpawn({x:position.x,y:position.y+1,z:position.z},6)).catch(()=>undefined);
   if(!car)return undefined;if(this.disposed){this.fleet.removeTrafficCar(car);return undefined;}
   const crew=policeCrew(modelId,level,0,this.random);
   car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};void this.clips.load(car.animGroup).catch(()=>{});
   this.units.push({car,wanted:0,member:crew.member,shotgunSeat:(crew as {shotgunSeat?:number}).shotgunSeat,seats:Array.from({length:4},(_,i)=>i<crew.seats),seatHealth:[100,100,100,100],deadSeats:[false,false,false,false],mission:'cruise',siren:false,cruise:policeCruiseSpeed(0,car.assets.handling.maxFlatVelocity,this.random),slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,route:[],routeAt:-Infinity,seconds:0});
   return car;
  }
  /** CSetPiece::TryToGenerateCopCar (0x4998A0) and SetupCar: the level's default cop car on the ground at `spawn`, facing
   * `target`, with AddPoliceCarOccupants' crew and the set piece's mission. Quick cars start at 2/3 units a frame.
   * BLOCKPLAYER_FORWARDANDBACK steering is unreversed, so those cars ram like MISSION_RAMPLAYER_CLOSE. */
  async spawnSetPieceCar(piece:SetPieceCar):Promise<WorldCar|undefined>{
   if(this.disposed)return undefined;
   const level=this.level(),modelId=DEFAULT_COP_CAR[Math.max(0,Math.min(3,level))];
   const x=piece.spawn[0],z=-piece.spawn[1],top=this.sim.player.position.y+60;
   const hit=this.sim.world.castRay(new RAPIER.Ray({x,y:top,z},{x:0,y:-1,z:0}),160,true,RAPIER.QueryFilterFlags.ONLY_FIXED);if(!hit)return undefined;
   const dx=piece.target[0]-piece.spawn[0],dy=piece.target[1]-piece.spawn[1];
   const car=await this.fleet.spawnTrafficCar(modelId,{x,y:top-hit.timeOfImpact,z},Math.atan2(-dx,dy),()=>!this.disposed&&this.canSpawn({x,y:top-hit.timeOfImpact+1,z},6));
   if(!car)return undefined;if(this.disposed){this.fleet.removeTrafficCar(car);return undefined;}
   const crew=policeCrew(modelId,level,this.law.level,this.random);
   car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};void this.clips.load(car.animGroup).catch(()=>{});
   const slowly=piece.mission==='slowlyDriveTowardsPlayer';
   this.units.push({car,wanted:this.law.level,member:crew.member,shotgunSeat:(crew as {shotgunSeat?:number}).shotgunSeat,seats:Array.from({length:4},(_,i)=>i<crew.seats),seatHealth:[100,100,100,100],deadSeats:[false,false,false,false],mission:slowly?'slowly1':'close',siren:!slowly,cruise:piece.cruise,
    goal:{x:piece.target[0],y:piece.target[1]},goForwardUntil:piece.quick?.1:undefined,slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,route:[],routeAt:-Infinity,seconds:0});
   car.activeRadius=250;
   if(piece.quick){const l=Math.hypot(dx,dy)||1;car.car.body.setLinvel({x:dx/l*2/3*50,y:0,z:-dy/l*2/3*50},true);}
   return car;
  }
  /** Removes a set-piece car whose partner failed to generate. */
  removeSetPieceCar(car:WorldCar){const i=this.units.findIndex(u=>u.car===car);if(i>=0)this.units.splice(i,1);this.fleet.removeTrafficCar(car);}
  /** CRoadBlocks::GenerateRoadBlocks, once a frame: ROADBLOX.DAT nodes roll against m_nChanceOnRoadBlock as the player,
   * in any vehicle, comes within 90 units of them, and the script's registered roadblocks go up as he comes back
   * within 90 units of one. */
  private generateRoadBlocks(inVehicle:boolean){
   const blocks=this.roadBlocks,paths=this.paths;if(!blocks||!paths)return;
   const p=this.sim.player.position;
   blocks.generate(this.frame++,this.law.native.chanceOnRoadBlock,inVehicle,{x:p.x,y:-p.z,z:p.y},{
    node:a=>paths.areas.get(a.area)?.nodes[a.node],
    naviLink:(area,link)=>{const at=paths.areas.get(area)?.navigationLinks[link];return at?paths.areas.get(at.area)?.navigation[at.node]:undefined;},
   },()=>Math.floor(this.random()*128),(a,b)=>{
    // CWorld::ProcessLineOfSight against buildings only.
    const from={x:a.x,y:a.z,z:-a.y},d={x:b.x-a.x,y:b.z-a.z,z:-(b.y-a.y)},l=Math.hypot(d.x,d.y,d.z);if(l<1e-6)return true;
    return !this.sim.world.castRay(new RAPIER.Ray(from,{x:d.x/l,y:d.y/l,z:d.z/l}),l,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   },(a,b,gang)=>{
    // A gang roadblock (a script's) would stand gang members and their cars there; the port builds police ones only.
    if(!gang&&this.roadblockQueue.length<8)this.roadblockQueue.push({a,b});
   });
   this.buildRoadblock();
  }
  /** CRoadBlocks::RegisterScriptRoadBlock and ClearScriptRoadBlocks for the script. */
  registerScriptRoadblock(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},gang:boolean){this.roadBlocks?.registerScript(a,b,gang);}
  clearScriptRoadblocks(){this.roadBlocks?.clearScript();}
  /** CreateRoadBlockBetween2Points is a retail stub. The port stands in for it: cop cars of the level's model parked
   * across the line from one point to the other, one for each 7 units of it (one to three), the first with four of
   * its crew standing guard and the rest with two. */
  private buildRoadblock(){
   if(this.disposed||this.roadblockBusy||!this.roadblockQueue.length||this.fleet.cars.size>=12)return;
   const {a,b}=this.roadblockQueue.shift()!;
   const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),count=Math.max(1,Math.min(3,Math.round(length/7)));
   // Browser frame: the car faces along the line (forward is (-sin h, -cos h)).
   const along={x:length?dx/length:1,z:length?-dy/length:0},heading=Math.atan2(-along.x,-along.z);
   this.roadblockBusy=true;
   void (async()=>{
    for(let k=0;k<count&&!this.disposed&&this.fleet.cars.size<12;k++){
     const t=(k+.5)/count,spot={x:a.x+dx*t,y:a.z+(b.z-a.z)*t,z:-(a.y+dy*t)};
     if(!this.canSpawn({x:spot.x,y:spot.y+1,z:spot.z},6))continue;
     if([...this.fleet.cars].some(c=>Math.hypot(c.car.body.translation().x-spot.x,c.car.body.translation().z-spot.z)<5))continue;
     const level=this.level();let modelId=choosePoliceCarModel(level,this.law.level,this.random);
     const still=()=>!this.disposed&&roadblockAllowed(this.law.level)&&this.canSpawn({x:spot.x,y:spot.y+1,z:spot.z},6);
     let car=await this.fleet.spawnTrafficCar(modelId,spot,heading,still).catch(()=>undefined);
     if(!car&&modelId!==DEFAULT_COP_CAR[level]){modelId=DEFAULT_COP_CAR[level];car=await this.fleet.spawnTrafficCar(modelId,spot,heading,still).catch(()=>undefined);}
     if(!car)continue;if(this.disposed){this.fleet.removeTrafficCar(car);return;}
     const crew=policeCrew(modelId,level,this.law.level,this.random);
     car.autopilot={throttle:0,brake:1,steering:0,handbrake:true};void this.clips.load(car.animGroup).catch(()=>{});
     const unit:Unit={car,wanted:this.law.level,member:crew.member,seats:Array.from({length:4},(_,i)=>i<(k?Math.min(2,crew.seats):crew.seats)),seatHealth:[100,100,100,100],deadSeats:[false,false,false,false],mission:'roadblock',siren:true,cruise:0,slowTimer:0,pullTimer:0,leaving:[],entering:[],returning:new Map(),stuck:0,recoveryMode:0,lastRecovery:-Infinity,route:[],routeAt:-Infinity,seconds:0};
     this.units.push(unit);car.activeRadius=250;
     this.placeRoadblockCrew(unit,k?2:4);
    }
   })().catch(e=>{this.error=String(e);}).finally(()=>{this.roadblockBusy=false;});
  }
 private exitSlot(seat:number){return [VEHICLE_ANIM.getoutLHS,VEHICLE_ANIM.getoutRHS,VEHICLE_ANIM.getoutRearLHS,VEHICLE_ANIM.getoutRearRHS][seat];}
 /** Native car-space door point for a seat's exit door (front seats use ped_frontseat, rear seats ped_backseat). */
 private doorPoint(car:WorldCar,seat:number){
  const getIn=this.clips.slot(car.animGroup,VEHICLE_ANIM.getinLHS),frame=car.car.nativeFramePosition(seat<2?'ped_frontseat':'ped_backseat');if(!getIn||!frame)return undefined;
  return nativeDoorPoint({x:frame.x,y:frame.y,z:frame.z},clipRootEnd(getIn.clip),car.assets.handling.values.seatOffset,seat%2===0?'left':'right',1);
 }
 /** GenerateRoadBlockPedsForCar: the crew stands beside the car at the native placements (no door exits), on the
  * side away from the player (the positions type is set by the unreversed CreateRoadBlockBetween2Points; authored),
  * facing him, each on the kill task with the pistol (GenerateRoadBlockPedsForCar sets it for city cops, never the
  * shotgun) or the unit's special loadout. */
 private placeRoadblockCrew(u:Unit,maxCount:number){
  const car=u.car,b=car.nativeBody,radius=Math.hypot(b.boundsMax.x-b.boundsMin.x,b.boundsMax.y-b.boundsMin.y,b.boundsMax.z-b.boundsMin.z)/2;
  const special=SPECIAL_COP_CARS.has(car.modelId),count=Math.min(maxCount,u.seats.filter(Boolean).length);
  const p=car.car.body.translation(),player=this.sim.player.position,q=car.car.body.rotation();
  const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y)),right={x:Math.cos(heading),z:-Math.sin(heading)};
  const playerRight=(player.x-p.x)*right.x+(player.z-p.z)*right.z;
  const type:0|1|2=special?2:playerRight>0?0:1;
  const spots=roadblockCrewPlacements(type,count,Math.max(.5,radius/DEFAULT_COP_CAR_RADIUS),special);
  spots.forEach((spot,seat)=>{
   if(!u.seats[seat])return;u.seats[seat]=false;
   // worldPoint takes native car space (x right, y forward, z up): the placement is on the car's ground plane.
   const world=car.worldPoint({x:spot.x,y:spot.y,z:0});
   const hit=this.sim.world.castRay(new RAPIER.Ray({x:world.x,y:world.y+1,z:world.z},{x:0,y:-1,z:0}),4,true,RAPIER.QueryFilterFlags.ONLY_FIXED);
   this.spawnOfficer?.(u.member.model,u.member.weapon,{x:world.x,y:(hit?world.y+1-hit.timeOfImpact:world.y-1)+.03,z:world.z},Math.atan2(player.x-world.x,player.z-world.z),{unit:u,seat,roadblock:true},u.member.accuracy);
  });
 }
 private beginExit(u:Unit,seat:number,wait=0){
  if(!u.seats[seat]||u.leaving.some(l=>l.seat===seat))return;
  const found=this.clips.slot(u.car.animGroup,this.exitSlot(seat));
  if(!found){this.finishExit(u,seat);return;}
  u.leaving.push({seat,clip:found.clip,key:found.key,time:0,door:[DOOR.leftFront,DOOR.rightFront,DOOR.leftRear,DOOR.rightRear][seat],wait});
 }
 /** Crew exiting: CTaskSimpleCarGetOut clips at the door, then CTaskSimpleCarSetPedOut. */
 private stepLeaving(u:Unit,dt:number){
  const car=u.car;
  // The player drives off the car he took before a cop is out of it: CTaskSimpleCarJumpOut, out of his door with the
  // roll-out clip, to get up an officer (AUTHORED, as the leave task's sensible-leave flag is unknown).
  if(u.taken&&u.leaving.length&&!car.canStepOut()){for(const l of u.leaving.splice(0))this.finishExit(u,l.seat,true);return;}
  for(let i=u.leaving.length-1;i>=0;i--){
   const l=u.leaving[i];
   if(l.wait&&l.wait>0){l.wait-=dt;continue;}
   l.time+=dt;
   const ratio=nativeDoorAnimRatio(car.animGroup,'getOut',l.time,car.doors[l.door].ratio,0);if(ratio!==undefined&&!car.doorMissing(l.door))car.openDoor(l.door,ratio);
   if(l.time>=l.clip.duration){u.leaving.splice(i,1);this.finishExit(u,l.seat);}
  }
 }
 private finishExit(u:Unit,seat:number,rollout=false){
  u.seats[seat]=false;const local=this.doorPoint(u.car,seat);
  const world=local?u.car.worldPoint(local):new RAPIER.Vector3(u.car.car.body.translation().x,u.car.car.body.translation().y,u.car.car.body.translation().z);
  const hit=this.sim.world.castRay(new RAPIER.Ray({x:world.x,y:world.y+1,z:world.z},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,this.sim.playerCollider,u.car.car.body);
  // Out of a car the player took, a cop is no longer the unit's: it is let go as soon as he is out.
  const rolled=rollout?this.clips.slot(u.car.animGroup,seat%2===0?VEHICLE_ANIM.rolloutLHS:VEHICLE_ANIM.rolloutRHS):undefined;
  this.spawnOfficer?.(u.member.model,seat===u.shotgunSeat?25:u.member.weapon,{x:world.x,y:(hit?world.y+1-hit.timeOfImpact:world.y-1)+.03,z:world.z},u.car.heading(),u.taken?undefined:{unit:u,seat},u.member.accuracy,rolled&&{key:rolled.key,clip:rolled.clip});
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
  // CWanted::NumOfHelisRequired (none with the law backed off), and none while SWITCH_POLICE_HELIS has them off.
  const need=this.policeHelisAllowed?this.law.native.helisRequired:0;
  this.dropLostHelis();
  // A spare helicopter is dismissed only while nobody is aboard or climbing in or out of it.
  while(this.helis.length>need){let i=this.helis.length-1;while(i>=0&&(this.helis[i].occupied||this.helis[i].entryBusy))i--;if(i<0)break;const h=this.helis.splice(i,1)[0];this.fleet.removePlane(h);this.searchlights.delete(h);}
  if(this.helis.length<need&&!this.heliBusy&&!this.disposed){
   this.heliBusy=true;
   const p=this.sim.player.position;
   void this.fleet.spawnPlane(POLICE_HELI_MODEL,p.x+80,p.z+80,0).then(heli=>{
    // Asked again on arrival: the law may have backed off or SWITCH_POLICE_HELIS gone off meanwhile.
    if(this.disposed||(this.policeHelisAllowed?this.law.native.helisRequired:0)<=this.helis.length){this.fleet.planes.delete(heli);heli.dispose();return;}
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
 /** When a patrol last asked for the path areas round it. */
 private patrolAreasAt=-Infinity;
 /** CCullZones::NoPolice for the player's position (the host's cull zones). */
 noPoliceZone?:()=>boolean;
 beforeStep(dt:number,playerCar?:WorldCar){
  this.seconds+=dt;
  // A car the fleet or a script let go since the last dispatch update (which prunes once a second) is gone: its
  // body is freed, and reading it would panic the physics world.
  for(let i=this.units.length-1;i>=0;i--)if(this.units[i].car.disposed||!this.units[i].car.car.body.isValid())this.units.splice(i,1);
  if(playerCar&&(playerCar.disposed||!playerCar.car.body.isValid())){
   if(import.meta.env?.DEV)console.warn('Police step: the player\'s car has no body',{disposed:playerCar.disposed,occupied:playerCar.occupied,model:playerCar.modelId});
   playerCar=undefined;
  }
  this.updateHelis(playerCar);
  this.generateRoadBlocks(!!(playerCar||this.fleet.occupied||this.fleet.occupiedBike||this.fleet.occupiedBoat||this.fleet.occupiedPlane));
  this.updateAlarms(dt);
  const player=this.sim.player.position,target=playerCar?playerCar.car.body.translation():player,targetVelocity=playerCar?playerCar.car.body.linvel():{x:0,y:0,z:0};
  const playerSpeed=playerCar?Math.hypot(targetVelocity.x,targetVelocity.z)/50:this.sim.player.speed/50;
  // CCarAI's chase gates: the level is clean, or PoliceBackOff() (SET_POLICE_IGNORE_PLAYER, the garage, everybody's
  // back-off), or the player stands in a no-police cull zone.
  const chaseOff=!this.law.level||this.law.native.backOff||!!this.noPoliceZone?.();
  for(const u of this.units){
   const car=u.car;u.seconds+=dt;
   if(car.wrecked){car.autopilot=undefined;continue;}
   if(car.occupied){car.autopilot=undefined;this.stepLeaving(u,dt);continue;}
   car.obstructingEntity=undefined;
   // The player dragged the driver out (CreateDragPedOutSubTask): his seat is empty from then on.
   if(car.driverOut&&(u.seats[0]||u.deadSeats[0])&&!u.leaving.some(l=>l.seat===0)){u.seats[0]=false;u.deadSeats[0]=false;}
   this.stepLeaving(u,dt);
   // Roadblock crews hold the block instead of reboarding while it stands.
   if(u.mission!=='roadblock'&&!u.taken)this.recallCrew(u,dt,playerCar);
   for(let i=u.entering.length-1;i>=0;i--){
    const e=u.entering[i];e.time+=dt;
    if(e.phase==='open'||e.phase==='closeInside'){const ratio=nativeDoorAnimRatio(car.animGroup,e.phase,e.time,car.doors[e.door].ratio,e.group);if(ratio!==undefined&&!car.doorMissing(e.door))car.openDoor(e.door,ratio);}
    if(e.time>=e.clip.duration){u.entering.splice(i,1);this.afterEntryPhase(u,e.seat,e.phase);}
   }
   // Bust pull: a stopped unit's crew at the suspect's door drags the driver
   // out so the foot arrest (CTaskSimpleArrestPed) can proceed. Roadblock
   // crews hold their block the same way when the suspect stops at it.
   if(!chaseOff&&(u.mission==='stopped'||u.mission==='roadblock')&&playerCar&&!playerCar.wrecked&&arrestOpensDriverDoor(playerCar.car.body.rotation())){
    const pv=playerCar.car.body.linvel(),pp=playerCar.car.body.translation();
    const carStopped=Math.hypot(pv.x,pv.z)<2;
    const atDoor=(this.crew?.list(u)??[]).some(c=>!c.down&&Math.hypot(c.position.x-pp.x,c.position.z-pp.z)<BUST_PULL_RANGE);
    u.pullTimer=bustPullProgress(u.pullTimer,dt,carStopped&&atDoor);
    if(u.pullTimer>=BUST_PULL_SECONDS){u.pullTimer=0;this.onPullFromCar?.(playerCar);}
   }else if(!chaseOff&&(u.mission==='stopped'||u.mission==='roadblock')&&!playerCar&&this.fleet.occupiedBike&&!this.fleet.occupiedBike.wrecked){
    // CTaskComplexArrestPed::CreateFirstSubTask: a suspect on a bike or quad gets TASK_COMPLEX_DRAG_PED_FROM_CAR, the
    // crew cop at the stopped bike pulling him off (CTaskSimpleBikeJacked) for the foot arrest.
    const bike=this.fleet.occupiedBike,bv=bike.body.linvel(),bp=bike.body.translation();
    const atBike=(this.crew?.list(u)??[]).some(c=>!c.down&&Math.hypot(c.position.x-bp.x,c.position.z-bp.z)<BUST_PULL_RANGE);
    u.pullTimer=bustPullProgress(u.pullTimer,dt,Math.hypot(bv.x,bv.z)<2&&atBike);
    if(u.pullTimer>=BUST_PULL_SECONDS){u.pullTimer=0;this.onPullFromBike?.(bike);}
   }else u.pullTimer=0;
   // Roadblock units hold across the road with their crew out; the block dissolves once the level
   // is clean or the player leaves, and the crew then reboards through recallCrew.
   if(u.mission==='roadblock'){
    car.autopilot={throttle:0,brake:1,steering:0,handbrake:true};
    const p0=car.car.body.translation();
    // CTaskComplexPolicePursuit gives a roadblock cop up only once the level is clean; the block stands while any stars
    // remain (and is left once the player is far off, the browser's removal).
    if(!this.law.level||Math.hypot(target.x-p0.x,target.z-p0.z)>120){u.mission='far';u.siren=false;}
    continue;
   }
   // CTaskComplexDieInCar: the shot driver coasts for 2000 ms, then leaves and dies if the car is still, else dies in his seat.
   if(u.driverDying){
    if(u.seconds>=u.driverDying.at+DIE_IN_CAR_OFFSET_MS/1000){
     u.driverDying=undefined;
     const v=car.car.body.linvel(),w=car.car.body.angvel(),r=car.car.body.rotation(),upZ=1-2*(r.x*r.x+r.z*r.z);
     if(canPedStepOutCar(upZ,{x:v.x/50,y:-v.z/50,z:v.y/50},{x:w.x/50,y:-w.z/50,z:w.y/50})){u.seats[0]=false;this.onCrewDiesOut?.(car,u.member.model);car.driverOut=true;}
     else{u.deadSeats[0]=true;car.driverDead=true;}
    }
    car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};continue;
   }
   if(u.deadSeats[0]){const v=car.car.body.linvel();car.autopilot={throttle:0,brake:1,steering:0,handbrake:Math.hypot(v.x,v.z)<.3};continue;}
   if(!u.seats[0]&&!u.leaving.some(l=>l.seat===0)){car.autopilot=undefined;car.driverOut=true;continue;}
   const p=car.car.body.translation(),q=car.car.body.rotation(),v=car.car.body.linvel(),speed=Math.hypot(v.x,v.z),distance=Math.hypot(target.x-p.x,target.z-p.z);
   const heading=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.x*q.x+q.y*q.y)),forward={x:-Math.sin(heading),z:-Math.cos(heading)};
   // CSetPiece cars: MISSION_SLOWLY_DRIVE_TOWARDS_PLAYER_1 heads for its destination; within 1.5 it becomes _2, whose
   // crew leaves the car and stops for good once the player is within 13 or beyond 70, or no longer wanted.
   if(u.mission==='slowly1'&&u.goal&&Math.hypot(u.goal.x-p.x,u.goal.y+p.z)<=1.5)u.mission='slowly2';
   if(u.mission==='slowly2'&&(distance<=13||distance>=70||chaseOff)){
    u.mission='stopped';u.goal=undefined;for(let seat=0;seat<4;seat++)this.beginExit(u,seat);
    car.autopilot={throttle:0,brake:1,steering:0,handbrake:true};continue;
   }
   // CCarAI::BackToCruisingIfNoWantedLevel: back to cruising in a no-police zone too, where the car takes no mission
   // at all (MISSION_NONE: it stops where it is).
   if(chaseOff&&u.mission!=='slowly1'&&u.mission!=='slowly2'){u.mission='cruise';u.siren=false;if(this.noPoliceZone?.()){car.autopilot={throttle:0,brake:1,steering:0,handbrake:speed<.5};continue;}}
   else if(u.mission==='cruise')u.mission='far';
   // CCarAI::UpdateCarAI switch distances: close within the straight-line distance 20, or head-on within 40; far beyond 50.
   // CCarAI::EntitiesGoHeadOn(player, car): the player (his ped, which faces as his car does) faces the car and the
   // car faces the player, each within 0.8 of the line between them.
   const playerForward=playerCar?(()=>{const r=playerCar.car.body.rotation(),h=Math.atan2(2*(r.w*r.y+r.x*r.z),1-2*(r.x*r.x+r.y*r.y));return {x:-Math.sin(h),z:-Math.cos(h)};})():{x:Math.sin(this.sim.player.heading),z:Math.cos(this.sim.player.heading)};
   const between={x:this.sim.player.position.x-p.x,z:this.sim.player.position.z-p.z},bl=Math.hypot(between.x,between.z)||1,dx=between.x/bl,dz=between.z/bl;
   const headOn=playerForward.x*dx+playerForward.z*dz<=-.8&&forward.x*dx+forward.z*dz>=.8&&distance<40;
   if(u.mission==='far'&&(distance<=20||headOn)){u.mission='close';u.siren=true;}
   else if(u.mission==='close'&&distance>50){u.mission='far';u.siren=false;}
   // RAM/BLOCK close: the crew gets out beside a player on foot, flipped, or stopped in a car for 2500 ms.
   // Police cars run BLOCKPLAYER (FindPoliceCarMissionForWantedLevel), whose UpdateCarAI branch counts the player's
   // car as stopped under 0.04 units a frame (RAMPLAYER's 0.05 is for other rammers), and m_nCopsInCarTimer, run only
   // in the close mission, adds TimeStep x 1000/60 a frame towards its 2500.
   const playerStopped=!playerCar||playerSpeed*playerSpeed<.04*.04;
   u.slowTimer=u.mission==='close'&&playerStopped?u.slowTimer+dt*50*1000/60:0;
   const upsideDown=!!playerCar&&(()=>{const r=playerCar.car.body.rotation();return 1-2*(r.x*r.x+r.z*r.z)<0;})();
   // A Rhino's crew gets out only when its random seed is over 10000 (of 32768).
   u.seed??=Math.floor(this.random()*65536);
   const crewMayLeave=car.modelId!==432||u.seed%32768>10000;
   if(u.mission==='close'&&distance<=10&&crewMayLeave&&(!playerCar||upsideDown||playerStopped&&u.slowTimer>2500)){
    u.mission='stopped';for(let seat=1;seat<4;seat++)this.beginExit(u,seat);
    // The siren goes off with the crew at one star or none.
    if(this.law.level<=1)u.siren=false;
    // CTaskComplexCopInCar's driver waits before leaving; one without the task leaves with the passengers.
    u.driverExitAt=u.seconds+copDriverExitDelay({copInCar:hasCopInCarTask(car.modelId,u.wanted),firstStop:u.firstStop!==false,random:this.random});
   }
   if(u.mission==='stopped'){
    car.autopilot={throttle:0,brake:1,steering:0,handbrake:speed<.5};
    // CTaskComplexCopInCar's waiting driver: the suspect driving off in another car (not crawling within 10 units)
    // resumes the drive mission at once, and the next stop waits the short time.
    if(u.driverExitAt!==undefined&&u.seats[0]&&hasCopInCarTask(car.modelId,u.wanted)&&playerCar&&playerCar!==car&&!suspectCarCrawling(playerSpeed,distance)){u.mission='far';u.driverExitAt=undefined;u.firstStop=false;continue;}
    if(u.driverExitAt!==undefined&&u.seconds>=u.driverExitAt){u.driverExitAt=undefined;this.beginExit(u,0);}
    if(distance>50&&u.seats[0]&&!u.leaving.length){u.mission='far';u.driverExitAt=undefined;}
    continue;
   }
   // CCarAI::UpdateCarAI resets a ram or block mission's cruise to FindPoliceCarSpeedForWantedLevel every frame;
   // MellowOutChaseSpeed only runs on the frame the car falls back to far, so it never holds there. A suspect on
   // foot is MISSION_APPROACHPLAYER_CLOSE (CTaskComplexCopInCar), which runs MellowOutChaseSpeed every frame: at one
   // or two stars the car creeps up at 5 within 20 units, 13 or 18 within 40, and 10 near a suspect standing still.
   let cruise=u.mission==='cruise'?12:policeCruiseSpeed(this.law.level,car.assets.handling.maxFlatVelocity,()=>.5);
   if(!playerCar&&u.mission==='close'){const pp=this.sim.player.position;cruise=mellowChaseSpeed(this.law.level,Math.hypot(pp.x-p.x,pp.y-p.y,pp.z-p.z),false,playerSpeed,cruise);}
   // CCarCtrl::SteerAICarWithPhysics_OnlyMission (VC; see nativeCarCtrl.ts), in native space.
   const nq=new Quaternion(q.x,q.y,q.z,q.w),f3=toNative(new Vector3(0,0,-1).applyQuaternion(nq)),fl=Math.hypot(f3.x,f3.y)||1;
   const state={position:{x:p.x,y:-p.z},forward:{x:f3.x/fl,y:f3.y/fl},moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},forward3:f3};
   const goal={x:target.x,y:-target.z};u.seed??=Math.floor(this.random()*65536);
   let pedals:Pedals|undefined,aim:{x:number;z:number}={x:target.x-p.x,z:target.z-p.z};
   // A land law car halts at the water's edge rather than driving in after a swimming or boating suspect.
   if(lawVehicleWaits({wanted:this.law.level,unitBoat:false,player:this.fleet.occupiedBoat?'boat':this.fleet.occupiedPlane?'aircraft':this.sim.player.swimming?'swimming':'land'})){car.autopilot={throttle:0,brake:1,steering:0,handbrake:speed<.5};continue;}
   if(u.goForwardUntil!==undefined){
    // SetupQuickCar's TEMPACT_GOFORWARD for 100 ms.
    u.goForwardUntil-=dt;if(u.goForwardUntil<=0)u.goForwardUntil=undefined;
    car.autopilot={throttle:1,brake:0,steering:0,handbrake:false};continue;
   }
   // JoinCarWithRoadSystem for a unit on no link yet: an ambient patrol is made on the road with no route of its own,
   // and without a link fell through to heading straight for the player, wanted or not (patrol cars drove into
   // SWEET1's Greenwood at the tags and pinned it).
   // The path areas are loaded round the player only when a dispatch runs (wanted), so a patrol asks for its own.
   if(this.paths&&!u.link){
    const joined=joinCarWithRoadSystem(this.paths.areas,{x:p.x,y:-p.z,z:p.y},state.forward);
    if(joined){u.link=joined;u.lane=u.nextLane=0;u.route=[];u.routeAt=-Infinity;}
    else if(this.seconds-this.patrolAreasAt>2){this.patrolAreasAt=this.seconds;void this.paths.loadAround(p.x,p.z).catch(e=>{this.error=String(e);});}
   }
   // A cruising unit with no road to follow yet waits where it is (full brake and the handbrake: the brake pedal alone
   // reverses a car at a standstill) rather than drive at the player.
   if(u.mission==='cruise'&&!u.link){car.autopilot={throttle:0,brake:0,steering:0,handbrake:false,native:{steerAngle:0,gas:0,brake:1,handbrake:true}};continue;}
   if(u.mission==='slowly1'||u.mission==='slowly2'){
    // The set-piece mission's steering is in the unreversed SteerAICarWithPhysics: straight at the destination, then
    // at the player, at the set piece's cruise speed.
    pedals=steerHeadingForTarget(state,u.mission==='slowly1'&&u.goal?u.goal:goal,u.cruise);
   }else if(u.mission==='close'&&playerCar){
    // MISSION_BLOCKPLAYER_CLOSE and BLOCKPLAYER_HANDBRAKESTOP (re3's steering; SA's is unreversed): head for the
    // player's spot a second of his speed ahead, and within 5 of it stop on the handbrake until he is 10 away.
    const blockTarget=blockPlayerTarget(goal,{x:targetVelocity.x/50,y:-targetVelocity.z/50});
    if(u.blockStop){if(distance>STOP_TO_BLOCK_DISTANCE)u.blockStop=false;pedals={swerve:0,accel:0,brake:1,handbrake:true};}
    else{if(Math.hypot(blockTarget.x-state.position.x,blockTarget.y-state.position.y)<BLOCK_TO_STOP_DISTANCE)u.blockStop=true;pedals=steerHeadingForTarget(state,blockTarget,cruise);}
    aim={x:blockTarget.x-p.x,z:-blockTarget.y-p.z};
   }else if(u.mission==='close'){
    // MISSION_APPROACHPLAYER_CLOSE for the suspect on foot: straight at him (the steering is unreversed).
    pedals=steerHeadingForTarget(state,goal,cruise);
   }else if(this.paths&&u.link){
    // FARAWAY missions route over the car path network to the node nearest the player, refreshed every 3 s or when the player moves 20 units.
    if(u.mission==='far'&&(this.seconds-u.routeAt>3||!u.routeGoal||Math.hypot(u.routeGoal.x-target.x,u.routeGoal.z-target.z)>20)){u.routeAt=this.seconds;u.routeGoal={x:target.x,y:target.y,z:target.z};u.route=findTrafficRoute(this.paths.areas,u.link.to,u.routeGoal)??[];}
    // PickNextNodeRandomly keeps a car already on switched-off or no-wander road (Grove Street's) able to go on over
    // it; with only the open roads allowed there, a patrol made there had nowhere to go.
    const closedRoad=(link:TrafficLink)=>link.from.switchedOff||link.from.dontWander||link.to.switchedOff||link.to.dontWander;
    const continuation=(link:TrafficLink)=>{const options=trafficLinks(this.paths!.areas,link.to,u.mission==='far'||closedRoad(link)).filter(n=>n.to!==link.from);return options.length?options[Math.floor(this.random()*options.length)]:undefined;};
    // PickNextNodeRandomly picks the cruising continuation once per node change, not every step: keep it per link.
    const cruiseNext=(link:TrafficLink)=>{if(!u.cruiseNext||u.cruiseNext.from!==link.to)u.cruiseNext=continuation(link);return u.cruiseNext;};
    let link=u.link,next=u.mission==='far'&&u.route.length?u.route[0]:cruiseNext(link);
    u.lane??=0;u.nextLane??=0;
    // SteerAICarWithPhysicsFollowPath's node change: PickNextNodeToChaseCar along the route, PickNextNodeRandomly when cruising.
    if(next&&next.from===link.to&&shouldPickNextNode(state,travel(link),u.lane,travel(next),u.nextLane)){
     if(u.mission==='far'&&u.route[0]===next)u.route.shift();
     u.link=link=next;u.lane=u.nextLane;u.cruiseNext=undefined;next=u.mission==='far'&&u.route.length?u.route[0]:cruiseNext(link);
     // Vice City's lane change: a lane over one time in four on a segment of 14 or more (the patrol's pick is not
     // PickNextNodeRandomly's).
     if(next){const change=this.random()<.25,right=this.random()<.5;u.nextLane=nextLaneOnLink(u.lane,pathDirection(next.from.address,next.to.address,next.navigation).lanes,change&&next.length>=14,right);}
    }
    let here=lanePoint(travel(link),u.lane),t=travel(link);
    // Thrown off its link (12 across it, or 3 above or below the road), or stuck through two recoveries: rejoin the
    // road system where the car is (JoinCarWithRoadSystem) and route again from there. SA's chase steering is a stub,
    // so when to rejoin is the browser's.
    const roadZ=(link.from.position[2]+link.to.position[2])/2;
    const offRoute=Math.abs((state.position.x-here.x)*t.forward.y-(state.position.y-here.y)*t.forward.x)>12||Math.abs(p.y-roadZ)>3||u.recoveryMode>=2&&!!u.recovery;
    if(offRoute&&this.seconds-(u.joinedAt??-Infinity)>2){
     const joined=joinCarWithRoadSystem(this.paths.areas,{x:p.x,y:-p.z,z:p.y},state.forward);
     if(joined){u.joinedAt=this.seconds;u.link=link=joined;u.lane=u.nextLane=0;u.routeAt=-Infinity;u.route=[];next=continuation(link);here=lanePoint(travel(link),0);t=travel(link);}
    }
    // With no road left toward the player, drive straight at him; a cruising unit at a dead end drives to its end.
    if(!next||next.from!==link.to)pedals=steerHeadingForTarget(state,u.mission==='cruise'?{x:link.to.position[0],y:link.to.position[1]}:goal,cruise);
    else{
     // Police drive under DRIVINGSTYLE_AVOID_CARS in pursuit (no traffic or lights); a cruising unit stops for lights.
     const stop=u.mission==='cruise'&&nativeShouldStopForLight({position:[state.position.x,state.position.y],appearance:'car',physicsStatus:true,
      current:{navigation:link.navigation,routeAddress:link.to.address,travelSign:link.dx*link.navigation.direction[0]-link.dz*link.navigation.direction[1]>=0?1:-1}},Math.floor(this.seconds*1000)>>>0);
     // A cruising unit drives DRIVINGSTYLE_STOP_FOR_CARS like the traffic it is part of: FindMaximumSpeedForThisCarInTraffic
     // slows it for the cars ahead. Taking its cruise speed as the traffic speed, a patrol car drove into a car
     // stopped in its lane and kept pushing it (SWEET1's Greenwood pinned against a wall at a tag).
     const trafficSpeed=u.mission==='cruise'?this.cruiseTrafficSpeed(car,cruise):cruise;
     pedals=steerFollowPath(state,t,u.lane,travel(next),{cruiseSpeed:cruise,trafficSpeed,stop});
     aim={x:here.x-p.x,z:-here.y-p.z};
    }
   }
   pedals??=steerHeadingForTarget(state,goal,cruise);
   u.aim={x:+(p.x+aim.x).toFixed(1),z:+(p.z+aim.z).toFixed(1)};
   // CCarAI stuck recovery: under 0.012 units/frame for 1000 ms reverses 1500, 4000 ms, then left and right for 2500 ms.
   if(u.recovery){
    u.recovery.remaining-=dt;car.autopilot={throttle:0,brake:1,steering:u.recovery.kind===2?-1:u.recovery.kind===3?1:0,handbrake:false};
    if(u.recovery.remaining<=0)u.recovery=undefined;continue;
   }
   if(speed/50<=.012&&u.mission!=='cruise'){u.stuck+=dt;if(u.stuck>1){u.stuck=0;u.recoveryMode=this.seconds-u.lastRecovery>=10?0:(u.recoveryMode+1)%4;u.lastRecovery=this.seconds;u.recovery={kind:u.recoveryMode,remaining:[1.5,4,2.5,2.5][u.recoveryMode]};}}
   else u.stuck=0;
   car.autopilot={steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
  }
 }
 /** CCarCtrl::FindMaximumSpeedForThisCarInTraffic under STOP_FOR_CARS (SlowCarDownForCarsSectorList): the lowest speed
  * any vehicle ahead allows, as WorldTraffic works it out for random traffic (the patrol car's m_SpeedMult is taken
  * as 1). */
 private cruiseTrafficSpeed(car:WorldCar,cruise:number){
  const others=[...this.fleet.cars].filter(o=>o!==car&&!o.disposed).map(o=>({...o.dangerView(),vehicle:o}));
  return slowCarDownForCars(car.dangerView(),others,cruise,cruise,(other,_proximity,speed)=>{car.obstructingEntity=other.vehicle;return speed;}).speed;
 }
 /** The cop at the wheel of a unit's car (every seat holds the unit's model; the driver's gun is the shotgun when he
  * was handed it), for the ped the player drags out or who leaves it. */
 driverOf(car:WorldCar){
  const u=this.units.find(u=>u.car===car);
  return u&&{model:u.member.model,officer:{weapon:u.shotgunSeat===0?25:u.member.weapon,accuracy:u.member.accuracy}};
 }
 /** The cop in the front passenger seat of a unit's car (CCarEnterExit::ComputeSlowJackedPed for the right front
  * door, m_apPassengers[0]), alive or dead, unless he is getting in or out. */
 frontPassengerOf(car:WorldCar){
  const u=this.units.find(u=>u.car===car);
  if(!u||!u.seats[1]||u.leaving.some(l=>l.seat===1)||u.entering.some(e=>e.seat===1))return undefined;
  return {model:u.member.model,officer:{weapon:u.shotgunSeat===1?25:u.member.weapon,accuracy:u.member.accuracy},dead:u.deadSeats[1]};
 }
 /** The player is dragging the front passenger out: the car entry draws him from now on. */
 dragPassenger(car:WorldCar){const u=this.units.find(u=>u.car===car);if(u){u.seats[1]=false;u.deadSeats[1]=false;u.seatHealth[1]=100;}}
 /** CCarEnterExit::MakeUndraggedPassengerPedsLeaveCar (0x64F540, unreversed in gta-reversed; iOS 0x1003e9564), run by
  * CTaskComplexEnterCar once the player is in his seat. Every passenger but the one dragged out (and one flagged
  * bStayInCarOnJack) gets CEventPedEnteredMyVehicle; a dead one is passed over. ComputePedEnteredVehicleResponse
  * (0x10029f874) answers it by the decision maker with a leave task by the ped's own door after (rand() & 0xffff) /
  * 65536 × 300 + 300 ms. Which leave task a cop's decision maker picks is not decoded (AUTHORED: CTaskComplexLeaveCar,
  * and he goes on as an officer on foot). */
 crewLeave(car:WorldCar){
  const u=this.units.find(u=>u.car===car);if(!u)return;
  u.taken=true;u.returning.clear();
  // A cop still climbing in steps back out at his door.
  for(const e of u.entering.splice(0))if(e.seat)this.finishExit(u,e.seat);
  for(let seat=1;seat<4;seat++)if(u.seats[seat]&&!u.deadSeats[seat])this.beginExit(u,seat,pedEnteredVehicleLeaveDelay(Math.floor(this.random()*65536)));
 }
 /** Whether a unit's driver is in his seat (alive or dead), not getting in or out; undefined for any other car. */
 driverSeated(car:WorldCar){
  const u=this.units.find(u=>u.car===car);
  return u&&u.seats[0]&&!u.leaving.some(l=>l.seat===0)&&!u.entering.some(e=>e.seat===0);
 }
 /** Seated and leaving crews for the occupant renderer. */
 poses():PolicePose[]{
  const out:PolicePose[]=[];
  for(const u of this.units){
   if(u.car.wrecked)continue;
   // In a car the player has taken only the crew getting out are drawn.
   const taken=u.car.occupied;
   for(let seat=0;seat<4;seat++){
    const leaving=u.leaving.find(l=>l.seat===seat)??(taken?undefined:u.entering.find(e=>e.seat===seat));
    if(!leaving&&taken)continue;
    if(leaving){const local=this.doorPoint(u.car,seat);if(local)out.push({car:u.car,seat,model:u.member.model,local,clip:leaving.key,seconds:leaving.time,animation:leaving.clip});continue;}
    if(!u.seats[seat])continue;
    // A driver the player has started to drag out is drawn by the car entry from that frame (beforeStep clears his seat).
    if(seat===0&&u.car.driverOut)continue;
    const frame=u.car.car.nativeFramePosition(seat<2?'ped_frontseat':'ped_backseat');if(!frame)continue;
    // A cop dead in his seat holds CAR_dead_LHS/RHS on its last frame.
    const dead=u.deadSeats[seat];
    const pose=nativeCarSeatPose({x:seat%2===0?-Math.abs(frame.x):Math.abs(frame.x),y:frame.y,z:frame.z},seat===0?'driver':seat-1,u.car.animGroup.id);
    out.push({car:u.car,seat,model:u.member.model,...pose,clip:dead?(seat===0?'car_dead_lhs':'car_dead_rhs'):sitClip(u.car.modelFlags,seat===0),seconds:dead?1e6:0});
   }
  }
  return out;
 }
 snapshot(){return {ready:!!this.paths,pending:this.busy,error:this.error??null,lastRappel:this.lastRappel,helis:this.helis.map(h=>({modelId:h.modelId,position:{...h.body.translation()},speed:Math.hypot(h.body.linvel().x,h.body.linvel().z),occupied:h.occupied,searchlight:this.searchlights.get(h)??{locked:false,illuminated:false,distance:0}})),units:this.units.map(u=>({handle:u.car.car.body.handle,modelId:u.car.modelId,mission:u.mission,siren:u.siren,crew:u.seats.filter(Boolean).length,health:[...u.seatHealth],dead:[...u.deadSeats],dying:!!u.driverDying,leaving:u.leaving.length,entering:u.entering.map(e=>({seat:e.seat,phase:e.phase})),returning:u.returning.size,position:{...u.car.car.body.translation()},speed:Math.hypot(u.car.car.body.linvel().x,u.car.car.body.linvel().z),recovery:u.recovery?.kind??null,route:u.route.length,routeEnd:u.route.at(-1)?.to.position??null,routeGoal:u.routeGoal??null,link:u.link?{from:u.link.from.position,to:u.link.to.position}:null,aim:u.aim??null}))};}
 dispose(){this.disposed=true;for(const u of this.units)this.fleet.removeTrafficCar(u.car);this.units.length=0;for(const h of this.helis){this.fleet.planes.delete(h);h.dispose();}this.helis.length=0;this.searchlights.clear();}
}
