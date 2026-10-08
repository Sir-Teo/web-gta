import { expect, test } from 'vitest';
import { roadblockAllowed } from '../src/police/nativeRoadBlocks';

test('roadblocks stand from three stars', () => {
  expect(roadblockAllowed(2)).toBe(false);
  expect(roadblockAllowed(3)).toBe(true);
});
