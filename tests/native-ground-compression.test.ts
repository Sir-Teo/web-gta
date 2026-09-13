import {expect,test} from 'vitest';
import {nativeGroundCompression,burstCompressionRandomUpper,type NativeGroundCompressionInput} from '../src/simulation/nativeGroundCompression';
import {nativeSuspensionCompression} from '../src/simulation/nativeSuspension';
const input=():NativeGroundCompressionInput=>({compression:.5,springLength:.5,lineLength:1,wheelRadius:.5,status:'normal',sandGroup:false,railTrack:false,rhino:false,forwardSpeed:0,wetRoads:0,handlingFlags:0,rotation:0,wheelSpeed:0,timeStep:1});
test('missing tires force extension and burst sampling adjusts raw fraction before spring conversion',()=>{
  expect(nativeGroundCompression({...input(),status:'missing'})).toBe(1);
  expect(burstCompressionRandomUpper(0)).toBe(98);expect(burstCompressionRandomUpper(-.5)).toBe(118);
  const raw=nativeGroundCompression({...input(),status:'burst',burstSample:97});expect(raw).toBe(.625);
  expect(nativeSuspensionCompression(raw,.5,1)).toBe(.25);
  expect(nativeGroundCompression({...input(),status:'burst',forwardSpeed:.5,burstSample:100})).toBe(.5);
  expect(nativeGroundCompression({...input(),status:'burst',compression:.99,burstSample:0})).toBe(1);
});
test('sand sink follows off-road priority and wet/speed floor',()=>{
  const i={...input(),sandGroup:true};
  expect(nativeGroundCompression(i)).toBeCloseTo(.65,7);
  expect(nativeGroundCompression({...i,handlingFlags:0x100000})).toBeCloseTo(.6,7);
  expect(nativeGroundCompression({...i,handlingFlags:0x300000})).toBeCloseTo(.575,7);
  expect(nativeGroundCompression({...i,wetRoads:1})).toBeCloseTo(.56,7);
  expect(nativeGroundCompression({...i,forwardSpeed:-1})).toBeCloseTo(.56,7);
  expect(nativeGroundCompression({...i,rhino:true})).toBe(.5);
});
test('rail pulses occur on phase crossings in both directions and respect the lower floor',()=>{
  const i={...input(),railTrack:true,rotation:2.9,wheelSpeed:.2};
  expect(nativeGroundCompression(i)).toBeCloseTo(.35,7);
  expect(nativeGroundCompression({...i,rotation:.1,wheelSpeed:-.2})).toBeCloseTo(.35,7);
  expect(nativeGroundCompression({...i,rotation:1})).toBe(.5);
  expect(nativeGroundCompression({...i,compression:.25})).toBeCloseTo(.2,7);
  expect(nativeGroundCompression({...i,forwardSpeed:.6})).toBe(.5);
});
test('sand and damage branches take precedence over rail pulses',()=>{
  const i={...input(),railTrack:true,sandGroup:true,rotation:2.9,wheelSpeed:.2};
  expect(nativeGroundCompression(i)).toBeCloseTo(.65,7);
  expect(nativeGroundCompression({...i,status:'burst',burstSample:0})).toBe(.625);
  expect(nativeGroundCompression({...i,rhino:true})).toBeCloseTo(.35,7);
  expect(nativeGroundCompression({...i,compression:1})).toBe(1);
});
test('requires explicit random input and rejects invalid data without mutating it',()=>{
  const i=input(),before=structuredClone(i);nativeGroundCompression(i);expect(i).toEqual(before);
  for(const patch of [{status:'burst' as const},{status:'burst' as const,burstSample:98},{wetRoads:2},{lineLength:0},{forwardSpeed:NaN}])expect(()=>nativeGroundCompression({...i,...patch})).toThrow();
});
