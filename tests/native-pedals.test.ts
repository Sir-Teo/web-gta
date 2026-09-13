import {expect,test} from 'vitest';
import {nativePedals,type NativePedalInput} from '../src/simulation/nativePedals';
const input=():NativePedalInput=>({accelerate:255,brake:0,forwardSpeed:0,previousGas:0,automaticallyHandbrake:false,handbrake:false,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true});
test('reverse input brakes a forward-moving car but becomes reverse gas below the strict threshold',()=>{
  const i={...input(),accelerate:0,brake:255};
  expect(nativePedals({...i,forwardSpeed:.01})).toMatchObject({gas:0,brake:1});
  expect(nativePedals({...i,forwardSpeed:.009})).toMatchObject({gas:-1,brake:0});
  expect(nativePedals({...i,forwardSpeed:-1})).toMatchObject({gas:-1,brake:0});
});
test('leaving reverse depends on previous gas and the reverse-speed boundary',()=>{
  expect(nativePedals({...input(),forwardSpeed:-.1,previousGas:.5})).toMatchObject({gas:0,brake:1});
  expect(nativePedals({...input(),forwardSpeed:-.1,previousGas:.6})).toMatchObject({gas:1,brake:0});
  expect(nativePedals({...input(),forwardSpeed:-.15,previousGas:.6})).toMatchObject({gas:0,brake:1});
});
test('burnout uses both physical pedals above 150 and resets outside that branch',()=>{
  expect(nativePedals({...input(),accelerate:151,brake:151})).toMatchObject({gas:Math.fround(151/255),brake:Math.fround(151/255),burnout:true});
  expect(nativePedals({...input(),accelerate:150,brake:150}).burnout).toBe(false);
  expect(nativePedals({...input(),brake:255,forwardSpeed:.01}).burnout).toBe(false);
  // The low-speed physical-pedal branch follows drowning's demand suppression.
  expect(nativePedals({...input(),brake:255,drowning:true}).burnout).toBe(true);
});
test('automatic handbrake, drowning and direction gating retain their branch order',()=>{
  expect(nativePedals({...input(),automaticallyHandbrake:true,brake:255})).toEqual({gas:0,brake:1,burnout:false,handbrake:true});
  expect(nativePedals({...input(),drowning:true}).gas).toBe(0);
  expect(nativePedals({...input(),drowning:true,engineOn:false}).gas).toBe(1);
  expect(nativePedals({...input(),forwardAllowed:false}).gas).toBe(0);
  expect(nativePedals({...input(),handbrake:true})).toMatchObject({gas:1,handbrake:true});
});
test('drive-by fallback only replaces zero demand and sentinel-model reverse scales before normalization',()=>{
  expect(nativePedals({...input(),accelerate:0,driveByAim:true,rightShoulder:128}).gas).toBeCloseTo(128/255,7);
  expect(nativePedals({...input(),driveByAim:true,leftShoulder:255}).gas).toBe(1);
  expect(nativePedals({...input(),accelerate:0,brake:255,unloadModel:true}).gas).toBeCloseTo(-.3,7);
  expect(nativePedals({...input(),accelerate:0,brake:255,reverseAllowed:false}).gas).toBe(0);
});
test('invalid values reject without mutating input',()=>{
  const i=input(),before=structuredClone(i);nativePedals(i);expect(i).toEqual(before);
  for(const patch of [{accelerate:256},{brake:.5},{previousGas:2},{forwardSpeed:NaN}])expect(()=>nativePedals({...i,...patch})).toThrow();
});
