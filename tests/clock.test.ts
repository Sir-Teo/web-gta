import { describe, expect, it } from 'vitest';
import { FixedClock } from '../src/core/FixedClock';

describe('fixed simulation time', () => {
  it('travels the same distance at 30, 60, and 144 render frames per second', () => {
    const distances = [30, 60, 144].map(fps => {
      const clock = new FixedClock(); let distance = 0;
      for (let i = 0; i < fps * 10; i++) clock.advance(1 / fps, dt => distance += dt * 5);
      expect(clock.tick).toBe(600);
      return distance;
    });
    for (const distance of distances) expect(distance).toBeCloseTo(50, 6);
  });
  it('does not catch up a hidden tab or run unbounded work after a stall', () => {
    const clock = new FixedClock();
    clock.advance(100, () => {});
    expect(clock.tick).toBe(6);
    clock.reset();
    expect(clock.advance(0, () => {})).toBe(0);
  });
});
