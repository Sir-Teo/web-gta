import { expect, test } from 'vitest';
import { scaleBlow, playerPunchDamage, npcPunchDamage, PLAYER_ATTACK_MULT } from '../src/ped/damage';

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
