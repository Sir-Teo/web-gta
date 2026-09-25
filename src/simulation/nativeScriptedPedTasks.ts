import type {ScmScriptedTask} from '../engine/ScmThread';
/* What a script's task asks of a ped, in the script's own terms.
 *
 * A scripted task is a CTask the original pushes onto the ped's intelligence. Only some of those tasks are
 * reversed, and only some of the reversed ones describe something this browser's pedestrians can already do.
 * This turns the tasks in that intersection into an order the world can carry out, and returns nothing for the
 * rest — nothing meaning the runtime gives the asking thread up rather than pretending the ped obeyed. */
export type ScriptedPedOrder=
 /** CTaskSimpleStandStill: stand where you are. `seconds` is Infinity for the looped form, which never ends. */
 |{kind:'standStill';seconds:number}
 /** CTaskSimpleAchieveHeading: turn, at the ped's own heading rate, to a heading in degrees clockwise from north. */
 |{kind:'achieveHeading';degrees:number}
 /** CTaskComplexWanderStandard: back to walking the path nodes, which is what a street ped does unasked. */
 |{kind:'wander'}
 /** CTaskComplexDie. */
 |{kind:'die'}
 /** CTaskComplexSmartFleePoint and CTaskComplexSmartFleeEntity: run from a place until `safe` units away, or
  * for `seconds`. The point is in the script's coordinates. */
 |{kind:'smartFlee';from:{x:number;y:number};safe:number;seconds:number}
 /** CTaskComplexGoToPointAndStandStill, or its Timed form when `seconds` is finite: walk, run or sprint (eMoveState)
  * straight at a point in the script's coordinates until within `radius`, then stand. The timed form puts a ped that
  * has not arrived when its time runs out on the point. A `z` at or below MAP_Z_LOW_LIMIT means "on the ground". */
 |{kind:'goToPoint';x:number;y:number;z:number;moveState:number;radius:number;moveStateRadius:number;seconds:number}
 /** CTaskComplexKillPedOnFoot: attack a ped (a script handle, the player's included) until it is dead or gone, or for
  * `seconds`. */
 |{kind:'killPed';target:number;seconds:number}
 /** CTaskSimpleRunNamedAnim: a clip from a script's animation block, looped or once (then held on its last frame
  * or let go), for `seconds` when the script gives a time. */
 |{kind:'playAnim';file:string;name:string;loop:boolean;keepLastFrame:boolean;seconds:number;
  /** A held last frame is let go when the time runs out rather than kept (CTaskSimpleHandsUp). */
  release?:boolean}
 /** CTaskSimpleTriggerLookAt: the head turns to a ped (a script handle, the player's included) for `seconds`; the
  * task itself is over as soon as it has started the look. */
 |{kind:'lookAt';target:number;seconds:number}
 /** CTaskComplexEnterCarAsDriverTimed and CTaskComplexEnterCarAsPassengerTimed: run to the seat's door and get in,
  * or be set in the seat when `seconds` run out. A passenger seat of -1 is any free one. */
 |{kind:'enterCar';vehicle:number;seat:'driver'|number;seconds:number}
 /** CTaskComplexFollowPointRoute: the points in order at eMoveState, each arrived at inside 0.5, then per its mode
  * (0 once, 1 there and back, 2 back and forth for ever, 3 round again for ever). */
 |{kind:'followRoute';points:readonly {x:number;y:number;z:number}[];moveState:number;mode:number}
 /** CTaskComplexSeekEntity for TASK_GOTO_CHAR: to within `radius` of a ped (a handle, the player's included), for
  * `seconds`. */
 |{kind:'gotoPed';target:number;radius:number;seconds:number}
 /** CTaskSimpleDuckToggle (TASK_TOGGLE_DUCK): the ped ducks or stands, and the task is over at once; with `seconds`,
  * CTaskSimpleDuck (TASK_DUCK) holds it ducked where it is for that long. */
 |{kind:'duck';crouch:boolean;seconds?:number};
/** Where the peds a task names stand, which a turn or a flight is measured against. */
export interface ScriptedTaskWorld{
 /** The ped being given the task. */
 self():{x:number;y:number;z:number};
 /** Another ped the task names, or nothing when the handle names none. */
 ped(handle:number):{x:number;y:number;z:number}|undefined;
 /** Whether a car handle names one the browser's peds can get into. */
 vehicle?(handle:number):boolean;
}
/** The target and move-state radii TASK_GO_STRAIGHT_TO_COORD gives CTaskComplexGoToPointAndStandStill. The handler
 * is unreversed. 0.5 is the tightest radius the task itself allows a walking ped (its bStopExactly clamp), and 2 is
 * the constructor's own move-state default. */
export const GO_STRAIGHT_TARGET_RADIUS=.5,GO_STRAIGHT_MOVE_STATE_RADIUS=2;
/** A task time in milliseconds as seconds; the original's -1 means for ever. */
const seconds=(milliseconds:number)=>milliseconds<0?Number.POSITIVE_INFINITY:milliseconds/1000;
/** CVector2D::Heading, atan2(-x, y), in the degrees a script speaks. */
export const nativeHeadingDegrees=(dx:number,dy:number)=>{
 const degrees=Math.atan2(-dx,dy)*180/Math.PI;
 return ((degrees%360)+360)%360;
};
export function scriptedPedOrder(task:ScmScriptedTask,world:ScriptedTaskWorld):ScriptedPedOrder|undefined{
 switch(task.kind){
  // CTaskSimpleStandStill takes its time in milliseconds; a time of nothing is the looped form, which the
  // original builds from CTaskComplexBeStill and which ends only when something aborts it.
  case 'standStill':return {kind:'standStill',seconds:task.time?seconds(task.time):Number.POSITIVE_INFINITY};
  // CTaskSimplePause only waits out its interval. A ped with nothing else to do waits it out standing, which
  // for a ped a script has just made is the whole of what it does.
  case 'pause':return {kind:'standStill',seconds:seconds(task.time)};
  // TASK_STAY_IN_SAME_PLACE: CTaskComplexBeStill while set, and back to wandering when cleared.
  case 'stayInSamePlace':return task.state?{kind:'standStill',seconds:Number.POSITIVE_INFINITY}:{kind:'wander'};
  case 'achieveHeading':return {kind:'achieveHeading',degrees:((task.heading%360)+360)%360};
  case 'turnToFaceCoord':{
   const from=world.self();
   return {kind:'achieveHeading',degrees:nativeHeadingDegrees(task.x-from.x,task.y-from.y)};
  }
  case 'turnToFaceEntity':{
   const target=world.ped(task.target);if(!target)return undefined;
   const from=world.self();
   return {kind:'achieveHeading',degrees:nativeHeadingDegrees(target.x-from.x,target.y-from.y)};
  }
  case 'wanderStandard':return {kind:'wander'};
  case 'die':return {kind:'die'};
  case 'goStraightToCoord':return {kind:'goToPoint',x:task.x,y:task.y,z:task.z,moveState:task.speed,radius:GO_STRAIGHT_TARGET_RADIUS,
   moveStateRadius:GO_STRAIGHT_MOVE_STATE_RADIUS,seconds:seconds(task.time)};
  // The attack style flags, the action delay and chance, and the must-be-on-foot bit are not modelled: the ped
  // fights with the browser's own armed and melee combat.
  case 'killPedOnFoot':return world.ped(task.target)?{kind:'killPed',target:task.target,seconds:seconds(task.time)}:undefined;
  // The blend delta, the X and Y root locks and the interruptable bit are not modelled: the clip replaces the pose at
  // once and the ped stays where it stands.
  case 'playAnim':return {kind:'playAnim',file:task.animationFile,name:task.animationName,loop:task.loop,keepLastFrame:task.keepLastFrame,
   seconds:task.time>0?task.time/1000:Number.POSITIVE_INFINITY};
  case 'lookAtPed':return world.ped(task.target)?{kind:'lookAt',target:task.target,seconds:seconds(task.time)}:undefined;
  case 'enterCarAsDriver':return world.vehicle?.(task.vehicle)?{kind:'enterCar',vehicle:task.vehicle,seat:'driver',seconds:seconds(task.time)}:undefined;
  case 'enterCarAsPassenger':return world.vehicle?.(task.vehicle)?{kind:'enterCar',vehicle:task.vehicle,seat:task.seat,seconds:seconds(task.time)}:undefined;
  case 'followPointRoute':return task.route&&task.route.length?{kind:'followRoute',points:task.route.map(p=>({...p})),moveState:task.speed,mode:task.mode}:undefined;
  // CTaskComplexGoToPointAnyMeans on foot: the vehicle it would take for a long way is not modelled.
  case 'goToCoordAnyMeans':return {kind:'goToPoint',x:task.x,y:task.y,z:task.z,moveState:task.speed,radius:GO_STRAIGHT_TARGET_RADIUS,
   moveStateRadius:GO_STRAIGHT_MOVE_STATE_RADIUS,seconds:Number.POSITIVE_INFINITY};
  case 'gotoPed':return world.ped(task.target)?{kind:'gotoPed',target:task.target,radius:task.radius,seconds:seconds(task.time)}:undefined;
  case 'killPedOnFootTimed':return world.ped(task.target)?{kind:'killPed',target:task.target,seconds:seconds(task.time)}:undefined;
  // CTaskSimpleScratchHead: the ped.ifp XPRESSscratch clip once.
  case 'scratchHead':return {kind:'playAnim',file:'PED',name:'XPRESSscratch',loop:false,keepLastFrame:false,seconds:Number.POSITIVE_INFINITY};
  // CTaskSimpleHandsUp: HANDSUP held for the task's time.
  case 'handsUp':return {kind:'playAnim',file:'PED',name:'handsup',loop:false,keepLastFrame:true,seconds:seconds(task.time),release:true};
  case 'toggleDuck':return {kind:'duck',crouch:task.state};
  case 'duck':return {kind:'duck',crouch:true,seconds:seconds(task.time)};
  case 'smartFleePoint':return {kind:'smartFlee',from:{x:task.x,y:task.y},safe:task.radius,seconds:seconds(task.time)};
  case 'smartFleePed':{
   const threat=world.ped(task.threat);if(!threat)return undefined;
   return {kind:'smartFlee',from:{x:threat.x,y:threat.y},safe:task.radius,seconds:seconds(task.time)};
  }
  default:return undefined;
 }
}
/** CTaskSimpleAchieveHeading's default tolerance and heading-rate multiplier. */
export const ACHIEVE_HEADING_TOLERANCE=.2,ACHIEVE_HEADING_RATE=.5;
/** One frame of CTaskSimpleAchieveHeading: the ped turns towards the heading it was given at half its own
 * pedstats heading-change rate, and the task is done once what it has reached is within the tolerance. Angles
 * are the browser's yaw in radians; `headingChange` is the ped's rate in degrees a frame at fifty frames. */
/** CTaskComplexGoToPointAndStandStill::SelectMoveState (0x668250) over the task's eMoveState: a runner walks inside
 * the move-state radius, and a sprinter walks inside it, runs inside 10 units and sprints beyond. */
export function goToPointMoveState(moveState:number,distance:number,moveStateRadius:number){
 if(moveState===6)return distance>=moveStateRadius?6:4;
 if(moveState===7)return distance>=moveStateRadius?distance>=10?7:6:4;
 return moveState;
}
/** CTaskSimpleGoToPoint::ProcessPed's arrival: inside the radius with the height within 2 units,
 * or when the step the ped is about to take would carry it past the point, whatever the height. */
export function goToPointArrived(distance:number,heightGap:number|undefined,radius:number,step:number){
 return distance<radius&&(heightGap===undefined||Math.abs(heightGap)<2)||distance<=step;
}
/** CTaskComplexFollowPointRoute::GetSubTaskType once a point is reached: the next index, or the route's turn at its
 * end by mode (reversing the points for RETURN's first pass and BACK_AND_FORTH), or nothing when it is over. */
export function nextRoutePoint(route:{points:{x:number;y:number;z:number}[];at:number;mode:number;traversals:number}){
 route.at++;
 if(route.at<route.points.length)return true;
 route.traversals++;
 switch(route.mode){
  case 1:if(route.traversals!==1)return false;route.points.reverse();route.at=0;return true;
  case 2:route.points.reverse();route.at=0;return true;
  case 3:route.at=0;return true;
  default:return false;
 }
}
export function achieveHeadingStep(current:number,desired:number,headingChangeDegrees:number,seconds:number){
 let delta=desired-current;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
 const turn=headingChangeDegrees*Math.PI/180*ACHIEVE_HEADING_RATE*50*seconds;
 const step=Math.max(-turn,Math.min(turn,delta));
 return {heading:current+step,done:Math.abs(delta-step)<=ACHIEVE_HEADING_TOLERANCE};
}
