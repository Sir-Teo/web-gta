import {test,expect} from 'vitest';
import {readPlayerBaseBody,PLAYER_BASE_FILES,type PlayerBodyVariant} from '../src/assets/readPlayerBaseBody';
test('base body reports missing inputs and rejects unknown variants',()=>{
 expect(()=>readPlayerBaseBody(new Map())).toThrow('Missing player base file');
 expect(()=>readPlayerBaseBody(new Map(),'unknown' as PlayerBodyVariant)).toThrow('Unknown player body variant');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('native body variants resolve only their dedicated skin rasters',async()=>{
 const {readFile}=await import('node:fs/promises');
 const files=new Map(await Promise.all(PLAYER_BASE_FILES.map(async name=>[name,new Uint8Array(await readFile(`${process.env.GTA_CONTENT_DIR}/player/${name}`))] as const)));
 for(const variant of ['normal','fat','ripped'] as const){
  const result=readPlayerBaseBody(files,variant),suffix=variant==='normal'?'':`_${variant}`;
  expect(result.textures.map(t=>t.name)).toEqual([`torso${suffix}`,'face',`legs${suffix}`,'foot']);
  expect(result.model.geometries.flatMap(g=>g.materials.map(m=>m.texture))).toEqual([`torso${suffix}`,'face','face',`torso${suffix}`,`legs${suffix}`,'foot']);
  expect(result.model.geometries.map(g=>g.skin?.boneCount)).toEqual([32,32,32,32,32]);
 }
 const wrong=new Map(files);wrong.set('player_face.txd',files.get('player_feet.txd')!);
 expect(()=>readPlayerBaseBody(wrong)).toThrow('player_face.txd requires base raster face');
 const missing=new Map(files);missing.delete('player_torso.txd');
 expect(()=>readPlayerBaseBody(missing)).toThrow('Missing player base file: player_torso.txd');
});
