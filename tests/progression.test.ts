import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponInventory} from '../src/weapons/Inventory';
import {readFileSync} from 'node:fs';
import {readWeaponData} from '../src/weapons/weaponData';
beforeAll(async()=>{await RAPIER.init();});
test('versioned saves restore ammo, money and practice; malformed fields retain defaults',()=>{const sim=new Simulation(),inv=new WeaponInventory();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{const p=new Progression(inv,sim,storage);inv.select(31);inv.fire();sim.money=999;p.hit(31);p.save();const restored=new WeaponInventory();new Progression(restored,sim,storage);expect(restored.selected).toBe(31);expect(restored.ammo.get(31)?.clip).toBe(49);expect(restored.practice.get(31)).toBe(5);expect(sim.money).toBe(999);raw=JSON.stringify({version:1,money:'lots',ammo:[[31,Infinity,-1]],practice:[[31,999999]],selected:999});const safe=new WeaponInventory();new Progression(safe,sim,storage);expect(safe.selected).toBe(0);expect(safe.ammo.get(31)?.clip).toBe(50);expect(safe.practice.size).toBe(0);}finally{sim.dispose();}});
test('practice has bounded effects',()=>{const sim=new Simulation(),inv=new WeaponInventory(),p=new Progression(inv,sim);try{inv.select(31);for(let i=0;i<1000;i++)p.hit(31);expect(inv.proficiency).toBe(1);expect(inv.reloadDuration).toBeCloseTo(inv.weapon.reload*.8);}finally{sim.dispose();}});
test('saves from before the Activities were removed still load, their fields dropped on the next save',()=>{const sim=new Simulation();let raw=JSON.stringify({version:1,money:1234,drivingSkill:40,distances:{walk:10,drive:20},completed:['walk'],missions:{current:2},missionCounters:{kills:3}});const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{const p=new Progression(new WeaponInventory(),sim,storage);expect(sim.money).toBe(1234);expect(p.drivingSkill).toBe(40);expect(p.save()).toBe(true);const data=JSON.parse(raw);for(const key of ['distances','completed','missions','missionCounters'])expect(data).not.toHaveProperty(key);}finally{sim.dispose();}});
test('driving skill grows with driven distance, persists, and rejects teleports',()=>{const sim=new Simulation(),inv=new WeaponInventory();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{const p=new Progression(inv,sim,storage);p.tick(1/60,true,false);for(let i=0;i<2500;i++){sim.player.position.x++;p.tick(1/60,true,false);}expect(p.drivingSkill).toBeCloseTo(100,6);expect(p.snapshot().drivingSkill).toBeCloseTo(100,6);p.save();const restored=new Progression(new WeaponInventory(),sim,storage);expect(restored.drivingSkill).toBeCloseTo(100,6);sim.player.position.x=100000;restored.tick(1/60,true,false);expect(restored.drivingSkill).toBeCloseTo(100,6);}finally{sim.dispose();}});

test('only the weapons with skill stats train, each at its AR_STATS.DAT rate',()=>{
 const sim=new Simulation(),inv=new WeaponInventory(),p=new Progression(inv,sim);
 try{
  p.skillIncrements=new Map([[22,.8],[31,2],[28,.4],[32,.4]]);
  p.hit(22);p.hit(22);p.hit(31);p.hit(32);p.hit(34);p.hit(33);
  expect(inv.practice.get(22)).toBeCloseTo(1.6,6);expect(inv.practice.get(31)).toBe(2);
  // The Tec-9 trains the Micro Uzi's stat; the sniper and country rifle have none to train.
  expect(inv.practice.get(28)).toBeCloseTo(.4,6);expect(inv.practice.has(34)).toBe(false);expect(inv.practice.has(33)).toBe(false);
 }finally{sim.dispose();}
});

test('the fighting style the gyms teach is saved and restored',()=>{
 const sim=new Simulation(),inv=new WeaponInventory();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(inv,sim,storage);inv.fightingStyle=6;inv.allowedAttackMoves=6;p.save();
  const restored=new WeaponInventory();new Progression(restored,sim,storage);
  expect([restored.fightingStyle,restored.allowedAttackMoves]).toEqual([6,6]);
 }finally{sim.dispose();}
});

test('sprayed tags survive a save and a reload',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);p.tags=[['tag:2490:-1680',255],['tag:2500:-1700',128]];p.save();
  expect(new Progression(new WeaponInventory(),sim,storage).tags).toEqual([['tag:2490:-1680',255],['tag:2500:-1700',128]]);
 }finally{sim.dispose();}
});

test('a debt survives a reload, a fractional or out-of-range sum does not',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  sim.money=-500;new Progression(new WeaponInventory(),sim,storage).save();sim.money=350;
  new Progression(new WeaponInventory(),sim,storage);expect(sim.money).toBe(-500);
  for(const money of [2.5,-10000000]){raw=JSON.stringify({version:1,money});sim.money=350;new Progression(new WeaponInventory(),sim,storage);expect(sim.money).toBe(350);}
 }finally{sim.dispose();}
});

test('a hitman pistol clip saved before WEAPON.DAT loads is restored once it has',()=>{
 const sim=new Simulation();let raw=JSON.stringify({version:1,ammo:[[22,33,777]],practice:[[22,1000]]});const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const inv=new WeaponInventory(),p=new Progression(inv,sim,storage);
  // Saved again before the data arrives, the row is kept as it was read.
  p.save();expect(JSON.parse(raw).ammo).toContainEqual([22,33,777]);
  inv.installNative(readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')));
  expect(inv.ammo.get(22)).toEqual({clip:33,reserve:777});
 }finally{sim.dispose();}
});

test('a save as large as the loader allows is restored, and a failed write says so and keeps the last save',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);
  for(let i=0;i<2000;i++)p.pickups.add(`pickup:${String(i).padStart(56,'0')}`);
  for(let i=0;i<256;i++){p.stuntJumpsFound.add(`jump:${String(i).padStart(58,'0')}`);p.stuntJumpsDone.add(`jump:${String(i).padStart(58,'0')}`);}
  expect(p.save()).toBe(true);expect(raw.length).toBeGreaterThan(32768);
  expect(new Progression(new WeaponInventory(),sim,storage).pickups.size).toBe(2000);
  const kept=raw;
  // Far past anything the loader's caps allow: not written.
  for(let i=0;i<20000;i++)p.pickups.add(`extra:${String(i).padStart(56,'0')}`);
  expect(p.save()).toBe(false);expect(raw).toBe(kept);
  expect(new Progression(new WeaponInventory(),sim).save()).toBe(false);
  expect(new Progression(new WeaponInventory(),sim,{getItem:()=>null,setItem:()=>{throw new Error('QuotaExceededError');}}).save()).toBe(false);
 }finally{sim.dispose();}
});

test('the explored map squares survive a reload',()=>{
 const sim=new Simulation();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);p.zones.update(0,2495,-1687,true,false);p.zones.update(6000,2495,-1687,true,false);p.save();
  const restored=new Progression(new WeaponInventory(),sim,storage);
  expect(restored.zones.revealed).toBe(1);expect(restored.zones.wasVisited(2495,-1687)).toBe(true);
 }finally{sim.dispose();}
});

test('a new game clears the saved progress and saves nothing more',()=>{
 const sim=new Simulation();let raw=JSON.stringify({version:1,money:1234,savedLocation:{x:1,y:2,z:3,heading:0,timeMinutes:600}});const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);expect(p.savedLocation).toBeDefined();
  p.startNewGame();expect(raw).toBe('');expect(p.save()).toBe(false);expect(raw).toBe('');
  sim.money=0;const fresh=new Progression(new WeaponInventory(),sim,storage);expect(fresh.savedLocation).toBeUndefined();expect(sim.money).toBe(0);
 }finally{sim.dispose();}
});

test('an interior save keeps its area and door stack; bad ones are dropped',()=>{
 const sim=new Simulation();const at={x:2495.9,y:-1707.4,z:1013.3,heading:0,timeMinutes:600};
 let raw=JSON.stringify({version:1,savedLocation:{...at,area:3,enexStack:[12,-1,'x',400,7]}});const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};
 try{
  const p=new Progression(new WeaponInventory(),sim,storage);expect(p.savedLocation).toMatchObject({area:3,enexStack:[12,7]});
  p.save();expect(new Progression(new WeaponInventory(),sim,storage).savedLocation).toMatchObject({area:3,enexStack:[12,7]});
  for(const area of [0,19,2.5,'3']){raw=JSON.stringify({version:1,savedLocation:{...at,area,enexStack:[1]}});const q=new Progression(new WeaponInventory(),sim,storage);expect(q.savedLocation).toBeDefined();expect(q.savedLocation!.area).toBeUndefined();expect(q.savedLocation!.enexStack).toBeUndefined();}
 }finally{sim.dispose();}
});
