import {expect,test} from 'vitest';
import {viewerFoggyness} from '../src/world/viewerWeather';
test('viewer fog flags distinguish San Fierro fog and sandstorm from rain and underwater rows',()=>{
  for(let weather=0;weather<23;weather++)expect(viewerFoggyness(weather)).toBe([9,19].includes(weather)?1:0);
  expect(viewerFoggyness(0,9,.25)).toBe(.25);expect(viewerFoggyness(19,0,.25)).toBe(.75);
  expect(viewerFoggyness(9,19,.25)).toBe(1);expect(viewerFoggyness(0,8,.5)).toBe(0);
  expect(()=>viewerFoggyness(23)).toThrow();expect(()=>viewerFoggyness(0,9,NaN)).toThrow();
});
