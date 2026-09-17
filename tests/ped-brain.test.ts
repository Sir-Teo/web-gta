import { expect, test } from 'vitest';
import { decideDamageResponse, applyDamageResponse, hitReactionTask, fightTask, TaskStack } from '../src/ped/brain';

test('temper 60+ fights, others flee, officers never brawl', () => {
  expect(decideDamageResponse({ temper: 70, officer: false, alreadyFighting: false, healthAfter: 80 }).valueOf()).toBe('fight');
  expect(decideDamageResponse({ temper: 10, officer: false, alreadyFighting: false, healthAfter: 80 })).toBe('flee');
  expect(decideDamageResponse({ temper: 10, officer: false, alreadyFighting: true, healthAfter: 80 })).toBe('fight');
  expect(decideDamageResponse({ temper: 90, officer: true, alreadyFighting: false, healthAfter: 80 })).toBe('none');
});

test('damage response writes retaliate/flee timers', () => {
  const s = { retaliate: 0, flee: 0 };
  applyDamageResponse(s, 'fight');
  expect(s.retaliate).toBe(6);
  expect(s.flee).toBe(0);
  const t = { retaliate: 0, flee: 0 };
  applyDamageResponse(t, 'flee');
  expect(t.flee).toBe(8);
});

test('hit and fight tasks complete on schedule', () => {
  const stack = new TaskStack<{ dt: number }>();
  const ctx = { dt: 0 };
  stack.push(hitReactionTask(), ctx, 0);
  expect(stack.update(ctx, 0.4, 0)).toBe('running');
  expect(stack.update(ctx, 0.2, 0)).toBe('done');
  stack.push(fightTask(), ctx, 0);
  expect(stack.update(ctx, 5.9, 0)).toBe('running');
  expect(stack.update(ctx, 0.2, 0)).toBe('done');
});
