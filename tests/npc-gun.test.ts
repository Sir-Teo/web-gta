import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readWeaponData,nativeWeaponInfo,nativeWeaponReloadMs} from '../src/weapons/weaponData';
import {stepNpcGun,npcAimSpread,npcBurstLength,npcBurstPause,type NpcGunState} from '../src/simulation/npcGun';
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
test('NPC dispersion stays inside the native weapon radius',()=>{
 const info=nativeWeaponInfo(data,22,3)!;
 const onset={x:0,y:0,z:-1};
 expect(npcAimSpread(onset,info).maxAngle).toBeGreaterThan(0);
 let worst=0;
 for(let i=0;i<200;i++){
  const {vector,maxAngle}=npcAimSpread(onset,info);
  expect(Math.hypot(vector.x,vector.y,vector.z)).toBeCloseTo(1,6);
  const angle=Math.acos(Math.max(-1,Math.min(1,-vector.z)));
  worst=Math.max(worst,angle);
  expect(angle).toBeLessThanOrEqual(maxAngle+1e-9);
 }
 expect(worst).toBeGreaterThan(0);
});
test('cop shooting accuracy tightens the dispersion cone',()=>{
 const info=nativeWeaponInfo(data,22,3)!,onset={x:0,y:0,z:-1};
 const street=npcAimSpread(onset,info,60).maxAngle,army=npcAimSpread(onset,info,84).maxAngle;
 expect(army).toBeLessThan(street);
 expect(army).toBeCloseTo(street*60/84,9);
});
test('weapon-class dispersion sprays shotguns and tightens rifles',async()=>{
  const {npcWeaponSpread}=await import('../src/simulation/npcGun');
  expect(npcWeaponSpread(25)).toBeGreaterThan(npcWeaponSpread(22));
  expect(npcWeaponSpread(30)).toBeLessThan(npcWeaponSpread(22));
  expect(npcWeaponSpread(34)).toBeLessThan(npcWeaponSpread(30));
  expect(npcWeaponSpread(38)).toBeGreaterThan(npcWeaponSpread(22));
  expect(npcWeaponSpread(99)).toBe(1);
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
