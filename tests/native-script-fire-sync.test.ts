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

test('a script fire the world put out stays out and is reported, so the script sees it extinguished',()=>{
 const fires=new NativeFireManager();
 fires.syncScriptFires([{key:1,position:at(5),strength:1,generations:2}]);
 // A water jet puts it out (CFire::ExtinguishWithWater on the one pool the script's fires share).
 fires.extinguishPoint(at(5),2);
 expect(fires.active.length).toBe(0);
 // The record still burning this frame: the key comes back for IS_SCRIPT_FIRE_EXTINGUISHED, and nothing relights.
 expect(fires.syncScriptFires([{key:1,position:at(5),strength:1,generations:2}])).toEqual([1]);
 expect(fires.active.length).toBe(0);
});

test('water weakens a script fire: the record’s strength is applied only when the script changes it',()=>{
 const fires=new NativeFireManager();
 fires.syncScriptFires([{key:2,position:at(5),strength:3,generations:2}]);
 fires.active[0].strength=1.5;
 fires.syncScriptFires([{key:2,position:at(5),strength:3,generations:2}]);
 expect(fires.active[0].strength).toBe(1.5);
 fires.syncScriptFires([{key:2,position:at(5),strength:2,generations:2}]);
 expect(fires.active[0].strength).toBe(2);
});

test('script fires reach the fire pool in native axes, as every other fire does',async()=>{
 const {ScmMission}=await import('../src/simulation/ScmMission');
 const self={runtime:{game:{fires:{fires:[{active:true,createdByScript:true,position:{x:2490,y:-1680,z:13},strength:1,generationsAllowed:0}]}}}};
 expect((ScmMission.prototype as any).scriptFires.call(self)).toEqual([{key:0,position:{x:2490,y:-1680,z:13},strength:1,generations:0}]);
});

// START_CHAR_FIRE on the player: the fire is his (m_pFire), takes the place of one he had, and follows him.
test('a script fire on the player becomes his fire and follows him',async()=>{
 const fires=new NativeFireManager();
 fires.startFireOn({kind:'player',key:'player'},at(0),7000,100,{nowMs:0,random:()=>.5});
 const own=fires.fireOn('player')!;
 fires.syncScriptFires([{key:3,position:at(5),strength:1,generations:0,player:true}]);
 expect(own.active&&!own.script).toBe(false);
 expect(fires.fireOn('player')!.script).toBe(true);
 const {ScmMission}=await import('../src/simulation/ScmMission');
 const fire={active:true,createdByScript:true,position:{x:0,y:0,z:0},strength:1,generationsAllowed:0,ped:1};
 const self={runtime:{game:{fires:{fires:[fire]}}},world:{playerPed:()=>({position:{x:7,y:8,z:9}})}};
 expect((ScmMission.prototype as any).scriptFires.call(self)).toEqual([{key:0,position:{x:7,y:8,z:9},strength:1,generations:0,player:true}]);
 expect(fire.position).toEqual({x:7,y:8,z:9});
});
