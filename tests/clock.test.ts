import { describe, expect, it } from 'vitest';
import { FixedClock, NATIVE_MAX_FRAME_SECONDS } from '../src/core/FixedClock';

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
  it('holds a slow frame to CTimer\'s three 50 Hz frames, playing slower instead of taking more steps', () => {
    const clock = new FixedClock(NATIVE_MAX_FRAME_SECONDS);
    // A phone drawing five frames a second: never more than four 60 Hz steps a frame, so the world runs slower.
    for (let i = 0; i < 50; i++) { let steps = 0; clock.advance(0.2, () => steps++); expect(steps).toBeLessThanOrEqual(4); }
    expect(clock.tick / 60).toBeGreaterThan(50 * 0.06 - 1 / 60);
    expect(clock.tick / 60).toBeLessThan(50 * 0.2 / 2);
    // At the frame limiter's 30 a second it keeps real time, as the default does.
    const steady = new FixedClock(NATIVE_MAX_FRAME_SECONDS);
    for (let i = 0; i < 300; i++) steady.advance(1 / 30, () => {});
    expect(steady.tick).toBe(600);
  });
});
