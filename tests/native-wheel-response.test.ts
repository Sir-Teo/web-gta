import {expect,test} from 'vitest';
import {nativeCoastBrake,nativeWheelResponse,type NativeWheelInput} from '../src/simulation/nativeWheelResponse';
const base:NativeWheelInput={wheel:'rearLeft',previousState:'normal',alreadySkidding:false,forwardSpeed:0,rightSpeed:0,contactCount:4,
  thrust:.1,brake:0,coastBrake:.03,adhesion:1,tractionLoss:.8,throttle:1,timeStep:1,playerControlled:false,antiDive:0};
test('ordinary drive preserves thrust while braking takes precedence and coasting uses its own limit',()=>{
  expect(nativeWheelResponse(base).forward).toBeCloseTo(.1,7);
  const braking=nativeWheelResponse({...base,thrust:99,brake:.2,forwardSpeed:4});expect(braking.driving).toBe(false);expect(braking.forward).toBeCloseTo(-.2,7);
  expect(nativeWheelResponse({...base,thrust:0,throttle:0,forwardSpeed:1}).forward).toBeCloseTo(-.03,7);
  expect(nativeWheelResponse({...base,thrust:0,throttle:.1,forwardSpeed:1}).forward).toBeCloseTo(0,7);
});
test('combined traction circle limits cornering and identifies front versus rear spin thresholds',()=>{
  const input={...base,thrust:.5,rightSpeed:4,forwardSpeed:.2};
  const front=nativeWheelResponse({...input,wheel:'frontRight'}),rear=nativeWheelResponse(input);
  expect(front.state).toBe('skidding');expect(rear.state).toBe('spinning');
  expect(Math.hypot(front.forward,front.right)).toBeCloseTo(.8,6);expect(front.forward).toBeCloseTo(.8/Math.sqrt(5),6);
  expect(front.right).toBeCloseTo(-1.6/Math.sqrt(5),6);
});
test('lock-up retains fixed state and player spin loss differs from shared skid history',()=>{
  const fixed=nativeWheelResponse({...base,thrust:0,brake:.2,adhesion:.1,forwardSpeed:1});expect(fixed.state).toBe('fixed');expect(fixed.forward).toBeCloseTo(-.08,7);
  const spinning=nativeWheelResponse({...base,thrust:3,playerControlled:true});expect(spinning.state).toBe('spinning');expect(spinning.forward).toBeCloseTo(.64,6);
  const previousSpin=nativeWheelResponse({...base,thrust:3,playerControlled:true,previousState:'spinning'});expect(previousSpin.adhesion).toBeCloseTo(.64,6);expect(previousSpin.alreadySkidding).toBe(true);
  const shared=nativeWheelResponse({...base,thrust:3,playerControlled:true,alreadySkidding:previousSpin.alreadySkidding});expect(shared.forward).toBeCloseTo(1,7);expect(shared.adhesion).toBe(1);
});
test('burst perturbation consumes an explicit sample only for nonzero lateral speed and preserves signed forward speed',()=>{
  expect(nativeWheelResponse({...base,burst:true}).right).toBe(0);
  expect(()=>nativeWheelResponse({...base,burst:true,rightSpeed:1})).toThrow(/random sample/);
  const result=nativeWheelResponse({...base,thrust:0,throttle:.1,burst:true,rightSpeed:.4,forwardSpeed:-1,burstNoise:.13});
  expect(result.right).toBeCloseTo(-.23,7);
});
test('anti-dive modifies turning response without changing linear braking or drive response',()=>{
  const drive=nativeWheelResponse({...base,antiDive:.6});expect(drive.forward).toBeCloseTo(.1,7);expect(drive.turnForward).toBeCloseTo(.07,7);
  const brake=nativeWheelResponse({...base,thrust:0,brake:.2,forwardSpeed:.4,antiDive:.6});expect(brake.forward).toBeCloseTo(-.1,7);expect(brake.turnForward).toBeCloseTo(-.04,7);
  const coast=nativeWheelResponse({...base,thrust:0,throttle:0,forwardSpeed:1,antiDive:.6});expect(coast.turnForward).toBe(coast.forward);
});
test('coast resistance preserves bike/plane/RC branches and high-brake precedence',()=>{
  expect(nativeCoastBrake(600,1000,'car')).toBeCloseTo(.6,7);expect(nativeCoastBrake(600,1000,'bike')).toBeCloseTo(.3,7);
  expect(nativeCoastBrake(600,1000,'rcBandit')).toBeCloseTo(.12,7);expect(nativeCoastBrake(600,1000,'plane')).toBe(0);
  expect(nativeCoastBrake(600000,1000,'rcBandit')).toBeCloseTo(60,6);
});
test('invalid contact domains and nonfinite calculations reject without mutating caller input',()=>{
  const before=structuredClone(base);
  for(const bad of [{contactCount:0},{timeStep:4},{adhesion:-1},{thrust:NaN},{tractionLoss:Infinity},{throttle:2},{rightSpeed:1,burst:true,burstNoise:.2}])expect(()=>nativeWheelResponse({...base,...bad})).toThrow();
  expect(()=>nativeCoastBrake(1,0,'car')).toThrow();expect(base).toEqual(before);
});
