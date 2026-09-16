import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';

/** CTaskSimpleSwim clip set resolved against the packaged swim.ifp. */
export const SWIM_CLIPS={tread:'Swim_Tread',breast:'Swim_Breast',crawl:'SWIM_crawl',diveUnder:'Swim_Dive_Under',under:'Swim_Under',glide:'Swim_Glide',jumpOut:'Swim_jumpout'} as const;

test('swim clips parse from the verified archive',{timeout:60000},async()=>{
 const bytes=readFileSync('public/play/world/files/animations/swim.ifp');
 expect(bytes.length).toBe(34816);
 expect(createHash('sha256').update(bytes).digest('hex')).toBe('d002fbbc889a4269c7a5352625096c78caada88fad214aca425c281ef435c692');
 const temporary=await mkdtemp(join(tmpdir(),'web-gta-swim-'));
 try{
  await build({input:resolve('src/assets/ifp.ts'),platform:'node',output:{file:join(temporary,'ifp.mjs'),format:'esm'}});
  const {readIfp}=await import(pathToFileURL(join(temporary,'ifp.mjs')).href);
  const names=readIfp(new Uint8Array(bytes)).animations.map((a:{name:string})=>a.name.toLowerCase());
  for(const clip of Object.values(SWIM_CLIPS))expect(names).toContain(clip.toLowerCase());
 }finally{await rm(temporary,{recursive:true,force:true});}
});
