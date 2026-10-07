import {followRouteSeconds} from './nativeFollowNodeRoute';
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
 /** CTaskComplexDie, with the named clip of TASK_DIE_NAMED_ANIM when one is given. */
 |{kind:'die';file?:string;name?:string}
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
  release?:boolean;
  /** TASK_PLAY_ANIM_NON_INTERRUPTABLE: the clip's task refuses an abort short of an immediate one, so an event
   * response (CEventInAir's fall and landing among them) cannot take the ped off it. */
  uninterruptable?:boolean}
 /** CTaskSimpleTriggerLookAt: the head turns to a ped (a script handle, the player's included) for `seconds`; the
  * task itself is over as soon as it has started the look. */
 |{kind:'lookAt';target:number;seconds:number}
 /** CTaskSimpleClearLookAt: the look the ped has is stopped, and the task is over. */
 |{kind:'clearLookAt'}
 /** CTaskComplexEnterCarAsDriverTimed and CTaskComplexEnterCarAsPassengerTimed: run to the seat's door and get in,
  * or be set in the seat when `seconds` run out. A passenger seat of -1 is any free one. */
 |{kind:'enterCar';vehicle:number;seat:'driver'|number;seconds:number;
  /** The eMoveState to the door (SET_NEXT_DESIRED_MOVE_STATE); a run without one. */
  moveState?:number}
 /** CTaskComplexFollowPointRoute: the points in order at eMoveState, each arrived at inside 0.5, then per its mode
  * (0 once, 1 there and back, 2 back and forth for ever, 3 round again for ever). */
 |{kind:'followRoute';points:readonly {x:number;y:number;z:number}[];moveState:number;mode:number}
 /** CTaskComplexSeekEntity for TASK_GOTO_CHAR: to within `radius` of a ped (a handle, the player's included), for
  * `seconds`. */
 |{kind:'gotoPed';target:number;radius:number;seconds:number;
  /** CEntitySeekPosCalculatorRadiusAngleOffset (TASK_GOTO_CHAR_OFFSET): the point `radius` out from the target at
   * `angle` radians from its heading, 0 being straight ahead of it. */
  offset?:{radius:number;angle:number};
  /** TASK_FOLLOW_FOOTSTEPS: at a walk, and on arrival the ped waits for the target to move off rather than ending. */
  follow?:boolean}
 /** CTaskSimpleDuckToggle (TASK_TOGGLE_DUCK): the ped ducks or stands, and the task is over at once; with `seconds`,
  * CTaskSimpleDuck (TASK_DUCK) holds it ducked where it is for that long. */
 |{kind:'duck';crouch:boolean;seconds?:number}
 /** TASK_USE_MOBILE_PHONE TRUE as a step of a sequence. The iOS handler (0x1001f6590) gives
  * CTaskComplexUseMobilePhone(-1) as the ped's primary scripted task, in a sequence or not; with no duration it never
  * ends, so the step holds the ped standing with the phone out until another task replaces it. */
 |{kind:'mobilePhone'}
 /** The simple tasks that set something on the ped and are over at once: CTaskSimpleTriggerLookAt at a point,
  * CTaskSimpleTogglePedThreatScanner, CTaskSimpleSetCharDecisionMaker (the decision maker's actual index) and
  * CTaskSimpleSetKindaStayInSamePlace. */
 |{kind:'lookAtPoint';x:number;y:number;z:number;seconds:number}
 /** CTaskComplexEvasiveDiveAndGetUp with its heading first: turn to the dive's way (script x, y), EV_DIVE, lie for
  * `seconds`, turn a quarter back and GETUP_FRONT. */
 |{kind:'diveAndGetUp';x:number;y:number;seconds:number}
 |{kind:'threatScanner';onFoot:boolean;inCar:boolean;duringScriptTask:boolean}
 |{kind:'decisionMaker';index:number}
 |{kind:'kindaStayInSamePlace';state:boolean}
 /** CTaskSimpleSetCharIgnoreWeaponRangeFlag (TASK_SET_IGNORE_WEAPON_RANGE_FLAG, reversed): bIgnoreWeaponRange, and the
  * task is over at once. */
 |{kind:'ignoreWeaponRange';state:boolean}
 /** CTaskComplexJump (TASK_JUMP) and CTaskComplexClimb (TASK_CLIMB, the climb forced), reversed: CTaskSimpleJump tests
  * for a hold ahead at the launch (CTaskSimpleClimb::TestForClimb); with one the ped climbs it, else it jumps (a force of
  * 4.5, or 8.5 for a high jump, over its mass) and the task is over once it has landed. `highJump` is
  * m_UsePlayerLaunchForce, the script's flag for both. */
 |{kind:'jump';forceClimb:boolean;highJump:boolean}
 /** CTaskComplexFallAndGetUp(direction, downTime) for TASK_FALL_AND_GET_UP: CTaskSimpleFall's KO clip, `lieMs` on the
  * ground, then CTaskSimpleGetUp; the task is over once the ped stands. */
 |{kind:'fallAndGetUp';clip:'ko_skid_front'|'ko_spin_r'|'ko_skid_back'|'ko_spin_l';lieMs:number}
 /** CTaskSimpleRunAnim for TASK_WEAPON_ROLL: the default group's CROUCH_ROLL_R or _L at a blend of 4, the ped carried
  * along by the clip's own movement; over when the clip ends. */
 |{kind:'roll';clip:'crouch_roll_r'|'crouch_roll_l'}
 /** CTaskSimpleGunControl for TASK_AIM_GUN_AT_* and TASK_SHOOT_AT_*: stand, face the target (a point in the script's
  * coordinates, or a ped's handle) and aim, firing when `fire`, for `seconds`. */
 |{kind:'gunAt';point?:{x:number;y:number;z:number};target?:number;fire:boolean;seconds:number}
 /** CTaskComplexGoToPointShooting: to a point at eMoveState, stopping inside `radius`, firing at a ped on the way. With
  * `aimOnly`, CTaskComplexGoToPointAiming: the gun aimed and not fired, at the ped (a handle; -1 none) or else at
  * `aimPoint` (script coordinates). */
 |{kind:'goToPointShooting';x:number;y:number;z:number;moveState:number;radius:number;target:number;aimOnly?:boolean;aimPoint?:{x:number;y:number;z:number};
  /** CTaskComplexGoToPointAiming (and Shooting) with a gun aimed from the shoulder (canAim, instant-hit or area):
   * CTaskSimpleGunControl's radius, inside which the ped stops and goes on aiming rather than ending the task. */
  gunControlRadius?:number}
 /** CTaskComplexSeekEntityAiming (0x694B90 on, reversed): seek a ped to `seekRadius` (CTaskComplexSeekEntity, 50 s
  * at most), aiming at it once within `aimRadius`; there, stand still aiming for 2 s, or until it is `seekRadius` off
  * again, and seek again. Never over on its own. */
 |{kind:'seekAiming';target:number;seekRadius:number;aimRadius:number}
 /** CTaskComplexDestroyCar: with a gun, CTaskComplexDestroyCarArmed (seek the car into half the weapon's range and
  * shoot it); unarmed, CTaskComplexDestroyCarMelee (seek it into its bound radius and fight it). Over once the car
  * is wrecked. A ped in a car leaves it first, which the mission does before the ped is given this. */
 |{kind:'destroyCar';vehicle:number}
 /** CTaskComplexFollowNodeRoute: along the ped path nodes to a point at eMoveState, or straight at it when it is near
  * and clear; put on the point when `seconds` run out. */
 |{kind:'followNodeRoute';x:number;y:number;z:number;moveState:number;seconds:number;tolerance?:number}
 /** CTaskComplexChat with a partner (a handle, the player's included): the lead speaker chats (CTaskSimpleChat, IDLE_chat),
  * the other stands and listens, each at the script's stage. */
 |{kind:'chat';partner:number;chatter:boolean;stage:number}
 /** CTaskComplexLeaveCar (and the any-car and immediate forms) for the player: out of the car he is in, the one
  * named or any; the on-foot peds' leave tasks run from the mission. */
 |{kind:'leaveCar';vehicle?:number;immediately:boolean}
 /** The player's driving tasks, on his own car (the script peds' run from the mission): CAutoPilot::SetTempAction for
  * `seconds`, and CCarAI::GetCarToGoToCoors (and its accurate and straight-line forms). */
 |{kind:'carTempAction';vehicle:number;action:number;seconds:number}
 |{kind:'carDriveToCoord';vehicle:number;x:number;y:number;z:number;cruise:number;style:number;accurate:boolean;straight:boolean};
/** Where the peds a task names stand, which a turn or a flight is measured against. */
export interface ScriptedTaskWorld{
 /** The ped being given the task. */
 self():{x:number;y:number;z:number};
 /** A car the task names, where it is, or nothing when the handle names none the browser has built. */
 vehiclePosition?(handle:number):{x:number;y:number;z:number}|undefined;
 /** A script object the task names, where it is. */
 objectPosition?(handle:number):{x:number;y:number;z:number}|undefined;
 /** Another ped the task names, or nothing when the handle names none. */
 ped(handle:number):{x:number;y:number;z:number}|undefined;
 /** A script's decision maker handle as the pool index it stands for (ScmDecisionMakers.actualIndex). */
 decisionMaker?(handle:number):number|undefined;
 /** Whether a car handle names one the browser's peds can get into. */
 vehicle?(handle:number):boolean;
}
/** The target and move-state radii TASK_GO_STRAIGHT_TO_COORD gives CTaskComplexGoToPointAndStandStill. The handler
 * is unreversed. 0.5 is the tightest radius the task itself allows a walking ped (its bStopExactly clamp), and 2 is
 * the constructor's own move-state default. */
export const GO_STRAIGHT_TARGET_RADIUS=.5,GO_STRAIGHT_MOVE_STATE_RADIUS=2;
/** An enter-car task's move state when the script set one other than the run it defaults to. */
const moveStateOf=(task:{moveState?:number})=>task.moveState!==undefined&&task.moveState!==6?{moveState:task.moveState}:{};
/** A task time in milliseconds as seconds; the original's -1 means for ever. */
const seconds=(milliseconds:number)=>milliseconds<0?Number.POSITIVE_INFINITY:milliseconds/1000;
/** How close TASK_FOLLOW_FOOTSTEPS' stand-in keeps behind its target (AUTHORED). */
const FOLLOW_FOOTSTEPS_RADIUS=1.5;
/** CVector2D::Heading, atan2(-x, y), in the degrees a script speaks. */
export const nativeHeadingDegrees=(dx:number,dy:number)=>{
 const degrees=Math.atan2(-dx,dy)*180/Math.PI;
 return ((degrees%360)+360)%360;
};
/** CTaskComplexFallAndGetUp's fall clip by direction (0x678700). */
const FALL_DIRECTION_CLIPS=['ko_skid_front','ko_spin_r','ko_skid_back','ko_spin_l'] as const;
export function scriptedPedOrder(task:ScmScriptedTask,world:ScriptedTaskWorld):ScriptedPedOrder|undefined{
 switch(task.kind){
  // CTaskSimpleStandStill takes its time in milliseconds; a time of nothing is the looped form, which the
  // original builds from CTaskComplexBeStill and which ends only when something aborts it.
  case 'standStill':return {kind:'standStill',seconds:task.time?seconds(task.time):Number.POSITIVE_INFINITY};
  // CTaskSimpleTriggerLookAt at the car: the head turns to where it is as the task starts.
  case 'lookAtVehicle':{const at=world.vehiclePosition?.(task.vehicle);return at&&{kind:'lookAtPoint',...at,seconds:seconds(task.time)};}
  case 'diveAndGetUp':return {kind:'diveAndGetUp',x:task.x,y:task.y,seconds:seconds(Math.max(0,task.time))};
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
  case 'dieNamedAnim':return {kind:'die',file:task.animationFile,name:task.animationName};
  // CTaskSimpleLookAbout: CTaskSimpleRunTimedAnim of IDLE_HBHB for the script's time.
  case 'lookAbout':return {kind:'playAnim',file:'ped',name:'IDLE_HBHB',loop:true,keepLastFrame:false,seconds:seconds(task.time)};
  case 'lookAtObject':{const at=world.objectPosition?.(task.object);return at&&{kind:'lookAtPoint',...at,seconds:seconds(task.time)};}
  // CTaskComplexFleePoint and CTaskComplexFleeEntity (and the any-means form on foot) are taken as their smart forms:
  // away from where the threat is as the task starts.
  case 'fleePoint':return {kind:'smartFlee',from:{x:task.x,y:task.y},safe:task.radius,seconds:seconds(task.time)};
  case 'fleePed':case 'fleePedAnyMeans':{
   const threat=world.ped(task.threat);if(!threat)return undefined;
   return {kind:'smartFlee',from:{x:threat.x,y:threat.y},safe:task.radius,seconds:seconds(task.time)};
  }
  // TASK_DEAD (unreversed; CTaskSimpleDead's ProcessPed is not reversed either) kills the ped as TASK_DIE does. MAIN
  // uses it for the bodies it lays out at scenes.
  case 'dead':return {kind:'die'};
  case 'goStraightToCoord':return {kind:'goToPoint',x:task.x,y:task.y,z:task.z,moveState:task.speed,radius:GO_STRAIGHT_TARGET_RADIUS,
   moveStateRadius:GO_STRAIGHT_MOVE_STATE_RADIUS,seconds:seconds(task.time)};
  // The attack style flags, the action delay and chance, and the must-be-on-foot bit are not modelled: the ped
  // fights with the browser's own armed and melee combat.
  case 'killPedOnFoot':return world.ped(task.target)?{kind:'killPed',target:task.target,seconds:seconds(task.time)}:undefined;
  // The blend delta and the X and Y root locks are not modelled: the clip replaces the pose at once and the ped stays
  // where it stands. The interruptable bit is kept for the player, whose fall it holds off.
  case 'playAnim':return {kind:'playAnim',file:task.animationFile,name:task.animationName,loop:task.loop,keepLastFrame:task.keepLastFrame,
   seconds:task.time>0?task.time/1000:Number.POSITIVE_INFINITY,...task.interruptable?{}:{uninterruptable:true}};
  case 'lookAtPed':return world.ped(task.target)?{kind:'lookAt',target:task.target,seconds:seconds(task.time)}:undefined;
  case 'clearLookAt':return {kind:'clearLookAt'};
  case 'enterCarAsDriver':return world.vehicle?.(task.vehicle)?{kind:'enterCar',vehicle:task.vehicle,seat:'driver',seconds:seconds(task.time),...moveStateOf(task)}:undefined;
  case 'enterCarAsPassenger':return world.vehicle?.(task.vehicle)?{kind:'enterCar',vehicle:task.vehicle,seat:task.seat,seconds:seconds(task.time),...moveStateOf(task)}:undefined;
  case 'followPointRoute':return task.route&&task.route.length?{kind:'followRoute',points:task.route.map(p=>({...p})),moveState:task.speed,mode:task.mode}:undefined;
  // CTaskComplexGoToPointAnyMeans on foot: the vehicle it would take for a long way is not modelled.
  // TASK_CHAT_WITH_CHAR (unreversed) builds CTaskComplexChat from the lead-speaker flag and its last operand (1 in
  // every mission), taken here as the task's stage, with no speech context: nothing is said.
  case 'chatWithPed':return world.ped(task.other)?{kind:'chat',partner:task.other,chatter:task.leadSpeaker,stage:task.unknown}:undefined;
  case 'carTempAction':return {kind:'carTempAction',vehicle:task.vehicle,action:task.actionId,seconds:task.time/1000};
  case 'carDriveToCoord':return {kind:'carDriveToCoord',vehicle:task.vehicle,x:task.x,y:task.y,z:task.z,cruise:task.speed,style:task.drivingStyle,
   accurate:task.driveStyle===1,straight:task.driveStyle===2};
  case 'leaveCar':return {kind:'leaveCar',vehicle:task.vehicle,immediately:false};
  case 'leaveAnyCar':return {kind:'leaveCar',immediately:false};
  case 'leaveCarImmediately':return {kind:'leaveCar',vehicle:task.vehicle,immediately:true};
  case 'followPathNodesToCoord':return {kind:'followNodeRoute',x:task.x,y:task.y,z:task.z,moveState:task.speed,seconds:followRouteSeconds(task.time),tolerance:task.radius};
  case 'goToCoordAnyMeans':return {kind:'goToPoint',x:task.x,y:task.y,z:task.z,moveState:task.speed,radius:GO_STRAIGHT_TARGET_RADIUS,
   moveStateRadius:GO_STRAIGHT_MOVE_STATE_RADIUS,seconds:Number.POSITIVE_INFINITY};
  case 'gotoPed':return world.ped(task.target)?{kind:'gotoPed',target:task.target,radius:task.radius,seconds:followRouteSeconds(task.time)}:undefined;
  // AUTHORED: CTaskComplexFollowPedFootsteps is unreversed past its constructor (which sets PEDMOVE_WALK and a point
  // route of the target's steps). The ped walks after the target, waits within FOLLOW_FOOTSTEPS_RADIUS of it, and the
  // task never ends by itself; dealer.scm gives it to a dealer for 6 s before sending him back.
  case 'followFootsteps':return world.ped(task.target)?{kind:'gotoPed',target:task.target,radius:FOLLOW_FOOTSTEPS_RADIUS,seconds:Number.POSITIVE_INFINITY,follow:true}:undefined;
  // CTaskComplexSeekEntity with CEntitySeekPosCalculatorRadiusAngleOffset, arrived within half a unit of that point.
  case 'gotoPedOffset':return world.ped(task.target)?{kind:'gotoPed',target:task.target,radius:.5,seconds:seconds(task.time),offset:{radius:task.offsetX,angle:task.offsetY*Math.PI/180}}:undefined;
  case 'killPedOnFootTimed':return world.ped(task.target)?{kind:'killPed',target:task.target,seconds:seconds(task.time)}:undefined;
  // CTaskSimpleScratchHead: the ped.ifp XPRESSscratch clip once.
  case 'scratchHead':return {kind:'playAnim',file:'PED',name:'XPRESSscratch',loop:false,keepLastFrame:false,seconds:Number.POSITIVE_INFINITY};
  // CTaskSimpleHandsUp: HANDSUP held for the task's time.
  case 'handsUp':return {kind:'playAnim',file:'PED',name:'handsup',loop:false,keepLastFrame:true,seconds:seconds(task.time),release:true};
  case 'toggleDuck':return {kind:'duck',crouch:task.state};
  // Stopping it inside a sequence (ped -1) reads a ped that is not there on iOS; no script does.
  case 'useMobilePhone':return task.start?{kind:'mobilePhone'}:undefined;
  case 'gotoPedAiming':return world.ped(task.target)?{kind:'seekAiming',target:task.target,seekRadius:task.seekRadius,aimRadius:task.aimRadius}:undefined;
  // CTaskComplexGoToPointAiming (unreversed in gta-reversed; iOS handler 0x1001f1140, CreateFirstSubTask 0x1004042d0,
  // ControlSubTask 0x10040442c). A negative or stale aim ped aims at the point instead. The walk
  // (CTaskComplexGoToPointAndStandStill) has its radii reset on the first pass to stop at 0.5 and slow at 2, unless the
  // slow-down distance is exactly 2, when the script's radius stands. The ped's weapon picks the rest as the order starts.
  case 'goToCoordWhileAiming':{
   const atPed=task.aimPed>=0&&world.ped(task.aimPed);
   return {kind:'goToPointShooting',x:task.x,y:task.y,z:task.z,moveState:task.speed,radius:Math.fround(task.slowDownDistance)===2?task.targetRadius:GO_STRAIGHT_TARGET_RADIUS,
    target:atPed?task.aimPed:-1,aimOnly:true,aimPoint:atPed?undefined:{x:task.aimX,y:task.aimY,z:task.aimZ},gunControlRadius:task.targetRadius};
  }
  // CTaskSimpleCower: CTaskSimpleRunAnim of HANDSCOWER (not looped, removed once over), and then the task is.
  case 'cower':return {kind:'playAnim',file:'PED',name:'handscower',loop:false,keepLastFrame:false,seconds:Number.POSITIVE_INFINITY};
  // CTaskComplexGoToPointShooting (iOS handler 0x1001e83cc) runs CTaskComplexGoToPointAiming's own subtask functions:
  // operand 5 is the target radius and 6 the slow-down distance, with the same 0.5 stop radius and weapon branches,
  // firing bursts where the aiming walk only aims.
  case 'goToCoordWhileShooting':return world.ped(task.target)?{kind:'goToPointShooting',x:task.x,y:task.y,z:task.z,moveState:task.speed,
   radius:Math.fround(task.stopRadius)===2?task.turnRadius:GO_STRAIGHT_TARGET_RADIUS,target:task.target,gunControlRadius:task.turnRadius}:undefined;
  case 'destroyCar':return world.vehicle?.(task.vehicle)?{kind:'destroyCar',vehicle:task.vehicle}:undefined;
  // TASK_GOTO_CAR: CTaskComplexSeekEntity after the car, at a run, to within the radius, for the time; the car's place
  // is taken as the task starts.
  case 'gotoCar':{const at=world.vehiclePosition?.(task.vehicle);return at&&{kind:'goToPoint',x:at.x,y:at.y,z:at.z,moveState:6,radius:task.radius,
   moveStateRadius:GO_STRAIGHT_MOVE_STATE_RADIUS,seconds:seconds(task.time)};}
  case 'shootAtCoord':return {kind:'gunAt',point:{x:task.x,y:task.y,z:task.z},fire:true,seconds:seconds(task.time)};
  case 'aimGunAtCoord':return {kind:'gunAt',point:{x:task.x,y:task.y,z:task.z},fire:false,seconds:seconds(task.time)};
  case 'shootAtPed':return world.ped(task.target)?{kind:'gunAt',target:task.target,fire:true,seconds:seconds(task.time)}:undefined;
  case 'aimGunAtPed':return world.ped(task.target)?{kind:'gunAt',target:task.target,fire:false,seconds:seconds(task.time)}:undefined;
  case 'lookAtCoord':return {kind:'lookAtPoint',x:task.x,y:task.y,z:task.z,seconds:seconds(task.time)};
  case 'togglePedThreatScanner':return {kind:'threatScanner',onFoot:task.onFoot,inCar:task.inCar,duringScriptTask:task.duringScriptTask};
  case 'setDecisionMaker':{const index=world.decisionMaker?.(task.decisionMaker);return index===undefined?undefined:{kind:'decisionMaker',index};}
  case 'kindaStayInSamePlace':return {kind:'kindaStayInSamePlace',state:task.state};
  case 'setIgnoreWeaponRangeFlag':return {kind:'ignoreWeaponRange',state:task.state};
  // iOS: TASK_CLIMB is CTaskComplexJump(FORCE) under CTaskComplexClimb's vtable (0x1001f8458), TASK_JUMP
  // CTaskComplexJump(0) (0x1001e6cec); each stores its flag as m_UsePlayerLaunchForce.
  case 'climb':return {kind:'jump',forceClimb:true,highJump:task.flag};
  case 'jump':return {kind:'jump',forceClimb:false,highJump:task.state};
  // iOS 0x1001e6c04: new CTaskComplexFallAndGetUp(direction, time) (ctor 0x100414850): 0 KO_SKID_FRONT, 1 KO_SPIN_R,
  // 2 KO_SKID_BACK, 3 KO_SPIN_L; another direction leaves the clip unset, which the port does not guess at.
  // iOS 0x1001f1f90: new CTaskSimpleRunAnim(ANIM_GROUP_DEFAULT, flag ? 59 CROUCH_ROLL_R : 57 CROUCH_ROLL_L, 4.0).
  case 'weaponRoll':return {kind:'roll',clip:task.state?'crouch_roll_r':'crouch_roll_l'};
  case 'fallAndGetUp':{const clip=FALL_DIRECTION_CLIPS[task.direction];return clip?{kind:'fallAndGetUp',clip,lieMs:Math.max(0,task.time)}:undefined;}
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
