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
