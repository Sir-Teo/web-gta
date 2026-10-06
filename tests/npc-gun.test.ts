import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readWeaponData,nativeWeaponInfo,nativeWeaponReloadMs} from '../src/weapons/weaponData';
import {stepNpcGun,npcBurstLength,npcBurstPause,npcShotEnd,shotgunPelletCount,shotgunPelletOffset,type NpcGunState} from '../src/simulation/npcGun';
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
test('NPC shots cross native fire markers, consume magazines and pause for reload',()=>{
 const info=nativeWeaponInfo(data,22,3)!,state:NpcGunState={time:0,rounds:2,reload:0,active:false};
 const reload=nativeWeaponReloadMs(data,info)/1000;let shots=0,first=0;
 for(let i=0;i<300&&!state.reload;i++)if(stepNpcGun(state,info,reload,1/60,true)){shots++;first ||= (i+1)/60;}
 expect(shots).toBe(2);expect(first).toBeGreaterThanOrEqual(info.loop.fire);expect(first).toBeLessThan(info.loop.fire+1/60+.00001);
 expect(state.rounds).toBe(0);expect(state.reload).toBe(reload);
 expect(stepNpcGun(state,info,reload,reload,true)).toBe(false);expect(state.rounds).toBe(info.clip);
});
test('loss of target cancels the fire marker; weapon loops retain different cadence',()=>{
 const count=(id:number)=>{const info=nativeWeaponInfo(data,id,3)??nativeWeaponInfo(data,id)!;const state={time:0,rounds:10000,reload:0,active:false};let shots=0;
 for(let i=0;i<120;i++)shots+=Number(stepNpcGun(state,info,1,1/60,true));return shots;};
 expect(count(28)).toBeGreaterThan(count(22));
 const info=nativeWeaponInfo(data,22,3)!,state={time:info.loop.fire-.01,rounds:17,reload:0,active:true};
 expect(stepNpcGun(state,info,1,.02,false)).toBe(false);expect(state.time).toBe(0);expect(state.rounds).toBe(17);
});
test('CTaskSimpleGunControl bursts: 4-5 rounds at the default rate 40, 3-4 for a city cop, paused in between',()=>{
 expect([npcBurstLength(17,40,()=>0),npcBurstLength(17,40,()=>.99)]).toEqual([5,4]);
 expect([npcBurstLength(17,30,()=>0),npcBurstLength(17,30,()=>.99)]).toEqual([4,3]);
 expect(npcBurstLength(2,40,()=>0)).toBe(2);expect(npcBurstLength(1,40,()=>.99)).toBe(1);expect(npcBurstLength(30,100,()=>.99)).toBe(30);
 // The pause scales with 1 / (rate × 0.04) around the attack period, twice it for projectiles.
 expect(npcBurstPause(false,40,()=>.5)).toBeCloseTo(.625,6);expect(npcBurstPause(true,40,()=>.5)).toBeCloseTo(1.25,6);
 const state:NpcGunState={time:0,rounds:17,reload:0,active:false};let shots=0,paused=0;
 const info=nativeWeaponInfo(data,22,1)!;
 for(let i=0;i<600;i++){const fired=stepNpcGun(state,info,1,1/60,true,{rate:40,random:()=>0});shots+=Number(fired);if(!state.active)paused++;}
 // Ten seconds: bursts of five with pauses between, never the unbroken stream a clip would give.
 expect(shots).toBeGreaterThan(5);expect(paused).toBeGreaterThan(100);
});
test('An engagement opens with a burst at once, and a reload drops the rest of the burst for a fresh pause',()=>{
 const info=nativeWeaponInfo(data,22,1)!;
 const state:NpcGunState={time:0,rounds:17,reload:0,active:false};let first=-1;
 for(let i=0;i<120&&first<0;i++)if(stepNpcGun(state,info,1,1/60,true,{rate:40,random:()=>0}))first=(i+1)/60;
 // The first shot comes at the fire marker, with no pause before it.
 expect(first).toBeGreaterThan(0);expect(first).toBeLessThan(info.loop.fire+2/60);
 // Leaving and re-entering gun control opens with a burst again.
 stepNpcGun(state,info,1,1/60,false);expect(state.pause).toBeUndefined();
 // Two rounds left of a five-round burst: the second empties the clip, and after the reload a pause comes first.
 const low:NpcGunState={time:0,rounds:2,reload:0,active:false};
 for(let i=0;i<120&&!low.reload;i++)stepNpcGun(low,info,.5,1/60,true,{rate:40,random:()=>0});
 expect(low.burstLeft).toBe(0);expect(low.pause).toBeCloseTo(npcBurstPause(false,40,()=>0),6);
});
test('FireInstantHit sends an AI round to the weapon\'s range, its end moved by (100 - accuracy) over the weapon\'s',()=>{
 const pistol=nativeWeaponInfo(data,22,1)!,from={x:0,y:1,z:0};
 // The line runs on through the target to the weapon's range; with the draws at their ends the offset is the spread
 // times 0.2 across (x), 0.2 along native y (renderer -z) and 0.1 up.
 const spread=(100-60)/pistol.accuracy,edge=()=>1,centre=()=>.5;
 const straight=npcShotEnd(from,{x:0,y:1,z:-10},pistol,60,{},centre);
 expect(straight.z).toBeCloseTo(-pistol.weaponRange,4);expect(straight.x).toBeCloseTo(0,6);expect(straight.y).toBeCloseTo(1,6);
 const far=npcShotEnd(from,{x:0,y:1,z:-10},pistol,60,{},edge);
 expect(far.x).toBeCloseTo(.2*spread,4);expect(far.y-1).toBeCloseTo(.1*spread,4);expect(far.z+pistol.weaponRange).toBeCloseTo(-.2*spread,4);
 // The error is fixed at the range's end: a target three units off and thirty off get the same end point offsets.
 const near=npcShotEnd(from,{x:0,y:1,z:-3},pistol,60,{},edge),distant=npcShotEnd(from,{x:0,y:1,z:-30},pistol,60,{},edge);
 expect(near).toEqual(distant);
 // The army (84) misses by less than a street cop (60); the player's speed widens it up to 1.1 (0.8 still).
 expect(npcShotEnd(from,{x:0,y:1,z:-10},pistol,84,{},edge).x).toBeCloseTo(.2*(16/pistol.accuracy),4);
 expect(npcShotEnd(from,{x:0,y:1,z:-10},pistol,60,{targetIsPlayer:true,targetSpeed:0},edge).x).toBeCloseTo(.2*spread*.8,4);
 expect(npcShotEnd(from,{x:0,y:1,z:-10},pistol,60,{targetIsPlayer:true,targetSpeed:1},edge).x).toBeCloseTo(.2*spread*1.1,4);
 // A target in a car: three times the range, so a third of the angle.
 expect(npcShotEnd(from,{x:0,y:1,z:-10},pistol,60,{rangeMultiplier:3},centre).z).toBeCloseTo(-3*pistol.weaponRange,3);
 // A shotgun takes no random end point.
 const shotgun=nativeWeaponInfo(data,25,1)!;
 expect(npcShotEnd(from,{x:0,y:1,z:-10},shotgun,60,{},edge).x).toBeCloseTo(0,6);
});
test('SetUpPelletCol: eight pellets for the SPAS 12, fifteen for the other shotguns, between a fifth and the whole depth off',()=>{
 expect([shotgunPelletCount(25),shotgunPelletCount(26),shotgunPelletCount(27)]).toEqual([15,15,8]);
 for(const r of [0,.25,.5,.999]){const o=shotgunPelletOffset(2,()=>r),d=Math.hypot(o.across,o.up);expect(d).toBeGreaterThanOrEqual(.4-1e-9);expect(d).toBeLessThanOrEqual(2+1e-9);}
});
