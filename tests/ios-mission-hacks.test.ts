import {expect,test} from 'vitest';
import {IosMissionCarDensity,iosCutsceneSkipBlocked,iosPrintReleasesPlayerControls,iosWaterExtinguishMultiplier} from '../src/engine/iosMissionHacks';
import {NativeFireManager} from '../src/combat/nativeFire';
import {WorldFleet} from '../src/simulation/WorldFleet';
import {ScmPads} from '../src/engine/ScmPads';

test('CCutsceneMgr::IsCutsceneSkipButtonBeingPressed refuses while five missions head the script list',()=>{
 for(const name of ['CAT3','cat4','ZERO1','LA1FIN1','bcrash1'])expect(iosCutsceneSkipBlocked(name)).toBe(true);
 for(const name of ['CAT1','cat','zero2','la1fin2','BCRASH',undefined])expect(iosCutsceneSkipBlocked(name)).toBe(false);
});

test('water puts fires out 24 times as fast while firetru is the head or the script after it',()=>{
 expect(iosWaterExtinguishMultiplier('FIRETRU',undefined)).toBe(24);
 expect(iosWaterExtinguishMultiplier('gf_date','FIRETRU')).toBe(24);
 expect(iosWaterExtinguishMultiplier('MAIN','gf_date')).toBe(1);
 const fires=new NativeFireManager(),clock={nowMs:0,random:()=>0};
 const fire=fires.startFire({x:0,y:0,z:0},10000,0,clock)!;fire.strength=3;
 fires.extinguishPointWithWater({x:0,y:0,z:0},2,2,.02);expect(fire.strength).toBeCloseTo(3-.04,9);
 fires.waterMultiplier=()=>24;fires.extinguishPointWithWater({x:0,y:0,z:0},2,2,.02);expect(fire.strength).toBeCloseTo(3-.04-.96,9);
});

test("CGame::Process forces cprace's and heist4's car density until the player is off the mission",()=>{
 const latch=new IosMissionCarDensity();
 expect(latch.update(true,'MAIN')).toBeUndefined();
 expect(latch.update(true,'CPRACE')).toBe(.75);
 // Latched: a sub-script at the head does not lift it.
 expect(latch.update(true,'helper')).toBe(.75);
 expect(latch.update(true,'HEIST4')).toBe(1);
 expect(latch.update(false,'HEIST4')).toBeUndefined();
 expect(latch.update(true,'MAIN')).toBeUndefined();
});

test('the car density multiplier scales the traffic driver cap, and 0 makes no new traffic',()=>{
 const row={maxCars:10};
 const fleet=(density:number)=>({popRow:()=>row,trafficScale:1,carDensity:()=>density});
 const drivers=(density:number)=>(WorldFleet.prototype as any).trafficDrivers.call(fleet(density));
 const full=drivers(1);expect(full).toBeGreaterThan(2);
 expect(drivers(.5)).toBe(Math.max(2,Math.round(full*.5)));
 expect(drivers(0)).toBe(0);
});

test("PRINT of WUZ1_DA or GAR2_10 releases the player's controls on the next pad update",()=>{
 expect(iosPrintReleasesPlayerControls('GAR2_10')).toBe(true);expect(iosPrintReleasesPlayerControls('WUZ1_DA')).toBe(true);
 expect(iosPrintReleasesPlayerControls('gar2_10')).toBe(false);expect(iosPrintReleasesPlayerControls('GAR2_11')).toBe(false);
 const pads=new ScmPads();expect(pads.releaseControls).toEqual([false,false]);
});

import {ScmRuntime} from '../src/engine/ScmRuntime';
import {scmOpcode} from '../src/engine/scmOpcodes';
test('the PRINT handler raises the pad flag for GAR2_10, not for another key or PRINT_NOW',()=>{
 const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
 const key=(s:string)=>[9,...Array.from({length:8},(_,i)=>s.charCodeAt(i)||0)];
 const op=(name:string,...args:number[][])=>{const n=scmOpcode(name);return [n&255,n>>8,...args.flat()];};
 const run=(code:number[][])=>{const space=new Uint8Array(512);space.set([...code.flat(),0x4e,0],128);const runtime=new ScmRuntime(space);runtime.start(128);runtime.process(0,20);return runtime.game.pads.releaseControls[0];};
 expect(run([op('PRINT',key('GAR2_10'),int(7000),int(1))])).toBe(true);
 expect(run([op('PRINT',key('GAR2_11'),int(7000),int(1))])).toBe(false);
 expect(run([op('PRINT_NOW',key('GAR2_10'),int(7000),int(1))])).toBe(false);
});
