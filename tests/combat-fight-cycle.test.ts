import { expect, test } from 'vitest';
import { NATIVE_MELEE_COMBOS, FightCycle, tryBlock, tryDodge } from '../src/combat/meleeChain';

const UNARMED = NATIVE_MELEE_COMBOS.UNARMED;

test('fight cycle crosses windup->hit->recover->done on melee.dat frames', () => {
  const c = new FightCycle(UNARMED, 0, false, false);
  expect(c.phase).toBe('windup');
  expect(c.update(0.05)).toBe('windup');
  expect(c.update(0.2)).toBe('hit');
  expect(c.update(0.05)).toBe('recover');
  expect(c.update(1)).toBe('done');
  expect(c.phase).toBe('done');
});

test('block and dodge stay unreversed stubs', () => {
  expect(tryBlock(1, 1)).toBe(false);
  expect(tryDodge(1)).toBe(false);
});
