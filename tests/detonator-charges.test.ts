import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WeaponInventory} from '../src/weapons/Inventory';
import {readWeaponData} from '../src/weapons/weaponData';

// CWeapon::Fire's WEAPON_DETONATOR: CWorld::UseDetonator sets off every satchel, then m_AmmoInClip = m_TotalAmmo = 1
// and the shot's decrement leaves the detonator empty, however many satchels were thrown (each gave it a charge).
test('one detonator press sets off every satchel and leaves it empty',()=>{
  const inventory=new WeaponInventory();inventory.installNative(readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8')));
  inventory.give(40,3);inventory.select(40);
  const exploded:unknown[]=[];
  const self=Object.assign(Object.create(WeaponSystem.prototype),{inventory,ready:true,firstPerson:undefined,stealthReady:0,lastWhip:false,
    sim:{player:{health:100,swimming:false,grounded:true,crouched:false,position:{x:0,y:0,z:0}},playerBody:{isEnabled:()=>true},playerCollider:{isEnabled:()=>true}},
    projectiles:[{weapon:39,position:{x:1,y:0,z:0}},{weapon:39,position:{x:2,y:0,z:0}},{weapon:39,position:{x:3,y:0,z:0}}],
    pistolWhipTarget:()=>undefined,onUse(){},onSound(){},explode:(at:unknown)=>{exploded.push(at);}});
  expect((WeaponSystem.prototype as any).fire.call(self,{origin:{x:0,y:0,z:0},direction:{x:0,y:0,z:1}})).toBe(true);
  expect(exploded).toHaveLength(3);
  const ammo=inventory.ammo.get(40)!;
  expect(ammo.clip+ammo.reserve).toBe(0);
});
