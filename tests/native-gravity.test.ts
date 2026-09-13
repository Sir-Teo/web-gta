import {expect,test} from 'vitest';
import {nativeGravity} from '../src/simulation/nativeGravity';
const flags={applyGravity:true,disableMoveForce:false,usesCollision:true};
test('ordinary native gravity uses 20 ms velocity units and source flag gates',()=>{
  expect(nativeGravity(1,flags).linear.z).toBeCloseTo(-.008,9);
  expect(nativeGravity(3,flags).linear.z).toBeCloseTo(-.024,8);
  for(const patch of [{applyGravity:false},{disableMoveForce:true},{usesCollision:false}])expect(nativeGravity(1,{...flags,...patch}).linear.z).toBe(0);
});
test('native gravity rejects invalid timestep rather than silently changing simulation time',()=>{
  for(const dt of [-1,4,NaN,Infinity])expect(()=>nativeGravity(dt,flags)).toThrow(/timestep/);
});
