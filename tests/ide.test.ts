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

test('texture-parent definitions form child-first chains and reject cycles or conflicts', async () => {
  const { readIdeParents, mergeIdeParents, textureDictionaryChain } = await import('../src/assets/ide');
  const links = readIdeParents('objs\n1 model child 100 0\nend\ntxdp\nChild, Parent # comment\nparent Root\nend');
  expect(textureDictionaryChain('CHILD', mergeIdeParents(links))).toEqual(['child', 'parent', 'root']);
  expect(() => mergeIdeParents([...links, ['root', 'child']])).toThrow('Cyclic');
  expect(() => mergeIdeParents([...links, ['child', 'other']])).toThrow('Conflicting');
  expect(() => readIdeParents('txdp\nchild ../parent\nend')).toThrow('Invalid');
  expect(() => textureDictionaryChain('0', new Map(Array.from({ length: 32 }, (_, i) => [String(i), String(i + 1)])))).toThrow('32 dictionaries');
});
