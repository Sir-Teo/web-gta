import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {nativeWeaponMovement} from '../src/weapons/nativeWeaponMovement';
import {readWeaponData} from '../src/weapons/weaponData';
const data=readWeaponData(readFileSync('public/play/world/files/data/weapon.dat','utf8'));
const controls={x:1,y:0,sprint:true,jump:true,cameraYaw:0};
test('native heavy weapon rows block sprint and jumping before launch animation',()=>{
  for(const id of [35,36,37,38]){const result=nativeWeaponMovement(controls,data,id,false);expect(result.sprint).toBe(false);expect(result.jump).toBe(false);expect(result.x).toBe(1);}
});
test('unarmed movement is unrestricted; targeting prevents jumping',()=>{
  expect(nativeWeaponMovement(controls,data,0,false)).toEqual(controls);
  expect(nativeWeaponMovement(controls,data,22,true).jump).toBe(false);
  expect(nativeWeaponMovement(controls,data,22,false)).toEqual(controls);
});
