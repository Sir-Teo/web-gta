import {beforeAll,expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Progression} from '../src/simulation/Progression';
import {Simulation} from '../src/simulation/Simulation';
import {WeaponInventory} from '../src/weapons/Inventory';
import {readFileSync} from 'node:fs';
import {readWeaponData} from '../src/weapons/weaponData';
beforeAll(async()=>{await RAPIER.init();});
test('versioned saves restore ammo, money and practice; malformed fields retain defaults',()=>{const sim=new Simulation(),inv=new WeaponInventory();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{const p=new Progression(inv,sim,storage);inv.select(31);inv.fire();sim.money=999;p.hit(31);p.save();const restored=new WeaponInventory();new Progression(restored,sim,storage);expect(restored.selected).toBe(31);expect(restored.ammo.get(31)?.clip).toBe(49);expect(restored.practice.get(31)).toBe(5);expect(sim.money).toBe(999);raw=JSON.stringify({version:1,money:'lots',ammo:[[31,Infinity,-1]],practice:[[31,999999]],selected:999});const safe=new WeaponInventory();new Progression(safe,sim,storage);expect(safe.selected).toBe(0);expect(safe.ammo.get(31)?.clip).toBe(50);expect(safe.practice.size).toBe(0);}finally{sim.dispose();}});
test('driving activity rejects teleports and awards once',()=>{const sim=new Simulation(),p=new Progression(new WeaponInventory(),sim);try{p.tick(1/60,true,0,false);sim.player.position.x=10000;p.tick(1/60,true,0,false);expect(p.distances.drive).toBe(0);for(let i=0;i<1100;i++){sim.player.position.x++;p.tick(1/60,true,0,false);}expect(p.completed.has('drive')).toBe(true);expect(sim.money).toBe(850);}finally{sim.dispose();}});
test('escape reward excludes death and arrest, and practice has bounded effects',()=>{const sim=new Simulation(),inv=new WeaponInventory(),p=new Progression(inv,sim);try{p.tick(.1,false,2,false);p.tick(.1,false,0,true);expect(p.completed.size).toBe(0);p.tick(.1,false,2,false);sim.player.health=0;p.tick(.1,false,0,false);expect(p.completed.size).toBe(0);sim.player.health=100;p.tick(.1,false,2,false);p.tick(.1,false,0,false);expect(p.completed.has('escape')).toBe(true);inv.select(31);for(let i=0;i<1000;i++)p.hit(31);expect(inv.proficiency).toBe(1);expect(inv.reloadDuration).toBeCloseTo(inv.weapon.reload*.8);}finally{sim.dispose();}});
test('driving skill grows with driven distance, persists, and rejects teleports',()=>{const sim=new Simulation(),inv=new WeaponInventory();let raw='';const storage={getItem:()=>raw,setItem:(_:string,v:string)=>{raw=v;}};try{const p=new Progression(inv,sim,storage);p.tick(1/60,true,0,false);for(let i=0;i<2500;i++){sim.player.position.x++;p.tick(1/60,true,0,false);}expect(p.drivingSkill).toBeCloseTo(100,6);expect(p.snapshot().drivingSkill).toBeCloseTo(100,6);p.save();const restored=new Progression(new WeaponInventory(),sim,storage);expect(restored.drivingSkill).toBeCloseTo(100,6);sim.player.position.x=100000;restored.tick(1/60,true,0,false);expect(restored.drivingSkill).toBeCloseTo(100,6);}finally{sim.dispose();}});

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
