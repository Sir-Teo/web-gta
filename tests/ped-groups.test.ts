import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readPedsIde, readPedGroups, readPedStats } from '../src/assets/pedGroups';

const PEDS_IDE = `#
peds
19, BMYDJ, BMYDJ, CIVMALE, STAT_STREET_GUY, gang1, 170F,1, null,5,0,PED_TYPE_GEN,VOICE_GEN_BMYDJ ,VOICE_GEN_BMYDJ
23, WMYBMX, WMYBMX, CIVMALE, STAT_STREET_GUY, man,0800,0, null,6,4,PED_TYPE_GEN,VOICE_GEN_WMYBMX ,VOICE_GEN_WMYBMX
105, FAM1, FAM1, GANG2, STAT_GANG2, gang2, 110F,1, null,5,5,PED_TYPE_GANG,VOICE_GNG_FAM1 ,VOICE_GNG_FAM2
102, BALLAS1, BALLAS1, GANG1, STAT_GANG1, gang1, 110F,1, null,3,3,PED_TYPE_GANG,VOICE_GNG_BALLAS1 ,VOICE_GNG_BALLAS2
${Array.from({ length: 197 }, (_, i) => `${1000 + i}, FILL${i}, FILL${i}, CIVMALE, STAT_STREET_GUY, man, 0,0, null,0,0,PED_TYPE_GEN,VOICE_X,VOICE_X`).join('\n')}
end
`;

const PEDGRP = `BMYDJ # POPCYCLE_GROUP_ENTERTAINERS
BALLAS1, BALLAS2, BALLAS3 # Gang 1 (BALLAS)
FAM1, FAM2, FAM3 # Gang 2 (FAMILIES)
LSV1, LSV2, LSV3 # Gang 3
SFR1, SFR2, SFR3 # Gang 4
DNB1, DNB2, DNB3 # Gang 5
VMAFF1, VMAFF2 # Gang 6
TRIADA, TRIADB # Gang 7
VLA1, VLA2 # Gang 8
VLA1, VLA2 # Gang 9
VLA1, VLA2 # Gang 10
BMYDRUG, WMYDRUG # Dealers
`;

test('peds.ide maps models to ped type, stats and anim groups', () => {
  const defs = readPedsIde(PEDS_IDE);
  expect(defs.get('bmydj')).toMatchObject({ pedType: 'CIVMALE', stat: 'STAT_STREET_GUY', animGroup: 'gang1' });
  expect(defs.get('fam1')).toMatchObject({ pedType: 'GANG2', stat: 'STAT_GANG2', animGroup: 'gang2' });
  expect(defs.get('wmybmx')?.animGroup).toBe('man');
});

test('pedgrp resolves the ten gangs and dealers', () => {
  const groups = readPedGroups(PEDGRP);
  expect(groups.gangs).toHaveLength(10);
  expect(groups.gangs[0]).toEqual(['ballas1', 'ballas2', 'ballas3']);
  expect(groups.gangs[1]).toEqual(['fam1', 'fam2', 'fam3']);
  expect(groups.dealers).toEqual(['bmydrug', 'wmydrug']);
});

test('pedstats resolves attack and defend multipliers', () => {
  const rows = [
    'STAT_PLAYER          0.0   9.0    50  50  50  50  3.0   0.4   40\t2',
    'STAT_COP             20.0  7.5    10  30  100 50  1.0   1.0   40\t1',
    'STAT_TOUGH_GUY       17.0  7.5    30  70  50  60  1.1   1.5   55\t3',
  ];
  const filler = Array.from({ length: 30 }, (_, i) => `STAT_FILL${i} 17.0 7.5 50 50 50 50 1.0 1.0 40 2`).join('\n');
  const stats = readPedStats(`${rows.join('\n')}\n${filler}\n`);
  expect(stats.get('STAT_PLAYER')).toMatchObject({ attack: 3.0, defend: 0.4 });
  expect(stats.get('STAT_TOUGH_GUY')).toMatchObject({ attack: 1.1, defend: 1.5 });
});

test('the shipped ped tables resolve roster models, gangs and stats', async () => {
  const [ide, grp, stats] = await Promise.all([
    readFile('public/play/world/files/data/peds.ide', 'utf8'),
    readFile('public/play/world/files/data/pedgrp.dat', 'utf8'),
    readFile('public/play/world/files/data/pedstats.dat', 'utf8'),
  ]);
  const defs = readPedsIde(ide);
  expect(defs.get('bmydj')).toMatchObject({ animGroup: 'gang1' });
  expect(defs.get('fam1')).toMatchObject({ pedType: 'GANG2', animGroup: 'gang2' });
  expect(defs.get('lapd1')).toMatchObject({ pedType: 'COP', stat: 'STAT_COP' });
  const groups = readPedGroups(grp);
  expect(groups.gangs[0]).toContain('ballas1');
  expect(groups.gangs[1]).toContain('fam1');
  const table = readPedStats(stats);
  expect(table.get('STAT_PLAYER')).toMatchObject({ attack: 3.0, defend: 0.4 });
});
