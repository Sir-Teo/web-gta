import {expect,test} from 'vitest';
import {turnToward,playerTurnStep} from '../src/simulation/nativePlayerLocomotion';

// Hip-fire turns CJ to the follow camera's heading at the heading change rate (9° a 50th), not at once.
test('the hip-fire heading turns at the player heading change rate',()=>{
  const step=playerTurnStep(1/60);
  expect(turnToward(0,2.6,1/60)).toBeCloseTo(step);
  expect(turnToward(0,-2.6,1/60)).toBeCloseTo(-step);
  expect(turnToward(1,1.05,1/60)).toBeCloseTo(1.05);
  // The short way round across ±π.
  expect(turnToward(3,-3,1/60)).toBeGreaterThan(3);
});
