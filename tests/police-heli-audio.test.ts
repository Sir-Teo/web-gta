import { expect, test } from 'vitest';
import { worldPlaneAudioInput } from '../src/audio/native/worldVehicleAudio';

const stub = (over: Record<string, unknown>) => ({
  health: 800, occupied: false, policeHeli: false, autopilot: undefined, throttle: 0,
  body: { translation: () => ({ x: 0, y: 30, z: 0 }), linvel: () => ({ x: 0, y: 0, z: 0 }), rotation: () => ({ x: 0, y: 0, z: 0, w: 1 }) },
  ...over,
}) as any;

test('a scripted police airframe runs its engine off the autopilot collective', () => {
  const pad = { accelerate: 0, brake: 0 };
  expect(worldPlaneAudioInput(stub({}), true, pad).engineOn).toBe(false);
  expect(worldPlaneAudioInput(stub({ occupied: true, throttle: 0.6 }), true, pad).engineOn).toBe(true);
  expect(worldPlaneAudioInput(stub({ policeHeli: true, autopilot: { throttle: 0.5, pitch: 0, roll: 0, rudder: 0, brake: false }, throttle: 0.5 }), true, pad).engineOn).toBe(true);
  expect(worldPlaneAudioInput(stub({ policeHeli: true, throttle: 0 }), true, pad).engineOn).toBe(false);
  expect(worldPlaneAudioInput(stub({ policeHeli: true, autopilot: { throttle: 0.5, pitch: 0, roll: 0, rudder: 0, brake: false }, throttle: 0.5, health: 0 }), true, pad).engineOn).toBe(false);
});
