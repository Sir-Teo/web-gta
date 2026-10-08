import { expect, test } from 'vitest';
import { decideDamageResponse, applyDamageResponse } from '../src/ped/brain';

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
