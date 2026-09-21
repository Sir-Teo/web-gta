import {expect,test} from 'vitest';
import {NativeFireManager} from '../src/combat/nativeFire';

const at=(x:number)=>({x,y:0,z:0});

test('the browser keeps one fire for each of the script’s and lets it go with the record',()=>{
 const fires=new NativeFireManager();
 fires.syncScriptFires([{key:3,position:at(10),strength:1,generations:5}]);
 const burning=fires.active;
 expect(burning.length).toBe(1);
 expect(burning[0].script).toBe(true);
 expect(burning[0].position).toEqual(at(10));
 expect(burning[0].generations).toBe(5);
 // A script fire burns until its record says otherwise, not on a timer of the browser's own.
 expect(burning[0].timeToBurn).toBe(Number.POSITIVE_INFINITY);

 // The same record again moves the fire rather than making a second.
 fires.syncScriptFires([{key:3,position:at(20),strength:2,generations:5}]);
 expect(fires.active.length).toBe(1);
 expect(fires.active[0].position).toEqual(at(20));
 // A change of strength asks the effect to be rebuilt, as CreateFxSysForStrength would.
 expect(fires.active[0].fxSerial).toBeGreaterThan(burning[0].fxSerial-1);

 // A second record takes a second slot; dropping the first puts only that one out.
 fires.syncScriptFires([{key:3,position:at(20),strength:2,generations:5},{key:8,position:at(30),strength:1,generations:1}]);
 expect(fires.active.length).toBe(2);
 fires.syncScriptFires([{key:8,position:at(30),strength:1,generations:1}]);
 expect(fires.active.length).toBe(1);
 expect(fires.active[0].position).toEqual(at(30));
 // And with no records at all nothing of the script's is still burning.
 fires.syncScriptFires([]);
 expect(fires.active.length).toBe(0);
});

test('a script fire the world put out is made again rather than left as a hole',()=>{
 const fires=new NativeFireManager();
 fires.syncScriptFires([{key:1,position:at(5),strength:1,generations:2}]);
 // A water jet puts it out; the record still says it should burn.
 fires.extinguishPoint(at(5),2);
 expect(fires.active.length).toBe(0);
 fires.syncScriptFires([{key:1,position:at(5),strength:1,generations:2}]);
 expect(fires.active.length).toBe(1);
 expect(fires.active[0].script).toBe(true);
});
