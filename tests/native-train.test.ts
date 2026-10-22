import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {TRAIN_STATIONS,TRAIN_TRACK_FILES,findClosestTrackNode,readTrainTrack,stationDistances} from '../src/simulation/nativeTrainTracks';
import {createMissionTrain,findCaboose,findCarriage,nextStation,skipTrainToAllowedStation,trainStationSkipPlan,setTrainCruiseSpeed,setTrainSpeed} from '../src/simulation/nativeTrain';

const tracks=TRAIN_TRACK_FILES.map(f=>readTrainTrack(readFileSync(`public/play/world/files/data/paths/${f}`,'utf8')));
const model=(id:number)=>({model:id,boxLength:id===537?18:15,boxMinZ:-1.2,suspensionLowerLimit:-.1});

describe('the train tracks',()=>{
 test('every file reads its nodes, quantized as CTrainNode keeps them, with a loop’s distances',()=>{
  expect(tracks.map(t=>t.nodes.length)).toEqual([926,300,67,656].slice(0,4).map((_,i)=>tracks[i].nodes.length));
  expect(tracks[0].nodes.length).toBe(926);
  for(const t of tracks){
   expect(t.nodes[0].distance).toBe(0);
   for(let i=1;i<t.nodes.length;i++)expect(t.nodes[i].distance).toBeGreaterThanOrEqual(t.nodes[i-1].distance);
   expect(t.totalLength).toBeGreaterThan(t.nodes.at(-1)!.distance);
   // Eighths of a unit, thirds of a unit.
   for(const n of t.nodes.slice(0,20)){expect(n.x*8).toBe(Math.round(n.x*8));expect(n.distance*3).toBeCloseTo(Math.round(n.distance*3),6);}
  }
  expect(tracks[0].nodes[0]).toMatchObject({x:2555.375,y:2292.25,z:2.25});
 });
 test('INTRO’s train point is on the main line',()=>{
  const {track,node}=findClosestTrackNode(tracks,{x:2285.15,y:-1257.5,z:23});
  const n=tracks[track].nodes[node];
  expect(Math.hypot(n.x-2285.15,n.y+1257.5)).toBeLessThan(15);
 });
});

describe('a mission train',()=>{
 test('type 13 is a freight engine and five flat cars, laid engine first along the rails',()=>{
  const cars=createMissionTrain(tracks,{x:2285.15,y:-1257.5,z:23},true,13,model);
  expect(cars.map(c=>c.model.model)).toEqual([537,569,569,569,569,569]);
  expect(findCarriage(cars[0],2)).toBe(cars[2]);expect(findCaboose(cars[0])).toBe(cars[5]);
  expect(cars[0].carriagesPulled()).toBe(5);
  for(const c of cars)c.processControl(tracks,1,60000);
  // Each carriage sits a carriage's length behind the one before it, and faces the way the train runs.
  for(let i=1;i<cars.length;i++){
   const a=cars[i-1].position,b=cars[i].position,d=Math.hypot(a[0]-b[0],a[1]-b[1]);
   expect(d).toBeGreaterThan(14);expect(d).toBeLessThan(19);
   const back=[b[0]-a[0],b[1]-a[1]];expect(back[0]*cars[i-1].forward[0]+back[1]*cars[i-1].forward[1]).toBeLessThan(0);
  }
  const up=cars[0].up;expect(up[2]).toBeGreaterThan(.9);
 });
 test('SET_TRAIN_CRUISE_SPEED draws it up to speed; SET_TRAIN_SPEED sets it at once',()=>{
  const cars=createMissionTrain(tracks,{x:2285.15,y:-1257.5,z:23},false,10,model);
  setTrainCruiseSpeed(cars[0],20);
  const start=cars[0].railDistance;
  for(let f=0;f<3000;f++)for(const c of cars)c.processControl(tracks,1,60000+f*20);
  // 20 units a second is 0.4 a step, run the other way round the loop.
  expect(Math.abs(cars[0].speed)).toBeCloseTo(.4,1);expect(cars[0].speed).toBeLessThan(0);
  expect(cars[0].railDistance).not.toBe(start);
  setTrainSpeed(cars[0],0);expect(cars[0].speed).toBe(-0);
  const moving=Math.hypot(...cars[1].moveSpeed);expect(moving).toBeGreaterThan(.3);
 });
 test('a train made in a game’s first seconds waits as at a station: ten seconds for freight',()=>{
  const cars=createMissionTrain(tracks,{x:2285.15,y:-1257.5,z:23},true,10,model);
  setTrainCruiseSpeed(cars[0],30);
  for(let f=0;f<200;f++)for(const c of cars)c.processControl(tracks,1,3000+f*20);
  expect(cars[0].speed).toBe(0);
  for(let f=0;f<3000;f++)for(const c of cars)c.processControl(tracks,1,23000+f*20);
  expect(cars[0].speed).toBeGreaterThan(.3);
 });
});

describe('IsNextStationAllowed',()=>{
 test('InitTrains uses track-0 station marks and quantized float32 rail distances',()=>{
  const marks=readFileSync('public/play/world/files/data/paths/tracks.dat','utf8').split(/\r?\n/).slice(1).map(l=>l.trim().split(/\s+/).map(Number)).filter(p=>p[3]);
  expect(TRAIN_STATIONS).toEqual(marks.map(p=>p.slice(0,3).map(Math.fround)));
  const nearest=TRAIN_STATIONS.map(([x,y,z])=>findClosestTrackNode(tracks,{x,y,z}));
  expect(nearest.map(n=>n.track)).toEqual([0,0,0,0,0,0]);expect(nearest.map(n=>n.node)).toEqual([58,106,330,370,596,822]);
  expect(stationDistances(tracks)).toEqual([617.3333333333334,1135,5646.333333333333,6804.666666666667,11501,16645].map(Math.fround));
 });
 test('the next station ahead, or the one after when the train stands within 100 of it',()=>{
  const dist=[100,1000,2000,3000,4000,5000];
  expect(nextStation(500,true,dist)).toBe(1);expect(nextStation(500,false,dist)).toBe(0);
  // Past the last station: clockwise wraps to the first, anticlockwise the last.
  expect(nextStation(6000,true,dist)).toBe(0);expect(nextStation(6000,false,dist)).toBe(5);
  // Before the first: anticlockwise goes round to the last.
  expect(nextStation(50,false,dist)).toBe(5);
  // At a station (within 100) the one after it along the way.
  expect(nextStation(950,true,dist)).toBe(2);expect(nextStation(1050,false,dist)).toBe(0);
  expect(nextStation(5050,true,dist)).toBe(0);expect(nextStation(120,false,dist)).toBe(5);
 });
});

describe('SkipToNextAllowedStation',()=>{
 const distances=[100,300,600,900,1200,1500];
 test('clockwise travel skips locked stations and stops twenty before the first allowed one',()=>{
  const visited:number[]=[],target=TRAIN_STATIONS[2];
  const plan=trainStationSkipPlan(200,true,distances,[target[0]-60,target[1]-80,999],i=>{visited.push(i);return i===2;});
  expect(visited).toEqual([1,2]);expect(plan).toEqual({station:2,railDistance:580,speed:Math.fround(.1),minutes:28});
 });
 test('anticlockwise travel stops twenty above the station and preserves the negative speed',()=>{
  const visited:number[]=[],target=TRAIN_STATIONS[1];
  const plan=trainStationSkipPlan(800,false,distances,[target[0]+30,target[1]+40,-999],i=>{visited.push(i);return i===1;});
  expect(visited).toEqual([2,1]);expect(plan).toEqual({station:1,railDistance:320,speed:Math.fround(-.1),minutes:25});
 });
 test('the existing strict 100-unit own-station rule and end-of-track wrapping also apply to skipping',()=>{
  expect(trainStationSkipPlan(200,true,distances,[0,0,0],()=>true)?.station).toBe(1);
  expect(trainStationSkipPlan(201,true,distances,[0,0,0],()=>true)?.station).toBe(2);
  expect(trainStationSkipPlan(1600,true,distances,[0,0,0],()=>true)?.station).toBe(0);
  expect(trainStationSkipPlan(50,false,distances,[0,0,0],()=>true)?.station).toBe(5);
  expect(trainStationSkipPlan(200,true,distances,[0,0,0],()=>false)).toBeUndefined();
 });
 test('a caboose argument updates its engine; carriage spacing catches up on the next control pass',()=>{
  const cars=createMissionTrain(tracks,{x:1297,y:-1898,z:3},true,10,model),dist=stationDistances(tracks);
  for(const c of cars)c.processControl(tracks,0,60000);
  const old=cars[1].railDistance,plan=skipTrainToAllowedStation(cars[1],dist,i=>i===0)!;
  expect(plan.station).toBe(0);expect(cars[0].railDistance).toBe(plan.railDistance);expect(cars[0].speed).toBe(Math.fround(.1));expect(cars[1].railDistance).toBe(old);
  for(const c of cars)c.processControl(tracks,0,60000);
  expect(cars[1].railDistance).toBeCloseTo(cars[0].railDistance+cars[1].length,5);
  expect(Math.hypot(cars[1].position[0]-cars[0].position[0],cars[1].position[1]-cars[0].position[1])).toBeGreaterThan(10);
 });
});
