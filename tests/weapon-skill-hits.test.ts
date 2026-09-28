import {expect,test} from 'vitest';
import {WeaponSystem} from '../src/weapons/WeaponSystem';
import {WorldPedestrians} from '../src/simulation/WorldPedestrians';

// CWeapon::DoBulletImpact trains the weapon skill (CStats::UpdateStatsWhenWeaponHit) only for a ped alive and outside
// the shooter's group, or a vehicle that can be damaged, is not bullet-proof and is not wrecked, tested before the
// damage lands. A corpse, a recruit or a bullet-proof car still takes the hit but trains nothing.
const trains=(crowd:any,cars:any[]=[])=>{
  const self=Object.assign(Object.create(WeaponSystem.prototype),{hits:0,pedestrians:()=>crowd,fleet:()=>({cars,boats:[]}),onCrime(){},releaseExplosions(){}});
  const hit=(WeaponSystem.prototype as any).damage.call(self,7,10,{x:0,y:0,z:1},false,'bullet',{weapon:22});
  return {hit,trains:self.hitTrains};
};
const ped=(o:object)=>({collider:{handle:7},health:100,follow:false,...o});
const crowdOf=(p:any)=>({trainsSkill:(WorldPedestrians.prototype as any).trainsSkill.bind({people:[p]}),damageCollider:()=>p.health>0?{id:1,officer:false}:true});
test('a living stranger trains the skill; a corpse or a recruit does not',()=>{
  expect(trains(crowdOf(ped({})))).toEqual({hit:true,trains:true});
  expect(trains(crowdOf(ped({health:0})))).toEqual({hit:true,trains:false});
  expect(trains(crowdOf(ped({follow:true})))).toEqual({hit:true,trains:false});
});
test('a bullet-proof or undamageable car takes the hit but trains nothing',()=>{
  const car=(o:object)=>({car:{body:{numColliders:()=>1,collider:()=>({handle:7}),handle:3}},wrecked:false,health:1000,canBeDamaged:true,damage:()=>false,...o});
  const none={trainsSkill:()=>false,damageCollider:()=>false};
  expect(trains(none,[car({})])).toEqual({hit:true,trains:true});
  expect(trains(none,[car({proofs:{bullet:true}})])).toEqual({hit:true,trains:false});
  expect(trains(none,[car({canBeDamaged:false})])).toEqual({hit:true,trains:false});
});
