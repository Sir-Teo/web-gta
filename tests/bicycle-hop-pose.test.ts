import {expect,test} from 'vitest';
import {stepBicycleHopPose} from '../src/simulation/bicycleHopPose';
import {stepBicycleCrank} from '../src/simulation/bicycleCrank';

test('charge poses hold the first 0.2 seconds and blend in at eight per second',()=>{
 const partial=stepBicycleHopPose(undefined,{charge:12.5,ridden:true,duration:1},1/16)!;
 expect(partial).toEqual({seconds:.1,amount:.5,released:false,duration:1});
 const full=stepBicycleHopPose(partial,{charge:25,ridden:true,duration:1},1/16)!;
 expect(full.seconds).toBe(.2);expect(full.amount).toBe(1);
 expect(stepBicycleHopPose(full,{charge:25,ridden:true,duration:1},0)).toEqual(full);
});
test('a partial release skips the unused clip time, plays at 1.5x and fades after launch',()=>{
 const input={charge:12.5,ridden:true,duration:1},held=stepBicycleHopPose(undefined,input,.2)!;
 // Half charge: start at 0.6 s and finish the remaining 0.4 s at 1.5x.
 const released=stepBicycleHopPose(held,{...input,launchRemaining:.4/1.5},.02)!;expect(released.seconds).toBeCloseTo(.6);expect(released.released).toBe(true);
 const playing=stepBicycleHopPose(released,{...input,launchRemaining:.4/1.5-.1},.1)!;expect(playing.seconds-released.seconds).toBeCloseTo(.15);
 const finished=stepBicycleHopPose(playing,{...input,charge:0},.1)!;expect(finished.seconds).toBe(1);expect(finished.amount).toBeCloseTo(.6);
 expect(stepBicycleHopPose(finished,{...input,charge:0},.15)).toBeUndefined();
});
test('departure cancels at eight per second and a missing clip never invents a jump pose',()=>{
 const held=stepBicycleHopPose(undefined,{charge:25,ridden:true,duration:1},.2)!;
 expect(stepBicycleHopPose(held,{charge:0,ridden:false},.1)?.amount).toBeCloseTo(.2);
 expect(stepBicycleHopPose(held,{charge:0,ridden:false},.125)).toBeUndefined();
 expect(stepBicycleHopPose(undefined,{charge:10,ridden:true},.1)).toBeUndefined();
 expect(()=>stepBicycleHopPose(held,{charge:0,ridden:true,duration:NaN},.1)).toThrow();
});
test('the bunny-hop association owns the crank and blends it towards horizontal pedals',()=>{
 expect(stepBicycleCrank(-2,1,{seconds:.2,duration:1},0)).toBe(-2);
 expect(stepBicycleCrank(-2,1,{seconds:.2,duration:1},.5)).toBeCloseTo((-2+Math.PI/2)/2,6);
 expect(stepBicycleCrank(-2,1,{seconds:.2,duration:1},1)).toBe(Math.fround(Math.PI/2));
});
