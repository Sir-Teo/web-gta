import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readWeaponData,nativeWeaponInfo} from '../src/weapons/weaponData';
import {playerAimReach,PLAYER_AIM_REACH} from '../src/weapons/WeaponSystem';
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
test('the player\'s aimed rounds reach across a street; shotguns keep their range',()=>{
 const pistol=nativeWeaponInfo(data,22,1)!,m4=nativeWeaponInfo(data,31,1)!,shotgun=nativeWeaponInfo(data,25,1)!;
 expect(pistol.weaponRange).toBeLessThan(40);
 expect(playerAimReach('bullet',pistol)).toBe(PLAYER_AIM_REACH);
 expect(playerAimReach('bullet',{weaponRange:300})).toBe(300);
 expect(playerAimReach('bullet',m4)).toBe(Math.max(m4.weaponRange,PLAYER_AIM_REACH));
 expect(playerAimReach('shotgun',shotgun)).toBe(shotgun.weaponRange);
});
