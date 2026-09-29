import {expect,test} from 'vitest';
import {controlsOffSpeedScale,rawSteerTowards,steerFraction} from '../src/simulation/nativeQuadSteer';
import {nativePedals} from '../src/simulation/nativePedals';

// CAutomobile::ProcessControlInputs, which the quad shares with cars.
test('the raw steer moves a fifth of the way to the pad each frame and the steer angle is its square with the sign',()=>{
 let raw=0;raw=rawSteerTowards(raw,1,1/50);expect(raw).toBeCloseTo(.2,6);
 raw=rawSteerTowards(raw,1,1/50);expect(raw).toBeCloseTo(.36,6);
 // Two frames' worth at once, and never past the pad.
 expect(rawSteerTowards(0,1,2/50)).toBeCloseTo(.4,6);expect(rawSteerTowards(.9,1,1)).toBe(1);
 expect(rawSteerTowards(1,-1,1/50)).toBeCloseTo(.6,6);
 expect(steerFraction(.5)).toBeCloseTo(.25,6);expect(steerFraction(-.5)).toBeCloseTo(-.25,6);expect(steerFraction(1)).toBe(1);
});
test('the reverse button brakes a quad rolling forward and reverses one that has stopped',()=>{
 const pedals=(forwardSpeed:number,previousGas=0)=>nativePedals({accelerate:0,brake:255,forwardSpeed,previousGas,automaticallyHandbrake:false,handbrake:false,engineOn:true,drowning:false,driveByAim:false,rightShoulder:0,leftShoulder:0,unloadModel:false,forwardAllowed:true,reverseAllowed:true});
 expect(pedals(.2)).toMatchObject({gas:0,brake:1});
 expect(pedals(.005)).toMatchObject({gas:-1,brake:0});
 expect(pedals(-.05,-1)).toMatchObject({gas:-1,brake:0});
});
test('CAutomobile::ProcessControl holds the player\'s quad to 0.28 units a frame with the controls off',()=>{
 expect(controlsOffSpeedScale(10)).toBe(1);expect(controlsOffSpeedScale(28)).toBeCloseTo(.5,6);
});
