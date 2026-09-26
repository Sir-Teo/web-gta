import {expect,test} from 'vitest';
import {gangWeapons,randomGangWeapon,gangMemberArmed,GANG_WEAPON_CHANCE,setGangWeapons,resetGangWeapons} from '../src/simulation/nativeGangWeapons';
test('gang weapon choices: CGangs::Initialise defaults until the script sets a gang\'s',()=>{
 resetGangWeapons();
 expect(gangWeapons(0)).toEqual([22,28,0]);expect(gangWeapons(2)).toEqual([22,0,0]);expect(gangWeapons(5)).toEqual([24,0,0]);expect(gangWeapons(6)).toEqual([22,30,0]);
 // Rifa (3) is never set; the Aztecas (7) carry a pistol and a micro SMG.
 expect(gangWeapons(1)).toEqual([22,0,0]);expect(gangWeapons(3)).toEqual([0,0,0]);expect(gangWeapons(7)).toEqual([22,28,0]);
 // MAIN's hundred-tag reward: the Families' Desert Eagle, MP5 and knife; a new game puts the defaults back.
 setGangWeapons(1,24,29,4);expect(gangWeapons(1)).toEqual([24,29,4]);
 resetGangWeapons();expect(gangWeapons(1)).toEqual([22,0,0]);
 expect(()=>setGangWeapons(12,1,2,3)).toThrow();
});
test('a random gang weapon skips the unarmed choices; a third of the members draw one',()=>{
 expect(randomGangWeapon(0,()=>.1)).toBe(22);expect(randomGangWeapon(0,()=>.9)).toBe(28);
 expect(randomGangWeapon(2,()=>.9)).toBe(22);expect(randomGangWeapon(3,()=>.5)).toBe(0);
 setGangWeapons(1,24,29,4);expect(randomGangWeapon(1,()=>.5)).toBe(29);resetGangWeapons();
 expect(GANG_WEAPON_CHANCE).toBe(33);expect(gangMemberArmed(()=>.32)).toBe(true);expect(gangMemberArmed(()=>.34)).toBe(false);
});
