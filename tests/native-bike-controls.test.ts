import {expect,test} from 'vitest';
import {bikePedals,bikeSteerFraction} from '../src/simulation/nativeBikeControls';
import {steerFraction} from '../src/simulation/nativeQuadSteer';

test('CBike::ProcessControlInputs steers in proportion to the raw steer; CAutomobile squares it',()=>{
 expect(bikeSteerFraction(.5)).toBe(.5);expect(bikeSteerFraction(-.5)).toBe(-.5);expect(bikeSteerFraction(1.2)).toBe(1);
 expect(steerFraction(.5)).toBe(.25);
});

test('the bike pedals: the opposite pedal brakes while rolling, reverse only from a standstill, no BMX burnout',()=>{
 const p=(accelerate:number,brake:number,forwardSpeed:number,bmx=false)=>bikePedals({accelerate,brake,forwardSpeed,bmx});
 // Rolling forward: S brakes; W drives.
 expect(p(0,255,.2)).toMatchObject({gas:0,brake:1});expect(p(255,0,.2)).toMatchObject({gas:1,brake:0});
 // Rolling back: W brakes; S drives back.
 expect(p(255,0,-.2)).toMatchObject({gas:0,brake:1});expect(p(0,255,-.2)).toMatchObject({gas:-1,brake:0});
 // At a standstill S reverses; both held past 150 is a burnout, but not on a BMX.
 expect(p(0,255,.005)).toMatchObject({gas:-1,brake:0});
 expect(p(200,200,0)).toMatchObject({burnout:true,gas:200/255,brake:200/255});
 expect(p(200,200,0,true)).toMatchObject({burnout:false,gas:0,brake:0});
 // The player's controls off: full brake, the handbrake, and the 0.28 cap.
 expect(bikePedals({accelerate:255,brake:0,forwardSpeed:.3,bmx:false,controlsDisabled:true})).toEqual({gas:0,brake:1,burnout:false,handbrake:true,speedCap:.28});
});
