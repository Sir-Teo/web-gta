import {expect,test} from 'vitest';
import {HeatSeekLock,distToLine,evaluateHeatSeekTarget,pickHeatSeekTarget} from '../src/weapons/nativeHeatSeeker';

const o={x:0,y:0,z:0},ahead={x:1,y:0,z:0};
test('CCollision::DistToLine clamps to the segment ends',()=>{
 expect(distToLine(o,{x:10,y:0,z:0},{x:5,y:3,z:0})).toBeCloseTo(3,6);
 expect(distToLine(o,{x:10,y:0,z:0},{x:-4,y:3,z:0})).toBeCloseTo(5,6);
 expect(distToLine(o,{x:10,y:0,z:0},{x:13,y:4,z:0})).toBeCloseTo(5,6);
});
test('EvaluateTargetForHeatSeekingMissile: sqrt(distance) / 10 plus the off-line share, rejected outside the cone',()=>{
 expect(evaluateHeatSeekTarget({x:100,y:0,z:0},o,ahead,1.2)).toBeCloseTo(1,6);
 expect(evaluateHeatSeekTarget({x:100,y:20,z:0},o,ahead,1.2)).toBeCloseTo(Math.sqrt(Math.hypot(100,20))/10+20/Math.hypot(100,20),6);
 // Off the line by more than distance / 1.2 (about 56 degrees): rejected; behind the origin too.
 expect(evaluateHeatSeekTarget({x:10,y:20,z:0},o,ahead,1.2)).toBe(-1);
 expect(evaluateHeatSeekTarget({x:-50,y:0,z:0},o,ahead,1.2)).toBe(-1);
 expect(evaluateHeatSeekTarget({x:100,y:0,z:0},o,ahead,1.2,{preferred:true})).toBeCloseTo(.25,6);
 expect(evaluateHeatSeekTarget({x:100,y:0,z:0},o,ahead,1.2,{aircraft:true,planesPriority:true})).toBeCloseTo(.25,6);
});
test('PickTargetForHeatSeekingMissile prefers the near, on-line and previously picked vehicle, skipping wrecks',()=>{
 const cars=[{key:'far',position:{x:200,y:0,z:0},health:1},{key:'near',position:{x:50,y:5,z:0},health:1},{key:'wreck',position:{x:20,y:0,z:0},health:0},{key:'side',position:{x:5,y:40,z:0},health:1}];
 expect(pickHeatSeekTarget(cars,o,ahead,1.2)).toBe('near');
 // The rating runs from five units along the aim; the last target's rating is quartered.
 expect(pickHeatSeekTarget(cars,o,ahead,1.2,{preferred:'far'})).toBe('far');
 expect(pickHeatSeekTarget(cars,o,ahead,1.2,{ignore:'near'})).toBe('far');
 expect(pickHeatSeekTarget([],o,ahead,1.2)).toBeUndefined();
});
test('the lock turns red after 1.5 s on one target in sight, and restarts when the target changes or is hidden',()=>{
 const lock=new HeatSeekLock<string>();let target:string|undefined='a',sight=true;
 lock.enter(1000);
 const step=(now:number)=>lock.update(now,()=>target,()=>sight);
 step(1000);expect(lock.marked).toBe('a');expect(lock.locked(1000)).toBe(false);
 step(1500);step(2400);expect(lock.locked(2400)).toBe(false);
 // The same target in sight since the first frame at 1000.
 step(3100);expect(lock.locked(3100)).toBe(true);
 target='b';step(3200);expect(lock.locked(3200)).toBe(false);
 // Out of sight at the next once-a-second test: the timer keeps restarting.
 sight=false;step(4300);step(6000);expect(lock.locked(6000)).toBe(false);
 target=undefined;step(6100);expect(lock.marked).toBeUndefined();expect(lock.locked(6100)).toBe(false);
});
