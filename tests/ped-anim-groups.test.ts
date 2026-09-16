import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readPedAnimGroups, pedLocomotion, clipRootSpeed } from '../src/assets/pedAnimGroups';
import type { AnimationPackage } from '../src/assets/ifp';

const ANIMGRP = `# native walkcycle groups
man, ped, walkcycle, 6
\twalk_civi
\trun_civi
\tsprint_panic
\tidle_stance
\troadcross
\twalk_start
end

gang1, ped, walkcycle, 6
\twalk_gang1
\trun_gang1
\tsprint_panic
\tidle_gang1
\troadcross_gang
\twalk_start
end
`;

function clip(name: string, duration: number, dx: number): any {
  return { name, flags: 0, duration, tracks: [{ name: 'Root', boneId: 0, frameType: 2, times: new Float32Array([0, duration]), rotations: new Float32Array(8), translations: new Float32Array([0, 0, 0, dx, 0, 0]) }] };
}

const pack: AnimationPackage = { format: 'ANP2', name: 'ped', animations: [clip('walk_civi', 1.133, 1.725), clip('run_civi', 0.733, 3.156), clip('sprint_panic', 0.6, 3.542), clip('idle_stance', 2, 0), clip('walk_gang1', 1.0, 1.4), clip('run_gang1', 0.7, 2.9), clip('idle_gang1', 2, 0)] } as unknown as AnimationPackage;

test('animgrp walkcycle groups resolve to clip names', () => {
  const groups = readPedAnimGroups(ANIMGRP);
  expect(groups.get('man')).toMatchObject({ walk: 'walk_civi', run: 'run_civi', sprint: 'sprint_panic', idle: 'idle_stance' });
  expect(groups.get('gang1')).toMatchObject({ walk: 'walk_gang1', idle: 'idle_gang1' });
});

test('variant locomotion derives root-motion speeds', () => {
  const groups = readPedAnimGroups(ANIMGRP);
  const man = pedLocomotion(pack, groups.get('man')!);
  expect(man.speeds.walk).toBeCloseTo(1.725 / 1.133, 3);
  expect(man.speeds.run).toBeCloseTo(3.156 / 0.733, 3);
  const gang = pedLocomotion(pack, groups.get('gang1')!);
  expect(gang.speeds.walk).toBeCloseTo(1.4, 3);
  expect(gang.walk.clip.name).toBe('walk_gang1');
});

test('root speed requires a translated root and motion', () => {
  expect(() => clipRootSpeed({ name: 'idle', duration: 2, tracks: [] } as any)).toThrow();
  expect(() => pedLocomotion(pack, { group: 'missing', walk: 'nope', run: 'run_civi', sprint: 'sprint_panic', idle: 'idle_stance' })).toThrow();
});

test('the shipped animgrp.dat parses with all native walkcycle variants', async () => {
  const groups = readPedAnimGroups(await readFile('public/play/world/files/data/animgrp.dat', 'utf8'));
  for (const name of ['man', 'gang1', 'gang2', 'swat', 'woman', 'sexywoman', 'oldman', 'fatman', 'oldwoman', 'oldfatwoman']) {
    expect(groups.has(name), name).toBe(true);
  }
  expect(groups.get('man')).toMatchObject({ walk: 'walk_civi', run: 'run_civi', sprint: 'sprint_panic', idle: 'idle_stance' });
  expect(groups.get('gang1')).toMatchObject({ walk: 'walk_gang1', run: 'run_gang1' });
  expect(groups.get('swat')).toMatchObject({ walk: 'walk_civi', run: 'swat_run' });
});
