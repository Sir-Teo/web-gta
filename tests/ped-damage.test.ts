import { expect, test } from 'vitest';
import { scaleBlow, playerPunchDamage, npcPunchDamage, PLAYER_ATTACK_MULT } from '../src/ped/damage';

test('pedstats scaling: attacker strength times victim defend', () => {
  expect(scaleBlow(10, 1, 1)).toBe(10);
  expect(scaleBlow(10, 2, 0.5)).toBe(10);
  expect(playerPunchDamage(9, 1)).toBeCloseTo(9 * PLAYER_ATTACK_MULT, 6);
  expect(npcPunchDamage(10, 1.2)).toBeCloseTo(12, 6);
});
