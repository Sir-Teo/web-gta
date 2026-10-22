import {describe,expect,it} from 'vitest';
import {copCanArrest,policePursuitWeapon} from '../src/police/nativeArrest';
import {meleeAttackFalls} from '../src/simulation/nativeMelee';

describe('CTaskComplexPolicePursuit::SetWeapon',()=>{
 it('draws the nightstick at one star unless the player holds a gun',()=>{
  expect(policePursuitWeapon({current:'unarmed',wantedLevel:1,playerHoldsGun:false})).toBe('nightstick');
  expect(policePursuitWeapon({current:'unarmed',wantedLevel:1,playerHoldsGun:true})).toBe('pistol');
  // Putting the gun away at one star brings the nightstick back.
  expect(policePursuitWeapon({current:'pistol',wantedLevel:1,playerHoldsGun:false})).toBe('nightstick');
 });
 it('keeps any weapon already in hand above one star, otherwise draws the pistol',()=>{
  expect(policePursuitWeapon({current:'unarmed',wantedLevel:2,playerHoldsGun:false})).toBe('pistol');
  expect(policePursuitWeapon({current:'nightstick',wantedLevel:3,playerHoldsGun:true})).toBe('nightstick');
 });
 it('changes nothing while arresting, with the player on an entity or with no wanted level',()=>{
  expect(policePursuitWeapon({current:'pistol',wantedLevel:1,playerHoldsGun:false,arresting:true})).toBe('pistol');
  expect(policePursuitWeapon({current:'pistol',wantedLevel:1,playerHoldsGun:false,playerOnEntity:true})).toBe('pistol');
  expect(policePursuitWeapon({current:'unarmed',wantedLevel:0,playerHoldsGun:true})).toBe('unarmed');
 });
});

describe('CTaskComplexArrestPed on foot',()=>{
 const at=(x:number,y:number,z:number)=>({x,y,z});
 it('arrests only a falling suspect within 3 units horizontally and 2 vertically',()=>{
  expect(copCanArrest({cop:at(0,0,0),suspect:at(2.9,0,0),suspectFalling:true,up:'y'})).toBe(true);
  expect(copCanArrest({cop:at(0,0,0),suspect:at(2.9,0,0),suspectFalling:false,up:'y'})).toBe(false);
  expect(copCanArrest({cop:at(0,0,0),suspect:at(3.1,0,0),suspectFalling:true,up:'y'})).toBe(false);
  expect(copCanArrest({cop:at(0,0,0),suspect:at(1,2.1,0),suspectFalling:true,up:'y'})).toBe(false);
  expect(copCanArrest({cop:at(0,0,0),suspect:at(1,0,2.1),suspectFalling:true,up:'z'})).toBe(false);
 });
});

describe('melee.dat FLAGS',()=>{
 it('knocks down on the third bat, knife and sword swing, but never with fists',()=>{
  expect([0,1,2].map(i=>meleeAttackFalls('BBALLBAT',i as 0|1|2))).toEqual([false,false,true]);
  expect([0,1,2].map(i=>meleeAttackFalls('UNARMED',i as 0|1|2))).toEqual([false,false,false]);
  expect(meleeAttackFalls('KNIFE',2)).toBe(true);expect(meleeAttackFalls('GOLFCLUB',2)).toBe(false);
 });
});
