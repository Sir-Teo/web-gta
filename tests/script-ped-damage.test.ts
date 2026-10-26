import {beforeAll,expect,test,vi} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {scriptPedDamage} from '../src/ped/damage';
import {Simulation} from '../src/simulation/Simulation';

beforeAll(async()=>RAPIER.init());
test.each([
 {health:100,armour:50,amount:25,flag:true,want:{health:100,armour:25}},
 {health:100,armour:50,amount:75,flag:true,want:{health:75,armour:0}},
 {health:100,armour:50,amount:50,flag:true,want:{health:100,armour:0}},
 {health:100,armour:50,amount:25,flag:false,want:{health:75,armour:50}},
 {health:25.5,armour:100,amount:25,flag:false,want:{health:.5,armour:100}},
 {health:25.5,armour:100,amount:26,flag:false,want:{health:0,armour:100}},
 {health:100,armour:100,amount:-25,flag:true,want:{health:100,armour:125}},
 {health:100,armour:100,amount:-25,flag:false,want:{health:125,armour:100}},
])('DAMAGE_CHAR follows its direct subtraction branches: %j',row=>{
 expect(scriptPedDamage(row.health,row.armour,row.amount,row.flag)).toEqual(row.want);
});
test('script damage writes float32 fields, independently of the ordinary below-one death boundary',()=>{
 expect(scriptPedDamage(Math.fround(25.1),0,25,false)).toEqual({health:Math.fround(Math.fround(25.1)-25),armour:0});
});
test('player script damage bypasses damage protection/stats without a weapon event or last-weapon change',()=>{
 const sim=new Simulation();try{
  sim.playerCanBeDamaged=false;sim.playerProofs={bullet:true,fire:true,explosion:true,collision:true,melee:true};sim.lastWeaponDamage=34;sim.player.armour=100;
  const pain=vi.fn();sim.onPlayerPain=pain;sim.damagePlayerFromScript(25,true);
  expect(sim.player).toMatchObject({health:100,armour:75});sim.damagePlayerFromScript(25,false);
  expect(sim.player).toMatchObject({health:75,armour:75});expect(sim.damageEvents).toEqual([]);expect(sim.lastWeaponDamage).toBe(34);expect(pain).not.toHaveBeenCalled();
 }finally{sim.dispose();}
});
test('positive fractional player health survives the command, while zero uses the scripted die bridge once',()=>{
 const sim=new Simulation();try{
  sim.player.health=25.5;sim.player.armour=100;sim.playerCanBeDamaged=false;sim.damagePlayerFromScript(25,false);
  expect(sim.player.health).toBe(.5);expect(sim.deathRemaining).toBe(0);expect(sim.damageEvents).toEqual([]);
  sim.damagePlayerFromScript(1,false);expect(sim.player.health).toBe(0);expect(sim.player.armour).toBe(100);expect(sim.deathRemaining).toBeGreaterThan(0);expect(sim.damageEvents).toHaveLength(1);
  sim.damagePlayerFromScript(1,false);expect(sim.damageEvents).toHaveLength(1);
 }finally{sim.dispose();}
});
