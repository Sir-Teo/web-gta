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
/** An entry of the published gta3.img, read from its directory and the chunk that holds it. */
async function publishedArchiveEntry(name:string){
 const {readFile}=await import('node:fs/promises'),{gunzipSync}=await import('node:zlib');
 const root='public/play/world',manifest=JSON.parse(await readFile(`${root}/manifest.json`,'utf8')),directory=await readFile(`${root}/directory.bin`);
 for(let i=0;i<directory.readUInt32LE(4);i++){
  const at=8+i*32;if(directory.toString('latin1',at+8,at+32).replace(/\0.*$/s,'').toLowerCase()!==name)continue;
  const offset=directory.readUInt32LE(at)*2048,length=(directory.readUInt16LE(at+4)||directory.readUInt16LE(at+6))*2048;
  const range=manifest.ranges.find((r:{offset:number})=>r.offset===offset);
  return new Uint8Array(gunzipSync(await readFile(`${root}/${manifest.chunks[range.chunk].file}`)).subarray(range.start,range.start+length));
 }
 throw new Error(`gta3.img has no ${name}.`);
}
test('the cutscene player: CJ\'s clothes on csplay\'s skeleton, with cs_head and cs_hands on the face\'s and thumbs\' bones',async()=>{
 const {readFile}=await import('node:fs/promises');
 const {PLAYER_CUTSCENE_FILES}=await import('../src/assets/readPlayerBaseBody');
 const files=new Map(await Promise.all(PLAYER_CLASSIC_FILES.map(async name=>[name,new Uint8Array(await readFile(`public/play/world/files/player/${name}`))] as const)));
 for(const name of ['cs_head.dff','cs_hands.dff'])files.set(name,new Uint8Array(await readFile(`public/play/world/files/player/${name}`)));
 expect(()=>readPlayerBaseBody(files,'normal','classic',true)).toThrow('Missing player base file: csplay.dff');
 files.set('csplay.dff',await publishedArchiveEntry('csplay.dff'));
 expect([...PLAYER_CUTSCENE_FILES]).toEqual(['csplay.dff','cs_head.dff','cs_hands.dff']);
 const body=readPlayerBaseBody(files,{normal:1,fat:0,ripped:0},'classic',true);
 expect(body.model.frames).toHaveLength(62);expect(body.model.geometries.map(g=>g.skin?.boneCount)).toEqual([61,61,61,61,61]);
 // The face's bones carry the head, as CClothesBuilder builds it for the cutscene; the deltoids (301, 302) hang from
 // the upper arms there, not from the spine as in player.dff.
 const ids=body.model.frames.map(f=>f.hanim?.id);
 const head=body.model.geometries[1],used=new Set<number>();for(let i=0;i<head.skin!.indices.length;i++)if(head.skin!.weights[i]>0)used.add(head.skin!.indices[i]);
 const palette=body.model.frames.find(f=>f.hanim?.nodes.length===61)!.hanim!.nodes,byIndex=new Map(palette.map(n=>[n.index,n.id]));
 expect([...used].map(i=>byIndex.get(i)).filter(id=>id!>=5000).length).toBeGreaterThan(10);
 expect(body.model.frames[body.model.frames[ids.indexOf(301)].parent].hanim?.id).toBe(22);
 expect(body.textures.map(t=>t.name)).toEqual(['torso','face','legs','foot']);
});
