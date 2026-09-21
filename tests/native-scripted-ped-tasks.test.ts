import {describe,expect,test} from 'vitest';
import {nativeHeadingDegrees,scriptedPedOrder,type ScriptedTaskWorld} from '../src/simulation/nativeScriptedPedTasks';
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

 test('dying is its own order',()=>{
  expect(scriptedPedOrder({kind:'die'},world({}))).toEqual({kind:'die'});
 });
});
