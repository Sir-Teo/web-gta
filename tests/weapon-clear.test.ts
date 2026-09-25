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
