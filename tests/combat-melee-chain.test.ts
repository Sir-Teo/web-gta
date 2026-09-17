import { expect, test } from 'vitest';
import {
  NATIVE_MELEE_COMBOS,
  nextChainIndex,
  resolveStrike,
  inStrikeCone,
  MeleeSwing,
} from '../src/combat/meleeChain';

const UNARMED = NATIVE_MELEE_COMBOS.UNARMED;

test('landed strikes chain jab->cross->hook, whiffs reset to jab', () => {
  expect(nextChainIndex(0, 0.1, UNARMED.stages[0].chain)).toBe(1);
  expect(nextChainIndex(1, 0.1, UNARMED.stages[1].chain)).toBe(2);
  expect(nextChainIndex(2, 0.1, UNARMED.stages[2].chain)).toBe(0);
  expect(nextChainIndex(0, 99, UNARMED.stages[0].chain)).toBe(0);
});

test('strike resolution matches melee.dat damage and hit frames', () => {
  expect(resolveStrike(UNARMED, { stage: 0, moving: false, victimDown: false }).damage).toBe(6);
  expect(resolveStrike(UNARMED, { stage: 1, moving: false, victimDown: false }).damage).toBe(9);
  expect(resolveStrike(UNARMED, { stage: 2, moving: false, victimDown: false })).toMatchObject({
    damage: 15,
    finisher: true,
  });
  expect(
    resolveStrike(UNARMED, { stage: 0, moving: false, victimDown: true }).damage,
  ).toBe(25);
  expect(
    resolveStrike(UNARMED, { stage: 1, moving: true, victimDown: false }).damage,
  ).toBe(5);
  expect(resolveStrike(UNARMED, { stage: 0, moving: false, victimDown: false }).delay).toBeCloseTo(
    5 / 30,
    6,
  );
});

test('strike cone rejects targets behind the striker', () => {
  expect(inStrikeCone(0, 1, 0, 1)).toBe(true);
  expect(inStrikeCone(0, -1, 0, 1)).toBe(false);
});

test('melee swing fires once on the hit frame', () => {
  const swing = new MeleeSwing(resolveStrike(UNARMED, { stage: 0, moving: false, victimDown: false }));
  expect(swing.update(0.05)).toBe('pending');
  expect(swing.update(0.2)).toBe('hit');
  expect(swing.update(0.2)).toBe('pending');
});
