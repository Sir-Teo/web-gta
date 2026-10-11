import type {NativeAnimation} from '../assets/ifp';
import {PED_ORIGIN_HEIGHT} from './nativeSwim';
import {achieveHeadingStep,goToPointArrived,goToPointMoveState,nextRoutePoint,type ScriptedPedOrder} from './nativeScriptedPedTasks';
import {NATIVE_PLAYER_HEADING_CHANGE_RATE} from './nativePlayerLocomotion';

/* The tasks a script gives the player's own ped (scplayer): CPedIntelligence's primary task, run instead of
 * CTaskSimplePlayerOnFoot while it lasts. The missions mostly do this with SET_PLAYER_CONTROL off, walking CJ to a
 * mark, turning him, or playing a clip on him before a cut. The browser's player moves by the pad, so a running task
 * speaks for the pad: it names where the stick points and how hard, and the player's own movement does the rest. */

/** MAP_Z_LOW_LIMIT: a script point at or below it is on the ground wherever that is. */
const MAP_Z_LOW_LIMIT=-100;

type Running=
 |{kind:'standStill';remaining:number}
 |{kind:'dive';phase:'loading'|'diving'|'done';yaw:number;lie:number}
 |{kind:'achieveHeading';heading:number}
 |{kind:'goToPoint';x:number;z:number;y?:number;moveState:number;radius:number;moveStateRadius:number;remaining:number}
 |{kind:'playAnim';clip:string;loop:boolean;hold:boolean;release:boolean;remaining:number;phase:'loading'|'ready'|'playing';elapsed:number;uninterruptable:boolean}
 |{kind:'followRoute';points:{x:number;y:number;z:number}[];at:number;mode:number;traversals:number;moveState:number}
 |{kind:'enterCar';vehicle:number;remaining:number;started:boolean}
 |{kind:'leaveCar';vehicle?:number;immediately:boolean;started:boolean}
 |{kind:'carTask';order:Extract<ScriptedPedOrder,{kind:'carTempAction'|'carDriveToCoord'}>;started:boolean}
 /** CTaskSimpleUseGun aiming at a point (renderer coordinates), or at a script ped where it stands each frame, for
  * the seconds left. */
 |{kind:'gunAt';point:{x:number;y:number;z:number};target?:number;remaining:number}
 /** CTaskComplexUseMobilePhone as his primary task: on the call until TASK_USE_MOBILE_PHONE stops it. */
 |{kind:'mobilePhone'};

/** What the player's ped is and can do, in renderer terms (y up, the script's y is -z). */
export interface PlayerTaskBody{
 position:{x:number;y:number;z:number};
 heading:number;
 /** Ground speed, units a second. */
 speed:number;
 onFoot:boolean;
 view?:{
  hasReaction(name:string):boolean;
  installReactions(clips:Record<string,NativeAnimation>):void;
  playReaction(name:string,duration?:number,fitDuration?:boolean,startSeconds?:number,loop?:boolean):void;
  clearReaction():void;
  readonly reactionName:string|undefined;
  reactionDuration(name:string):number|undefined;
  /** The clip's time over its length, which SET_CHAR_ANIM_SPEED and SET_CHAR_ANIM_CURRENT_TIME move. */
  readonly reactionProgress:number|undefined;
 };
}
export interface PlayerTaskWorld{
 /** A clip from the script's animation block (PED is ped.ifp). */
 animation(file:string,name:string):Promise<NativeAnimation|undefined>;
 /** CTaskComplexEnterCarAsDriver on the player: his own walk to the door and get-in (CarEntry) for the car a script
  * handle names; false when it cannot begin. */
 enterCar?(vehicle:number):boolean;
 /** The Timed form out of time: set in at the wheel. */
 warpIntoCar?(vehicle:number):void;
 /** CTaskComplexLeaveCar on the player: 'started' once he is getting out, 'wait' while the car is not yet still
  * enough to step out of (CTaskSimpleCarWaitToSlowDown; the immediate form does not wait), 'none' when he is in no
  * car or not the one named. */
 leaveCar?(vehicle:number|undefined,immediately:boolean):'started'|'wait'|'none';
 /** A driving task on the car he is in (the one named): its autopilot takes the wheel; false when he is in no such car. */
 startCarTask?(order:Extract<ScriptedPedOrder,{kind:'carTempAction'|'carDriveToCoord'}>):boolean;
 /** Whether that task still drives: the temporary action or the mission is not yet over. */
 carTaskRunning?():boolean;
 /** The pad has the car back. */
 endCarTask?():void;
 /** CTaskComplexUseMobilePhone on the player: the phone comes out (PlayerPhone), as TASK_USE_MOBILE_PHONE's own does. */
 mobilePhone?(start:boolean):void;
 /** Where a script ped's handle stands (renderer coordinates), for a task aimed at him; none once he is gone. */
 pedPoint?(handle:number):{x:number;y:number;z:number}|undefined;
 /** TASK_AIM_GUN_AT_COORD on the player: his weapon aims at the point (renderer coordinates) until undefined. */
 aimAt?(point:{x:number;y:number;z:number}|undefined):void;
 /** Where the player is with cars: on foot, on his way into one, or in one. */
 carState?():'none'|'entering'|'seated';
 /** CTaskSimpleDuckToggle on the player: he crouches or stands. */
 duck?(crouch:boolean):void;
 /** CTaskSimpleTriggerLookAt at a point in the script's coordinates. */
 lookAtPoint?(x:number,y:number,z:number,seconds:number):void;
 /** CTaskComplexEvasiveDiveAndGetUp: the dive along a renderer yaw, the lie and the get-up; `diving` while it lasts. */
 dive?(yaw:number,lieSeconds:number):boolean;
 diving?():boolean;
 /** CTaskComplexDie: he dies. */
 die?():void;
 /** CTaskSimpleTriggerLookAt: the head looks at the ped a script handle names. */
 lookAt?(target:number,seconds:number):void;
 /** CTaskSimpleClearLookAt: the head lets go of what it looks at. */
 clearLookAt?():void;
 /** CPedPlacement::FindZCoorForPed and SetPosn: the feet on the ground under the point. */
 placeOnGround(x:number,z:number,originY?:number):void;
}
/** What the running task asks of the pad this frame: a stick pushed toward `yaw` (renderer yaw of the direction),
 * the walk or sprint modifier, or the player held still facing `facing`. */
export type PlayerTaskControl=
 |{kind:'move';yaw:number;walk:boolean;sprint:boolean}
 |{kind:'hold';facing?:number};

export class PlayerScriptTasks{
 private sequence?:{orders:ScriptedPedOrder[];at:number;repeat:boolean;sequence:boolean};
 private running?:Running;
 /** A clip left on its last frame, which the next task lets go. */
 private held?:string;
 private generation=0;
 constructor(private world:PlayerTaskWorld){}
 /** The kinds the player can carry out; anything else the thread gives up on. */
 static runs(order:ScriptedPedOrder){return order.kind==='standStill'||order.kind==='achieveHeading'||order.kind==='goToPoint'||order.kind==='playAnim'||order.kind==='lookAt'||order.kind==='clearLookAt'||order.kind==='followRoute'||order.kind==='duck'&&order.seconds===undefined||
  order.kind==='enterCar'&&order.seat==='driver'||order.kind==='leaveCar'||order.kind==='carTempAction'||order.kind==='carDriveToCoord'||
  order.kind==='lookAtPoint'||order.kind==='die'||order.kind==='diveAndGetUp'||order.kind==='mobilePhone'||order.kind==='gunAt'&&(!!order.point||order.target!==undefined)&&!order.fire;}
 /** Whether a task of the script's runs on the player (GET_SCRIPT_TASK_STATUS). */
 get active(){return !!(this.running||this.sequence);}
 /** A TASK_PLAY_ANIM_NON_INTERRUPTABLE clip runs on him: the in-air event's fall and landing do not take over. */
 get uninterruptable(){return this.running?.kind==='playAnim'&&this.running.uninterruptable;}
 give(order:ScriptedPedOrder,body:PlayerTaskBody){this.giveSequence([order],false,body,false);}
 /** CTaskComplexSequence on the player: the tasks one after another, from `start` on the first pass (nested
  * sequences arrive run inline, so there can be more than the eight one sequence holds). */
 giveSequence(orders:readonly ScriptedPedOrder[],repeat:boolean,body:PlayerTaskBody,sequence=true,start=0){
  // CTaskSimpleAnim::MakeAbortable on the command event: the clip the old task plays blends out, a looped one too.
  if(this.running?.kind==='playAnim'&&body.view?.reactionName===this.running.clip)body.view.clearReaction();
  this.sequence={orders:[...orders],at:Math.min(Math.max(0,start),orders.length),repeat,sequence};
  this.next(body);
 }
 /** TASK_USE_MOBILE_PHONE with 0 (iOS 0x1001f7e34): the phone task found in his primary task, a sequence's step
  * too, is told to stop, and the sequence goes on to its next task. */
 stopPhone(body:PlayerTaskBody){if(this.running?.kind==='mobilePhone')this.next(body);}
 /** GET_SEQUENCE_PROGRESS on the player: the index of the task his sequence is on, -1 without one. */
 get progress(){const s=this.sequence;return s?.sequence?s.at-1:-1;}
 /** CLEAR_CHAR_TASKS (and its immediate form) on the player: the task and any clip it ran go at once. */
 clear(body:PlayerTaskBody){
  if(this.running?.kind==='gunAt')this.world.aimAt?.(undefined);
  const clip=this.running?.kind==='playAnim'?this.running.clip:this.held;
  if(clip!==undefined&&body.view?.reactionName===clip)body.view.clearReaction();
  this.endCarTask();
  this.running=undefined;this.sequence=undefined;this.held=undefined;this.generation++;
 }
 private next(body:PlayerTaskBody){
  for(let step=0,steps=this.sequence?.orders.length??0;step<=steps;step++){
   const sequence=this.sequence;
   if(!sequence){this.running=undefined;return;}
   if(sequence.at>=sequence.orders.length){
    if(!sequence.repeat){this.sequence=undefined;this.running=undefined;return;}
    sequence.at=0;
   }
   this.apply(sequence.orders[sequence.at++],body);
   if(this.running)return;
  }
  this.sequence=undefined;this.running=undefined;
 }
 /** A driving task that had the car gives it back. */
 private endCarTask(){if(this.running?.kind==='carTask'&&this.running.started)this.world.endCarTask?.();}
 private apply(order:ScriptedPedOrder,body:PlayerTaskBody){
  this.endCarTask();
  if(this.running?.kind==='gunAt')this.world.aimAt?.(undefined);
  this.running=undefined;this.generation++;
  if(this.held!==undefined){if(body.view?.reactionName===this.held)body.view.clearReaction();this.held=undefined;}
  switch(order.kind){
   case 'standStill':this.running={kind:'standStill',remaining:order.seconds};break;
   // The script's degrees clockwise from north are the renderer's yaw plus half a turn.
   case 'achieveHeading':this.running={kind:'achieveHeading',heading:order.degrees*Math.PI/180+Math.PI};break;
   case 'goToPoint':this.running={kind:'goToPoint',x:order.x,z:-order.y,y:order.z>MAP_Z_LOW_LIMIT?order.z:undefined,moveState:order.moveState,
    radius:order.radius,moveStateRadius:order.moveStateRadius,remaining:order.seconds};break;
   case 'playAnim':{
    const clip=order.name.toLowerCase(),own:Running={kind:'playAnim',clip,loop:order.loop,hold:order.keepLastFrame,release:!!order.release,remaining:order.seconds,phase:'loading',elapsed:0,uninterruptable:!!order.uninterruptable};
    this.running=own;
    const generation=this.generation;
    if(order.file.toLowerCase()==='ped'&&body.view?.hasReaction(clip)){own.phase='ready';break;}
    void this.world.animation(order.file,order.name).then(animation=>{
     if(this.generation!==generation||this.running!==own)return;
     if(!animation||!body.view){own.phase='playing';own.remaining=0;return;}
     body.view.installReactions({[clip]:animation});own.phase='ready';
    });
    break;
   }
   case 'followRoute':this.running={kind:'followRoute',points:order.points.map(q=>({x:q.x,y:q.z,z:-q.y})),at:0,mode:order.mode,traversals:0,moveState:order.moveState};break;
   case 'duck':this.world.duck?.(order.crouch);break;
   case 'enterCar':this.running={kind:'enterCar',vehicle:order.vehicle,remaining:order.seconds,started:false};break;
   case 'leaveCar':this.running={kind:'leaveCar',vehicle:order.vehicle,immediately:order.immediately,started:false};break;
   case 'carTempAction':case 'carDriveToCoord':this.running={kind:'carTask',order,started:false};break;
   // The trigger task starts the look and is over.
   case 'lookAt':this.world.lookAt?.(order.target,order.seconds);break;
   case 'clearLookAt':this.world.clearLookAt?.();break;
   case 'lookAtPoint':this.world.lookAtPoint?.(order.x,order.y,order.z,order.seconds);break;
   case 'die':this.world.die?.();break;
   // A sequence's TASK_USE_MOBILE_PHONE (LA1FIN2's: CJ walks to Sweet's door, waits, and takes the call): the phone
   // comes out and he stays on the call until the script's TASK_USE_MOBILE_PHONE with 0 stops it (stopPhone).
   case 'mobilePhone':this.world.mobilePhone?.(true);this.running={kind:'mobilePhone'};break;
   // TASK_AIM_GUN_AT_COORD (CAT2: CJ, frozen at the counter, holds the shotgun on the clerk for ten seconds), and
   // TASK_AIM_GUN_AT_CHAR, which follows the ped.
   case 'gunAt':{
    const point=order.point?{x:order.point.x,y:order.point.z,z:-order.point.y}:order.target!==undefined?this.world.pedPoint?.(order.target):undefined;
    if(point){this.running={kind:'gunAt',point,target:order.point?undefined:order.target,remaining:order.seconds};this.world.aimAt?.(point);}
    break;
   }
   // The script's (x, y) way is the renderer's (x, -y); its yaw is atan2(x, z) there.
   case 'diveAndGetUp':{
    const own:Running={kind:'dive',phase:'loading',yaw:Math.atan2(order.x,-order.y),lie:order.seconds};this.running=own;
    const start=()=>{own.phase=this.world.dive?.(own.yaw,own.lie)?'diving':'done';};
    if(body.view?.hasReaction('ev_dive')){start();break;}
    const generation=this.generation;
    void this.world.animation('ped','EV_dive').then(animation=>{
     if(this.generation!==generation||this.running!==own)return;
     if(animation&&body.view){body.view.installReactions({ev_dive:animation});start();}else own.phase='done';
    });
    break;
   }
   default:break;
  }
 }
 /** One frame of the running task, and what it asks of the pad. Nothing when no task of the script's runs, or while
  * one runs that CarEntry moves him for (getting into or out of a car). */
 step(dt:number,body:PlayerTaskBody):PlayerTaskControl|undefined{
  const o=this.running;if(!o)return undefined;
  switch(o.kind){
   case 'enterCar':{
    const state=this.world.carState?.()??'none';
    if(!o.started){
     // Already in: nothing to do. Otherwise the walk to the door and the get-in begin, or the task is over.
     if(state==='seated'||!(o.started=!!this.world.enterCar?.(o.vehicle)))this.next(body);
     return undefined;
    }
    if(state!=='seated'&&o.remaining!==Number.POSITIVE_INFINITY){o.remaining-=dt;if(o.remaining<=0){this.world.warpIntoCar?.(o.vehicle);this.next(body);return undefined;}}
    if(state!=='entering')this.next(body);
    return undefined;
   }
   case 'carTask':{
    if(!o.started){if(!(o.started=!!this.world.startCarTask?.(o.order)))this.next(body);return undefined;}
    if(!this.world.carTaskRunning?.()){this.endCarTask();this.next(body);}
    return undefined;
   }
   case 'leaveCar':{
    if(!o.started){
     const began=this.world.leaveCar?.(o.vehicle,o.immediately)??'none';
     if(began==='started')o.started=true;else if(began==='none')this.next(body);
     return undefined;
    }
    if((this.world.carState?.()??'none')==='none')this.next(body);
    return undefined;
   }
   case 'standStill':
    o.remaining-=dt;if(o.remaining<=0)this.next(body);
    return {kind:'hold'};
   case 'gunAt':{
    // A ped aimed at is followed; once he is gone the task is over.
    const point=o.target!==undefined?this.world.pedPoint?.(o.target):o.point;
    o.remaining-=dt;if(o.remaining<=0||!point){this.world.aimAt?.(undefined);this.next(body);return {kind:'hold'};}
    if(point!==o.point){o.point=point;this.world.aimAt?.(point);}
    return {kind:'hold',facing:Math.atan2(point.x-body.position.x,point.z-body.position.z)};
   }
   case 'mobilePhone':return {kind:'hold'};
   case 'dive':
    if(o.phase==='loading')return {kind:'hold'};
    if(o.phase==='done'||!this.world.diving?.())this.next(body);
    return undefined;
   case 'achieveHeading':{
    const turned=achieveHeadingStep(body.heading,o.heading,NATIVE_PLAYER_HEADING_CHANGE_RATE,dt);
    if(turned.done)this.next(body);
    return {kind:'hold',facing:turned.heading};
   }
   case 'goToPoint':{
    // Out of time and not yet standing, CTaskComplexGoToPointAndStandStillTimed puts the ped on the point.
    if(o.remaining!==Number.POSITIVE_INFINITY){o.remaining-=dt;if(o.remaining<=0){o.remaining=Number.POSITIVE_INFINITY;this.world.placeOnGround(o.x,o.z,o.y);return {kind:'hold'};}}
    const q=body.position,gx=o.x-q.x,gz=o.z-q.z,distance=Math.hypot(gx,gz);
    if(goToPointArrived(distance,o.y===undefined?undefined:q.y+PED_ORIGIN_HEIGHT-o.y,o.radius,body.speed*dt)){this.next(body);return {kind:'hold'};}
    const moveState=goToPointMoveState(o.moveState,distance,o.moveStateRadius);
    return {kind:'move',yaw:Math.atan2(gx,gz),walk:moveState<=5,sprint:moveState>=7};
   }
   case 'followRoute':{
    const q=body.position,point=o.points[o.at],gx=point.x-q.x,gz=point.z-q.z,distance=Math.hypot(gx,gz);
    if(goToPointArrived(distance,point.y>MAP_Z_LOW_LIMIT?q.y+PED_ORIGIN_HEIGHT-point.y:undefined,.5,body.speed*dt)){if(!nextRoutePoint(o))this.next(body);return {kind:'hold'};}
    return {kind:'move',yaw:Math.atan2(gx,gz),walk:o.moveState<=5,sprint:o.moveState>=7};
   }
   case 'playAnim':{
    const view=body.view;
    if(o.phase==='loading')return {kind:'hold'};
    if(o.phase==='ready'&&view){view.playReaction(o.clip,o.loop||o.hold?Number.POSITIVE_INFINITY:undefined,false,0,o.loop);o.phase='playing';o.elapsed=0;return {kind:'hold'};}
    o.elapsed+=dt;o.remaining-=dt;
    // The clip ends when its own time does, which a script can stop or move; the task's time is the clock's.
    const replaced=view?.reactionName!==o.clip,ended=!o.loop&&!(o.hold&&o.release)&&(view?.reactionProgress??1)>=1;
    if(o.remaining<=0||replaced||ended){
     if(!replaced&&view){if(o.hold&&!o.release)this.held=o.clip;else view.clearReaction();}
     this.next(body);
    }
    return {kind:'hold'};
   }
  }
 }
}
