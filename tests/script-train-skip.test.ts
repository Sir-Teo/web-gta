import {expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmMission} from '../src/simulation/ScmMission';
import {UnsupportedScmCommand,ScmEntityPending} from '../src/engine/ScmThread';
import {TRAIN_STATIONS} from '../src/simulation/nativeTrainTracks';
const script=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
async function setup(){
 const car={},skip=vi.fn((_car:unknown,_allowed:(station:number)=>boolean):{station:number;railDistance:number;speed:number;minutes:number}|undefined=>({station:0,railDistance:80,speed:.1,minutes:30})),passTime=vi.fn(),loadScene=vi.fn();
 const host={spawnScriptVehicle:async()=>car,scriptVehiclePosition:()=>({x:0,y:0,z:0}),scriptVehicleHeading:()=>0,scriptVehicleAlive:()=>true,
  skipScriptTrainToAllowedStation:skip,passTime,loadScene,cityAt:(x:number)=>x===TRAIN_STATIONS[2][0]?2:1};
 const m=new ScmMission(script,{infoLabels:['TEST'],population:[]} as any,host as any),handle=m.vehicles.create(537,{x:0,y:0,z:0});await m.vehicles.whenSettled(handle);
 return {m,handle,skip,passTime,loadScene,host};
}

test('train skip uses the city-unlock gate, then loads the destination and advances game time',async()=>{
 const f=await setup();f.m.runtime.game.stats.set(181,0);
 f.m.runtime.world!.skipTrainToNextStation!(f.handle);
 const allowed=f.skip.mock.calls[0][1];expect(allowed(0)).toBe(true);expect(allowed(2)).toBe(false);
  expect(f.loadScene).toHaveBeenCalledExactlyOnceWith(...TRAIN_STATIONS[0]);expect(f.passTime).toHaveBeenCalledExactlyOnceWith(30);
 expect(f.loadScene.mock.invocationCallOrder[0]).toBeLessThan(f.passTime.mock.invocationCallOrder[0]);
 f.m.runtime.game.stats.set(181,1);f.m.runtime.world!.skipTrainToNextStation!(f.handle);expect(f.skip.mock.calls[1][1](2)).toBe(true);
});

test('pending tracks do not advance the clock, and missing effects are resolved before train mutation',async()=>{
 const f=await setup();f.skip.mockReturnValue(undefined);
 expect(()=>f.m.runtime.world!.skipTrainToNextStation!(f.handle)).toThrow(ScmEntityPending);
 expect(f.loadScene).not.toHaveBeenCalled();expect(f.passTime).not.toHaveBeenCalled();
 f.skip.mockClear();(f.host as any).passTime=undefined;
 expect(()=>f.m.runtime.world!.skipTrainToNextStation!(f.handle)).toThrow(UnsupportedScmCommand);expect(f.skip).not.toHaveBeenCalled();
});
