import {expect,test} from 'vitest';
import {stepNativeSteeringInput,type NativeSteeringControl,type NativeSteeringState} from '../src/simulation/nativeSteeringInput';
const state=():NativeSteeringState=>({raw:0,secondAngle:0,lastInput:'keyboard'});
const input=():NativeSteeringControl=>({steeringAxis:-128,mouseDeltaX:0,mouseThirdPerson:false,mouseSteeringEnabled:false,vehicleMouseLook:false,timeStep:1,steeringLockDegrees:35,rearHandbrakeSteering:false,handbrake:false});
test('pad steering approaches its target before the sign-preserving squared angle curve',()=>{
  const first=stepNativeSteeringInput(state(),input());expect(first.state.raw).toBeCloseTo(.2,7);expect(first.angle).toBeCloseTo(1.4*Math.PI/180,7);
  const second=stepNativeSteeringInput(first.state,input());expect(second.state.raw).toBeCloseTo(.36,7);
  const opposite=stepNativeSteeringInput(state(),{...input(),steeringAxis:128});expect(opposite.angle).toBeCloseTo(-first.angle,7);
  expect(stepNativeSteeringInput({...state(),raw:1},{...input(),steeringAxis:0}).state.raw).toBeCloseTo(.8,7);
});
test('mouse mode persists without movement and keyboard axis can take control back',()=>{
  const i={...input(),steeringAxis:0,mouseDeltaX:100,mouseThirdPerson:true,mouseSteeringEnabled:true};
  const r=stepNativeSteeringInput(state(),i);expect(r.state.raw).toBeCloseTo(-.35,7);expect(r.state.lastInput).toBe('mouse');
  expect(stepNativeSteeringInput(r.state,{...i,mouseDeltaX:0}).state.raw).toBe(r.state.raw);
  expect(stepNativeSteeringInput(r.state,{...i,mouseDeltaX:0,steeringAxis:128}).state.lastInput).toBe('keyboard');
  expect(stepNativeSteeringInput(state(),{...i,mouseDeltaX:1000}).state.raw).toBe(-1);
});
test('mouse-look decays raw steering and rear handbrake steering updates per call',()=>{
  const previous={...state(),raw:.5,secondAngle:.2,lastInput:'mouse' as const};
  const i={...input(),steeringAxis:0,mouseThirdPerson:true,mouseSteeringEnabled:true,vehicleMouseLook:true,timeStep:2,rearHandbrakeSteering:true,handbrake:true};
  const r=stepNativeSteeringInput(previous,i);expect(r.state.raw).toBeCloseTo(.5*.975**2,7);expect(r.state.secondAngle).toBeCloseTo(.2*.1-r.angle*.9,7);
  expect(stepNativeSteeringInput(previous,{...i,handbrake:false,timeStep:0}).state.secondAngle).toBeCloseTo(.18,7);
  expect(stepNativeSteeringInput(previous,{...i,rearHandbrakeSteering:false}).state.secondAngle).toBeCloseTo(.2,7);
});
test('invalid input rejects without changing prior steering state',()=>{
  const previous=state(),before=structuredClone(previous);stepNativeSteeringInput(previous,input());expect(previous).toEqual(before);
  for(const patch of [{steeringAxis:129},{steeringAxis:.5},{mouseDeltaX:NaN},{timeStep:-1},{steeringLockDegrees:0}])expect(()=>stepNativeSteeringInput(previous,{...input(),...patch})).toThrow();
});
