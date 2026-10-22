import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('the Hunter command forwards the live vehicle, current script matrix, game clock and native timestep',async()=>{
 const car={},matrix={right:{x:1,y:0,z:0},forward:{x:0,y:1,z:0},up:{x:0,y:0,z:1},position:{x:1,y:2,z:3}},fire=vi.fn();
 const host={spawnScriptVehicle:async()=>car,scriptVehiclePosition:()=>matrix.position,scriptVehicleHeading:()=>0,scriptVehicleMatrix:()=>matrix,fireScriptHunterGun:fire};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),h=m.vehicles.create(425,matrix.position);await m.vehicles.whenSettled(h);
 (m as any).clockMs=151;(m as any).frameMs=30;m.runtime.world!.fireHunterGun!(h);
 expect(fire).toHaveBeenCalledExactlyOnceWith(car,matrix,151,Math.fround(1.5));
});
