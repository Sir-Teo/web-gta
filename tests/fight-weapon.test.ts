import {expect,test} from 'vitest';
import {weaponAtStartOfFight} from '../src/ped/nativeFightWeapon';

// CPed::GiveWeaponAtStartOfFight's rolls on m_nRandomSeed % 1024.
test('gang members draw a pistol under 400; dealers, criminals and prostitutes a knife under 200 or a pistol under 400',()=>{
 expect(weaponAtStartOfFight('GANG1',399)).toBe(22);expect(weaponAtStartOfFight('GANG10',400)).toBeUndefined();expect(weaponAtStartOfFight('GANG3',1024+10)).toBe(22);
 expect(weaponAtStartOfFight('DEALER',199)).toBe(4);expect(weaponAtStartOfFight('CRIMINAL',200)).toBe(22);expect(weaponAtStartOfFight('PROSTITUTE',399)).toBe(22);expect(weaponAtStartOfFight('PROSTITUTE',400)).toBeUndefined();
 expect(weaponAtStartOfFight('CIVMALE',0)).toBeUndefined();expect(weaponAtStartOfFight('COP',0)).toBeUndefined();expect(weaponAtStartOfFight(undefined,0)).toBeUndefined();
});
