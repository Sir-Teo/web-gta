import {expect,test} from 'vitest';
import {CAR_MISSION,followCarClosePedals} from '../src/simulation/ScriptCarMissions';

const base={swerve:.2,accel:1,brake:0,handbrake:false};

// MISSION_FOLLOWCAR_CLOSE (iOS 0x1001997d0).
test('beyond the follow distance + 10 the car heads for the leader as any close mission does',()=>{
 expect(followCarClosePedals(base,37,27,.1,.1)).toBe(base);
});

test('inside it, the gap past the follow distance (x2, x5 when short) plus the leader\'s speed less its own sets gas or brake',()=>{
 // 3 units long, both at 0.1 a frame: 3 x 2 = 6, a twentieth: 0.3 gas.
 expect(followCarClosePedals(base,30,27,.1,.1)).toEqual({...base,accel:.3,brake:0});
 // Level with the distance and 0.05 a frame faster than the leader: -3, a brake of 0.3.
 const slow=followCarClosePedals(base,27,27,.1,.15);expect(slow.accel).toBe(0);expect(slow.brake).toBeCloseTo(.3,6);
 // 2 short: -10, a full brake; far behind and slow, full gas.
 expect(followCarClosePedals(base,25,27,0,0)).toEqual({...base,accel:0,brake:1});
 expect(followCarClosePedals(base,36,27,.5,0)).toEqual({...base,accel:1,brake:0});
});

test('SET_CAR_MISSION\'s 52 and 53 are the follow missions',()=>{
 expect(CAR_MISSION[52]).toBe('followCarFar');expect(CAR_MISSION[53]).toBe('followCarClose');
});
