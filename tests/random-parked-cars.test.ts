import { expect, test } from 'vitest';
import { resolveRandomParkedRecord } from '../src/simulation/WorldFleet';
import type { WorldCarGenerator } from '../src/assets/worldCarGenerators';

const record = (modelId: number): WorldCarGenerator => ({ id: 'test:0', source: 'test', sourceIndex: 0, position: [0, 0, 0], angle: 0, modelId, primaryColor: -1, secondaryColor: -1, flags: 0, alarmChance: 0, doorLockChance: 0, minDelay: 0, maxDelay: 0 });

test('random-model generators resolve through the membership pool', () => {
  expect(resolveRandomParkedRecord(record(100), [1, 2])).toBeUndefined();
  expect(resolveRandomParkedRecord(record(-1), [])).toBeUndefined();
  const picked = resolveRandomParkedRecord(record(-1), [492, 404, 551], () => 0.5);
  expect(picked?.modelId).toBe(404);
  expect(picked?.id).toBe('test:0');
  expect(resolveRandomParkedRecord(record(-1), [492], () => 0.99)?.modelId).toBe(492);
});

test('PickRandomCar draws by frequency among the normal, family and motorbike classes, and skips crowded or suppressed models', async () => {
  const { pickRandomCar } = await import('../src/simulation/WorldFleet');
  const models: Record<number, { vehicleClass: string; frequency: number; suppressed: boolean; instances: number }> = {
    1: { vehicleClass: 'normal', frequency: 10, suppressed: false, instances: 0 },
    2: { vehicleClass: 'motorbike', frequency: 30, suppressed: false, instances: 0 },
    3: { vehicleClass: 'executive', frequency: 100, suppressed: false, instances: 0 },
    4: { vehicleClass: 'poorfamily', frequency: 20, suppressed: true, instances: 0 },
    5: { vehicleClass: 'richfamily', frequency: 40, suppressed: false, instances: 3 },
  };
  const info = (id: number) => models[id];
  // Only 1, 2, 4 and 5 are eligible (sum 100). A draw of 10 is still model 1 (its frequency reaches it); 11 moves on.
  expect(pickRandomCar([1, 2, 3, 4, 5], info, () => .10, true, true)).toBe(1);
  expect(pickRandomCar([1, 2, 3, 4, 5], info, () => .11, true, true)).toBe(2);
  expect(pickRandomCar([1, 2, 3, 4, 5], info, () => .40, true, true)).toBe(2);
  // The executive class never takes part in a normal pick.
  expect(pickRandomCar([3], info, () => .5, true, true)).toBeUndefined();
  // A suppressed draw, or one of a model already three times in the world, is redrawn; ten misses give nothing.
  let n = 0; const draws = [.5, .95, .2];
  expect(pickRandomCar([1, 2, 3, 4, 5], info, () => draws[n++] ?? .2, true, true)).toBe(2);
  expect(pickRandomCar([4, 5], info, () => .9, true, true)).toBeUndefined();
  expect(pickRandomCar([5], info, () => .9, false, true)).toBe(5);
});
