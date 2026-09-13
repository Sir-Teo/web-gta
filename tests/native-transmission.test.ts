import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
import {stepNativeTransmission,type TransmissionInput} from '../src/simulation/nativeTransmission';
const handling=()=>prepareHandling(readHandling('DIAGNOSTIC 1200 2400 0 0 0 0 75 .8 .9 .5 5 180 24 10 R P 8 .6 0 35 1.2 .15 .02 .3 -.2 .55 .1 .25 .7 12345 0 0 1 2 3').records[0],0);
const input:TransmissionInput={velocity:0,throttle:1,timeStep:1,allWheelsOnGround:true};
test('drive increment follows gear boost, throttle and native timestep independently of mass forces',()=>{
  const h=handling();expect(stepNativeTransmission(h,{gear:1},input).acceleration).toBeCloseTo(.003072,8);
  expect(stepNativeTransmission(h,{gear:1},{...input,throttle:.5,timeStep:.5}).acceleration).toBeCloseTo(.000768,8);
  expect(stepNativeTransmission(h,{gear:0},{...input,velocity:-.02,throttle:-1}).acceleration).toBeCloseTo(-.003456,8);
  h.values.handlingFlags=3;expect(stepNativeTransmission(h,{gear:1},input).acceleration).toBeCloseTo(.004608,8);
  h.values.handlingFlags=2;expect(stepNativeTransmission(h,{gear:1},input).acceleration).toBeCloseTo(.00384,8);
  h.values.gears=1;expect(stepNativeTransmission(h,{gear:0},{...input,velocity:-.02,throttle:-1}).acceleration).toBeCloseTo(-.000768,8);
});
test('forward and reverse selection respects throttle direction and exact shift boundaries',()=>{
  const h=handling();expect(stepNativeTransmission(h,{gear:0},input).state.gear).toBe(1);
  expect(stepNativeTransmission(h,{gear:1},{...input,velocity:-.02,throttle:-1}).state.gear).toBe(0);
  expect(stepNativeTransmission(h,{gear:1},{...input,velocity:-.02}).state.gear).toBe(1);
  const up=h.gears[1].changeUpVelocity;expect(stepNativeTransmission(h,{gear:1},{...input,velocity:up}).state.gear).toBe(1);
  expect(stepNativeTransmission(h,{gear:1},{...input,velocity:up+.001}).state.gear).toBe(2);
  const down=h.gears[3].changeDownVelocity;expect(stepNativeTransmission(h,{gear:3},{...input,velocity:down}).state.gear).toBe(3);
  expect(stepNativeTransmission(h,{gear:3},{...input,velocity:down-.001}).state.gear).toBe(2);
});
test('multi-gear shifts omit inertia and cheat effects for the remainder of that call',()=>{
  const h=handling(),prior={gear:1,inertia:{ratio:.2,smoothing:.3}},before=structuredClone(prior);
  const result=stepNativeTransmission(h,prior,{...input,velocity:.5,cheat:'nitros'});
  expect(result.shifts).toBe(2);expect(result.state.gear).toBe(3);expect(prior).toEqual(before);
  expect(result.state.inertia).toEqual({ratio:Math.fround(.2),smoothing:Math.fround(.3)});
  expect(result.acceleration).toBe(stepNativeTransmission(h,{gear:3},{...input,velocity:.5}).acceleration);
});
test('ground contact smooths inertia while airborne updates memory without damping this increment',()=>{
  const h=handling(),prior={gear:1,inertia:{ratio:0,smoothing:1}};
  const grounded=stepNativeTransmission(h,prior,input);
  expect(grounded.state.inertia!.smoothing).toBeCloseTo(.865,6);expect(grounded.acceleration).toBeCloseTo(.003072*.865,8);
  const next=stepNativeTransmission(h,grounded.state,input);expect(next.acceleration).toBeGreaterThan(grounded.acceleration);
  const airborne=stepNativeTransmission(h,prior,{...input,allWheelsOnGround:false});
  expect(airborne.state.inertia!.ratio).toBeCloseTo(.01,7);expect(airborne.state.inertia!.smoothing).toBe(Math.fround(.1));
  expect(airborne.acceleration).toBe(stepNativeTransmission(h,{gear:1},input).acceleration);expect(prior.inertia).toEqual({ratio:0,smoothing:1});
});
test('unshifted modifiers, global speed bounds and per-gear taper remain separate',()=>{
  const h=handling(),plain=stepNativeTransmission(h,{gear:1},input).acceleration;
  expect(stepNativeTransmission(h,{gear:1},{...input,cheat:'perfect'}).acceleration).toBeCloseTo(plain*1.2,8);
  expect(stepNativeTransmission(h,{gear:1},{...input,cheat:'nitros'}).acceleration).toBeCloseTo(plain*2,8);
  for(const velocity of [h.values.maxVelocity+.01,h.maxReverseVelocity-.01]){
    const result=stepNativeTransmission(h,{gear:2}, {...input,velocity});expect(result.acceleration).toBe(0);expect(result.state.gear).toBe(2);expect(result.shifts).toBe(0);
  }
  // Isolate the taper branch with a diagnostic gear max below its shift threshold.
  h.gears[1].maxVelocity=.1;
  expect(stepNativeTransmission(h,{gear:1},{...input,velocity:.125}).acceleration).toBeCloseTo(plain*.5,7);
  expect(stepNativeTransmission(h,{gear:1},{...input,velocity:.16}).acceleration).toBe(0);
});
test('invalid numeric and inertia inputs fail without partially committing transmission state',()=>{
  const h=handling(),prior={gear:1,inertia:{ratio:0,smoothing:1}},before=structuredClone(prior);
  for(const bad of [{velocity:NaN},{throttle:2},{timeStep:4},{timeStep:-1}])expect(()=>stepNativeTransmission(h,prior,{...input,...bad})).toThrow();
  expect(()=>stepNativeTransmission(h,{gear:6},input)).toThrow(/gear/);
  h.values.engineInertia=0;expect(()=>stepNativeTransmission(h,prior,{...input,allWheelsOnGround:false})).toThrow(/inertia/);
  expect(prior).toEqual(before);
});
