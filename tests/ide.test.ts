import { expect, test } from 'vitest';
import { readIdeAssociations, mergeIdeAssociations } from '../src/assets/ide';
test('IDE associations preserve source IDs and names across supported sections and ignore unrelated records', () => {
  const records = readIdeAssociations('\uFEFF# diagnostic\r\nobjs\r\n100, Building, Shared, 200, 0 # comment\r\nend\r\n2dfx\ninvalid association data\nend\nhier\n101 tree foliage\nend');
  expect(records).toEqual([{ id: 100, model: 'Building', dictionary: 'Shared', section: 'objs' }, { id: 101, model: 'tree', dictionary: 'foliage', section: 'hier' }]);
  expect(mergeIdeAssociations(records).get('building')?.dictionary).toBe('Shared');
});
test('IDE conflicts reject ambiguous dictionary selection but allow repeated equivalent associations', () => {
  const a = readIdeAssociations('objs\n1 House Shared 100 0\nend');
  expect(mergeIdeAssociations([...a, ...readIdeAssociations('tobj\n2 house SHARED 100 0 6 18\nend')]).size).toBe(1);
  expect(() => mergeIdeAssociations([...a, ...readIdeAssociations('objs\n2 house Different 100 0\nend')])).toThrow('Conflicting IDE');
});
test('IDE association reader rejects malformed identifiers, names and excessive input', () => {
  for (const row of ['-1 house txd', '1e2 house txd', '65536 house txd', '1 ../house txd', '1 house']) expect(() => readIdeAssociations(`objs\n${row}\nend`)).toThrow();
  expect(() => readIdeAssociations(' '.repeat(4 * 1024 * 1024 + 1))).toThrow('limit');
});
