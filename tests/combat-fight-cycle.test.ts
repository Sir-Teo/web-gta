import { expect, test } from 'vitest';
import { NATIVE_MELEE_COMBOS, FightCycle, tryBlock, tryDodge } from '../src/combat/meleeChain';
import { PedTaskAdapter } from '../src/ped/brain';

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

test('ped task adapter mirrors legacy timers without touching them', () => {
  const a = new PedTaskAdapter();
  expect(a.syncFromTimers({ retaliate: 0, flee: 0, down: 0, stagger: 0 }, 0)).toBe('wander');
  expect(a.syncFromTimers({ retaliate: 5, flee: 0, down: 0, stagger: 0 }, 0)).toBe('fight');
  expect(a.syncFromTimers({ retaliate: 0, flee: 5, down: 0, stagger: 0 }, 1)).toBe('flee');
  expect(a.syncFromTimers({ retaliate: 0, flee: 0, down: 2, stagger: 0 }, 2)).toBe('downed');
});
