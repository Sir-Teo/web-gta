import { expect, test } from 'vitest';
import { NATIVE_UNARMED_STAGES, NATIVE_UNARMED_GROUND_DAMAGE, NATIVE_UNARMED_MOVING_DAMAGE, NATIVE_MELEE_COMBOS, meleeComboFor, attackLineDistance } from '../src/simulation/nativeMelee';

test('unarmed stages match melee.dat UNARMED_1 hit/chain/damage', () => {
  expect(NATIVE_UNARMED_STAGES).toHaveLength(3);
  expect(NATIVE_UNARMED_STAGES[0]).toMatchObject({ damage: 6 });
  expect(NATIVE_UNARMED_STAGES[1]).toMatchObject({ damage: 9 });
  expect(NATIVE_UNARMED_STAGES[2]).toMatchObject({ damage: 15 });
  expect(NATIVE_UNARMED_STAGES[0].hit).toBeCloseTo(5 / 30, 6);
  expect(NATIVE_UNARMED_STAGES[0].chain).toBeCloseTo(10 / 30, 6);
  expect(NATIVE_UNARMED_STAGES[2].chain).toBeCloseTo(20 / 30, 6);
  expect(NATIVE_UNARMED_GROUND_DAMAGE).toBe(25);
  expect(NATIVE_UNARMED_MOVING_DAMAGE).toBe(5);
});

test('weapon combos resolve through the weapon.dat baseCombo rows', () => {
  expect(meleeComboFor('UNARMED')).toBe(NATIVE_MELEE_COMBOS.UNARMED);
  expect(meleeComboFor('BBALLBAT')?.stages.map(s => s.damage)).toEqual([18, 18, 25]);
  expect(meleeComboFor('KNIFE')?.stages.map(s => s.damage)).toEqual([10, 10, 25]);
  expect(meleeComboFor('SWORD')?.stages.map(s => s.damage)).toEqual([10, 15, 25]);
  expect(meleeComboFor('DILDO')?.stages.map(s => s.damage)).toEqual([18, 18, 25]);
  expect(meleeComboFor('FLOWERS')?.stages.map(s => s.damage)).toEqual([18, 18, 25]);
  for (const combo of Object.values(NATIVE_MELEE_COMBOS)) expect(combo.range).toBe(1.6);
  expect(meleeComboFor(undefined)).toBeUndefined();
  expect(meleeComboFor('CHAINSAW')).toBeUndefined();
  expect(meleeComboFor('SKATEBOARD')).toBeUndefined();
});

test('lock-on prefers the ped closest to the camera line', () => {
  const origin = { x: 0, z: 0 }, fwd = { x: 0, z: 1 };
  const ahead = attackLineDistance(origin, fwd, { x: 0.1, z: 5 }, false);
  const side = attackLineDistance(origin, fwd, { x: 5, z: 5 }, false);
  expect(ahead).toBeLessThan(side);
});
