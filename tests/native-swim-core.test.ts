import {expect,test} from 'vitest';
import {SWIM,SWIM_STOP_TIME,swimBlendRatio,swimBreath,swimBreathMultiplier,swimEntry,swimResistance,swimSubmergeVelocity,swimSubmergeZ,swimSurfaceState} from '../src/simulation/nativeSwim';

test('swim starts with feet 0.6 under the surface; the stop threshold is 15 native time units',()=>{
 expect(SWIM_STOP_TIME).toBe(15);
 expect(swimEntry(9.3,10)).toBe(true);
 expect(swimEntry(9.5,10)).toBe(false);
 expect(swimEntry(0,undefined)).toBe(false);
});

test('PC breath recovery overshoots capacity and drowning events truncate damage',()=>{
 expect(swimBreath(99,false,1,1)).toEqual({breath:101,damage:0});
 expect(swimBreath(101,false,1,1)).toEqual({breath:101,damage:0});
 expect(swimBreath(0,true,1,50/60)).toEqual({breath:0,damage:2});
 // Exhaustion does not inflict damage until the subsequent call.
 const exhausted=swimBreath(.5,true,1,1);
 expect(exhausted).toEqual({breath:0,damage:0});
 expect(swimBreath(exhausted.breath,true,1,1).damage).toBe(3);
 expect(swimBreath(20,true,1,1,100,true)).toEqual({breath:22,damage:0});
 // Preserve the source's bDrownsInWater branch, even though its name is surprising.
 expect(swimBreath(20,true,1,1,100,false,false)).toEqual({breath:20,damage:3});
});

test('breath rate comes from the underwater stroke association only',()=>{
 expect(swimBreathMultiplier(SWIM.underwaterSprinting)).toBe(1);
 expect(swimBreathMultiplier(SWIM.underwaterSprinting,{speed:1.2,blend:.5})).toBeCloseTo(1.6);
 expect(swimBreathMultiplier(SWIM.underwaterSprinting,{speed:1.2,blend:1})).toBeCloseTo(2.2);
 expect(swimBreathMultiplier(SWIM.tread,{speed:1.2,blend:1})).toBe(1);
});

test('surface states follow the blend and sprint button',()=>{
 expect(swimSurfaceState(0,false)).toBe(SWIM.tread);
 expect(swimSurfaceState(.6,false)).toBe(SWIM.sprint);
 expect(swimSurfaceState(0,true)).toBe(SWIM.sprinting);
 expect(swimSurfaceState(.9,true)).toBe(SWIM.sprinting);
 expect(swimBlendRatio(0,1,1)).toBeCloseTo(.07,10);
 expect(swimBlendRatio(.9,1,1)).toBeCloseTo(.97,10);
});

test('resistance blends clip motion into decaying velocity',()=>{
 const still=swimResistance({x:0,z:0},{x:1,z:0},1);
 expect(still.x).toBeCloseTo(.1,10);
 const glide=swimResistance({x:2,z:0},{x:0,z:0},1);
 expect(glide.x).toBeCloseTo(1.8,10);
 // Converges to the sustained stroke speed.
 let v={x:0,z:0};
 for(let i=0;i<200;i++)v=swimResistance(v,{x:1,z:0},1);
 expect(v.x).toBeCloseTo(1,6);
});

test('the submerge servo holds the waterline without snapping',()=>{
 // A metre low is capped by the per-second clamp, not the per-frame one.
 expect(swimSubmergeVelocity(9,10,.5,0,1,1/60)).toBeCloseTo(1/60,10);
 expect(swimSubmergeVelocity(9.4,10,.5,0,1,1/60)).toBeCloseTo(1/60,10);
 expect(swimSubmergeVelocity(9.5,10,.5,0,1,1/60)).toBeCloseTo(0,10);
 expect(swimSubmergeZ(0,0)).toBeCloseTo(.55,10);
 expect(swimSubmergeZ(1,0)).toBeCloseTo(.95,10);
});

test('breath recovers at the surface, drains underwater and kills empty lungs',()=>{
 expect(swimBreath(50,false,1,1)).toEqual({breath:52,damage:0});
 expect(swimBreath(100,false,1,1).breath).toBe(100);
 expect(swimBreath(50,true,2,1)).toEqual({breath:48,damage:0});
 expect(swimBreath(0,true,1,1)).toEqual({breath:0,damage:3});
});
