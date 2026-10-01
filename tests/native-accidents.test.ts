import {describe,expect,test} from 'vitest';
import {NativeAccidentManager,NUM_ACCIDENTS,type AccidentPed} from '../src/ped/nativeAccidents';
import {ambulanceDue,findNearestFire,fireTruckAim,fireTruckDue,medicCanTreat} from '../src/simulation/WorldEmergency';

const ped=(x:number,y:number,o:Partial<{mission:boolean;allowMedics:boolean;submerged:boolean;headless:boolean}>={}):AccidentPed=>({
 mission:!!o.mission,allowMedics:o.allowMedics??true,headless:!!o.headless,submerged:()=>!!o.submerged,position:()=>({x,y,z:0})});

describe('CAccidentManager',()=>{
 test('ReportAccident skips mission peds and those medics may not revive, and never doubles a ped',()=>{
  const m=new NativeAccidentManager<AccidentPed>(),a=ped(0,0);
  m.report(ped(1,1,{mission:true}));m.report(ped(2,2,{allowMedics:false}));
  m.report(a);m.report(a);
  expect(m.accidents.filter(x=>x.ped).length).toBe(1);
  expect(m.numberOfFree()).toBe(1);
 });
 test('sixteen slots, the seventeenth report goes unrecorded',()=>{
  const m=new NativeAccidentManager<AccidentPed>();
  for(let i=0;i<NUM_ACCIDENTS+1;i++)m.report(ped(i,0));
  expect(m.numberOfFree()).toBe(NUM_ACCIDENTS);
 });
 test('IsFree: not treated, not revived, not under water',()=>{
  const m=new NativeAccidentManager<AccidentPed>();
  const a=ped(0,0),b=ped(5,0),c=ped(9,0,{submerged:true});m.report(a);m.report(b);m.report(c);
  expect(m.numberOfFree()).toBe(2);
  m.of(a)!.treated=true;expect(m.numberOfFree()).toBe(1);
  m.of(b)!.revived=true;expect(m.numberOfFree()).toBe(0);
 });
 test('the nearest free accident, by 3D distance, passing over the one excepted and the headless when asked',()=>{
  const m=new NativeAccidentManager<AccidentPed>();
  const near=ped(2,0,{headless:true}),mid=ped(5,0),far=ped(9,0);m.report(far);m.report(near);m.report(mid);
  expect(m.nearestFree({x:0,y:0,z:0},false)?.ped).toBe(near);
  expect(m.nearestFree({x:0,y:0,z:0},true)?.ped).toBe(mid);
  expect(m.nearestFreeExcept({x:0,y:0,z:0},m.of(mid),true)?.ped).toBe(far);
 });
 test('a ped gone from the world leaves its slot empty, and a revived one keeps his',()=>{
  const m=new NativeAccidentManager<AccidentPed>(),a=ped(0,0);m.report(a);
  m.of(a)!.revived=true;m.report(a);expect(m.accidents.filter(x=>x.ped===a).length).toBe(1);
  m.forget(a);expect(m.of(a)).toBeUndefined();
 });
});

describe('the ambulance dispatch (AUTHORED from III/VC)',()=>{
 const base={wanted:0,onDuty:0,freeAccidents:2,nearestDistance:10,ambulances:0,nowMs:40000,lastCreatedMs:0};
 test('two free accidents, one within 30 units, none on duty: an ambulance',()=>{expect(ambulanceDue(base)).toBe(true);});
 test('one accident, a far one, one on duty, two about, four stars or within 30 s of the last: none',()=>{
  expect(ambulanceDue({...base,freeAccidents:1})).toBe(false);
  expect(ambulanceDue({...base,nearestDistance:31})).toBe(false);
  expect(ambulanceDue({...base,nearestDistance:undefined})).toBe(false);
  expect(ambulanceDue({...base,onDuty:1})).toBe(false);
  expect(ambulanceDue({...base,ambulances:2})).toBe(false);
  expect(ambulanceDue({...base,wanted:4})).toBe(false);
  expect(ambulanceDue({...base,nowMs:29000})).toBe(false);
 });
 test('CTaskComplexMedicTreatInjuredPed treats within 1 unit across and 2 up',()=>{
  expect(medicCanTreat({x:0,y:0,z:0},{x:.9,y:0,z:1.9})).toBe(true);
  expect(medicCanTreat({x:0,y:0,z:0},{x:1.1,y:0,z:0})).toBe(false);
  expect(medicCanTreat({x:0,y:0,z:0},{x:0,y:0,z:2.1})).toBe(false);
 });
});

describe('the fire engine (CTaskComplexDriveFireTruck, FireTruckControl)',()=>{
 test('FindNearestFire: active, not the script\'s, not being put out, not on a ped, nearest in 2D',()=>{
  const fire=(x:number,o:Partial<{active:boolean;script:boolean;beingExtinguished:boolean;target:{kind:string}}>={})=>({active:o.active??true,script:!!o.script,beingExtinguished:!!o.beingExtinguished,position:{x,y:0,z:x*10},target:o.target});
  const fires=[fire(1,{script:true}),fire(2,{beingExtinguished:true}),fire(3,{target:{kind:'ped'}}),fire(4,{active:false}),fire(9),fire(7)];
  expect(findNearestFire(fires,{x:0,y:0})?.position.x).toBe(7);
  expect(findNearestFire([],{x:0,y:0})).toBeUndefined();
 });
 test('the dispatch wants three fires, the nearest within 30 units, and 35 s since the last engine',()=>{
  const base={wanted:0,onDuty:0,activeFires:3,nearestDistance:10,fireTrucks:0,nowMs:40000,lastCreatedMs:0};
  expect(fireTruckDue(base)).toBe(true);
  expect(fireTruckDue({...base,activeFires:2})).toBe(false);
  expect(fireTruckDue({...base,nearestDistance:31})).toBe(false);
  expect(fireTruckDue({...base,onDuty:1})).toBe(false);
  expect(fireTruckDue({...base,nowMs:34000})).toBe(false);
 });
 test('the nozzle turns a hundredth of a step at a time toward the fire\'s bearing off the heading, and sways ±0.15',()=>{
  // Fire straight to the truck's left (−x) with the truck facing +y: bearing atan2(1, 0) = π/2.
  let aim={yaw:0,pitch:0};
  for(let i=0;i<10;i++)aim=fireTruckAim(aim,{fire:{x:-10,y:0},car:{x:0,y:0},heading:0,timeStep:1,timeMs:1024});
  expect(aim.yaw).toBeCloseTo(.1,6);
  expect(aim.pitch).toBeCloseTo(.15,6);
  for(let i=0;i<1000;i++)aim=fireTruckAim(aim,{fire:{x:-10,y:0},car:{x:0,y:0},heading:0,timeStep:1,timeMs:0});
  expect(Math.abs(aim.yaw-Math.PI/2)).toBeLessThan(.01);
  expect(aim.pitch).toBe(0);
 });
});
