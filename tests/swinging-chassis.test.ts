import {expect,test} from 'vitest';
import {NativeSwingingChassis,createSwingingChassis} from '../src/simulation/nativeSwingingChassis';
import type {CarAxes} from '../src/simulation/nativeDoor';
const axes:CarAxes={right:[1,0,0],forward:[0,1,0],up:[0,0,1]};

test('constructor selects native chassis limits and gives handling precedence over the fire-ladder case',()=>{
 expect(createSwingingChassis(492,0)).toBeUndefined();expect(createSwingingChassis(544,0)?.openAngle).toBe(Math.fround(.1*Math.PI));
 expect(createSwingingChassis(598,0x10000000)?.openAngle).toBe(Math.fround(.03*Math.PI));
 expect(createSwingingChassis(409,0x10000000)?.openAngle).toBe(Math.fround(.01*Math.PI));
 expect(createSwingingChassis(544,0x10000000)?.kind).toBe('chassis');
});

test('fire ladder damps, springs and caps velocity while integrating once per render frame',()=>{
 const fire=new NativeSwingingChassis('firetruck',.1);fire.angVel=.1;fire.step([0,0,0],axes,1.5);
 expect(fire.angVel).toBe(Math.fround(.05));expect(fire.angle).toBe(Math.fround(.05));
 fire.step([0,0,0],axes,1.5);expect(fire.angVel).toBeCloseTo(.04525,6);
 expect(fire.angle).toBeCloseTo(.09525,6);
 for(let i=0;i<600;i++)fire.step([0,0,0],axes,1.5);expect(Math.abs(fire.angle)).toBeLessThan(1e-5);
});

test('chassis input is suppressed in the reduced mode while the native spring keeps returning it',()=>{
 const normal=new NativeSwingingChassis('chassis',.02),reduced=new NativeSwingingChassis('chassis',.02);
 normal.step([.1,0,0],axes,1);reduced.step([.1,0,0],axes,1,true);
 expect(normal.angle).toBeLessThan(0);expect(reduced.angle).toBe(0);
 reduced.angle=.02;reduced.step([.1,0,0],axes,1,true);expect(reduced.angle).toBeLessThan(.02);
});

test('fixed-state open and closed limits bounce without shutting the spring mechanism off',()=>{
 const s=new NativeSwingingChassis('firetruck',.1);s.angle=s.openAngle;s.angVel=.1;s.step([0,0,0],axes,1);
 expect(s.angle).toBe(s.openAngle);expect(s.angVel).toBeLessThan(0);
 s.angle=s.closedAngle;s.angVel=-.1;s.step([0,0,0],axes,1);expect(s.angle).toBe(s.closedAngle);expect(s.angVel).toBeGreaterThan(0);
});
