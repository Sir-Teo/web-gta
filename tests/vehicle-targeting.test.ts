import {beforeAll,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {pedCanBeTargettedVehicleWise} from '../src/ped/nativeVehicleTargeting';
import {ScmMission} from '../src/simulation/ScmMission';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponSystem,type SeatedTarget,type SeatedVehicle} from '../src/weapons/WeaponSystem';
beforeAll(async()=>RAPIER.init());

test('native vehicle-wise targeting accepts on-foot peds, flagged occupants and all bike occupants',()=>{
 expect(pedCanBeTargettedVehicleWise(false)).toBe(true);expect(pedCanBeTargettedVehicleWise(true)).toBe(false);
 expect(pedCanBeTargettedVehicleWise(true,{})).toBe(false);expect(pedCanBeTargettedVehicleWise(true,{pedTargetable:true})).toBe(true);
 expect(pedCanBeTargettedVehicleWise(true,{bike:true,pedTargetable:false})).toBe(true);
});

test('SYN6’s original instruction enables its vehicle, independently of the heat-seeker flag',async()=>{
 const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),car={hsTargetable:false,pedTargetable:false},m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,{spawnScriptVehicle:async()=>car} as any),h=m.vehicles.create(487,{x:0,y:0,z:10});await m.vehicles.whenSettled(h);
 const block=readScmHeader(script).missions[62],sites=decodeScmInstructions(script,block.start,block.end).filter(i=>i.opcode===0x84e);expect(sites).toHaveLength(1);expect(sites[0].offset).toBe(1637887);
 const i=sites[0],code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));code.set([0x4e,0],i.end-i.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(149*4,h,true);slot.thread.run(1000,100,1);
 expect(car).toEqual({hsTargetable:false,pedTargetable:true});m.runtime.world!.setVehicleCanBeTargetted!(h,false);expect(car.pedTargetable).toBe(false);expect(m.snapshot().skipped).toEqual([]);
});

test('the touch target list keeps stable seat identities, native vehicle gates and pedestrian exclusions',()=>{
 const sim=new Simulation(),walking={handle:5,position:{x:0,y:1,z:-5}},weapons=new WeaponSystem(sim,()=>({targets:()=>[walking]}) as any,()=>undefined);
 const car:SeatedVehicle={car:{body:{handle:99,translation:()=>({x:10,y:2,z:-20}),rotation:()=>({x:0,y:0,z:0,w:1})}}},driver:SeatedTarget<SeatedVehicle>={car,kind:'script',seat:0,local:{x:1,y:0,z:1}},passenger={...driver,seat:1,head:{x:12,y:4,z:-19}};
 try{
  weapons.seatedPeds=()=>[driver,passenger];expect(weapons.automaticAimTargets()).toEqual([walking]);car.pedTargetable=true;
  const first=weapons.automaticAimTargets();expect(first).toHaveLength(3);expect(first[1].position).toEqual({x:11,y:3.64,z:-19.77});expect(first[2].position).toEqual(passenger.head);expect(first[1].handle).toBeLessThan(0);expect(first[1].handle).not.toBe(first[2].handle);
  weapons.seatedPeds=()=>[passenger,driver];expect(weapons.automaticAimTargets().slice(1).map(t=>t.handle)).toEqual([first[2].handle,first[1].handle]);
  driver.neverTargeted=true;expect(weapons.automaticAimTargets()).toHaveLength(2);driver.neverTargeted=false;car.driverDead=true;expect(weapons.automaticAimTargets()).toHaveLength(2);car.driverDead=false;
  car.pedTargetable=false;driver.bike=true;expect(weapons.automaticAimTargets()).toHaveLength(2);driver.canBeShot=false;expect(weapons.automaticAimTargets()).toHaveLength(2);
  for(const flag of ['occupied','wrecked','disposed'] as const){car[flag]=true;expect(weapons.automaticAimTargets()).toEqual([walking]);car[flag]=false;}
 }finally{weapons.dispose();sim.dispose();}
});

test('disabling automatic targeting leaves bullet head intersection active; shot-proof occupants still reject bullets',()=>{
 const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined),car:SeatedVehicle={pedTargetable:false,car:{body:{handle:99,translation:()=>({x:0,y:0,z:-10}),rotation:()=>({x:0,y:0,z:0,w:1})}}},target:SeatedTarget<SeatedVehicle>={car,kind:'script',seat:0,local:{x:0,y:0,z:0},head:{x:0,y:1,z:-10}};
 try{weapons.seatedPeds=()=>[target];expect(weapons.automaticAimTargets()).toEqual([]);expect(weapons.seatedHit({x:0,y:1.1,z:0},{x:0,y:0,z:-1},20,car.car.body)?.target).toBe(target);target.canBeShot=false;expect(weapons.seatedHit({x:0,y:1.1,z:0},{x:0,y:0,z:-1},20,car.car.body)).toBeUndefined();}finally{weapons.dispose();sim.dispose();}
});

test('a van occupant without a drawn head uses its quarter-turned seat for fallback aim and bullet checks',()=>{
 const sim=new Simulation(),weapons=new WeaponSystem(sim,()=>undefined,()=>undefined),car:SeatedVehicle={pedTargetable:true,car:{body:{handle:99,translation:()=>({x:0,y:0,z:-10}),rotation:()=>({x:0,y:0,z:0,w:1})}}};
 const target:SeatedTarget<SeatedVehicle>={car,kind:'script',seat:2,local:{x:0,y:0,z:0},headingOffset:Math.PI/2};
 try{
  weapons.seatedPeds=()=>[target];const position=weapons.automaticAimTargets()[0].position;
  expect(position.x).toBeCloseTo(.23,8);expect(position.y).toBeCloseTo(.64,8);expect(position.z).toBeCloseTo(-10,8);
  expect(weapons.seatedHit({x:.23,y:.74,z:0},{x:0,y:0,z:-1},20,car.car.body)?.target).toBe(target);
  expect(weapons.seatedHit({x:0,y:.74,z:0},{x:0,y:0,z:-1},20,car.car.body)).toBeUndefined();
 }finally{weapons.dispose();sim.dispose();}
});
