import {Quaternion,Vector3} from 'three';
import type {PathArea} from '../assets/pathNodes';
import {pathDirection} from '../assets/pathDirection';
import {nativeShouldStopForLight} from '../world/nativeSignalStop';
import {lanePoint,nextLaneOnLink,pickNextNodeRandomly,ramPlayerCloseTarget,shouldPickNextNode,steerFollowPath,steerHeadingForTarget,tempActionPedals,turnPedals,type Pedals} from '../vehicle/nativeCarCtrl';
import {slowCarDownForCars,type DangerView} from '../vehicle/nativeCarCtrl';
import {findTrafficRoute,joinCarWithRoadSystem,trafficLinks,travelLink as travel,type TrafficLink} from './trafficRoute';
import type {WorldCar} from './WorldCar';
/** What CAutoPilot drives: a car, or a bike, whose rider takes the same pedals (CBike::ProcessControlInputs). */
export interface ScriptDrivable {
 readonly car:{body:import('@dimforge/rapier3d-compat').RigidBody};
 readonly wrecked:boolean;readonly disposed:boolean;readonly occupied:boolean;scriptDriven?:boolean;
 readonly nativeBody:{boundsMin:{x:number;y:number;z:number};boundsMax:{x:number;y:number;z:number}};
 autopilot?:WorldCar['autopilot'];
 autopilotFields?:{stayInSlowLane?:number};
}

/* CCarAI's coordinate missions for the cars a script drives (TASK_CAR_DRIVE_TO_COORD's CTaskComplexDriveToPoint).
 *
 * CCarAI::GetCarToGoToCoors(Accurate/StraightLine) and UpdateCarAI's switching are reversed (CarAI.cpp):
 * - GOTOCOORDINATES follows the road toward the target and turns to STRAIGHTLINE inside FindSwitchDistanceClose, the
 *   autopilot's m_nStraightLineDistance (20 unless SET_CAR_STRAIGHT_LINE_DISTANCE says otherwise).
 * - STRAIGHTLINE heads for the target and clears the mission inside 3 units (1 for the accurate pair). Past the
 *   straight-line distance + 5 it rejoins the road, checked every eighth frame.
 * - JoinCarWithRoadSystemGotoCoors is unreversed. Vice City's answers "go straight" when the path search finds fewer
 *   than two nodes, which is what a missing route means here.
 * The path following and the stuck recovery are the police units' (see WorldPolice), as CCarCtrl's SA steering is a
 * stub. Traffic avoidance is not modelled: STOP_FOR_CARS and SLOW_DOWN_FOR_CARS only stop at red lights. */

/** eCarMission, the ones a script's drive asks for. */
export type ScriptCarMissionKind='gotoCoords'|'gotoCoordsStraight'|'gotoCoordsAccurate'|'gotoCoordsStraightAccurate'|'cruise'|'none'
 |'ramPlayerFar'|'ramPlayerClose'|'blockPlayerFar'|'blockPlayerClose'|'blockPlayerStop'
 |'ramCarFar'|'ramCarClose'|'blockCarFar'|'blockCarClose'|'blockCarStop'
 |'emergencyStop'|'stopForever'|'escort'|'escortFar';
/** eCarMission's numbers for TASK_CAR_MISSION, and the kind each starts as. */
export const CAR_MISSION:Readonly<Record<number,ScriptCarMissionKind>>={0:'none',1:'cruise',2:'ramPlayerFar',3:'ramPlayerClose',4:'blockPlayerFar',
 5:'blockPlayerClose',6:'blockPlayerStop',10:'emergencyStop',11:'stopForever',15:'ramCarFar',16:'ramCarClose',17:'blockCarFar',18:'blockCarClose',
 19:'blockCarStop',29:'escort',30:'escort',31:'escort',32:'escort',57:'escortFar',58:'escortFar',59:'escortFar',60:'escortFar'};
/** MISSION_ESCORT_LEFT, _RIGHT, _REAR and _FRONT (29-32) and their FARAWAY forms. */
export type EscortSide='left'|'right'|'rear'|'front';
export const escortSide=(mission:number):EscortSide|undefined=>(['left','right','rear','front'] as const)[mission>=57?mission-57:mission-29];
/** The kinds that follow the road toward a goal (SteerAICarWithPhysicsFollowPath), a moving one for the FARAWAY missions. */
const ROAD_KINDS:ReadonlySet<ScriptCarMissionKind>=new Set(['gotoCoords','gotoCoordsAccurate','ramPlayerFar','blockPlayerFar','ramCarFar','blockCarFar','escortFar']);
/** VC's SteerAICarWithPhysicsTryingToBlockTarget: the target's speed counted up to 0.13 a frame, and the handbrake stop
 * inside 5 units, back to blocking past 10. */
export const MAX_SPEED_TO_ACCOUNT_IN_INTERCEPTING=.13,DISTANCE_TO_SWITCH_FROM_BLOCK_TO_STOP=5,DISTANCE_TO_SWITCH_FROM_STOP_TO_BLOCK=10;
/** Where a blocking car heads: the target's position plus its speed (capped) times GAME_SPEED_TO_CARAI_SPEED, native 2-D. */
export function blockTargetPoint(target:{x:number;y:number},speed:{x:number;y:number}){
 const length=Math.hypot(speed.x,speed.y),k=length>MAX_SPEED_TO_ACCOUNT_IN_INTERCEPTING?MAX_SPEED_TO_ACCOUNT_IN_INTERCEPTING/length:1;
 return {x:target.x+speed.x*k*60,y:target.y+speed.y*k*60};
}
/** The escort's station beside, behind or ahead of the car it escorts (CCarCtrl::SteerAICarTowardsPointInEscort is
 * unreversed, so the spacing is authored): a lane-width gap beside the pair's widths, or four units past their
 * lengths, native 2-D. */
export function escortStation(side:EscortSide,target:{position:{x:number;y:number};forward:{x:number;y:number};halfWidth:number;halfLength:number},own:{halfWidth:number;halfLength:number}){
 const right={x:target.forward.y,y:-target.forward.x};
 const across=target.halfWidth+own.halfWidth+2,along=target.halfLength+own.halfLength+4;
 switch(side){
  case 'left':return {x:target.position.x-right.x*across,y:target.position.y-right.y*across};
  case 'right':return {x:target.position.x+right.x*across,y:target.position.y+right.y*across};
  case 'rear':return {x:target.position.x-target.forward.x*along,y:target.position.y-target.forward.y*along};
  case 'front':return {x:target.position.x+target.forward.x*along,y:target.position.y+target.forward.y*along};
 }
}
/** Where the player is, for the missions against him: his position, the car he drives (if any) and his speed, renderer
 * space, units a second. */
export interface ScriptCarPlayer{position:{x:number;y:number;z:number};vehicle?:WorldCar;velocity:{x:number;y:number;z:number}}
/** SteerAICarWithPhysics_OnlyMission's MISSION_NONE (VC): no swerve or gas, half brake, the handbrake on. */
/** The last-resort unstick: seconds without headway, and how near the player it never happens. */
export const UNSTICK_SECONDS=8,UNSTICK_NEAR=15;
export const HOLD:Pedals={swerve:0,accel:0,brake:.5,handbrake:true};
/** eCarDrivingStyle. */
export const DRIVINGSTYLE={stopForCars:0,slowDownForCars:1,avoidCars:2,ploughThrough:3,stopForCarsIgnoreLights:4} as const;

interface Mission{
 kind:ScriptCarMissionKind;
 /** m_vecDestinationCoors, renderer space. */
 goal:{x:number;y:number;z:number};
 cruise:number;style:number;straightLineDistance:number;
 link?:TrafficLink;lane:number;nextLane:number;route:TrafficLink[];cruiseNext?:TrafficLink;joinedAt:number;
 stuck:number;recoveryMode:number;lastRecovery:number;recovery?:{kind:number;remaining:number};
 /** Seconds without headway, for the last-resort unstick. */
 jammed?:number;
 /** m_nTempAction and the time left of it (m_nTempActionTime). */
 temp?:{action:number;remaining:number};
 /** m_TargetEntity for the car missions; nothing for the player's. */
 target?:WorldCar;
 escort?:EscortSide;
 /** When the moving goal's route was last worked out, and for where. */
 routeAt?:number;routeGoal?:{x:number;y:number;z:number};
 /** TEMPACT_TURNLEFT or TURNRIGHT the ram sets for 250 ms beside the player's car. */
 turn?:{dir:'left'|'right';until:number};
 /** m_nRandomSeed's low byte, for the ram's side. */
 seed:number;
}
/** eAutoPilotTempAction, the ones the scripts use. */
export const TEMPACT={wait:1,reverse:3,handbrakeTurnLeft:4,handbrakeTurnRight:5,handbrakeStraight:6,turnLeft:7,turnRight:8,goForward:9,
 reverseLeft:13,reverseRight:14,reverseStraight:22,brake:24} as const;
/** CCarCtrl::SteerAICarWithPhysics for a temporary action; SA's steerer is a stub, so these are Vice City's where VC has
 * the action (wait, reverse, the handbrake turns, the turns, go forward) and plain readings of the SA-only ones: the
 * reverses with the wheel full left, full right or straight, and TEMPACT_BRAKE's full brake. */
export function scriptTempActionPedals(action:number,remainingMs:number,o:{follow?:Pedals;forwardSpeed:number}):Pedals|undefined{
 const rolling=o.forwardSpeed>.04,back=(swerve:number):Pedals=>({swerve,accel:rolling?0:-.5,brake:rolling?.5:0,handbrake:false});
 switch(action){
  case TEMPACT.wait:return tempActionPedals('wait',remainingMs);
  case TEMPACT.reverse:return tempActionPedals('reverse',remainingMs,o);
  case TEMPACT.handbrakeTurnLeft:return {swerve:1,accel:0,brake:0,handbrake:true};
  case TEMPACT.handbrakeTurnRight:return {swerve:-1,accel:0,brake:0,handbrake:true};
  case TEMPACT.handbrakeStraight:return tempActionPedals('handbrakeStraight',remainingMs);
  case TEMPACT.turnLeft:return turnPedals('left');
  case TEMPACT.turnRight:return turnPedals('right');
  case TEMPACT.goForward:return {swerve:0,accel:.5,brake:0,handbrake:false};
  case TEMPACT.reverseLeft:return back(1);
  case TEMPACT.reverseRight:return back(-1);
  case TEMPACT.reverseStraight:return back(0);
  case TEMPACT.brake:return {swerve:0,accel:0,brake:1,handbrake:false};
  default:return undefined;
 }
}
export type ScriptCarPaths={areas:ReadonlyMap<number,PathArea>;loadAround(x:number,z:number):Promise<void>};
type Paths=ScriptCarPaths;

const toNative=(v:{x:number;y:number;z:number})=>({x:v.x,y:-v.z,z:v.y});

export class ScriptCarMissions{
 private missions=new Map<ScriptDrivable,Mission>();
 private seconds=0;private frame=0;private lastLoad=-Infinity;
 /** The player, for the missions against him; with none, those missions hold the car still. */
 player?:()=>ScriptCarPlayer;
 /** The loaded collision under a renderer (x, z), looking down from height `from`, or undefined where none is
  * streamed in. */
 ground?:(x:number,z:number,from:number)=>number|undefined;
 /** The vehicles on the road as CCarCtrl's danger scans read them (WorldCar.dangerView), each with the vehicle itself
  * so a car finds its own. */
 traffic?:()=>Iterable<DangerView&{vehicle:unknown}>;
 constructor(private paths:()=>Paths|undefined,private random:()=>number=Math.random){}
 /** TASK_CAR_MISSION: CTaskComplexCarDriveMission sets the autopilot's mission, target, cruise speed and style.
  * Missions the browser does not drive give nothing back. */
 carMission(car:ScriptDrivable,o:{mission:number;target?:WorldCar;cruise:number;style:number}){
  const kind=CAR_MISSION[o.mission];if(kind===undefined)return false;
  if(kind==='cruise'){this.wander(car,o);return true;}
  const needsCar=kind.startsWith('ramCar')||kind.startsWith('blockCar')||kind.startsWith('escort');
  if(needsCar&&!o.target)return false;
  const existing=this.missions.get(car),m:Mission={...this.idle(existing?.straightLineDistance),kind,cruise:o.cruise,style:o.style,target:needsCar?o.target:undefined,
   escort:kind.startsWith('escort')?escortSide(o.mission):undefined,seed:Math.floor(this.random()*32768)};
  this.missions.set(car,m);
  if(ROAD_KINDS.has(kind)){const goal=this.targetPosition(m);if(goal){m.goal=goal;this.route(car,m);m.routeAt=this.seconds;m.routeGoal={...goal};}}
  return true;
 }
 /** Where the mission's target is: the target car, or the player (FindPlayerCoors). */
 private targetPosition(m:Mission){
  if(m.target)return m.target.disposed?undefined:{...m.target.car.body.translation()};
  const player=this.player?.();return player?{...(player.vehicle?player.vehicle.car.body.translation():player.position)}:undefined;
 }
 /** Whether the car is on a coordinate mission still (CTaskComplexDriveToPoint is running). */
 driving(car:ScriptDrivable){const m=this.missions.get(car);return !!m&&m.kind!=='none';}
 /** Whether a temporary action still runs on the car (TASK_CAR_TEMP_ACTION's CTaskSimpleCarDrive). */
 inTempAction(car:ScriptDrivable){return !!this.missions.get(car)?.temp;}
 /** TASK_CAR_TEMP_ACTION: CAutoPilot::SetTempAction for the task's time, over whatever mission the car has. */
 tempAction(car:ScriptDrivable,action:number,seconds:number){
  let m=this.missions.get(car);if(!m){m=this.idle();this.missions.set(car,m);}
  m.temp={action,remaining:seconds};
 }
 /** TASK_CAR_DRIVE_WANDER's MISSION_CRUISE: along the roads, picking where to go at each junction. */
 wander(car:ScriptDrivable,o:{cruise:number;style:number}){
  const existing=this.missions.get(car),m:Mission={...this.idle(existing?.straightLineDistance),kind:'cruise',cruise:o.cruise,style:o.style};
  this.missions.set(car,m);
  const paths=this.paths();if(!paths)return;
  const p=car.car.body.translation();m.link=joinCarWithRoadSystem(paths.areas,{x:p.x,y:-p.z,z:p.y},this.forward(car));
 }
 mission(car:ScriptDrivable){return this.missions.get(car)?.kind;}
 /** CCarAI::GetCarToGoToCoors and its accurate and straight-line forms, with the task's cruise speed and style. */
 gotoCoords(car:ScriptDrivable,goal:{x:number;y:number;z:number},o:{accurate?:boolean;straight?:boolean;cruise:number;style:number;straightLineDistance?:number}){
  const existing=this.missions.get(car);
  const kind:ScriptCarMissionKind=o.straight?(o.accurate?'gotoCoordsStraightAccurate':'gotoCoordsStraight'):this.join(car,goal)?(o.accurate?'gotoCoordsStraightAccurate':'gotoCoordsStraight'):(o.accurate?'gotoCoordsAccurate':'gotoCoords');
  this.missions.set(car,{kind,goal:{...goal},cruise:o.cruise,style:o.style,straightLineDistance:o.straightLineDistance??existing?.straightLineDistance??20,
   lane:0,nextLane:0,route:existing?.route??[],link:existing?.link,joinedAt:-Infinity,stuck:0,recoveryMode:0,lastRecovery:-Infinity,seed:existing?.seed??0});
  if(kind==='gotoCoords'||kind==='gotoCoordsAccurate')this.route(car,this.missions.get(car)!);
 }
 /** SET_CAR_STRAIGHT_LINE_DISTANCE: m_nStraightLineDistance (a byte). */
 setStraightLineDistance(car:ScriptDrivable,distance:number){const m=this.missions.get(car);if(m)m.straightLineDistance=distance&255;else this.missions.set(car,this.idle(distance&255));}
 /** The mission is dropped (the task was cleared, or the driver left): the car holds its brakes as MISSION_NONE. */
 clear(car:ScriptDrivable){const m=this.missions.get(car);if(m){m.kind='none';m.route=[];m.recovery=undefined;}}
 forget(car:ScriptDrivable){this.missions.delete(car);}
 private idle(straightLineDistance=20):Mission{return {kind:'none',goal:{x:0,y:0,z:0},cruise:0,style:0,straightLineDistance,lane:0,nextLane:0,route:[],joinedAt:-Infinity,stuck:0,recoveryMode:0,lastRecovery:-Infinity,seed:0};}
 /** Vice City's JoinCarWithRoadSystemGotoCoors: true (drive straight) when there is no road route of two nodes or more. */
 private join(car:ScriptDrivable,goal:{x:number;y:number;z:number}){
  const paths=this.paths();if(!paths)return true;
  const p=car.car.body.translation(),f=this.forward(car);
  const link=joinCarWithRoadSystem(paths.areas,{x:p.x,y:-p.z,z:p.y},f);if(!link)return true;
  const route=findTrafficRoute(paths.areas,link.to,goal);
  return !route||route.length<1;
 }
 private route(car:ScriptDrivable,m:Mission){
  const paths=this.paths();if(!paths)return;
  const p=car.car.body.translation();
  m.link=joinCarWithRoadSystem(paths.areas,{x:p.x,y:-p.z,z:p.y},this.forward(car));m.lane=m.nextLane=0;m.cruiseNext=undefined;
  m.route=m.link?findTrafficRoute(paths.areas,m.link.to,m.goal)??[]:[];
 }
 /** SteerAICarWithPhysics_OnlyMission's close missions (VC's CarCtrl.cpp; SA's is a stub), or nothing for the others. */
 private closePedals(car:ScriptDrivable,m:Mission,state:{position:{x:number;y:number};forward:{x:number;y:number};moveSpeed:{x:number;y:number;z:number}}):Pedals|undefined{
  const player=this.player?.();
  const speedOf=(c:ScriptDrivable)=>{const v=c.car.body.linvel();return {x:v.x/50,y:-v.z/50};};
  const targetNative=()=>{
   if(m.target){const t=m.target.car.body.translation();return {at:{x:t.x,y:-t.z},speed:speedOf(m.target)};}
   if(!player)return undefined;
   if(player.vehicle){const t=player.vehicle.car.body.translation();return {at:{x:t.x,y:-t.z},speed:speedOf(player.vehicle)};}
   return {at:{x:player.position.x,y:-player.position.z},speed:{x:player.velocity.x/50,y:-player.velocity.z/50}};
  };
  switch(m.kind){
   case 'ramPlayerClose':{
    const t=targetNative();if(!t)return {swerve:0,accel:0,brake:1,handbrake:false};
    const v=player?.vehicle,vr=v?.car.body.rotation(),vq=vr&&new Quaternion(vr.x,vr.y,vr.z,vr.w);
    const vf=vq&&toNative(new Vector3(0,0,-1).applyQuaternion(vq)),vright=vq&&toNative(new Vector3(1,0,0).applyQuaternion(vq));
    const ram=ramPlayerCloseTarget({seed:m.seed,player:t.at,car:{position:state.position,forward:state.forward,halfWidth:car.nativeBody.boundsMax.x},
     playerVehicle:v&&vf&&vright?{position:t.at,forward:{x:vf.x,y:vf.y},right:{x:vright.x,y:vright.y},halfWidth:v.nativeBody.boundsMax.x,speed:Math.hypot(t.speed.x,t.speed.y)}:undefined});
    if(ram.turn&&!(m.turn&&this.seconds<m.turn.until))m.turn={dir:ram.turn,until:this.seconds+.25};
    return m.turn&&this.seconds<m.turn.until?turnPedals(m.turn.dir):steerHeadingForTarget(state,ram.target,m.cruise);
   }
   case 'ramCarClose':{const t=targetNative();return t?steerHeadingForTarget(state,t.at,m.cruise):undefined;}
   case 'blockPlayerClose':case 'blockCarClose':{
    const t=targetNative();if(!t)return {swerve:0,accel:0,brake:1,handbrake:false};
    // DRIVINGSTYLE_AVOID_CARS for the block, and the handbrake stop once it is in front.
    m.style=DRIVINGSTYLE.avoidCars;
    const aim=blockTargetPoint(t.at,t.speed);
    const pedals=steerHeadingForTarget(state,aim,m.cruise);
    if((aim.x-state.position.x)**2+(aim.y-state.position.y)**2<DISTANCE_TO_SWITCH_FROM_BLOCK_TO_STOP**2)m.kind=m.kind==='blockCarClose'?'blockCarStop':'blockPlayerStop';
    return pedals;
   }
   case 'blockPlayerStop':case 'blockCarStop':{
    const t=targetNative();
    if(t&&(t.at.x-state.position.x)**2+(t.at.y-state.position.y)**2>DISTANCE_TO_SWITCH_FROM_STOP_TO_BLOCK**2)m.kind=m.kind==='blockCarStop'?'blockCarClose':'blockPlayerClose';
    return {swerve:0,accel:0,brake:1,handbrake:true};
   }
   case 'escort':{
    const target=m.target;if(!target)return undefined;
    const tp=target.car.body.translation(),tr=target.car.body.rotation(),tf=toNative(new Vector3(0,0,-1).applyQuaternion(new Quaternion(tr.x,tr.y,tr.z,tr.w)));
    const fl=Math.hypot(tf.x,tf.y)||1,forward={x:tf.x/fl,y:tf.y/fl},b=target.nativeBody,o=car.nativeBody;
    const station=escortStation(m.escort??'rear',{position:{x:tp.x,y:-tp.z},forward,halfWidth:b.boundsMax.x,halfLength:b.boundsMax.y},{halfWidth:o.boundsMax.x,halfLength:o.boundsMax.y});
    // Aim a few units down the escorted car's line from the station, and hold its speed, closing the gap along it.
    const ts=speedOf(target),targetSpeed=(ts.x*forward.x+ts.y*forward.y)*60;
    const behind=(station.x-state.position.x)*forward.x+(station.y-state.position.y)*forward.y;
    const aim={x:station.x+forward.x*5,y:station.y+forward.y*5};
    return steerHeadingForTarget(state,aim,Math.max(0,Math.min(m.cruise,targetSpeed+behind*2)));
   }
  }
  return undefined;
 }
 private forward3(car:ScriptDrivable){const q=car.car.body.rotation();return toNative(new Vector3(0,0,-1).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w)));}
 private forward(car:ScriptDrivable){const f=this.forward3(car),l=Math.hypot(f.x,f.y)||1;return {x:f.x/l,y:f.y/l};}
 /** A car SET_CAR_COORDINATES moved: JoinCarWithRoadSystem for a cruise from where it now stands, and the road route
  * worked out again for the missions that drive to a point or at the player. */
 rejoinRoads(car:ScriptDrivable){
  const m=this.missions.get(car);if(!m)return;
  m.link=undefined;m.cruiseNext=undefined;m.route=[];
  if(m.kind!=='cruise'&&ROAD_KINDS.has(m.kind))this.route(car,m);
 }
 /** CAutoPilot's m_startingRouteNode and m_currentAddress for a car on a mission: the ends of the link it drives. */
 routeNodes(car:ScriptDrivable){const link=this.missions.get(car)?.link;return link&&{starting:link.from,current:link.to};}
 /** The loaded car path areas the script's node questions search (CPathFind searches only the areas it has loaded),
  * kept streaming round `around` as the missions keep them. Nothing until the first load has finished. */
 pathAreas(around?:{x:number;z:number}){
  const paths=this.paths();
  if(paths&&around&&this.seconds-this.lastLoad>2){this.lastLoad=this.seconds;void paths.loadAround(around.x,around.z).catch(()=>{});}
  return paths?.areas;
 }
 /** One frame for every car a script is driving: UpdateCarAI's mission switching, then the steering. */
 step(dt:number,around?:{x:number;z:number}){
  this.seconds+=dt;this.frame++;
  if(!this.missions.size)return;
  const paths=this.paths();
  if(paths&&around&&this.missions.size&&this.seconds-this.lastLoad>2){this.lastLoad=this.seconds;void paths.loadAround(around.x,around.z).catch(()=>{});}
  for(const [car,m] of this.missions){
   if(car.disposed){this.missions.delete(car);continue;}
   // The player's own car drives on its mission only while a script's driving task has it (scriptDriven).
   if(car.wrecked||car.occupied&&!car.scriptDriven){m.kind='none';m.temp=undefined;continue;}
   const p=car.car.body.translation();
   this.switchTargetMission(car,m,p);
   const gx=m.goal.x-p.x,gz=m.goal.z-p.z,distSq=gx*gx+gz*gz;
   switch(m.kind){
    case 'gotoCoords':if(distSq<=m.straightLineDistance**2)m.kind='gotoCoordsStraight';break;
    case 'gotoCoordsAccurate':if(distSq<=m.straightLineDistance**2)m.kind='gotoCoordsStraightAccurate';break;
    case 'gotoCoordsStraight':case 'gotoCoordsStraightAccurate':{
     const accurate=m.kind==='gotoCoordsStraightAccurate';
     if(distSq<(accurate?1:9)){m.kind='none';break;}
     if(distSq>=(m.straightLineDistance+5)**2&&this.frame%8===0){
      const straight=this.join(car,m.goal);
      m.kind=straight?m.kind:accurate?'gotoCoordsAccurate':'gotoCoords';
      if(!straight)this.route(car,m);
     }
     break;
    }
   }
   car.autopilot=this.drive(car,m,dt);
  }
 }
 /** CCarAI::UpdateCarAI for the missions against a target (CarAI.cpp, reversed), with the moving goal kept up for the
  * FARAWAY ones: their route is worked out again every 3 s, or once the target has moved 20 units. */
 private switchTargetMission(car:ScriptDrivable,m:Mission,p:{x:number;y:number;z:number}){
  if(m.kind==='none'||m.kind==='cruise'||m.kind.startsWith('gotoCoords')||m.kind==='emergencyStop'||m.kind==='stopForever')return;
  // A target car that is gone ends the mission (RAMCAR_CLOSE's ends in cruising instead).
  if(m.target?.disposed){
   if(m.kind==='ramCarClose'){const cruise=m.cruise,style=m.style;this.wander(car,{cruise,style});}else m.kind='none';
   return;
  }
  const target=this.targetPosition(m);if(!target){m.kind='none';return;}
  const player=this.player?.(),playerAt=player?(player.vehicle?player.vehicle.car.body.translation():player.position):target;
  const d2=(target.x-p.x)**2+(target.z-p.z)**2,close=m.straightLineDistance,far=close+5;
  switch(m.kind){
   // EntitiesGoHeadOn: the two face each other within 40 units.
   case 'ramPlayerFar':if(d2<=close**2||d2<40**2&&this.headOn(car,player))m.kind='ramPlayerClose';break;
   // SA takes a close ram or block that falls behind back to RAMPLAYER_FARAWAY alike, when a road route there exists.
   case 'ramPlayerClose':case 'blockPlayerClose':if(d2>far**2&&!this.join(car,target))m.kind='ramPlayerFar';break;
   case 'ramCarFar':if(d2<=close**2)m.kind='ramCarClose';break;
   case 'ramCarClose':if(d2>=far**2){m.kind='ramCarFar';this.route(car,m);}break;
   case 'blockCarFar':if(d2<=close**2)m.kind='blockCarClose';break;
   // BLOCKCAR_CLOSE only rejoins the road when the target gets away; the mission stays.
   case 'blockCarClose':if(d2>=close**2){const q=car.car.body.translation(),paths=this.paths();if(paths)m.link=joinCarWithRoadSystem(paths.areas,{x:q.x,y:-q.z,z:q.y},this.forward(car));}break;
   // The escort's switching measures the player, not the car it escorts; a straight-line distance of 240 or more
   // holds it close.
   case 'escort':{const e2=(playerAt.x-p.x)**2+(playerAt.z-p.z)**2;if(m.straightLineDistance<240&&e2>=far**2&&!this.join(car,playerAt)){m.kind='escortFar';this.route(car,m);}break;}
   case 'escortFar':{const e2=(playerAt.x-p.x)**2+(playerAt.z-p.z)**2;if(e2<=close**2)m.kind='escort';break;}
  }
  if(ROAD_KINDS.has(m.kind)){
   m.goal={...target};
   if(this.seconds-(m.routeAt??-Infinity)>3||!m.routeGoal||Math.hypot(m.routeGoal.x-target.x,m.routeGoal.z-target.z)>20){m.routeAt=this.seconds;m.routeGoal={...target};this.route(car,m);}
  }
 }
 /** AUTHORED last resort: a car or bike a script drives that has made no headway for UNSTICK_SECONDS, through every
  * recovery mode, is set down on its route a few units on, facing along it. The recovery above backs and turns out
  * of most jams, but a bike wedged on a kerb or against another rider stays put, and a homie who never arrives leaves
  * the mission waiting for good (INTRO1's ride to Grove Street: Smoke on the slope at 1345,-1227, Sweet and Ryder
  * against each other). The original never shows this happen; it is kept out of sight of the player, beyond
  * UNSTICK_NEAR units of him. */
 private unstick(car:ScriptDrivable,m:Mission,dt:number,speed:number){
  const moving=ROAD_KINDS.has(m.kind)||m.kind.startsWith('gotoCoords')||m.kind==='cruise';
  if(!moving||speed>.5){m.jammed=0;return false;}
  m.jammed=(m.jammed??0)+dt;if(m.jammed<UNSTICK_SECONDS)return false;
  const p=car.car.body.translation(),player=this.player?.();
  if(player&&Math.hypot(player.position.x-p.x,player.position.z-p.z)<UNSTICK_NEAR)return false;
  const next=m.route[0]??m.link;if(!next)return false;
  const t=travel(next),at=lanePoint(t,m.lane);
  // Only onto collision that is there: a car set down past the streamed window fell through the world.
  const road=Math.max(next.from.position[2],next.to.position[2]),ground=this.ground?this.ground(at.x,-at.y,road+4):road;
  if(ground===undefined){m.jammed=0;return false;}
  const z=ground+1;
  const yaw=Math.atan2(-t.forward.x,t.forward.y);
  car.car.body.setTranslation({x:at.x,y:z,z:-at.y},true);car.car.body.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
  car.car.body.setLinvel({x:0,y:0,z:0},true);car.car.body.setAngvel({x:0,y:0,z:0},true);
  m.jammed=0;m.stuck=0;m.recovery=undefined;m.recoveryMode=0;
  if(m.route[0]===next){m.route.shift();m.link=next;}
  this.unstuck++;
  return true;
 }
 /** How many times unstick has set a car down (a dev count). */
 unstuck=0;
 /** CCarAI::EntitiesGoHeadOn(player, car). */
 private headOn(car:ScriptDrivable,player?:ScriptCarPlayer){
  if(!player)return false;
  const p=car.car.body.translation(),a=player.vehicle?player.vehicle.car.body.translation():player.position;
  const dx=a.x-p.x,dz=a.z-p.z,l=Math.hypot(dx,dz)||1,d={x:dx/l,y:-dz/l};
  const own=this.forward(car),theirs=player.vehicle?this.forward(player.vehicle):undefined;
  if(!theirs)return false;
  return theirs.x*d.x+theirs.y*d.y<=-.8&&own.x*d.x+own.y*d.y>=.8;
 }
 /** CCarCtrl::FindMaximumSpeedForThisCarInTraffic for the car scans (the car's m_SpeedMult is taken as 1): the lowest
  * speed the vehicles ahead allow, which SLOW_DOWN_FOR_CARS averages with the cruise speed. */
 private trafficSpeed(car:ScriptDrivable,cruise:number,slowDown:boolean){
  const others=[...this.traffic?.()??[]],own=others.find(o=>o.vehicle===car);if(!own)return cruise;
  const speed=slowCarDownForCars(own,others,cruise,cruise).speed;
  return slowDown?(speed+cruise)/2:speed;
 }
 private drive(car:ScriptDrivable,m:Mission,dt:number):WorldCar['autopilot']{
  const p=car.car.body.translation(),v=car.car.body.linvel(),f=this.forward(car);
  const state={position:{x:p.x,y:-p.z},forward:f,moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},forward3:this.forward3(car)};
  if(m.temp){
   const t=m.temp;t.remaining-=dt;if(t.remaining<=0)m.temp=undefined;
   const forwardSpeed=state.moveSpeed.x*f.x+state.moveSpeed.y*f.y;
   const pedals=scriptTempActionPedals(t.action,Math.max(0,t.remaining)*1000,{forwardSpeed});
   if(pedals)return {steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
  }
  // CCarCtrl::FindMaximumSpeedForThisCarInTraffic (SlowCarDownForCarsSectorList) under the stop-for-cars styles: the
  // lowest speed any car ahead allows; AVOID_CARS and PLOUGH_THROUGH keep the cruise speed. A script car took its
  // cruise speed as the traffic speed whatever its style, and drove into the cars stopped ahead of it.
  const trafficSpeed=m.style===DRIVINGSTYLE.stopForCars||m.style===DRIVINGSTYLE.slowDownForCars||m.style===DRIVINGSTYLE.stopForCarsIgnoreLights?this.trafficSpeed(car,m.cruise,m.style===DRIVINGSTYLE.slowDownForCars):m.cruise;
  const native=(pedals:Pedals):WorldCar['autopilot']=>({steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}});
  // MISSION_NONE: no gas, half brake and the handbrake, as the car's own pedals (the pad's brake at a standstill
  // would put it in reverse).
  if(m.kind==='none')return native(HOLD);
  // EMERGENCYVEHICLE_STOP and STOP_FOREVER: half brake with the handbrake on.
  if(m.kind==='emergencyStop'||m.kind==='stopForever')return native({swerve:0,accel:0,brake:.5,handbrake:true});
  const close=this.closePedals(car,m,state);
  if(close)return native(close);
  const goal={x:m.goal.x,y:-m.goal.z};
  let pedals:Pedals|undefined;
  const paths=this.paths();
  if(m.kind==='cruise'){
   if(!paths)return native(HOLD);
   if(!m.link){const q=car.car.body.translation();m.link=joinCarWithRoadSystem(paths.areas,{x:q.x,y:-q.z,z:q.y},f);}
   const link=m.link;if(!link)return native(HOLD);
   // CCarCtrl::PickNextNodeRandomly, one continuation per node change, as the traffic controller runs it: the turn the
   // lane allows, no dead end or switched-off road unless coming from one, and the U-turn when nothing else is left.
   // (Filtering the way back out and drawing from the rest left a car at a dead end with nothing, circling the end
   // of its last link: an ambulance wandering off from Grove Street's turning circle ran down the people there.)
   const pick=(from:TrafficLink)=>{
    const onFrom=pathDirection(from.from.address,from.to.address,from.navigation);
    // Switched-off and don't-wander roads are among the candidates, kept to a car already on one by the switched-off
    // test: a car that joined the road system on one (Grove Street's) found no link at all from its end.
    const closed=(n:TrafficLink['to'])=>n.switchedOff||n.dontWander;
    const candidates=trafficLinks(paths.areas,from.to,true).map(link=>{const l=pathDirection(link.from.address,link.to.address,link.navigation);
     return {value:link,node:{x:link.to.position[0],y:link.to.position[1]},uTurn:link.to.address.area===from.from.address.area&&link.to.address.node===from.from.address.node,
      deadEnd:link.to.deadEnd,switchedOff:closed(link.to),lanes:l.lanes,oppositeLanes:l.reverseLanes};});
    return pickNextNodeRandomly({previous:{x:from.from.position[0],y:from.from.position[1]},current:{x:from.to.position[0],y:from.to.position[1]},candidates,
     lanesOnCurrent:onFrom.lanes,onOneWayRoad:onFrom.reverseLanes===0,nextLane:m.nextLane,previousDeadEnd:from.from.deadEnd,previousSwitchedOff:closed(from.from)||closed(from.to),
     random:count=>Math.floor(this.random()*count)}).choice?.value;
   };
   if(!m.cruiseNext||m.cruiseNext.from!==link.to)m.cruiseNext=pick(link);
   let next=m.cruiseNext;
   if(next&&shouldPickNextNode(state,travel(link),m.lane,travel(next),m.nextLane)){
    m.link=next;m.lane=m.nextLane;m.cruiseNext=pick(next);next=m.cruiseNext;
    if(next)m.nextLane=nextLaneOnLink(m.lane,pathDirection(next.from.address,next.to.address,next.navigation).lanes,next.length,this.random()<.25,this.random()<.5,car.autopilotFields?.stayInSlowLane===1);
   }
   const at=m.link;
   if(next&&at){
    const lights=m.style===DRIVINGSTYLE.stopForCars||m.style===DRIVINGSTYLE.slowDownForCars;
    const stop=lights&&nativeShouldStopForLight({position:[state.position.x,state.position.y],appearance:'car',physicsStatus:true,
     current:{navigation:at.navigation,routeAddress:at.to.address,travelSign:at.dx*at.navigation.direction[0]-at.dz*at.navigation.direction[1]>=0?1:-1}},Math.floor(this.seconds*1000)>>>0);
    pedals=steerFollowPath(state,travel(at),m.lane,travel(next),{cruiseSpeed:m.cruise,trafficSpeed,stop});
   }else if(at){const end=travel(at).position;pedals=steerHeadingForTarget(state,end,m.cruise);}
  }
  if(ROAD_KINDS.has(m.kind)&&paths&&m.link){
   let link=m.link,next=m.route.length?m.route[0]:undefined;
   if(next&&next.from===link.to&&shouldPickNextNode(state,travel(link),m.lane,travel(next),m.nextLane)){
    m.route.shift();m.link=link=next;m.lane=m.nextLane;next=m.route[0];
    if(next)m.nextLane=nextLaneOnLink(m.lane,pathDirection(next.from.address,next.to.address,next.navigation).lanes,next.length,this.random()<.25,this.random()<.5,car.autopilotFields?.stayInSlowLane===1);
   }
   const here=lanePoint(travel(link),m.lane),t=travel(link),roadZ=(link.from.position[2]+link.to.position[2])/2;
   const offRoute=Math.abs((state.position.x-here.x)*t.forward.y-(state.position.y-here.y)*t.forward.x)>12||Math.abs(p.y-roadZ)>3||m.recoveryMode>=2&&!!m.recovery;
   if(offRoute&&this.seconds-m.joinedAt>2){m.joinedAt=this.seconds;this.route(car,m);link=m.link??link;next=m.route[0];}
   if(next&&next.from===link.to){
    const lights=m.style===DRIVINGSTYLE.stopForCars||m.style===DRIVINGSTYLE.slowDownForCars;
    const stop=lights&&nativeShouldStopForLight({position:[state.position.x,state.position.y],appearance:'car',physicsStatus:true,
     current:{navigation:link.navigation,routeAddress:link.to.address,travelSign:link.dx*link.navigation.direction[0]-link.dz*link.navigation.direction[1]>=0?1:-1}},Math.floor(this.seconds*1000)>>>0);
    pedals=steerFollowPath(state,travel(link),m.lane,travel(next),{cruiseSpeed:m.cruise,trafficSpeed,stop});
   }else if(!next&&(m.kind==='gotoCoords'||m.kind==='gotoCoordsAccurate')){
    // SteerAICarWithPhysicsFollowPath (VC): with the path search spent (PickNextNodeToFollowPath finds under two
    // nodes), the go-to missions turn straight for the point, the accurate one staying accurate.
    m.kind=m.kind==='gotoCoords'?'gotoCoordsStraight':'gotoCoordsStraightAccurate';
    pedals=steerHeadingForTarget(state,goal,m.cruise);
   }else if(!next){
    // The route is spent before the switch distance: carry on along the road's continuation.
    const options=trafficLinks(paths.areas,link.to,true).filter(n=>n.to!==link.from);
    if(options.length){m.cruiseNext??=options[Math.floor(this.random()*options.length)];if(m.cruiseNext.from===link.to)pedals=steerFollowPath(state,travel(link),m.lane,travel(m.cruiseNext),{cruiseSpeed:m.cruise,trafficSpeed,stop:false});}
   }
  }
  pedals??=steerHeadingForTarget(state,goal,m.cruise);
  if(this.unstick(car,m,dt,Math.hypot(v.x,v.z)))return native(HOLD);
  // CCarAI's stuck recovery, as the police units run it: under 0.012 units a frame for a second.
  if(m.recovery){
   m.recovery.remaining-=dt;const r=m.recovery;if(r.remaining<=0)m.recovery=undefined;
   return {throttle:0,brake:1,steering:r.kind===2?-1:r.kind===3?1:0,handbrake:false};
  }
  // Only a car that is trying to go can be stuck: one held at a red light or behind the car ahead (its pedals the brake,
  // no gas) is waiting, and the recovery's reverse took it back up the road from the lights.
  const trying=pedals.accel>.05&&pedals.brake<.05;
  if(trying&&Math.hypot(v.x,v.z)/50<=.012){m.stuck+=dt;if(m.stuck>1){m.stuck=0;m.recoveryMode=this.seconds-m.lastRecovery>=10?0:(m.recoveryMode+1)%4;m.lastRecovery=this.seconds;m.recovery={kind:m.recoveryMode,remaining:[1.5,4,2.5,2.5][m.recoveryMode]};}}
  else m.stuck=0;
  return {steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
 }
}
