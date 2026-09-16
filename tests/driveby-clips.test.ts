import { expect, test } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readIfp } from '../src/assets/ifp';

async function clips(path: string) {
  const pack = readIfp(new Uint8Array(await readFile(path)));
  return pack.animations.map(c => c.name);
}

test('gang drive-by poses ship in the verified archive', async () => {
  const names = await clips('public/play/world/files/animations/drivebys.ifp');
  expect(names.map(n => n.toLowerCase()).sort()).toEqual(
    ['gang_drivebylhs', 'gang_drivebylhs_bwd', 'gang_drivebylhs_fwd', 'gang_drivebyrhs', 'gang_drivebyrhs_bwd', 'gang_drivebyrhs_fwd', 'gang_drivebytop_lhs', 'gang_drivebytop_rhs'].sort(),
  );
});

test('player drive-by poses ship in the verified archive', async () => {
  const names = await clips('public/play/world/files/animations/player_dvbys.ifp');
  expect(names).toHaveLength(4);
  expect(names.map(n => n.toLowerCase()).sort()).toEqual(
    ['plyr_drivebybwd', 'plyr_drivebyfwd', 'plyr_drivebylhs', 'plyr_drivebyrhs'].sort(),
  );
});
