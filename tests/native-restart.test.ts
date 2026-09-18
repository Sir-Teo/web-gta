import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readInitialRestartPoints} from '../src/assets/scmRestartPoints';
import {LEVEL_COUNTRYSIDE,NativeRestart} from '../src/simulation/nativeRestart';

const main=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
const countryside=()=>LEVEL_COUNTRYSIDE;
const fallback={position:[0,0,0] as [number,number,number],heading:0};

test('the packaged INITIAL mission carries all eight hospital and seven police restarts',()=>{
 const {hospitals,police}=readInitialRestartPoints(main());
 expect([hospitals.length,police.length]).toEqual([8,7]);
 expect(hospitals[0]).toEqual({position:[2027.77001953125,-1420.52001953125,15.989999771118164],heading:137,townId:0});
 expect(hospitals[7]).toEqual({position:[1578.446044921875,1770.681640625,9.835800170898438],heading:99.75669860839844,townId:2});
 expect(police[0]).toEqual({position:[1550.6800537109375,-1675.489990234375,14.510000228881836],heading:90,townId:0});
 // Two Los Santos hospitals and one Los Santos police station are available before any city is unlocked.
 expect(hospitals.filter(p=>p.townId===0)).toHaveLength(2);
 expect(police.filter(p=>p.townId===0)).toHaveLength(1);
 expect(hospitals.map(p=>p.townId)).toEqual([0,0,1,1,1,2,2,2]);
});

test('a fresh game restarts in Los Santos and unlocking cities opens the nearer points',()=>{
 const restart=new NativeRestart(readInitialRestartPoints(main()));
 const lasVenturas:[number,number,number]=[2337,2453,14];
 // STAT_CITY_UNLOCKED is zero on a new game, so only the town-zero points qualify.
 const locked=restart.findClosestHospitalRestartPoint(lasVenturas,0,countryside,fallback);
 expect(locked.position).toEqual([2027.77001953125,-1420.52001953125,15.989999771118164]);
 const unlocked=restart.findClosestHospitalRestartPoint(lasVenturas,2,countryside,fallback);
 expect(unlocked.position).toEqual([1578.446044921875,1770.681640625,9.835800170898438]);
 const station=restart.findClosestPoliceRestartPoint(lasVenturas,2,countryside,fallback);
 expect(station).toEqual({position:[2337.083251953125,2453.8017578125,13.976499557495117],heading:90.76429748535156});
});

test('points outside the query level are pushed back sixfold unless the query is countryside',()=>{
 const near={position:[100,0,0] as [number,number,number],heading:10,townId:0};
 const far={position:[-500,0,0] as [number,number,number],heading:20,townId:0};
 const restart=new NativeRestart({hospitals:[near,far],police:[near,far]});
 const levelAt=(p:readonly number[])=>p[0]>=0?1:2;
 // From level 1 the near point is 100 away, the far point 500*6.
 expect(restart.findClosestHospitalRestartPoint([0,0,0],0,levelAt,fallback).heading).toBe(10);
 // From level 2 the near point costs 600 and the far point 500.
 expect(restart.findClosestHospitalRestartPoint([-1000,0,0],0,p=>levelAt(p),fallback).heading).toBe(20);
 // A countryside query compares raw distances, so the near point wins again.
 expect(restart.findClosestHospitalRestartPoint([-1000,0,0],0,p=>p[0]===-1000?LEVEL_COUNTRYSIDE:levelAt(p),fallback).heading).toBe(20);
 expect(restart.findClosestHospitalRestartPoint([-200,0,0],0,p=>p[0]===-200?LEVEL_COUNTRYSIDE:levelAt(p),fallback).heading).toBe(10);
});

test('overrides, mission base points and extra points take precedence once each',()=>{
 const only={position:[0,0,0] as [number,number,number],heading:0,townId:0};
 const restart=new NativeRestart({hospitals:[only],police:[only]});
 restart.overrideNextRestart([5,6,7],90);
 expect(restart.findClosestHospitalRestartPoint([900,0,0],0,countryside,fallback)).toEqual({position:[5,6,7],heading:90});
 expect(restart.findClosestHospitalRestartPoint([900,0,0],0,countryside,fallback).position).toEqual([0,0,0]);
 restart.overrideNextRestart([1,1,1],0);restart.cancelOverrideRestart();
 expect(restart.findClosestHospitalRestartPoint([900,0,0],0,countryside,fallback).position).toEqual([0,0,0]);
 // The extra point applies inside its radius; Initialise leaves that radius at zero.
 expect(restart.extraHospital.radius).toBe(0);
 restart.extraHospital={position:[50,0,0],heading:45,radius:100};
 expect(restart.findClosestHospitalRestartPoint([60,0,0],0,countryside,fallback)).toEqual({position:[50,0,0],heading:45});
 expect(restart.findClosestHospitalRestartPoint([900,0,0],0,countryside,fallback).position).toEqual([0,0,0]);
 // A mission respawn base replaces the query point for one lookup only.
 restart.setRespawnPointForDurationOfMission([55,0,0]);
 expect(restart.findClosestHospitalRestartPoint([900,0,0],0,countryside,fallback).heading).toBe(45);
 expect(restart.findClosestHospitalRestartPoint([900,0,0],0,countryside,fallback).heading).toBe(0);
});

test('a table with nothing unlocked leaves the caller value untouched',()=>{
 const restart=new NativeRestart({hospitals:[{position:[1,2,3],heading:7,townId:2}],police:[{position:[1,2,3],heading:7,townId:2}]});
 expect(restart.findClosestHospitalRestartPoint([0,0,0],0,countryside,fallback)).toEqual(fallback);
 expect(()=>new NativeRestart({hospitals:[],police:[]})).toThrow('empty');
});
