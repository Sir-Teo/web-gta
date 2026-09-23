import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {WeaponInventory} from '../src/weapons/Inventory';
import {readWeaponData,nativeWeaponInfo,nativeWeaponReloadMs} from '../src/weapons/weaponData';
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
const inventory=()=>{const i=new WeaponInventory();i.installNative(data);i.select(22);return i;};
const empty=(i:WeaponInventory)=>{while(i.ammo.get(22)!.clip>0){i.cooldown=0;i.fire();}};

test('a reload left running while the weapon is put away finishes by its own clock (CWeapon::m_TimeForNextShotMs)',()=>{
 const i=inventory();empty(i);
 expect(i.reloading).toBeGreaterThan(0);
 const total=i.reloading;
 i.select(0);i.tick(total/2);i.select(22);
 // Half of it is still to run, not a fresh reload.
 expect(i.reloading).toBeCloseTo(total/2,5);
 i.select(0);i.tick(total);i.select(22);
 expect(i.reloading).toBe(0);expect(i.ammo.get(22)!.clip).toBe(i.magazine());
});

test('firing with an empty clip fills it from the total and fires on the same press (CWeapon::Fire)',()=>{
 const i=inventory();const a=i.ammo.get(22)!;a.clip=0;
 const before=a.reserve;
 expect(i.fire()).toBe(true);
 expect(a.clip+a.reserve).toBe(before-1);
});

test('the player\'s fast reload takes a quarter of the reload time and does not wait on the animation',()=>{
 const i=inventory();i.reloadClipSeconds=()=>10;
 const slow=i.reloadDuration;
 i.fastReload=()=>true;
 expect(i.reloadDuration).toBeCloseTo(nativeWeaponReloadMs(data,nativeWeaponInfo(data,22,i.skill())!)/4000,6);
 expect(i.reloadDuration).toBeLessThan(slow);
});
