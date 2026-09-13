import { describe, expect, test } from 'vitest';
import { CLEAR_TIME_KEYS, GAME_MINUTES_PER_SECOND, sampleTimecycle, wrapMinutes } from '../src/world/timecycle';

describe('time cycle', () => {
  test('wraps at midnight and follows the reference clock rate', () => {
    expect(wrapMinutes(1439.5 + GAME_MINUTES_PER_SECOND)).toBe(0.5);
    expect(wrapMinutes(-1)).toBe(1439);
    expect(sampleTimecycle(1440)).toEqual(sampleTimecycle(0));
  });
  test('remains continuous at every time sample, including midnight', () => {
    for (const key of CLEAR_TIME_KEYS) {
      const before = sampleTimecycle(key.hour * 60 - 0.001), after = sampleTimecycle(key.hour * 60 + 0.001);
      for (const field of ['top', 'horizon', 'ambient', 'ground', 'sun'] as const) {
        after[field].forEach((c, i) => expect(Math.abs(c - before[field][i])).toBeLessThan(0.0001));
      }
      expect(Math.abs(before.night - after.night)).toBeLessThan(0.0001);
      expect(Math.abs(before.sunIntensity - after.sunIntensity)).toBeLessThan(0.0001);
      expect(Math.hypot(before.direction.x - after.direction.x, before.direction.y - after.direction.y, before.direction.z - after.direction.z)).toBeLessThan(0.0001);
    }
  });
  test('daylight and artificial light trade places without negative values over a full day', () => {
    for (let minute = 0; minute < 1440; minute++) {
      const s = sampleTimecycle(minute);
      expect(s.night).toBeGreaterThanOrEqual(0); expect(s.night).toBeLessThanOrEqual(1);
      expect(s.sunIntensity).toBeGreaterThanOrEqual(0);
      expect(Math.hypot(s.direction.x, s.direction.y, s.direction.z)).toBeCloseTo(1);
    }
    const noon = sampleTimecycle(720), midnight = sampleTimecycle(0);
    expect(noon.sunIntensity).toBeGreaterThan(2); expect(noon.night).toBe(0);
    expect(midnight.sunIntensity).toBe(0); expect(midnight.night).toBe(1);
    expect(midnight.ambientIntensity).toBeLessThan(noon.ambientIntensity);
  });
});
