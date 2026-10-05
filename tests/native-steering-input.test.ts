import {expect,test} from 'vitest';
import {padSteeringAxis,stepNativeSteeringInput,type NativeSteeringControl,type NativeSteeringState} from '../src/simulation/nativeSteeringInput';
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
test('mouse-look decays raw steering and rear handbrake steering updates once per game frame',()=>{
  const previous={...state(),raw:.5,secondAngle:.2,lastInput:'mouse' as const};
  const i={...input(),steeringAxis:0,mouseThirdPerson:true,mouseSteeringEnabled:true,vehicleMouseLook:true,timeStep:2,rearHandbrakeSteering:true,handbrake:true};
  const r=stepNativeSteeringInput(previous,i);expect(r.state.raw).toBeCloseTo(.5*.975**2,7);
  // One 30 fps game frame (a timestep of 50/30) is one lerp; a timestep of 2 is 1.2 frames.
  const frame=stepNativeSteeringInput(previous,{...i,timeStep:50/30});expect(frame.state.secondAngle).toBeCloseTo(.2*.1-frame.angle*.9,6);
  expect(r.state.secondAngle).toBeCloseTo(-r.angle+(.2+r.angle)*.1**1.2,6);
  expect(stepNativeSteeringInput(previous,{...i,handbrake:false,timeStep:50/30}).state.secondAngle).toBeCloseTo(.18,6);
  expect(stepNativeSteeringInput(previous,{...i,rearHandbrakeSteering:false}).state.secondAngle).toBeCloseTo(.2,7);
});
test('invalid input rejects without changing prior steering state',()=>{
  const previous=state(),before=structuredClone(previous);stepNativeSteeringInput(previous,input());expect(previous).toEqual(before);
  for(const patch of [{steeringAxis:129},{steeringAxis:.5},{mouseDeltaX:NaN},{timeStep:-1},{steeringLockDegrees:0}])expect(()=>stepNativeSteeringInput(previous,{...input(),...patch})).toThrow();
});
test('an analog deflection steers in the pad\'s whole units, which the native input accepts',()=>{
  // A touch stick a third of the way over (on the port's curve), tilt steering and a controller's stick give fractions.
  for(const deflection of [.24,-.613,1/3,.0001,.9999]){
    const axis=padSteeringAxis(deflection);
    expect(Number.isInteger(axis)).toBe(true);expect(Math.abs(axis-deflection*128)).toBeLessThanOrEqual(.5);
    expect(()=>stepNativeSteeringInput(state(),{...input(),steeringAxis:axis})).not.toThrow();
  }
  expect(padSteeringAxis(1)).toBe(128);expect(padSteeringAxis(-1)).toBe(-128);expect(padSteeringAxis(0)).toBe(0);
  // Past full lock, or nothing readable, is full lock or straight on; a rounding to -0 is 0.
  expect(padSteeringAxis(1.2)).toBe(128);expect(padSteeringAxis(-7)).toBe(-128);expect(padSteeringAxis(NaN)).toBe(0);expect(Object.is(padSteeringAxis(-.001),0)).toBe(true);
  // The raw fraction is what the native input refuses (the frame loop threw on it at the wheel of a touch-steered car).
  expect(()=>stepNativeSteeringInput(state(),{...input(),steeringAxis:.24*128})).toThrow('Invalid steering input range.');
});
