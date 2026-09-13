import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { imgFixture } from './fixtures/native-assets';
import { readScene } from '../src/assets/scene';
const model = new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'));
const texture = new Uint8Array(readFileSync('tests/fixtures/dragonff-model-textures.txd'));
const file = new File([imgFixture([{ name: 'first.dff', bytes: model }, { name: 'second.dff', bytes: model }, { name: 'shared.txd', bytes: texture }]) as BlobPart], 'scene.img');
const associations = ['first', 'second'].map((model, i) => ({ model, id: i + 1, dictionary: 'shared', section: 'objs' }));
const placementFile = new File(['inst\n1 first 0 0 0 0 0 0 0 1 -1\n1 first 0 10 0 0 0 0 0 1 -1\n2 second 0 20 0 0 0 0 0 1 -1\n3 absent 0 30 0 0 0 0 0 1 -1\nend'], 'scene.ipl');
test('scene assembly resolves multiple model types, groups repeats and reports omissions', async () => {
  const result = await readScene({ file, placementFile, associations, parents: [], interior: 0 });
  expect(result.scene.map(p => [p.name, p.placements.length, p.textures.length])).toEqual([['first', 2, 1], ['second', 1, 1]]);
  expect(result.scene[0].textures[0]).toBe(result.scene[1].textures[0]);
  expect(result.requested).toBe(4); expect(result.omitted).toBe(1); expect(result.notices.join(' ')).toContain('Missing model: absent.dff');
});
test('scene assembly rejects ambiguous IDs and empty interiors, and reports absent dictionaries', async () => {
  await expect(readScene({ file, placementFile, associations: [associations[0], { ...associations[1], id: 1 }], parents: [], interior: 0 })).rejects.toThrow('Ambiguous');
  await expect(readScene({ file, placementFile, associations, parents: [], interior: 4 })).rejects.toThrow('placements');
  const result = await readScene({ file, placementFile, associations: [], parents: [], interior: 0 });
  expect(result.scene[0].notices.join(' ')).toContain('Missing dictionary: first.txd');
  expect(result.scene[0].notices.join(' ')).toContain('Unbound textures');
});
