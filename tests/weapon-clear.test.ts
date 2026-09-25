import {expect,test} from 'vitest';
import {WeaponInventory} from '../src/weapons/Inventory';

test('CPed::ClearWeapon takes one weapon and leaves a held one unarmed; ClearWeapons takes them all',()=>{
 const inventory=new WeaponInventory();inventory.strip();
 inventory.give(22,50);inventory.give(25,20);inventory.select(22);
 // Not carried: nothing happens.
 expect(inventory.clearWeapon(31)).toBe(false);
 // Carried but not held: it goes, the pistol stays in hand.
 expect(inventory.clearWeapon(25)).toBe(true);expect(inventory.selected).toBe(22);expect(inventory.ammo.get(25)).toEqual({clip:0,reserve:0});
 // Held: the ped is unarmed.
 expect(inventory.clearWeapon(22)).toBe(true);expect(inventory.selected).toBe(0);
 // Fists never go.
 expect(inventory.clearWeapon(0)).toBe(false);
});

test('CPed::SetAmmo and GrantAmmo on the weapons the player holds',()=>{
 const inventory=new WeaponInventory();inventory.strip();
 inventory.give(22,50);
 const magazine=inventory.magazine(22);
 expect(inventory.setTotalAmmo(22,100)).toBe(true);
 expect(inventory.ammo.get(22)).toEqual({clip:magazine,reserve:100-magazine});
 expect(inventory.grantAmmo(22,5)).toBe(true);
 const a=inventory.ammo.get(22)!;expect(a.clip+a.reserve).toBe(105);
 // Less than a clip: all of it loaded.
 inventory.setTotalAmmo(22,3);expect(inventory.ammo.get(22)).toEqual({clip:3,reserve:0});
 // A weapon he does not have, and fists, are left alone.
 expect(inventory.setTotalAmmo(31,100)).toBe(false);expect(inventory.grantAmmo(31,10)).toBe(false);expect(inventory.setTotalAmmo(0,5)).toBe(false);
});
