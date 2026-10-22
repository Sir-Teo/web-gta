import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import fixture from './fixtures/native-vehicle-dead-query.json';
import {ScmMission} from '../src/simulation/ScmMission';
import {WorldPlane} from '../src/simulation/WorldPlane';
import {scmOpcode} from '../src/engine/scmOpcodes';

let spawned:any;
const m=new ScmMission(new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),{infoLabels:['TEST'],population:[]}as any,{spawnScriptVehicle:async()=>spawned,scriptVehicleAlive:(v:any)=>!v.disposed,removeScriptVehicle:()=>{},scriptVehicleIsDead:(v:any)=>v.wrecked===true||v.drowning===true}as any);
for(const [index,row]of fixture.cases.entries())test(`captured IS_CAR_DEAD ${index}: ${JSON.stringify(row.input)}`,async()=>{
 const c=row.input;spawned=Object.assign(Object.create(WorldPlane.prototype),{canBeDamaged:true,occupied:false,health:1000,bombTimerMs:0,throttle:1,drowning:c.drowning});
 if((c.status&0xf8)===0x28)(WorldPlane.prototype as any).destroyed.call(spawned);
 // Native script writes can change health/timer independently of an existing vehicle's destruction status.
 spawned.health=c.health;spawned.bombTimerMs=c.timer;
 const valid=c.handle===7,h=valid?m.vehicles.create(487,{x:0,y:0,z:10}):-999;if(valid)await m.vehicles.whenSettled(h);
 for(const negated of[false,true]){
  const code=new Uint8Array(9),view=new DataView(code.buffer);view.setUint16(0,scmOpcode('IS_CAR_DEAD')|(negated?0x8000:0),true);code[2]=1;view.setInt32(3,h,true);code[7]=78;
  const slot=m.runtime.start(0,[],{space:code});slot.thread.name='DEADTEST';let condition;try{slot.thread.run(0,20,1);condition=slot.thread.condition;}finally{m.runtime.terminateAllWithName('DEADTEST');}expect(condition).toBe(negated?!row.dead:row.dead);
 }
 if(valid)m.vehicles.delete(h);expect(m.snapshot().skipped).toEqual([]);expect(m.snapshot().gaveUp).toEqual([]);
});
