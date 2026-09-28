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

test('after Busted only fists are held; GiveWeapon fills slots, carries shotgun ammo and reloads a held weapon at once',()=>{
 const i=new WeaponInventory();i.installNative(data);
 i.strip();i.cycle(1);expect(i.selected).toBe(0);i.cycle(-1);expect(i.selected).toBe(0);
 // A pump shotgun (25, slot 3) with 20 shells, then a sawn-off (26, same slot) with 10: the pump is dropped and its 20 carry over.
 i.give(25,20);expect([...i.owned].sort((a,b)=>a-b)).toEqual([0,25]);expect(i.selected).toBe(25);
 i.give(26,10);expect(i.owned.has(25)).toBe(false);expect(i.selected).toBe(26);
 const sawn=i.ammo.get(26)!;expect(sawn.clip+sawn.reserve).toBe(30);expect(i.ammo.get(25)).toEqual({clip:0,reserve:0});
 // A pistol (22, slot 2) takes its own slot beside it; cycling walks the held weapons in slot order.
 i.give(22,34);i.select(0);i.cycle(1);expect(i.selected).toBe(22);i.cycle(1);expect(i.selected).toBe(26);i.cycle(1);expect(i.selected).toBe(0);
 // Topping up the held pistol reloads its clip straight away (CWeapon::Reload).
 i.select(22);i.cooldown=0;i.fire();i.cooldown=0;i.fire();const before=i.ammo.get(22)!.clip;
 i.give(22,5);const after=i.ammo.get(22)!;expect(after.clip).toBe(i.magazine(22));expect(after.clip).toBeGreaterThan(before);expect(after.clip+after.reserve).toBe(34-2+5);
});
test('CPed::GetWeaponInSlot names the weapon held in a slot, fists never',()=>{
 const i=inventory();i.strip();i.give(27,20);
 expect(i.inSlot(i.slotOf(25))).toBe(27);
 expect(i.inSlot(i.slotOf(2))).toBeUndefined();
 expect(i.inSlot(i.slotOf(0))).toBeUndefined();
});
test('at 100% completion a shot empties the clip but not the total (CWeapon::Fire)',()=>{
 const i=inventory();i.select(30);const a=i.ammo.get(30)!,total=a.clip+a.reserve;
 i.fullCompletion=()=>true;i.fire();
 expect(a.clip+a.reserve).toBe(total);expect(a.clip).toBe(i.magazine(30)-1);
 i.fullCompletion=()=>false;(i as any).cooldown=0;i.fire();
 expect(a.clip+a.reserve).toBe(total-1);
});
test('at 100% completion the camera still uses up its film (isPlayerFiring excludes WEAPON_CAMERA)',()=>{
 const i=inventory();i.give(43,36);i.select(43);const a=i.ammo.get(43)!,total=a.clip+a.reserve;
 i.fullCompletion=()=>true;i.fire();
 expect(a.clip+a.reserve).toBe(total-1);
});
test('brass knuckles take the fists\' slot: the cycle stops on one or the other, not both',()=>{
 const i=inventory();i.strip();i.give(1,1);i.give(22,17);i.select(22);
 const seen=new Set<number>();for(let n=0;n<4;n++){i.cycle(1);seen.add(i.selected);}
 expect([...seen].sort((a,b)=>a-b)).toEqual([1,22]);
});
