import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('moving-part commands resolve a live vehicle and delegate the native fraction and reported offset',async()=>{
 const car={},control=vi.fn(),offset=vi.fn(()=>1.5),host={spawnScriptVehicle:async()=>car,scriptVehiclePosition:()=>({x:0,y:0,z:0}),scriptVehicleHeading:()=>0,
  controlScriptVehicleMovingPart:control,scriptVehicleMovingComponentOffset:offset};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),h=m.vehicles.create(530,{x:0,y:0,z:0});await m.vehicles.whenSettled(h);
 m.runtime.world!.controlMovableVehiclePart!(h,.5);expect(control).toHaveBeenCalledExactlyOnceWith(car,.5);
 expect(m.runtime.world!.getCarMovingComponentOffset!(h)).toBe(1.5);expect(offset).toHaveBeenCalledExactlyOnceWith(car);
});
