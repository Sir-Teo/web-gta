import {expect,test} from 'vitest';
import {stepNativeSuspensionFrame,type NativeSuspensionFrameInput,type SuspensionFrameWheel} from '../src/simulation/nativeSuspensionFrame';
const wheel=():SuspensionFrameWheel=>({compression:.5,point:{x:0,y:0,z:-1},normal:{x:0,y:0,z:1},groundSpeed:{x:0,y:0,z:0},forceLevel:1,bias:.5,damping:.5});
const input=():NativeSuspensionFrameInput=>({linear:{x:0,y:0,z:-.02},angular:{x:0,y:0,z:0},centerOfMass:{x:0,y:0,z:0},mass:1000,turnMass:2000,direction:{x:0,y:0,z:-1},timeStep:1,mode:'normal',makeMassTwiceAsBig:false,frameLimit:1,springLimitMultiplier:2,wheels:{frontLeft:wheel(),rearLeft:undefined,frontRight:undefined,rearRight:undefined}});
test('relative speed is captured after spring force before damping',()=>{
  const result=stepNativeSuspensionFrame(input());
  expect(result.relative.frontLeft!.z).toBeCloseTo(-.016,7);expect(result.linear.z).toBeCloseTo(-.008,7);
  expect(result.motions).toHaveLength(2);
});
test('all wheels retain one snapshot while later damping reads updated chassis speed',()=>{
  const i=input();i.wheels.rearLeft=wheel();i.wheels.frontLeft!.damping=1;i.wheels.rearLeft.damping=1;
  const r=stepNativeSuspensionFrame(i);
  expect(r.relative.frontLeft!.z).toBeCloseTo(-.012,7);expect(r.relative.rearLeft!.z).toBeCloseTo(-.012,7);
  expect(r.damping.frontLeft!.magnitude).toBeCloseTo(-12,5);expect(r.damping.rearLeft!.magnitude).toBeCloseTo(0,5);expect(r.linear.z).toBeCloseTo(0,7);
});
test('moving ground changes saved relative velocity without replacing chassis-only speed',()=>{
  const i=input();i.wheels.frontLeft!.groundSpeed.z=-.03;
  const r=stepNativeSuspensionFrame(i);expect(r.relative.frontLeft!.z).toBeCloseTo(.014,7);
  expect(r.damping.frontLeft!.magnitude).toBeCloseTo(0,6);expect(r.linear.z).toBeCloseTo(-.016,7);
});
test('missing contacts yield no forces and late invalid data never modifies caller state',()=>{
  const i=input();i.wheels.frontLeft=undefined;expect(stepNativeSuspensionFrame(i).motions).toEqual([]);
  i.wheels.frontLeft=wheel();i.wheels.rearRight={...wheel(),damping:NaN};const before=structuredClone(i);
  expect(()=>stepNativeSuspensionFrame(i)).toThrow();expect(i).toEqual(before);
});
