import {expect,test} from 'vitest';
import {NativeMotorbikeTraining} from '../src/simulation/nativeMotorbikeTraining';
import {readFileSync} from 'node:fs';
import {AR,NativeStatReactions,readActionReactionStats,STAT_STAMINA} from '../src/simulation/nativeStatReactions';

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

test('native motorbike skill counts fast riding and reduced contact half again, steady riding half',()=>{
 const r=new NativeMotorbikeTraining(values);let skill=0;
 const step=(speed:number,wheels:number)=>{const result=r.step(1,{velocity:[speed,0,0],contactWheels:wheels,skill});skill=result.skill;};
 step(.7,4);expect(r.counter).toBe(30);
 step(.3,0);expect(r.counter).toBe(60);
 step(.3,4);expect(r.counter).toBe(70);
 step(.1,4);expect(r.counter).toBe(70);
 // The routine can award while stopped; its CPlayerInfo caller separately skips zero speed.
 r.counter=180001;step(0,4);expect(skill).toBe(25);expect(r.counter).toBe(0);
});
