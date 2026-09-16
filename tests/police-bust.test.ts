import { expect, test } from 'vitest';
import { bustPullProgress, BUST_PULL_RANGE, BUST_PULL_SECONDS } from '../src/simulation/WorldPolice';

test('bust pull accumulates door-hold time and resets on any gap', () => {
  expect(BUST_PULL_RANGE).toBe(3.5);
  expect(BUST_PULL_SECONDS).toBe(1.5);
  let progress = 0;
  progress = bustPullProgress(progress, 0.5, true);
  progress = bustPullProgress(progress, 0.5, true);
  expect(progress).toBeCloseTo(1.0, 6);
  expect(bustPullProgress(progress, 0.5, false)).toBe(0);
  progress = bustPullProgress(0, 1.0, true);
  expect(bustPullProgress(progress, 0.5, true)).toBeGreaterThanOrEqual(BUST_PULL_SECONDS);
});
