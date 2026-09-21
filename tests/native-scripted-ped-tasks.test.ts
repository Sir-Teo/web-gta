import {describe,expect,test} from 'vitest';
import {ACHIEVE_HEADING_TOLERANCE,achieveHeadingStep,nativeHeadingDegrees,scriptedPedOrder,type ScriptedTaskWorld} from '../src/simulation/nativeScriptedPedTasks';
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

 test('standing still takes its time in milliseconds, and no time at all means for ever',()=>{
  expect(scriptedPedOrder({kind:'standStill',time:2500},world({}))).toEqual({kind:'standStill',seconds:2.5});
  expect(scriptedPedOrder({kind:'standStill',time:0},world({}))).toEqual({kind:'standStill',seconds:Infinity});
  // The original's -1 is a task that never times out.
  expect(scriptedPedOrder({kind:'pause',time:-1},world({}))).toEqual({kind:'standStill',seconds:Infinity});
  expect(scriptedPedOrder({kind:'pause',time:750},world({}))).toEqual({kind:'standStill',seconds:.75});
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

 test('a smart flight keeps the point, the safe distance and the time',()=>{
  expect(scriptedPedOrder({kind:'smartFleePoint',x:1,y:2,z:3,radius:40,time:8000},world({})))
   .toEqual({kind:'smartFlee',from:{x:1,y:2},safe:40,seconds:8});
  expect(scriptedPedOrder({kind:'smartFleePed',threat:3,radius:25,time:-1},world({3:{x:9,y:9,z:0}})))
   .toEqual({kind:'smartFlee',from:{x:9,y:9},safe:25,seconds:Infinity});
  expect(scriptedPedOrder({kind:'smartFleePed',threat:3,radius:25,time:1000},world({}))).toBeUndefined();
 });

 test('a task with no browser behaviour yet gives nothing back, so the thread gives up instead of pretending',()=>{
  const unported:ScmScriptedTask[]=[{kind:'scratchHead'},{kind:'handsUp',time:1000},
   {kind:'goStraightToCoord',x:0,y:0,z:0,speed:1,time:1000},{kind:'leaveAnyCar'}];
  for(const task of unported)expect(scriptedPedOrder(task,world({}))).toBeUndefined();
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

 test('dying is its own order',()=>{
  expect(scriptedPedOrder({kind:'die'},world({}))).toEqual({kind:'die'});
 });
});
