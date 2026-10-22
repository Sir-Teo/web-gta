import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {PLAYER_VEHICLE_HANDLE,ScmMission} from '../src/simulation/ScmMission';
import {ScmEntityPending} from '../src/engine/ScmThread';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));

test('vehicle quaternion dispatch waits for the body, forwards raw components and accepts the player vehicle',async()=>{
 const car={},set=vi.fn(),host={spawnScriptVehicle:async()=>car,playerVehicleEntity:()=>car,scriptVehiclePosition:()=>({x:0,y:0,z:0}),scriptVehicleHeading:()=>0,setScriptVehicleQuaternion:set};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),h=m.vehicles.create(413,{x:0,y:0,z:0}),w=m.runtime.world!;
 expect(()=>w.setVehicleQuaternion!(h,0,0,1,1)).toThrow(ScmEntityPending);expect(set).not.toHaveBeenCalled();await m.vehicles.whenSettled(h);
 w.setVehicleQuaternion!(h,0,0,1,1);expect(set).toHaveBeenLastCalledWith(car,{x:0,y:0,z:1,w:1});
 w.setVehicleQuaternion!(PLAYER_VEHICLE_HANDLE,1,0,0,1);expect(set).toHaveBeenLastCalledWith(car,{x:1,y:0,z:0,w:1});
});
