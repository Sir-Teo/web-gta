import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {WeaponInventory} from '../src/weapons/Inventory';
import {readWeaponData} from '../src/weapons/weaponData';
const native=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
function inventory(){const i=new WeaponInventory();i.installNative(native);i.select(28);i.setTotalAmmo(28,100);return i;}
test('bike firing uses strict absolute retry times instead of the handheld animation interval',()=>{
 const i=inventory();i.tick(1/60,100);i.prepareDriveBy(100,true);expect(i.fireFromCar()).toBe(true);expect(i.ammo.get(28)).toEqual({clip:49,reserve:50});
 i.tick(.07,170);expect(i.fireFromCar()).toBe(false);expect(i.shots).toBe(1);
 i.tick(.001,171);expect(i.fireFromCar()).toBe(true);expect(i.shots).toBe(2);expect(i.cooldown).toBe(.07);
});
test('empty clips reload only after the controller retry time, including equality',()=>{
 const i=inventory();Object.assign(i.ammo.get(28)!,{clip:1,reserve:99});i.tick(1/60,100);i.prepareDriveBy(100,true);expect(i.fireFromCar()).toBe(true);expect(i.reloading).toBe(.07);expect(i.ammo.get(28)).toEqual({clip:0,reserve:99});
 i.tick(.07,170);expect(i.ammo.get(28)?.clip).toBe(0);expect(i.reloading).toBeGreaterThan(0);expect(i.fireFromCar()).toBe(false);
 i.tick(.001,171);expect(i.reloading).toBe(0);expect(i.ammo.get(28)).toEqual({clip:50,reserve:49});expect(i.fireFromCar()).toBe(true);expect(i.ammo.get(28)).toEqual({clip:49,reserve:49});
});
test('releasing the trigger refills from the total without consuming ammo',()=>{
 const i=inventory();Object.assign(i.ammo.get(28)!,{clip:1,reserve:99});i.tick(1/60,100);i.prepareDriveBy(100,false);expect(i.ammo.get(28)).toEqual({clip:50,reserve:50});expect(i.shots).toBe(0);
});
for(const completion of [false,true])test(`vehicle ammo preservation respects native 25000/full completion gates (${completion})`,()=>{
 const i=inventory();i.fullCompletion=()=>completion;i.setTotalAmmo(28,25000);i.tick(1/60,100);i.prepareDriveBy(100,true);expect(i.fireFromCar()).toBe(true);expect(i.ammo.get(28)).toEqual({clip:49,reserve:24951});
 i.setTotalAmmo(28,100);i.tick(.1,200);i.prepareDriveBy(200,true);expect(i.fireFromCar()).toBe(true);expect(i.ammo.get(28)).toEqual({clip:49,reserve:completion?51:50});
});
test('ordinary weapon use resumes with the remaining delay after leaving the bike',()=>{
 const i=inventory();i.tick(1/60,100);i.prepareDriveBy(100,true);i.fireFromCar();i.tick(.02);expect(i.driveByActive).toBe(false);expect(i.cooldown).toBeCloseTo(.05,12);expect(i.fire()).toBe(false);i.tick(.1);expect(i.fire()).toBe(true);expect(i.cooldown).toBe(i.interval);
});
test('script ammo and weapon replacement cannot reuse stale vehicle ammo',()=>{
 const i=inventory();i.tick(1/60,100);i.prepareDriveBy(100,true);i.fireFromCar();i.setTotalAmmo(28,2);i.tick(.1,200);i.prepareDriveBy(200,true);expect(i.fireFromCar()).toBe(true);expect(i.ammo.get(28)).toEqual({clip:1,reserve:0});
 i.select(29);i.setTotalAmmo(29,40);i.tick(.1,300);i.prepareDriveBy(300,true);expect(i.fireFromCar()).toBe(true);expect(i.ammo.get(29)!.clip+i.ammo.get(29)!.reserve).toBe(39);expect(i.ammo.get(28)).toEqual({clip:1,reserve:0});
});

test('release refills the standard drive-by clip even when skill supports a larger handheld clip',()=>{
 const i=inventory();i.practice.set(28,1000);i.setTotalAmmo(28,100);expect(i.ammo.get(28)?.clip).toBe(100);i.tick(1/60,100);i.prepareDriveBy(100,false);expect(i.ammo.get(28)).toEqual({clip:50,reserve:50});
});
