import {test,expect} from 'vitest';
import {composePlayerTexture} from '../src/assets/composePlayerTexture';
import type {ModelTexture} from '../src/assets/modelTextures';
import {readPlayerBaseBody,PLAYER_BASE_FILES} from '../src/assets/readPlayerBaseBody';
import {decodeNamedTextures} from '../src/assets/modelTextures';
const texture=(data:number[]):ModelTexture=>({name:'torso',filter:1,addressU:1,addressV:1,hasAlpha:true,mips:[{width:data.length/4,height:1,data:new Uint8ClampedArray(data)}]});
test('clothing layers preserve holes and replace even nearly transparent pixels in order',()=>{
 const base=texture([10,20,30,255,40,50,60,255,70,80,90,255]);
 const overlay=texture([200,200,200,0,100,110,120,1,130,140,150,128]);
 const result=composePlayerTexture(base,[overlay]);
 expect([...result.mips[0].data]).toEqual([10,20,30,255,100,110,120,1,130,140,150,128]);
 expect(result.filter).toBe(2);expect(result.hasAlpha).toBe(true);expect(result.mips).toHaveLength(1);
 expect([...base.mips[0].data]).toEqual([10,20,30,255,40,50,60,255,70,80,90,255]);
 expect(composePlayerTexture(base,[overlay,base]).mips[0].data).toEqual(base.mips[0].data);
 expect(composePlayerTexture(base,[]).hasAlpha).toBe(false);
 expect(()=>composePlayerTexture(base,[texture([0,0,0,255])])).toThrow('matching dimensions');
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('native vest replaces its torso mesh and composites every garment pixel over skin',async()=>{
 const {readFile}=await import('node:fs/promises');
 const files=new Map(await Promise.all([...PLAYER_BASE_FILES,'vest.dff','vest.txd'].map(async name=>[name,new Uint8Array(await readFile(`${process.env.GTA_CONTENT_DIR}/player/${name}`))] as const)));
 const vest=decodeNamedTextures(['vest'],files.get('vest.txd')!)[0].mips[0].data;
 for(const variant of ['normal','fat','ripped'] as const){
  const base=readPlayerBaseBody(files,variant),outfit=readPlayerBaseBody(files,variant,'vest');
  const skin=base.textures[0].mips[0].data,result=outfit.textures[0].mips[0].data;
  let covered=0,uncovered=0;
  for(let i=0;i<result.length;i+=4){
   const source=vest[i+3]!==0?vest:skin;
   if(source===vest)covered++;else uncovered++;
   for(let channel=0;channel<4;channel++)if(result[i+channel]!==source[i+channel])throw new Error(`Incorrect vest pixel ${i/4}, channel ${channel}`);
  }
  expect(covered).toBeGreaterThan(0);expect(uncovered).toBeGreaterThan(0);
  expect(outfit.model.geometries[0].positions).not.toEqual(base.model.geometries[0].positions);
  expect(outfit.textures[0].filter).toBe(2);
 }
});
