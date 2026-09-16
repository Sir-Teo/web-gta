import {expect,test} from 'vitest';
import {sidestepDirection} from '../src/simulation/WorldPedestrians';

test('blocked pedestrians slide ±65° around obstacles',()=>{
  const ahead=sidestepDirection(0,1,1);
  expect(ahead.x).toBeCloseTo(-Math.sin(Math.PI*.36),10);
  expect(ahead.z).toBeCloseTo(Math.cos(Math.PI*.36),10);
  const other=sidestepDirection(0,1,-1);
  expect(other.x).toBeCloseTo(Math.sin(Math.PI*.36),10);
  expect(other.z).toBeCloseTo(Math.cos(Math.PI*.36),10);
  // Rotation preserves stride length in every heading.
  for(const [x,z] of [[1,0],[-1,0],[0,-1],[.6,.8]] as const)
    for(const side of [1,-1] as const){
      const s=sidestepDirection(x,z,side);
      expect(Math.hypot(s.x,s.z)).toBeCloseTo(Math.hypot(x,z),10);
    }
});
