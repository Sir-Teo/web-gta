import {expect,test} from 'vitest';
import {nativeAirResistance as step,nativeCarAirResistance as coefficient} from '../src/simulation/nativeAirResistance';
test('car drag keeps the small-value branch and converts larger handling multipliers',()=>{
  expect(coefficient(.01)).toBe(Math.fround(.01));expect(coefficient(2)).toBeCloseTo(.001,9);expect(coefficient(0)).toBe(0);
});
test('vehicle resistance uses full 3D speed and explicit zone multiplier',()=>{
  const r=step({x:.3,y:0,z:.4},{x:1,y:2,z:3},2,.1,2);
  expect(r.factor).toBeCloseTo(.81,6);expect(r.linear.z).toBeCloseTo(.324,7);expect(r.angular.y).toBeCloseTo(2*.99**1.2,6);/* timeStep 2 is 1.2 game frames of 0.99 */
});
test('zero drag still damps spin by 0.99 a game frame and invalid fractional powers reject',()=>{
  const r=step({x:1,y:0,z:0},{x:1,y:0,z:0},50/30,0);
  expect(r.linear.x).toBe(1);expect(r.angular.x).toBeCloseTo(.99,6);
  expect(step({x:0,y:0,z:0},{x:1,y:0,z:0},50/60,0).angular.x).toBeCloseTo(Math.sqrt(.99),6);
  expect(()=>step({x:20,y:0,z:0},{x:0,y:0,z:0},.5,1)).toThrow(/Nonfinite/);
});
