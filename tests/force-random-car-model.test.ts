import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {WorldFleet} from '../src/simulation/WorldFleet';
import {Simulation} from '../src/simulation/Simulation';
const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const force=(model:number)=>[0xbf,9,...int(model)];
beforeAll(async()=>{await RAPIER.init();});

test('the raw signed model persists across ordinary thread endings and -1 resets without a used-object table',()=>{
 const bytes=new Uint8Array(256);bytes.set([...force(435),0x4e,0],128);bytes.set([...force(-1),0x4e,0],160);
 const r=new ScmRuntime(bytes);expect(r.game.forceRandomCarModel).toBe(-1);
 r.start(128);r.process(0,0);expect(r.game.forceRandomCarModel).toBe(435);
 r.start(160);r.process(1,0);expect(r.game.forceRandomCarModel).toBe(-1);
});

test('mission cleanup clears the override even when a mission terminates without resetting it',()=>{
 const bytes=new Uint8Array(256);bytes.set([...force(435),1,0,...int(100),0x4e,0],128);
 const r=new ScmRuntime(bytes);r.start(128,[],{mission:true});r.process(0,0);expect(r.game.forceRandomCarModel).toBe(435);
 r.process(101,0);expect(r.game.forceRandomCarModel).toBe(-1);
});

test('the civilian override bypasses suppression and restores ordinary selection after cleanup',()=>{
 const sim=new Simulation(),fleet=new WorldFleet(sim,new Scene(),{} as never,undefined,'forced-model-test:');
 const bytes=new Uint8Array(256);bytes.set([...force(435),1,0,...int(100),0x4e,0],128);const r=new ScmRuntime(bytes);
 fleet.forceRandomCarModel=()=>r.game.forceRandomCarModel;fleet.suppressedModels=()=>new Set([435]);
 try{
  expect(fleet.trafficPick()).toEqual({modelId:492});r.start(128,[],{mission:true});r.process(0,0);
  expect(fleet.trafficPick()).toEqual({modelId:435});expect(fleet.trafficPick()).toEqual({modelId:435});
  expect(fleet.civilianModelInMemory()).toBe(404);
  r.process(101,0);expect(fleet.trafficPick()).toEqual({modelId:551});
 }finally{fleet.dispose();sim.dispose();}
});
