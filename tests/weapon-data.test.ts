import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {WEAPON_FLAG,WEAPON_ANIM_GROUPS,hasWeaponFlag,nativeAnimLoop,nativeShotDelayMs,nativeTargetHeadRange,nativeWeaponInfo,nativeWeaponRadiusOnScreen,nativeWeaponReloadMs,playerWeaponSkill,readWeaponData} from '../src/weapons/weaponData';
const native=()=>readWeaponData(new TextDecoder('windows-1252').decode(readFileSync('public/play/world/files/data/weapon.dat')));
test('synthetic rows follow CWeaponInfo::LoadWeaponData field order and flag layout',()=>{
 const data=readWeaponData('£ KNIFE MELEE 10.0 1.6 335 -1 1 KNIFE 1 1 stealth_kn\n$ PISTOL INSTANT_HIT 25.0 30.0 346 -1 2 colt45 17 25 0.25 0.05 0.09 0 0 0.75 1.0 6 17 6 6 16 6 99 3033\n% colt45 0.2 0.6 0.1 0.1 254 633 254 633\nENDWEAPONDATA\n$ MINIGUN INSTANT_HIT 1 1 1 1 1 flame 1 1 0 0 0 1 0 1 1 1 1 1 1 1 1 1 0');
 const knife=nativeWeaponInfo(data,4)!,pistol=nativeWeaponInfo(data,22,0)!;
 expect(knife).toMatchObject({fire:'melee',slot:1,baseCombo:'KNIFE',combos:1,animGroup:'stealth_kn',models:[335,-1]});
 expect(pistol).toMatchObject({fire:'instant',clip:17,damage:25,skill:0,animGroup:'colt45',requiredStat:0});
 expect(hasWeaponFlag(pistol,WEAPON_FLAG.canAim|WEAPON_FLAG.aimWithArm)).toBe(true);expect(hasWeaponFlag(pistol,WEAPON_FLAG.reload)).toBe(true);expect(hasWeaponFlag(pistol,WEAPON_FLAG.twinPistol)).toBe(false);
 expect(data.aim.get('colt45')).toMatchObject({reloadA:254,reloadB:633});expect(nativeWeaponInfo(data,38)).toBeUndefined();
});
test('animation loops quantize the end to 50 Hz steps like SetAnimLoopInfos',()=>{
 const loop=nativeAnimLoop(6,15,6);expect(loop.start).toBeCloseTo(.2,6);expect(loop.end-loop.start).toBeCloseTo(.294,5);expect(loop.fire).toBeCloseTo(.2,6);
 expect(nativeAnimLoop(6,10,7).end-nativeAnimLoop(6,10,7).start).toBeCloseTo(.114,5);expect(()=>nativeAnimLoop(10,6,7)).toThrow();
});
test('native weapon.dat supplies skill levels, twin pistols, clips and reload times',()=>{
 const data=native();
 expect(nativeWeaponInfo(data,22,1)).toMatchObject({clip:17,damage:25,requiredStat:40,weaponRange:35,targetRange:30});
 const pro=nativeWeaponInfo(data,22,2)!;expect(pro).toMatchObject({clip:34,animGroup:'colt45pro',requiredStat:999});expect(hasWeaponFlag(pro,WEAPON_FLAG.twinPistol)).toBe(true);
 expect(nativeWeaponInfo(data,22,3)?.animGroup).toBe('colt_cop');
 expect(hasWeaponFlag(nativeWeaponInfo(data,26,2)!,WEAPON_FLAG.twinPistol)).toBe(true);expect(nativeWeaponInfo(data,28,2)!.clip).toBe(100);expect(nativeWeaponInfo(data,32,2)!.clip).toBe(100);
 for(const type of [23,24,25,27,29,30,31])expect(hasWeaponFlag(nativeWeaponInfo(data,type,2)!,WEAPON_FLAG.twinPistol)).toBe(false);
 expect(playerWeaponSkill(data,22,0)).toBe(0);expect(playerWeaponSkill(data,22,1)).toBe(1);expect(playerWeaponSkill(data,22,998)).toBe(1);expect(playerWeaponSkill(data,22,999)).toBe(2);expect(playerWeaponSkill(data,34,0)).toBe(1);
 expect(nativeWeaponReloadMs(data,nativeWeaponInfo(data,22,1)!)).toBe(1000);expect(nativeWeaponReloadMs(data,pro)).toBe(2000);
 expect(nativeWeaponReloadMs(data,nativeWeaponInfo(data,25,1)!)).toBe(826);expect(nativeWeaponReloadMs(data,nativeWeaponInfo(data,34)!)).toBe(1000);
 expect(nativeShotDelayMs(nativeWeaponInfo(data,30,1)!)).toBe(0);expect(nativeShotDelayMs(nativeWeaponInfo(data,25,1)!)).toBe(948);expect(nativeShotDelayMs(nativeWeaponInfo(data,43)!)).toBe(1100);
 expect(nativeWeaponInfo(data,24,0)!.damage).toBe(70);expect(nativeWeaponInfo(data,24,1)!.damage).toBe(140);expect(nativeWeaponInfo(data,34)!.damage).toBe(125);
 expect(nativeWeaponInfo(data,37)).toMatchObject({fire:'area',speed:.5,lifespan:1000,spread:2});expect(hasWeaponFlag(nativeWeaponInfo(data,37)!,WEAPON_FLAG.slowdown|WEAPON_FLAG.randSpeed)).toBe(true);
 expect(nativeWeaponInfo(data,4)?.animGroup).toBe('stealth_kn');expect(nativeWeaponInfo(data,9)?.flags).toBe(0x201);
 expect(nativeTargetHeadRange(nativeWeaponInfo(data,22,1)!)).toBeCloseTo(4.2,5);
 const ak=nativeWeaponInfo(data,30,1)!;expect(nativeWeaponRadiusOnScreen(ak)).toBeCloseTo(Math.min(1,15/70)*1,5);expect(nativeWeaponRadiusOnScreen(ak,0,true)).toBe(.2);
 expect(nativeWeaponRadiusOnScreen(nativeWeaponInfo(data,25,1)!)).toBeCloseTo(.5/1.2,5);
 for(const info of data.infos.values())if(info.fire!=='melee'&&info.animGroup&&!['grenade','goggles','null'].includes(info.animGroup))expect(WEAPON_ANIM_GROUPS[info.animGroup],info.animGroup).toBeDefined();
});
