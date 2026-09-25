import {Quaternion,Vector3} from 'three';
import type {PathArea} from '../assets/pathNodes';
import {pathDirection} from '../assets/pathDirection';
import {nativeShouldStopForLight} from '../world/nativeSignalStop';
import {lanePoint,nextLaneOnLink,shouldPickNextNode,steerFollowPath,steerHeadingForTarget,tempActionPedals,turnPedals,type Pedals} from '../vehicle/nativeCarCtrl';
import {findTrafficRoute,joinCarWithRoadSystem,trafficLinks,travelLink as travel,type TrafficLink} from './trafficRoute';
import type {WorldCar} from './WorldCar';

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
export type ScriptCarMissionKind='gotoCoords'|'gotoCoordsStraight'|'gotoCoordsAccurate'|'gotoCoordsStraightAccurate'|'cruise'|'none';
/** eCarDrivingStyle. */
export const DRIVINGSTYLE={stopForCars:0,slowDownForCars:1,avoidCars:2,ploughThrough:3,stopForCarsIgnoreLights:4} as const;

interface Mission{
 kind:ScriptCarMissionKind;
 /** m_vecDestinationCoors, renderer space. */
 goal:{x:number;y:number;z:number};
 cruise:number;style:number;straightLineDistance:number;
 link?:TrafficLink;lane:number;nextLane:number;route:TrafficLink[];cruiseNext?:TrafficLink;joinedAt:number;
 stuck:number;recoveryMode:number;lastRecovery:number;recovery?:{kind:number;remaining:number};
 /** m_nTempAction and the time left of it (m_nTempActionTime). */
 temp?:{action:number;remaining:number};
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
 private missions=new Map<WorldCar,Mission>();
 private seconds=0;private frame=0;private lastLoad=-Infinity;
 constructor(private paths:()=>Paths|undefined,private random:()=>number=Math.random){}
 /** Whether the car is on a coordinate mission still (CTaskComplexDriveToPoint is running). */
 driving(car:WorldCar){const m=this.missions.get(car);return !!m&&m.kind!=='none';}
 /** Whether a temporary action still runs on the car (TASK_CAR_TEMP_ACTION's CTaskSimpleCarDrive). */
 inTempAction(car:WorldCar){return !!this.missions.get(car)?.temp;}
 /** TASK_CAR_TEMP_ACTION: CAutoPilot::SetTempAction for the task's time, over whatever mission the car has. */
 tempAction(car:WorldCar,action:number,seconds:number){
  let m=this.missions.get(car);if(!m){m=this.idle();this.missions.set(car,m);}
  m.temp={action,remaining:seconds};
 }
 /** TASK_CAR_DRIVE_WANDER's MISSION_CRUISE: along the roads, picking where to go at each junction. */
 wander(car:WorldCar,o:{cruise:number;style:number}){
  const existing=this.missions.get(car),m:Mission={...this.idle(existing?.straightLineDistance),kind:'cruise',cruise:o.cruise,style:o.style};
  this.missions.set(car,m);
  const paths=this.paths();if(!paths)return;
  const p=car.car.body.translation();m.link=joinCarWithRoadSystem(paths.areas,{x:p.x,y:-p.z,z:p.y},this.forward(car));
 }
 mission(car:WorldCar){return this.missions.get(car)?.kind;}
 /** CCarAI::GetCarToGoToCoors and its accurate and straight-line forms, with the task's cruise speed and style. */
 gotoCoords(car:WorldCar,goal:{x:number;y:number;z:number},o:{accurate?:boolean;straight?:boolean;cruise:number;style:number;straightLineDistance?:number}){
  const existing=this.missions.get(car);
  const kind:ScriptCarMissionKind=o.straight?(o.accurate?'gotoCoordsStraightAccurate':'gotoCoordsStraight'):this.join(car,goal)?(o.accurate?'gotoCoordsStraightAccurate':'gotoCoordsStraight'):(o.accurate?'gotoCoordsAccurate':'gotoCoords');
  this.missions.set(car,{kind,goal:{...goal},cruise:o.cruise,style:o.style,straightLineDistance:o.straightLineDistance??existing?.straightLineDistance??20,
   lane:0,nextLane:0,route:existing?.route??[],link:existing?.link,joinedAt:-Infinity,stuck:0,recoveryMode:0,lastRecovery:-Infinity});
  if(kind==='gotoCoords'||kind==='gotoCoordsAccurate')this.route(car,this.missions.get(car)!);
 }
 /** SET_CAR_STRAIGHT_LINE_DISTANCE: m_nStraightLineDistance (a byte). */
 setStraightLineDistance(car:WorldCar,distance:number){const m=this.missions.get(car);if(m)m.straightLineDistance=distance&255;else this.missions.set(car,this.idle(distance&255));}
 /** The mission is dropped (the task was cleared, or the driver left): the car holds its brakes as MISSION_NONE. */
 clear(car:WorldCar){const m=this.missions.get(car);if(m){m.kind='none';m.route=[];m.recovery=undefined;}}
 forget(car:WorldCar){this.missions.delete(car);}
 private idle(straightLineDistance=20):Mission{return {kind:'none',goal:{x:0,y:0,z:0},cruise:0,style:0,straightLineDistance,lane:0,nextLane:0,route:[],joinedAt:-Infinity,stuck:0,recoveryMode:0,lastRecovery:-Infinity};}
 /** Vice City's JoinCarWithRoadSystemGotoCoors: true (drive straight) when there is no road route of two nodes or more. */
 private join(car:WorldCar,goal:{x:number;y:number;z:number}){
  const paths=this.paths();if(!paths)return true;
  const p=car.car.body.translation(),f=this.forward(car);
  const link=joinCarWithRoadSystem(paths.areas,{x:p.x,y:-p.z,z:p.y},f);if(!link)return true;
  const route=findTrafficRoute(paths.areas,link.to,goal);
  return !route||route.length<1;
 }
 private route(car:WorldCar,m:Mission){
  const paths=this.paths();if(!paths)return;
  const p=car.car.body.translation();
  m.link=joinCarWithRoadSystem(paths.areas,{x:p.x,y:-p.z,z:p.y},this.forward(car));m.lane=m.nextLane=0;m.cruiseNext=undefined;
  m.route=m.link?findTrafficRoute(paths.areas,m.link.to,m.goal)??[]:[];
 }
 private forward3(car:WorldCar){const q=car.car.body.rotation();return toNative(new Vector3(0,0,-1).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w)));}
 private forward(car:WorldCar){const f=this.forward3(car),l=Math.hypot(f.x,f.y)||1;return {x:f.x/l,y:f.y/l};}
 /** One frame for every car a script is driving: UpdateCarAI's mission switching, then the steering. */
 step(dt:number,around?:{x:number;z:number}){
  this.seconds+=dt;this.frame++;
  if(!this.missions.size)return;
  const paths=this.paths();
  if(paths&&around&&this.missions.size&&this.seconds-this.lastLoad>2){this.lastLoad=this.seconds;void paths.loadAround(around.x,around.z).catch(()=>{});}
  for(const [car,m] of this.missions){
   if(car.disposed){this.missions.delete(car);continue;}
   if(car.wrecked||car.occupied){m.kind='none';m.temp=undefined;continue;}
   const p=car.car.body.translation(),gx=m.goal.x-p.x,gz=m.goal.z-p.z,distSq=gx*gx+gz*gz;
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
 private drive(car:WorldCar,m:Mission,dt:number):WorldCar['autopilot']{
  const p=car.car.body.translation(),v=car.car.body.linvel(),f=this.forward(car);
  const state={position:{x:p.x,y:-p.z},forward:f,moveSpeed:{x:v.x/50,y:-v.z/50,z:v.y/50},forward3:this.forward3(car)};
  if(m.temp){
   const t=m.temp;t.remaining-=dt;if(t.remaining<=0)m.temp=undefined;
   const forwardSpeed=state.moveSpeed.x*f.x+state.moveSpeed.y*f.y;
   const pedals=scriptTempActionPedals(t.action,Math.max(0,t.remaining)*1000,{forwardSpeed});
   if(pedals)return {steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
  }
  // MISSION_NONE: no gas, the brakes on.
  if(m.kind==='none')return {steering:0,throttle:0,brake:1,handbrake:false};
  const goal={x:m.goal.x,y:-m.goal.z};
  let pedals:Pedals|undefined;
  const paths=this.paths();
  if(m.kind==='cruise'){
   if(!paths)return {steering:0,throttle:0,brake:1,handbrake:false};
   if(!m.link){const q=car.car.body.translation();m.link=joinCarWithRoadSystem(paths.areas,{x:q.x,y:-q.z,z:q.y},f);}
   const link=m.link;if(!link)return {steering:0,throttle:0,brake:1,handbrake:false};
   // PickNextNodeRandomly: one continuation per node change.
   const pick=(from:TrafficLink)=>{const options=trafficLinks(paths.areas,from.to,false).filter(n=>n.to!==from.from);return options.length?options[Math.floor(this.random()*options.length)]:undefined;};
   if(!m.cruiseNext||m.cruiseNext.from!==link.to)m.cruiseNext=pick(link);
   let next=m.cruiseNext;
   if(next&&shouldPickNextNode(state,travel(link),m.lane,travel(next),m.nextLane)){
    m.link=next;m.lane=m.nextLane;m.cruiseNext=pick(next);next=m.cruiseNext;
    if(next)m.nextLane=nextLaneOnLink(m.lane,pathDirection(next.from.address,next.to.address,next.navigation).lanes,next.length,this.random()<.25,this.random()<.5);
   }
   const at=m.link;
   if(next&&at){
    const lights=m.style===DRIVINGSTYLE.stopForCars||m.style===DRIVINGSTYLE.slowDownForCars;
    const stop=lights&&nativeShouldStopForLight({position:[state.position.x,state.position.y],appearance:'car',physicsStatus:true,
     current:{navigation:at.navigation,routeAddress:at.to.address,travelSign:at.dx*at.navigation.direction[0]-at.dz*at.navigation.direction[1]>=0?1:-1}},Math.floor(this.seconds*1000)>>>0);
    pedals=steerFollowPath(state,travel(at),m.lane,travel(next),{cruiseSpeed:m.cruise,trafficSpeed:m.cruise,stop});
   }else if(at){const end=travel(at).position;pedals=steerHeadingForTarget(state,end,m.cruise);}
  }
  if((m.kind==='gotoCoords'||m.kind==='gotoCoordsAccurate')&&paths&&m.link){
   let link=m.link,next=m.route.length?m.route[0]:undefined;
   if(next&&next.from===link.to&&shouldPickNextNode(state,travel(link),m.lane,travel(next),m.nextLane)){
    m.route.shift();m.link=link=next;m.lane=m.nextLane;next=m.route[0];
    if(next)m.nextLane=nextLaneOnLink(m.lane,pathDirection(next.from.address,next.to.address,next.navigation).lanes,next.length,this.random()<.25,this.random()<.5);
   }
   const here=lanePoint(travel(link),m.lane),t=travel(link),roadZ=(link.from.position[2]+link.to.position[2])/2;
   const offRoute=Math.abs((state.position.x-here.x)*t.forward.y-(state.position.y-here.y)*t.forward.x)>12||Math.abs(p.y-roadZ)>3||m.recoveryMode>=2&&!!m.recovery;
   if(offRoute&&this.seconds-m.joinedAt>2){m.joinedAt=this.seconds;this.route(car,m);link=m.link??link;next=m.route[0];}
   if(next&&next.from===link.to){
    const lights=m.style===DRIVINGSTYLE.stopForCars||m.style===DRIVINGSTYLE.slowDownForCars;
    const stop=lights&&nativeShouldStopForLight({position:[state.position.x,state.position.y],appearance:'car',physicsStatus:true,
     current:{navigation:link.navigation,routeAddress:link.to.address,travelSign:link.dx*link.navigation.direction[0]-link.dz*link.navigation.direction[1]>=0?1:-1}},Math.floor(this.seconds*1000)>>>0);
    pedals=steerFollowPath(state,travel(link),m.lane,travel(next),{cruiseSpeed:m.cruise,trafficSpeed:m.cruise,stop});
   }else if(!next){
    // The route is spent before the switch distance: carry on along the road's continuation.
    const options=trafficLinks(paths.areas,link.to,true).filter(n=>n.to!==link.from);
    if(options.length){m.cruiseNext??=options[Math.floor(this.random()*options.length)];if(m.cruiseNext.from===link.to)pedals=steerFollowPath(state,travel(link),m.lane,travel(m.cruiseNext),{cruiseSpeed:m.cruise,trafficSpeed:m.cruise,stop:false});}
   }
  }
  pedals??=steerHeadingForTarget(state,goal,m.cruise);
  // CCarAI's stuck recovery, as the police units run it: under 0.012 units a frame for a second.
  if(m.recovery){
   m.recovery.remaining-=dt;const r=m.recovery;if(r.remaining<=0)m.recovery=undefined;
   return {throttle:0,brake:1,steering:r.kind===2?-1:r.kind===3?1:0,handbrake:false};
  }
  if(Math.hypot(v.x,v.z)/50<=.012){m.stuck+=dt;if(m.stuck>1){m.stuck=0;m.recoveryMode=this.seconds-m.lastRecovery>=10?0:(m.recoveryMode+1)%4;m.lastRecovery=this.seconds;m.recovery={kind:m.recoveryMode,remaining:[1.5,4,2.5,2.5][m.recoveryMode]};}}
  else m.stuck=0;
  return {steering:0,throttle:0,brake:0,handbrake:false,native:{steerAngle:pedals.swerve,gas:pedals.accel,brake:pedals.brake,handbrake:pedals.handbrake}};
 }
}
