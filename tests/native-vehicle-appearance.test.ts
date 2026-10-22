import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import fixture from './fixtures/native-vehicle-appearance.json';
import {nativeVehicleAppearance} from '../src/vehicle/nativeVehicleAppearance';
import {ScmMission} from '../src/simulation/ScmMission';
import {scmOpcode} from '../src/engine/scmOpcodes';

for(const row of fixture.cases)test(`captured vehicle appearance: ${row.flags.toString(16)}`,()=>{expect(nativeVehicleAppearance(row.flags)).toBe(row.appearance);});
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
test.each([
 ['automobile',0,1],['bike',0x01000000,2],['helicopter',0x02000000,3],['boat',0x08000000,4],['plane',0x04000000,5],['mixed flags',0x03000000,0],
]as const)('script %s uses handling appearance in occupant conditions',async(_name,flags,appearance)=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]}as any,{spawnScriptVehicle:async()=>({modelFlags:flags}),scriptVehicleModelFlags:(car:{modelFlags:number})=>car.modelFlags}as any),handle=m.vehicles.create(487,{x:0,y:0,z:10});await m.vehicles.whenSettled(handle);
 const world=m.runtime.world!;expect(world.vehicleAppearance!(handle)).toBe(appearance);world.pedVehicle=()=>handle;
 for(const [name,wanted]of [['IS_CHAR_ON_ANY_BIKE',2],['IS_CHAR_IN_ANY_HELI',3],['IS_CHAR_IN_ANY_BOAT',4],['IS_CHAR_IN_ANY_PLANE',5]]as const)for(const negated of[false,true]){
  const bytes=new Uint8Array(9),view=new DataView(bytes.buffer);view.setUint16(0,scmOpcode(name)|(negated?0x8000:0),true);bytes[2]=1;view.setInt32(3,42,true);bytes[7]=78;
  const slot=m.runtime.start(0,[],{space:bytes});slot.thread.run(0,20);expect(slot.thread.condition).toBe(negated?appearance!==wanted:appearance===wanted);
 }
 expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
test('legacy hosts default to zero category flags while invalid vehicle handles still fail',async()=>{
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]}as any,{spawnScriptVehicle:async()=>({})}as any),h=m.vehicles.create(400,{x:0,y:0,z:0});await m.vehicles.whenSettled(h);expect(m.runtime.world!.vehicleAppearance!(h)).toBe(1);expect(()=>m.runtime.world!.vehicleAppearance!(999999)).toThrow();
});
