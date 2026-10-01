import {describe,expect,test} from 'vitest';
import {NativeAccidentManager,NUM_ACCIDENTS,type AccidentPed} from '../src/ped/nativeAccidents';
import {ambulanceDue,medicCanTreat} from '../src/simulation/WorldEmergency';

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
