import { expect, test } from 'vitest';
import { scaleBlow, playerPunchDamage, npcPunchDamage, PLAYER_ATTACK_MULT,spendPedArmour } from '../src/ped/damage';

test.each([22,38,51,0])('armour absorbs stat-scaled weapon %s damage before health',weapon=>{
 expect(spendPedArmour(25,50,weapon)).toEqual({armour:25,damageHealth:0,damageArmour:25});
 expect(spendPedArmour(60,50,weapon)).toEqual({armour:0,damageHealth:10,damageArmour:50});
 expect(spendPedArmour(50,50,weapon)).toEqual({armour:0,damageHealth:0,damageArmour:50});
});
test.each([53,54])('weapon %s bypasses armour',weapon=>{
 expect(spendPedArmour(25,50,weapon)).toEqual({armour:50,damageHealth:25,damageArmour:0});
});

test('pedstats scaling: attacker strength times victim defend', () => {
  expect(scaleBlow(10, 1, 1)).toBe(10);
  expect(scaleBlow(10, 2, 0.5)).toBe(10);
  expect(playerPunchDamage(9, 1)).toBeCloseTo(9 * PLAYER_ATTACK_MULT, 6);
  expect(npcPunchDamage(10, 1.2)).toBeCloseTo(12, 6);
});

test('ComputeWillKillPed kills a ped left under 1 HP',async()=>{
 const {healthAfter}=await import('../src/simulation/WorldPedestrians');
 expect(healthAfter(100,99.5)).toBe(0);expect(healthAfter(100,99)).toBe(1);expect(healthAfter(10,25)).toBe(0);expect(healthAfter(50,20)).toBe(30);
});
