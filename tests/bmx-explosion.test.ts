import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';

// CWorld::TriggerExplosionSectorList: a BMX's rider gets CEventKnockOffBike (KNOCK_OFF_TYPE_EXPLOSION) and a
// WEAPON_EXPLOSION damage event of damage × falloff × 1100; a motorbike's rider gets neither.
const blast=(motorbike:boolean)=>{
  const hurt:[number,unknown][]=[];let knocked=0;
  const bike={motorbike,occupied:true,wrecked:false,body:{handle:4,translation:()=>({x:1,y:0,z:0})},damage:()=>false,explosionKnockOff(){knocked++;return true;}};
  const self=Object.assign(Object.create(WeaponSystem.prototype),{onCrime(){},onExplosion(){},
    sim:{playerBody:{isEnabled:()=>false,translation:()=>({x:1,y:0,z:0})},playerCollider:{isEnabled:()=>false},player:{health:100},damagePlayer:(amount:number,_a:boolean,event:unknown)=>{hurt.push([amount,event]);}},
    pedestrians:()=>({targets:()=>[]}),fleet:()=>({cars:[],bikes:[bike],boats:[]})});
  (WeaponSystem.prototype as any).blast.call(self,{x:0,y:0,z:0},{radius:8,force:1,damagePercentage:1});
  return {hurt,knocked};
};
test('an explosion knocks a BMX rider off and hurts him as the bike',()=>{
  const {hurt,knocked}=blast(false);
  expect(knocked).toBe(1);
  expect(hurt).toHaveLength(1);expect(hurt[0][0]).toBe(1100);expect(hurt[0][1]).toMatchObject({weapon:51});
});
test('a motorbike rider is left on',()=>{
  const {hurt,knocked}=blast(true);
  expect(knocked).toBe(0);expect(hurt).toEqual([]);
});
