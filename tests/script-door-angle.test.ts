import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('the SCM door-angle query forwards index six and returns the raw signed angle',async()=>{
 const car={},angle=vi.fn(()=>-.125),host={spawnScriptVehicle:async()=>car,scriptVehiclePosition:()=>({x:0,y:0,z:0}),scriptVehicleHeading:()=>0,scriptVehicleDoorAngle:angle};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),h=m.vehicles.create(544,{x:0,y:0,z:0});await m.vehicles.whenSettled(h);
 expect(m.runtime.world!.getDoorAngleRatio!(h,6)).toBe(-.125);expect(angle).toHaveBeenCalledExactlyOnceWith(car,6);
});
