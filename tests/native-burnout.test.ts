import {expect,test} from 'vitest';
import {nativeBurnoutMotion} from '../src/simulation/nativeBurnout';
const geometry={right:{x:1,y:0,z:0},steerAngle:.5,rearLeftPoint:{x:-1,y:-2,z:-1},centerOfMass:{x:0,y:0,z:0}};
test('burnout preserves source argument order and applies angular motion only',()=>{
  const r=nativeBurnoutMotion(2000,geometry);
  expect(r.linear).toEqual({x:0,y:0,z:0});expect(r.angular.x).toBeCloseTo(0,8);expect(r.angular.y).toBeCloseTo(-.001,8);expect(r.angular.z).toBeCloseTo(.002,8);
});
test('turn mass cap and center of mass affect the source lever',()=>{
  const r=nativeBurnoutMotion(6000,geometry);expect(r.angular.z).toBeCloseTo(.001,8);
  expect(nativeBurnoutMotion(2000,{...geometry,centerOfMass:{x:1,y:0,z:0}}).angular.z).toBeCloseTo(.003,8);
  expect(()=>nativeBurnoutMotion(0,geometry)).toThrow();
});
