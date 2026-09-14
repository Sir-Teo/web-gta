import {test,expect} from 'vitest';
import {readPlayerBaseBody,PLAYER_BASE_FILES,PLAYER_CLASSIC_FILES,type PlayerBodyVariant} from '../src/assets/readPlayerBaseBody';
import {decodeNamedTextures} from '../src/assets/modelTextures';
test('base body reports missing inputs and rejects unknown variants',()=>{
 expect(()=>readPlayerBaseBody(new Map())).toThrow('Missing player base file');
 expect(()=>readPlayerBaseBody(new Map(),'unknown' as PlayerBodyVariant)).toThrow('Unknown player body variant');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('classic outfit uses native jeans and sneaker geometry with dictionary-local garment pixels',async()=>{
 const {readFile}=await import('node:fs/promises');
 const files=new Map(await Promise.all(PLAYER_CLASSIC_FILES.map(async name=>[name,new Uint8Array(await readFile(`${process.env.GTA_CONTENT_DIR}/player/${name}`))] as const)));
 for(const variant of ['normal','fat','ripped'] as const){
  const base=readPlayerBaseBody(files,variant),outfit=readPlayerBaseBody(files,variant,'classic');
  expect(outfit.model.geometries.map(g=>g.positions.length/3)).toEqual([405,581,258,294,183]);
  expect(outfit.model.geometries.map(g=>g.skin?.boneCount)).toEqual([32,32,32,32,32]);
  for(const [slot,dictionary,raster] of [[2,'jeansdenim.txd','legs'],[3,'sneakerbincblk.txd','sneakerbincblk']] as const){
   const garment=decodeNamedTextures([raster],files.get(dictionary)!)[0].mips[0].data;
   const skin=base.textures[slot].mips[0].data,actual=outfit.textures[slot].mips[0].data;
   for(let i=0;i<actual.length;i+=4){const expected=garment[i+3]?garment:skin;for(let c=0;c<4;c++)if(actual[i+c]!==expected[i+c])throw new Error(`Incorrect ${dictionary} pixel ${i/4}`);}
   expect(outfit.textures[slot].filter).toBe(2);
  }
 }
 const missing=new Map(files);missing.delete('jeans.dff');
 expect(()=>readPlayerBaseBody(missing,'normal','classic')).toThrow('Missing player base file: jeans.dff');
 const wrong=new Map(files);wrong.set('jeansdenim.txd',files.get('sneakerbincblk.txd')!);
 expect(()=>readPlayerBaseBody(wrong,'normal','classic')).toThrow('jeansdenim.txd requires garment raster legs');
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
