import {expect,test} from 'vitest';
import {nativeTireTemperature as step} from '../src/simulation/nativeTireTemperature';
test('burnout heats only driven rear spinning tires and caps at three',()=>{
  expect(step(1,2,0,'R',true,'normal','spinning')).toBeCloseTo(1.002,7);
  expect(step(2.999,3,0,'4',true,'spinning','normal')).toBe(3);
  expect(step(1,2,0,'F',true,'spinning','spinning')).toBe(1);
  expect(step(1,2,0,'R',false,'spinning','spinning')).toBe(1);
});
test('cooling is exponential above one and preserves colder values and NOS state',()=>{
  expect(step(2,2,0,'R',false,'normal','normal')).toBeCloseTo(1+.995**2,7);
  expect(step(.5,2,0,'R',false,'normal','normal')).toBe(.5);
  expect(step(-1,2,0x80000,'R',true,'spinning','spinning')).toBe(-1);
  expect(step(2,0,0,'R',false,'normal','normal')).toBe(2);
  expect(()=>step(-1,1,0,'R',false,'normal','normal')).toThrow(/NOS/);
});
