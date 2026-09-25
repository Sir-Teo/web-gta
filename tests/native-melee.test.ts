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
  // melee.dat CHAINSAW: 50/60/100 on frames 14/14/13, the ground attack 25 and the moving attack 25.
  const saw=meleeComboFor('CHAINSAW')!;
  expect(saw.stages.map(s => s.damage)).toEqual([50, 60, 100]);
  expect(saw.stages.map(s => Math.round(s.hit * 30))).toEqual([14, 14, 13]);
  expect(saw.ground.damage).toBe(25);expect(saw.moving.damage).toBe(25);
  expect(meleeComboFor('SKATEBOARD')).toBeUndefined();
});

test('lock-on prefers the ped closest to the camera line', () => {
  const origin = { x: 0, z: 0 }, fwd = { x: 0, z: 1 };
  const ahead = attackLineDistance(origin, fwd, { x: 0.1, z: 5 }, false);
  const side = attackLineDistance(origin, fwd, { x: 5, z: 5 }, false);
  expect(ahead).toBeLessThan(side);
});

test('the gym styles are melee.dat UNARMED_2 to UNARMED_4, and only they change the fists', async () => {
  const { fightingStyleCombo, MELEE_SWING_CLIPS } = await import('../src/simulation/nativeMelee');
  const { WeaponInventory } = await import('../src/weapons/Inventory');
  expect(NATIVE_MELEE_COMBOS.UNARMED_2.stages.map(s => s.damage)).toEqual([10, 7, 16]);
  expect(NATIVE_MELEE_COMBOS.UNARMED_3.stages[0].hit).toBeCloseTo(9 / 30, 6);
  expect(NATIVE_MELEE_COMBOS.UNARMED_4.stages[2].damage).toBe(200);
  expect([4, 5, 6, 7, 15, 16].map(fightingStyleCombo)).toEqual(['UNARMED', 'UNARMED_2', 'UNARMED_3', 'UNARMED_4', 'UNARMED', 'UNARMED']);
  expect(MELEE_SWING_CLIPS.UNARMED_3).toMatchObject({ file: 'fight_c', attacks: ['FightC_1', 'FightC_2', 'FightC_3'], hits: ['HitC_1', 'HitC_2', 'HitC_3'] });
  const inventory = new WeaponInventory();
  // CPlayerPed starts on STYLE_GRAB_KICK with every move; his fists punch the standard combo.
  expect([inventory.fightingStyle, inventory.allowedAttackMoves]).toEqual([15, 15]);
  inventory.fightingStyle = 5;
  expect(inventory.meleeCombo(0)).toBe('UNARMED_2');
  expect(inventory.meleeCombo(1)).toBe('UNARMED_2');
  // A bat keeps its own combo whatever the style.
  expect(inventory.meleeCombo(5)).toBe(inventory.info(5)?.baseCombo);
});
