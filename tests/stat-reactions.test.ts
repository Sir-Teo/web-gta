import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {AR,NativeStatReactions,readActionReactionStats,STAT_BIKE_SKILL,STAT_STAMINA} from '../src/simulation/nativeStatReactions';

const values=readActionReactionStats(readFileSync('public/play/world/files/data/ar_stats.dat','utf8'));

test('AR_STATS.DAT reads as id and value, comments skipped',()=>{
 expect(values.length).toBe(59);
 expect([values[AR.incSprintStamina],values[AR.incRunning],values[AR.incMotorbikeSkill]]).toEqual([10,5,25]);
 expect([values[AR.timeLimitSprintStamina],values[AR.timeLimitRunning],values[AR.timeLimitMotorbikeSkill]]).toEqual([300,300,180]);
 expect(values[12]).toBeCloseTo(.8,6);
});

test('five minutes of sprinting raise stamina by 10, of running by 5 (UpdateStatsWhenSprinting, UpdateStatsWhenRunning)',()=>{
 const got:[number,number][]=[],r=new NativeStatReactions(values,(stat,value)=>got.push([stat,value]));
 // 20 ms frames: the counter must pass 300000 ms, then the next frame pays out.
 for(let i=0;i<15000;i++)r.sprinting(20);
 expect(got).toEqual([]);
 r.sprinting(20);r.sprinting(20);
 expect(got).toEqual([[STAT_STAMINA,10]]);expect(r.sprintStaminaCounter).toBe(0);
 // The fraction of a millisecond is dropped each frame.
 got.length=0;for(let i=0;i<18000;i++)r.running(16.67);expect(got).toEqual([]);expect(r.runningCounter).toBe(288000);
});

test('motorbike skill counts fast riding and wheels in the air half again, steady riding half, standing still nothing',()=>{
 const got:[number,number][]=[],r=new NativeStatReactions(values,(stat,value)=>got.push([stat,value]));
 r.onMotorBike(20,.7,4);expect(r.bikeCounter).toBe(30);
 r.onMotorBike(20,.3,0);expect(r.bikeCounter).toBe(60);
 r.onMotorBike(20,.3,4);expect(r.bikeCounter).toBe(70);
 r.onMotorBike(20,.1,4);expect(r.bikeCounter).toBe(70);
 r.bikeCounter=180001;r.onMotorBike(20,0,4);expect(got).toEqual([[STAT_BIKE_SKILL,25]]);expect(r.bikeCounter).toBe(0);
});
