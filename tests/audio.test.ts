import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { DEFAULT_AUDIO, parseAudioSettings } from '../src/audio/settings';
import { ambienceSamples } from '../src/audio/synthesis';
import { SoundEvents, footSurface } from '../src/audio/events';
import { Simulation, type Controls } from '../src/simulation/Simulation';

let sim: Simulation | undefined;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { sim?.dispose(); sim = undefined; });
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, handbrake: false, cameraYaw: 0 };
test('invalid stored settings cannot make levels non-finite or louder than the volume range', () => {
  expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO);
  expect(parseAudioSettings({ master: NaN, effects: Infinity, ambience: 'loud', muted: 'false' })).toEqual(DEFAULT_AUDIO);
  expect(parseAudioSettings({ master: 4, effects: -1, ambience: 0.25, muted: true })).toEqual({ master: 1, effects: 0, ambience: 0.25, muted: true });
});
test('procedural loops are repeatable and bounded, with silent splice endpoints', () => {
  for (const kind of ['wind', 'crickets', 'horn'] as const) {
    const samples = ambienceSamples(44100, kind);
    expect(samples).toEqual(ambienceSamples(44100, kind));
    expect(samples.length).toBe(88200); expect(samples[0]).toBeCloseTo(0); expect(samples.at(-1)).toBeCloseTo(0);
    expect(samples.every(sample => Number.isFinite(sample) && Math.abs(sample) < 0.5)).toBe(true);
  }
});
test('steps follow grounded motion and reset does not replay old footsteps', () => {
  sim = new Simulation(); const events = new SoundEvents(); events.reset(sim);
  let steps = 0;
  for (let i = 0; i < 120; i++) {
    sim.step(1 / 60, { ...idle, y: 1 });
    steps += events.observe(sim).filter(e => e.sound.startsWith('step') && e.gain === 0.32).length;
  }
  expect(steps).toBeGreaterThan(3); expect(steps).toBeLessThan(9);
  events.reset(sim); expect(events.observe(sim)).toEqual([]);
  sim.player.grounded = false; sim.player.verticalSpeed = 3; sim.player.phase += Math.PI;
  expect(events.observe(sim).filter(e => e.gain === 0.32)).toEqual([]);
});
test('a completed door cycle emits one opening and one closing event', () => {
  sim = new Simulation(); const events = new SoundEvents(); events.reset(sim);
  const doorEvents: string[] = [];
  for (const door of [0, 0.01, 0.1, 0.5, 1, 1, 0.5, 0.01, 0, 0]) {
    sim.vehicles[0].door = door;
    doorEvents.push(...events.observe(sim).filter(e => e.sound.startsWith('door')).map(e => e.sound));
  }
  expect(doorEvents).toEqual(['door-open', 'door-close']);
  expect(footSurface({ x: 0, y: 0, z: 5 })).toBe('concrete');
  expect(footSurface({ x: 35, y: 0, z: 40 })).toBe('grass');
});
