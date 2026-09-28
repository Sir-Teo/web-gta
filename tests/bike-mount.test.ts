import {expect,test} from 'vitest';
import {bikeCanJumpOut,bikeCanStepOut} from '../src/simulation/BikeMount';
const still={x:0,y:0,z:0};
test('bikes step off only when still, by the base CanPedStepOutCar limits in units per frame',()=>{
 expect(bikeCanStepOut(still,still)).toBe(true);
 expect(bikeCanStepOut({x:.49,y:0,z:0},still)).toBe(true);   // |v2D| 0.0098 units/frame
 expect(bikeCanStepOut({x:.6,y:0,z:0},still)).toBe(false);
 expect(bikeCanStepOut({x:0,y:2.6,z:0},still)).toBe(false);  // |vz| over 0.05
 expect(bikeCanStepOut(still,{x:1.1,y:0,z:0})).toBe(false);  // |ω|² over 0.0004
});
test('bikes are jumped off from v2D² ≥ 0.07 units/frame, and never by a rider carrying a pillion',()=>{
 const edge=Math.sqrt(.07)*50;
 expect(bikeCanJumpOut({x:edge+.01,y:0,z:0},false)).toBe(true);
 expect(bikeCanJumpOut({x:edge-.05,y:0,z:0},false)).toBe(false);
 expect(bikeCanJumpOut({x:20,y:0,z:0},true)).toBe(false);
});
test('the quad (a CAutomobile) is jumped off only between v2D² 0.1 and 0.5 units/frame, pillion or not',()=>{
 const low=Math.sqrt(.1)*50,high=Math.sqrt(.5)*50;
 expect(bikeCanJumpOut({x:14,y:0,z:0},false,true)).toBe(false);   // a bike's jump-out speed, below the car band
 expect(bikeCanJumpOut({x:low+.01,y:0,z:0},true,true)).toBe(true);
 expect(bikeCanJumpOut({x:high+.1,y:0,z:0},false,true)).toBe(false);
});
