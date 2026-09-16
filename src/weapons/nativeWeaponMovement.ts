import type {Controls} from '../simulation/Simulation';
import {nativeWeaponInfo, WEAPON_FLAG, type NativeWeaponData} from './weaponData';
/** PlayerControlZelda (0x6883D0) checks the STD weapon row, regardless of
 * proficiency: heavy weapons cannot sprint/jump, targeting prevents a jump.
 * Apply before NativeCharacter.step so the launch pose obeys the same rule. */
export function nativeWeaponMovement(controls: Controls, data: NativeWeaponData | undefined, weapon: number, targeting: boolean): Controls {
  const heavy = !!((data && nativeWeaponInfo(data, weapon, 1)?.flags || 0) & WEAPON_FLAG.heavy);
  return {...controls, sprint: controls.sprint && !heavy, jump: controls.jump && !heavy && !targeting};
}
