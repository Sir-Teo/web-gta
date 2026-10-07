import {describe,expect,test} from 'vitest';
import {ACHIEVE_HEADING_TOLERANCE,achieveHeadingStep,goToPointArrived,goToPointMoveState,nativeHeadingDegrees,nextRoutePoint,scriptedPedOrder,type ScriptedTaskWorld} from '../src/simulation/nativeScriptedPedTasks';
import type {ScmScriptedTask} from '../src/engine/ScmThread';

const world=(peds:Record<number,{x:number;y:number;z:number}>,self={x:0,y:0,z:0}):ScriptedTaskWorld=>
 ({self:()=>self,ped:handle=>peds[handle]});

describe('the tasks a script gives a ped',()=>{
 test('CVector2D::Heading is atan2(-x, y), so north is nothing and east is ninety',()=>{
  expect(nativeHeadingDegrees(0,1)).toBeCloseTo(0,6);
  expect(nativeHeadingDegrees(-1,0)).toBeCloseTo(90,6);
  expect(nativeHeadingDegrees(0,-1)).toBeCloseTo(180,6);
  expect(nativeHeadingDegrees(1,0)).toBeCloseTo(270,6);
 });

 test('a phone step in a sequence (HOODS5) is the never-ending CTaskComplexUseMobilePhone(-1), as iOS gives it',()=>{
  expect(scriptedPedOrder({kind:'useMobilePhone',start:true},world({}))).toEqual({kind:'mobilePhone'});
  expect(scriptedPedOrder({kind:'useMobilePhone',start:false},world({}))).toBeUndefined();
 });

 test('TASK_WALK_ALONGSIDE_CHAR sprints to within 3 of the target, waits there and gives up at 10 (CTaskComplexWalkAlongsidePed)',()=>{
  expect(scriptedPedOrder({kind:'walkAlongsidePed',target:4},world({4:{x:1,y:2,z:3}}))).toEqual({kind:'gotoPed',target:4,radius:3,seconds:Number.POSITIVE_INFINITY,follow:true,sprint:true,giveUp:10});
  expect(scriptedPedOrder({kind:'walkAlongsidePed',target:5},world({}))).toBeUndefined();
 });

 test('TASK_SET_IGNORE_WEAPON_RANGE_FLAG is CTaskSimpleSetCharIgnoreWeaponRangeFlag, over at once (WUZI5, SYN5, MUSIC5)',()=>{
  expect(scriptedPedOrder({kind:'setIgnoreWeaponRangeFlag',state:true},world({}))).toEqual({kind:'ignoreWeaponRange',state:true});
 });

 test('TASK_CLIMB is the jump with its climb forced, TASK_JUMP the jump; each flag asks the high jump (iOS)',()=>{
  expect(scriptedPedOrder({kind:'climb',flag:true},world({}))).toEqual({kind:'jump',forceClimb:true,highJump:true});
  expect(scriptedPedOrder({kind:'jump',state:false},world({}))).toEqual({kind:'jump',forceClimb:false,highJump:false});
 });

 test('TASK_FALL_AND_GET_UP falls the way its direction names, lies its time and gets up (CTaskComplexFallAndGetUp)',()=>{
  expect(scriptedPedOrder({kind:'fallAndGetUp',direction:0,time:500},world({}))).toEqual({kind:'fallAndGetUp',clip:'ko_skid_front',lieMs:500});
  expect(scriptedPedOrder({kind:'fallAndGetUp',direction:1,time:0},world({}))).toEqual({kind:'fallAndGetUp',clip:'ko_spin_r',lieMs:0});
  expect(scriptedPedOrder({kind:'fallAndGetUp',direction:2,time:3000},world({}))).toEqual({kind:'fallAndGetUp',clip:'ko_skid_back',lieMs:3000});
  expect(scriptedPedOrder({kind:'fallAndGetUp',direction:3,time:-5},world({}))).toEqual({kind:'fallAndGetUp',clip:'ko_spin_l',lieMs:0});
  expect(scriptedPedOrder({kind:'fallAndGetUp',direction:4,time:0},world({}))).toBeUndefined();
 });

 test('TASK_WEAPON_ROLL rolls with CROUCH_ROLL_R for its flag and CROUCH_ROLL_L without (iOS)',()=>{
  expect(scriptedPedOrder({kind:'weaponRoll',state:true},world({}))).toEqual({kind:'roll',clip:'crouch_roll_r'});
  expect(scriptedPedOrder({kind:'weaponRoll',state:false},world({}))).toEqual({kind:'roll',clip:'crouch_roll_l'});
 });

 test('TASK_SIT_DOWN sits for its time, a time of -1 being 20 seconds (iOS)',()=>{
  expect(scriptedPedOrder({kind:'sitDown',time:80000},world({}))).toEqual({kind:'sitDown',idleMs:80000});
  expect(scriptedPedOrder({kind:'sitDown',time:-1},world({}))).toEqual({kind:'sitDown',idleMs:20000});
  expect(scriptedPedOrder({kind:'sitDown',time:-5},world({}))).toEqual({kind:'sitDown',idleMs:0});
 });

 test('standing still takes its time in milliseconds, and no time at all means for ever',()=>{
  expect(scriptedPedOrder({kind:'standStill',time:2500},world({}))).toEqual({kind:'standStill',seconds:2.5});
  expect(scriptedPedOrder({kind:'standStill',time:0},world({}))).toEqual({kind:'standStill',seconds:Infinity});
  // The original's -1 is a task that never times out.
  expect(scriptedPedOrder({kind:'pause',time:-1},world({}))).toEqual({kind:'standStill',seconds:Infinity});
  expect(scriptedPedOrder({kind:'pause',time:750},world({}))).toEqual({kind:'standStill',seconds:.75});
 });

 test("the pound guards' tasks: seeking a ped while aiming, going to a point aiming, cowering",()=>{
  // TASK_GOTO_CHAR_AIMING: CTaskComplexSeekEntityAiming(target, seek radius, aim radius); nothing for a ped gone.
  expect(scriptedPedOrder({kind:'gotoPedAiming',target:7,seekRadius:5,aimRadius:10},world({7:{x:1,y:2,z:3}}))).toEqual({kind:'seekAiming',target:7,seekRadius:5,aimRadius:10});
  expect(scriptedPedOrder({kind:'gotoPedAiming',target:8,seekRadius:5,aimRadius:10},world({}))).toBeUndefined();
  // TASK_GO_TO_COORD_WHILE_AIMING (iOS): aimed at a point when no ped is named (any negative handle), at the ped when
  // one is. The walk stops at 0.5 unless the slow-down distance is exactly 2; the gun-control branch keeps the script's
  // radius.
  const go={kind:'goToCoordWhileAiming' as const,x:1,y:2,z:3,speed:6,targetRadius:1,slowDownDistance:5,aimPed:-1,aimX:4,aimY:5,aimZ:6};
  expect(scriptedPedOrder(go,world({}))).toEqual({kind:'goToPointShooting',x:1,y:2,z:3,moveState:6,radius:.5,target:-1,aimOnly:true,aimPoint:{x:4,y:5,z:6},gunControlRadius:1});
  expect(scriptedPedOrder({...go,slowDownDistance:2},world({}))).toMatchObject({radius:1,gunControlRadius:1});
  expect(scriptedPedOrder({...go,aimPed:-2},world({}))).toMatchObject({target:-1,aimPoint:{x:4,y:5,z:6}});
  expect(scriptedPedOrder({...go,aimPed:7,targetRadius:0},world({7:{x:0,y:0,z:0}}))).toEqual({kind:'goToPointShooting',x:1,y:2,z:3,moveState:6,radius:.5,target:7,aimOnly:true,aimPoint:undefined,gunControlRadius:0});
  // TASK_COWER: HANDSCOWER once.
  expect(scriptedPedOrder({kind:'cower'},world({}))).toEqual({kind:'playAnim',file:'PED',name:'handscower',loop:false,keepLastFrame:false,seconds:Infinity});
 });

 test('staying in the same place holds the ped, and clearing it sends it back to wandering',()=>{
  expect(scriptedPedOrder({kind:'stayInSamePlace',state:true},world({}))).toEqual({kind:'standStill',seconds:Infinity});
  expect(scriptedPedOrder({kind:'stayInSamePlace',state:false},world({}))).toEqual({kind:'wander'});
  expect(scriptedPedOrder({kind:'wanderStandard'},world({}))).toEqual({kind:'wander'});
 });

 test('a turn is a heading, whether the script names one, a point or another ped',()=>{
  expect(scriptedPedOrder({kind:'achieveHeading',heading:-90},world({}))).toEqual({kind:'achieveHeading',degrees:270});
  // The ped stands at the origin; the point lies due east, which is a heading of 270.
  expect(scriptedPedOrder({kind:'turnToFaceCoord',x:10,y:0,z:0},world({}))).toEqual({kind:'achieveHeading',degrees:270});
  expect(scriptedPedOrder({kind:'turnToFaceEntity',target:7},world({7:{x:0,y:5,z:0}}))).toEqual({kind:'achieveHeading',degrees:0});
  // A handle naming no ped cannot be turned towards, so the thread gives up rather than guessing a heading.
  expect(scriptedPedOrder({kind:'turnToFaceEntity',target:7},world({}))).toBeUndefined();
 });

 test('destroying a car names a car the browser has built, or the thread gives up',()=>{
  const cars:ScriptedTaskWorld={...world({}),vehicle:handle=>handle===5};
  expect(scriptedPedOrder({kind:'destroyCar',vehicle:5},cars)).toEqual({kind:'destroyCar',vehicle:5});
  expect(scriptedPedOrder({kind:'destroyCar',vehicle:6},cars)).toBeUndefined();
 });

 test('a smart flight keeps the point, the safe distance and the time',()=>{
  expect(scriptedPedOrder({kind:'smartFleePoint',x:1,y:2,z:3,radius:40,time:8000},world({})))
   .toEqual({kind:'smartFlee',from:{x:1,y:2},safe:40,seconds:8});
  expect(scriptedPedOrder({kind:'smartFleePed',threat:3,radius:25,time:-1},world({3:{x:9,y:9,z:0}})))
   .toEqual({kind:'smartFlee',from:{x:9,y:9},safe:25,seconds:Infinity});
  expect(scriptedPedOrder({kind:'smartFleePed',threat:3,radius:25,time:1000},world({}))).toBeUndefined();
 });

 test('a task with no browser behaviour yet gives nothing back, so the thread gives up instead of pretending',()=>{
  const unported:ScmScriptedTask[]=[{kind:'swimToCoord',x:0,y:0,z:0}];
  for(const task of unported)expect(scriptedPedOrder(task,world({}))).toBeUndefined();
 });

 test('the leave-car tasks name the car (or any) and whether the ped waits for it to be still',()=>{
  expect(scriptedPedOrder({kind:'leaveAnyCar'},world({}))).toEqual({kind:'leaveCar',immediately:false});
  expect(scriptedPedOrder({kind:'leaveCar',vehicle:5},world({}))).toEqual({kind:'leaveCar',vehicle:5,immediately:false});
  expect(scriptedPedOrder({kind:'leaveCarImmediately',vehicle:5},world({}))).toEqual({kind:'leaveCar',vehicle:5,immediately:true});
 });

 test('a turn takes half the ped\u2019s heading rate a frame and ends inside the task\u2019s tolerance',()=>{
  // A street ped's pedstats heading change is 7.5 degrees a frame at fifty frames, which the task halves.
  const rate=7.5,frame=1/30,perFrame=rate*Math.PI/180*.5*50*frame;
  expect(achieveHeadingStep(0,Math.PI,rate,frame).heading).toBeCloseTo(perFrame,6);
  // Far from the heading the turn is the whole step and the task is not done.
  expect(achieveHeadingStep(0,Math.PI,rate,frame).done).toBe(false);
  // The turn never overshoots: a heading nearer than one frame's worth is reached exactly.
  const near=achieveHeadingStep(0,.05,rate,frame);
  expect(near.heading).toBeCloseTo(.05,6);expect(near.done).toBe(true);
  // The task ends once what it has reached is inside the tolerance, measured after the turn.
  expect(achieveHeadingStep(0,perFrame+ACHIEVE_HEADING_TOLERANCE,rate,frame).done).toBe(true);
  expect(achieveHeadingStep(0,perFrame+ACHIEVE_HEADING_TOLERANCE+.01,rate,frame).done).toBe(false);
  // The turn takes the short way round the circle, whichever side the heading lies.
  expect(achieveHeadingStep(Math.PI-.01,-Math.PI+.01,rate,frame).heading).toBeCloseTo(Math.PI+.01,6);
  // Turning to where it already faces is done at once and moves nothing.
  const still=achieveHeadingStep(1.25,1.25,rate,frame);
  expect(still.heading).toBeCloseTo(1.25,9);expect(still.done).toBe(true);
 });

 test('going straight to a point is CTaskComplexGoToPointAndStandStill, timed when the script gives a time',()=>{
  expect(scriptedPedOrder({kind:'goStraightToCoord',x:1,y:2,z:3,speed:6,time:-1},world({})))
   .toEqual({kind:'goToPoint',x:1,y:2,z:3,moveState:6,radius:.5,moveStateRadius:2,seconds:Infinity});
  expect(scriptedPedOrder({kind:'goStraightToCoord',x:1,y:2,z:3,speed:4,time:2500},world({}))).toMatchObject({seconds:2.5});
 });

 test('SelectMoveState walks near the point, runs further and sprints past 10 units',()=>{
  expect(goToPointMoveState(4,50,2)).toBe(4);
  expect(goToPointMoveState(6,1.9,2)).toBe(4);expect(goToPointMoveState(6,2,2)).toBe(6);expect(goToPointMoveState(6,500,2)).toBe(6);
  expect(goToPointMoveState(7,1,2)).toBe(4);expect(goToPointMoveState(7,9.9,2)).toBe(6);expect(goToPointMoveState(7,10,2)).toBe(7);
 });

 test('a go-to-point arrives inside its radius at the right height, or when the next step would pass the point',()=>{
  expect(goToPointArrived(.4,0,.5,.05)).toBe(true);
  expect(goToPointArrived(.6,0,.5,.05)).toBe(false);
  // Two units or more off the point's height is not there yet, until the step would carry the ped past it.
  expect(goToPointArrived(.4,2,.5,.05)).toBe(false);expect(goToPointArrived(.4,2,.5,.4)).toBe(true);
  // A point on the ground has no height to check.
  expect(goToPointArrived(.4,undefined,.5,0)).toBe(true);
 });

 test('killing a ped on foot needs the target to exist, and lasts until it dies or for the timed form’s time',()=>{
  const task=(target:number,time:number):ScmScriptedTask=>({kind:'killPedOnFoot',target,time,flags:0,actionDelay:0,actionChance:0,mustBeOnFoot:true});
  expect(scriptedPedOrder(task(3,-1),world({3:{x:1,y:1,z:0}}))).toEqual({kind:'killPed',target:3,seconds:Infinity});
  expect(scriptedPedOrder(task(3,4000),world({3:{x:1,y:1,z:0}}))).toEqual({kind:'killPed',target:3,seconds:4});
  expect(scriptedPedOrder(task(3,-1),world({}))).toBeUndefined();
 });

 test('playing an anim is CTaskSimpleRunNamedAnim, for the script’s time when it gives one',()=>{
  const task=(time:number):ScmScriptedTask=>({kind:'playAnim',animationName:'IDLE_chat',animationFile:'PED',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:true,time,interruptable:true});
  expect(scriptedPedOrder(task(-1),world({}))).toEqual({kind:'playAnim',file:'PED',name:'IDLE_chat',loop:false,keepLastFrame:true,seconds:Infinity});
  expect(scriptedPedOrder(task(2500),world({}))).toMatchObject({seconds:2.5});
 });

 test('looking at a ped is the trigger task, which needs the ped to exist',()=>{
  expect(scriptedPedOrder({kind:'lookAtPed',target:3,time:4000},world({3:{x:0,y:0,z:0}}))).toEqual({kind:'lookAt',target:3,seconds:4});
  expect(scriptedPedOrder({kind:'lookAtPed',target:3,time:-1},world({}))).toBeUndefined();
 });

 test('getting into a car needs a car the peds can board, and takes the seat and the time',()=>{
  const cars=(handle:number)=>handle===7;
  const w={...world({}),vehicle:cars};
  expect(scriptedPedOrder({kind:'enterCarAsDriver',vehicle:7,time:-1},w)).toEqual({kind:'enterCar',vehicle:7,seat:'driver',seconds:Infinity});
  expect(scriptedPedOrder({kind:'enterCarAsPassenger',vehicle:7,time:3000,seat:-1},w)).toEqual({kind:'enterCar',vehicle:7,seat:-1,seconds:3});
  expect(scriptedPedOrder({kind:'enterCarAsDriver',vehicle:8,time:-1},w)).toBeUndefined();
  // SET_NEXT_DESIRED_MOVE_STATE's walk rides on the task; the run is the default and says nothing.
  expect(scriptedPedOrder({kind:'enterCarAsDriver',vehicle:7,time:-1,moveState:4},w)).toMatchObject({moveState:4});
  expect(scriptedPedOrder({kind:'enterCarAsDriver',vehicle:7,time:-1,moveState:6},w)).not.toHaveProperty('moveState');
  expect(scriptedPedOrder({kind:'enterCarAsDriver',vehicle:7,time:-1},world({}))).toBeUndefined();
 });

 test('a point route copies the route and walks it by CTaskComplexFollowPointRoute’s modes',()=>{
  const route=[{x:1,y:1,z:0},{x:2,y:2,z:0}];
  expect(scriptedPedOrder({kind:'followPointRoute',speed:4,mode:0,route},world({}))).toEqual({kind:'followRoute',points:route,moveState:4,mode:0});
  expect(scriptedPedOrder({kind:'followPointRoute',speed:4,mode:0,route:[]},world({}))).toBeUndefined();
  const walk=(mode:number)=>{const r={points:[{x:0,y:0,z:0},{x:1,y:0,z:0},{x:2,y:0,z:0}],at:0,mode,traversals:0};const seen:number[]=[r.points[0].x];
   for(let i=0;i<9&&nextRoutePoint(r);i++)seen.push(r.points[r.at].x);return seen;};
  expect(walk(0)).toEqual([0,1,2]);
  expect(walk(1)).toEqual([0,1,2,2,1,0]);
  expect(walk(2).slice(0,9)).toEqual([0,1,2,2,1,0,0,1,2]);
  expect(walk(3).slice(0,7)).toEqual([0,1,2,0,1,2,0]);
 });

 test('going to a ped, killing it for a time, and the short clips',()=>{
  const w=world({3:{x:0,y:0,z:0}});
  expect(scriptedPedOrder({kind:'gotoPed',target:3,time:5000,radius:2},w)).toEqual({kind:'gotoPed',target:3,radius:2,seconds:5});
  expect(scriptedPedOrder({kind:'killPedOnFootTimed',target:3,time:2000},w)).toEqual({kind:'killPed',target:3,seconds:2});
  expect(scriptedPedOrder({kind:'scratchHead'},w)).toMatchObject({kind:'playAnim',name:'XPRESSscratch',loop:false});
  expect(scriptedPedOrder({kind:'handsUp',time:3000},w)).toMatchObject({kind:'playAnim',name:'handsup',keepLastFrame:true,release:true,seconds:3});
  expect(scriptedPedOrder({kind:'goToCoordAnyMeans',x:1,y:2,z:3,speed:6,vehicle:-1},w)).toMatchObject({kind:'goToPoint',x:1,y:2,moveState:6});
  // iOS 0x1001e8d64: -1 is 50000 ms (then the ped is put on the target), -2 no limit; the radius form's radius is the
  // target tolerance.
  expect(scriptedPedOrder({kind:'followPathNodesToCoord',x:1,y:2,z:3,speed:4,time:-1},w)).toEqual({kind:'followNodeRoute',x:1,y:2,z:3,moveState:4,seconds:50,tolerance:undefined});
  expect(scriptedPedOrder({kind:'followPathNodesToCoord',x:1,y:2,z:3,speed:4,time:-2,radius:8},w)).toEqual({kind:'followNodeRoute',x:1,y:2,z:3,moveState:4,seconds:Number.POSITIVE_INFINITY,tolerance:8});
  expect(scriptedPedOrder({kind:'followPathNodesToCoord',x:1,y:2,z:3,speed:6,time:2500},w)).toMatchObject({seconds:2.5});
  expect(scriptedPedOrder({kind:'chatWithPed',other:3,leadSpeaker:true,unknown:1},w)).toEqual({kind:'chat',partner:3,chatter:true,stage:1});
  expect(scriptedPedOrder({kind:'chatWithPed',other:99,leadSpeaker:false,unknown:1},w)).toBeUndefined();
 });

 test('ducking: the toggle at once, and TASK_DUCK for its time',()=>{
  expect(scriptedPedOrder({kind:'toggleDuck',state:true},world({}))).toEqual({kind:'duck',crouch:true});
  expect(scriptedPedOrder({kind:'duck',time:1500},world({}))).toEqual({kind:'duck',crouch:true,seconds:1.5});
 });

 test('the setter tasks: a look at a point, the threat scanner, a decision maker and the kinda-stay flag',()=>{
  expect(scriptedPedOrder({kind:'lookAtCoord',x:1,y:2,z:3,time:2000},world({}))).toEqual({kind:'lookAtPoint',x:1,y:2,z:3,seconds:2});
  expect(scriptedPedOrder({kind:'togglePedThreatScanner',onFoot:true,inCar:false,duringScriptTask:true},world({}))).toEqual({kind:'threatScanner',onFoot:true,inCar:false,duringScriptTask:true});
  expect(scriptedPedOrder({kind:'setDecisionMaker',decisionMaker:7},{...world({}),decisionMaker:h=>h===7?4:undefined})).toEqual({kind:'decisionMaker',index:4});
  expect(scriptedPedOrder({kind:'setDecisionMaker',decisionMaker:7},world({}))).toBeUndefined();
  expect(scriptedPedOrder({kind:'kindaStayInSamePlace',state:true},world({}))).toEqual({kind:'kindaStayInSamePlace',state:true});
 });

 test('aiming and shooting at a point or a ped are CTaskSimpleGunControl, firing only for the shoot tasks',()=>{
  const w=world({3:{x:0,y:0,z:0}});
  expect(scriptedPedOrder({kind:'shootAtCoord',x:1,y:2,z:3,time:2000},w)).toEqual({kind:'gunAt',point:{x:1,y:2,z:3},fire:true,seconds:2});
  expect(scriptedPedOrder({kind:'aimGunAtCoord',x:1,y:2,z:3,time:-1},w)).toEqual({kind:'gunAt',point:{x:1,y:2,z:3},fire:false,seconds:Infinity});
  expect(scriptedPedOrder({kind:'shootAtPed',target:3,time:1000},w)).toEqual({kind:'gunAt',target:3,fire:true,seconds:1});
  expect(scriptedPedOrder({kind:'aimGunAtPed',target:4,time:1000},w)).toBeUndefined();
 });

 test('going to a point while shooting at a ped',()=>{
  // Operand 5 (turnRadius) is the target radius and 6 (stopRadius) the slow-down distance: the walk stops at 0.5 unless
  // the slow-down distance is exactly 2.
  expect(scriptedPedOrder({kind:'goToCoordWhileShooting',x:1,y:2,z:3,speed:6,turnRadius:.75,stopRadius:1,target:3},world({3:{x:0,y:0,z:0}})))
   .toEqual({kind:'goToPointShooting',x:1,y:2,z:3,moveState:6,radius:.5,target:3,gunControlRadius:.75});
  expect(scriptedPedOrder({kind:'goToCoordWhileShooting',x:1,y:2,z:3,speed:6,turnRadius:.75,stopRadius:2,target:3},world({3:{x:0,y:0,z:0}})))
   .toMatchObject({radius:.75});
 });

 test('dying is its own order',()=>{
  expect(scriptedPedOrder({kind:'die'},world({}))).toEqual({kind:'die'});
  expect(scriptedPedOrder({kind:'dead'},world({}))).toEqual({kind:'die'});
 });
});
