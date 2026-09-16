import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

async function loadIfp(){
  const temporary=await mkdtemp(join(tmpdir(),'web-gta-driveby-'));
  try{
    await build({input:resolve('src/assets/ifp.ts'),platform:'node',output:{file:join(temporary,'ifp.mjs'),format:'esm'}});
    return await import(pathToFileURL(join(temporary,'ifp.mjs')).href);
  }finally{
    // Keep the temp dir for the dynamic import; clean up on process exit.
  }
}

test('drive-by IFP blocks parse from the verified archive',{timeout:60000},async()=>{
  const {readIfp}=await loadIfp();
  const drivebys=readIfp(new Uint8Array(readFileSync('public/play/world/files/animations/drivebys.ifp')));
  expect(drivebys.format).toBe('ANP3');
  expect(drivebys.animations.map((a:{name:string})=>a.name).sort()).toEqual([
    'Gang_DrivebyLHS','Gang_DrivebyLHS_Bwd','Gang_DrivebyLHS_Fwd','Gang_DrivebyRHS',
    'Gang_DrivebyRHS_Bwd','Gang_DrivebyRHS_Fwd','Gang_DrivebyTop_LHS','Gang_DrivebyTop_RHS',
  ].sort());
  const player=readIfp(new Uint8Array(readFileSync('public/play/world/files/animations/player_dvbys.ifp')));
  expect(player.animations.map((a:{name:string})=>a.name).sort()).toEqual([
    'Plyr_DrivebyBwd','Plyr_DrivebyFwd','Plyr_DrivebyLHS','Plyr_DrivebyRHS',
  ].sort());
  expect(createHash('sha256').update(readFileSync('public/play/world/files/animations/drivebys.ifp')).digest('hex')).toBe('fe04f9ac9ccd746f865c11378aaf909d6a70e5493b4c3135a2e0ca8c1d29fe7a');
});
