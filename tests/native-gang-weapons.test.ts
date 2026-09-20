import {expect,test} from 'vitest';
import {gangWeapons,randomGangWeapon,gangMemberArmed,GANG_WEAPON_CHANCE} from '../src/simulation/nativeGangWeapons';
test('gang weapon choices: CGangs::Initialise defaults with the script\'s Families set',()=>{
 expect(gangWeapons(0)).toEqual([22,28,0]);expect(gangWeapons(2)).toEqual([22,0,0]);expect(gangWeapons(5)).toEqual([22,30,0]);
 expect(gangWeapons(1)).toEqual([24,29,4]);expect(gangWeapons(7)).toEqual([0,0,0]);
});
test('a random gang weapon skips the unarmed choices; a third of the members draw one',()=>{
 expect(randomGangWeapon(0,()=>.1)).toBe(22);expect(randomGangWeapon(0,()=>.9)).toBe(28);
 expect(randomGangWeapon(2,()=>.9)).toBe(22);expect(randomGangWeapon(7,()=>.5)).toBe(0);
 expect(randomGangWeapon(1,()=>.5)).toBe(29);
 expect(GANG_WEAPON_CHANCE).toBe(33);expect(gangMemberArmed(()=>.32)).toBe(true);expect(gangMemberArmed(()=>.34)).toBe(false);
});
