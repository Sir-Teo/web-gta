import {describe,expect,test} from 'vitest';
import {NativePlayerWheelStats,STAT_LONGEST_2_WHEELS_TIME,STAT_LONGEST_WHEELIE_TIME,STAT_LONGEST_WHEELIE_DISTANCE,STAT_LONGEST_STOPPIE_TIME,type WheelStatsFrame} from '../src/simulation/nativeWheelStats';

/** 30 game frames a second: 33 ms each. */
const STEP=50/30;
const car=(compression:[number,number,number,number],damageIntensity=0):WheelStatsFrame=>({timeStep:STEP,vehicle:{kind:'car',compression,contactWheels:compression.filter(c=>c<1).length,damageIntensity,movingSpeed:.5}});
const bike=(ratios:[number,number,number,number],damageIntensity=0):WheelStatsFrame=>({timeStep:STEP,vehicle:{kind:'bike',ratios,damageIntensity,movingSpeed:.25}});
const LEFT_UP:[number,number,number,number]=[1,1,.5,.5],ALL_DOWN:[number,number,number,number]=[.5,.5,.5,.5],ALL_UP:[number,number,number,number]=[1,1,1,1];
const WHEELIE:[number,number,number,number]=[1,1,.5,.5],STOPPIE:[number,number,number,number]=[.5,.5,1,1];
const tracker=()=>{const records:[number,number][]=[];return {records,w:new NativePlayerWheelStats((stat,value)=>{records.push([stat,value]);})};};

describe('CPlayerInfo::Process wheel counters (iOS 0x100253b24)',()=>{
 test('a frame is the timestep in ms, truncated',()=>{const {w}=tracker();w.process(car(LEFT_UP));expect(w.carTwoWheelCounter).toBe(33);});
 test('a car on its right wheels for over 2 s is recorded when it lands, in whole seconds and the distance summed',()=>{
  const {w,records}=tracker();
  for(let i=0;i<70;i++)w.process(car(LEFT_UP));
  expect(w.carTwoWheelCounter).toBe(70*33);
  w.process(car(ALL_DOWN));
  expect(records).toEqual([[STAT_LONGEST_2_WHEELS_TIME,2],[12,Math.fround(70*.5)]]);
  expect(w.carTwoWheelCounter).toBe(0);
  expect(w.takeBests()).toMatchObject({twoWheelsTime:2310,twoWheelsDistance:Math.fround(70*.5)});
  expect(w.takeBests().twoWheelsTime).toBe(0);
 });
 test('a frame off the pattern runs the grace buffer; past 499 ms the run ends, and a collision counts as off it',()=>{
  const {w,records}=tracker();
  for(let i=0;i<70;i++)w.process(car(LEFT_UP));
  // Fully airborne: each frame adds 33 to the buffer, nothing to the run.
  for(let i=0;i<16;i++)w.process(car(ALL_UP));
  expect(w.carTwoWheelCounter).toBe(70*33);expect(w.tempBufferCounter).toBe(16*33);
  w.process(car(LEFT_UP,5));expect(records).toEqual([[STAT_LONGEST_2_WHEELS_TIME,2],[12,Math.fround(70*.5)]]);
  expect(w.tempBufferCounter).toBe(0);
 });
 test('a run under 2 s is dropped, and leaving the vehicle clears the counters but not the distances',()=>{
  const {w,records}=tracker();
  for(let i=0;i<30;i++)w.process(car(LEFT_UP));
  w.process({timeStep:STEP});expect(w.carTwoWheelCounter).toBe(0);expect(w.carTwoWheelDist).toBe(15);
  w.process(car(ALL_DOWN));expect(records).toEqual([]);
 });
 test('a wheelie needs 5 s and ends at once when the front touches; a stoppie needs 2 s',()=>{
  const {w,records}=tracker();
  for(let i=0;i<152;i++)w.process(bike(WHEELIE));
  expect(w.bikeRearWheelCounter).toBe(152*33);
  w.process(bike(ALL_DOWN));
  expect(records).toEqual([[STAT_LONGEST_WHEELIE_TIME,5],[STAT_LONGEST_WHEELIE_DISTANCE,Math.fround(152*.25)]]);
  for(let i=0;i<61;i++)w.process(bike(STOPPIE));
  w.process(bike(ALL_DOWN));
  expect(records[2]).toEqual([STAT_LONGEST_STOPPIE_TIME,2]);
  expect(w.takeBests()).toMatchObject({wheelieTime:152*33,stoppieTime:61*33});
 });
 test('the bike contact test takes the first touching line regardless of a collision, the second only without',()=>{
  const {w}=tracker();
  w.process(bike([1,1,.5,1],7));expect(w.bikeRearWheelCounter).toBe(33);
  const b=tracker().w;b.process(bike([1,1,1,.5],7));expect(b.bikeRearWheelCounter).toBe(0);
 });
});
