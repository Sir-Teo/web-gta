import { afterEach, beforeAll, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { DEFAULT_AUDIO, parseAudioSettings } from '../src/audio/settings';
import { SoundEvents } from '../src/audio/events';
import { Simulation, type Controls } from './helpers/groundedSimulation';

let sim: Simulation | undefined;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => { sim?.dispose(); sim = undefined; });
const idle: Controls = { x: 0, y: 0, sprint: false, jump: false, cameraYaw: 0 };
test('invalid stored settings cannot make levels non-finite or louder than the volume range', () => {
  expect(parseAudioSettings(null)).toEqual(DEFAULT_AUDIO);
  expect(parseAudioSettings({ master: NaN, effects: Infinity, ambience: 'loud', muted: 'false' })).toEqual(DEFAULT_AUDIO);
  expect(parseAudioSettings({ master: 4, effects: -1, ambience: 0.25, muted: true })).toEqual({ master: 1, effects: 0, muted: true });
});
test('steps follow grounded motion and reset does not replay old footsteps', () => {
  sim = new Simulation(); const events = new SoundEvents(); events.reset(sim);
  let steps = 0;
  for (let i = 0; i < 120; i++) {
    sim.step(1 / 60, { ...idle, y: 1 });
    steps += events.observe(sim).filter(e => e.sound.startsWith('step') && e.gain === 0.32).length;
  }
  // Default locomotion is now native run (5.706 m/s, was authored 3.7):
  // phase rate speed*2.8 gives ~10 crossings in 2 s, up from ~6.6.
  expect(steps).toBeGreaterThan(5); expect(steps).toBeLessThan(14);
  events.reset(sim); expect(events.observe(sim)).toEqual([]);
  sim.player.grounded = false; sim.player.verticalSpeed = 3; sim.player.phase += Math.PI;
  expect(events.observe(sim).filter(e => e.gain === 0.32)).toEqual([]);
});
test('a landing sounds at touchdown, native landing contacts replace the gait steps, and ordinary cadence returns',()=>{
 sim=new Simulation();const events=new SoundEvents();
 sim.player.grounded=false;sim.player.verticalSpeed=-5;events.reset(sim);
 sim.player.grounded=true;sim.player.speed=3;sim.player.phase+=Math.PI;
 // Touchdown: the landing sounds on its own (TaskComplexInAirAndLand) before the land clip's feet touch.
 const touchdown=events.observe(sim,true,[]);
 expect(touchdown).toHaveLength(1);expect(touchdown[0].landed).toBe(true);expect(touchdown[0].landingOnly).toBe(true);
 sim.player.phase+=Math.PI;
 const contacts=events.observe(sim,true,['right','left']);
 expect(contacts).toHaveLength(2);expect(contacts.map(e=>e.gain)).toEqual([.5,.5]);
 expect(contacts.map(e=>e.sound)).toEqual(['step-concrete-0','step-concrete-1']);
 expect(events.observe(sim,true,[])).toEqual([]);
 sim.player.phase+=Math.PI;expect(events.observe(sim)[0].gain).toBe(.32);
 events.reset(sim);expect(events.observe(sim)).toEqual([]);
});

test('player collision surface selects the native category for normal and landing steps',()=>{
 sim=new Simulation();sim.player.grounded=true;sim.player.speed=2;sim.player.position={x:0,y:0,z:0};
 const events=new SoundEvents();events.reset(sim);sim.player.phase+=Math.PI;
 expect(events.observe(sim,true,undefined,'grass')[0].sound).toBe('step-grass-0');
 sim.player.position={x:35,y:0,z:40};
 expect(events.observe(sim,true,['right'],'concrete')[0].sound).toBe('step-concrete-1');
});
