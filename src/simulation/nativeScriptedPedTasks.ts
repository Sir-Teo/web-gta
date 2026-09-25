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
 |{kind:'killPed';target:number;seconds:number};
/** Where the peds a task names stand, which a turn or a flight is measured against. */
export interface ScriptedTaskWorld{
 /** The ped being given the task. */
 self():{x:number;y:number;z:number};
 /** Another ped the task names, or nothing when the handle names none. */
 ped(handle:number):{x:number;y:number;z:number}|undefined;
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
export function achieveHeadingStep(current:number,desired:number,headingChangeDegrees:number,seconds:number){
 let delta=desired-current;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
 const turn=headingChangeDegrees*Math.PI/180*ACHIEVE_HEADING_RATE*50*seconds;
 const step=Math.max(-turn,Math.min(turn,delta));
 return {heading:current+step,done:Math.abs(delta-step)<=ACHIEVE_HEADING_TOLERANCE};
}
