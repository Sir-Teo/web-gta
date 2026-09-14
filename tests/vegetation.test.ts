import {readFile} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {expect,test} from 'vitest';
import {readPlants,readProcObjects} from '../src/assets/vegetation';
import {nativeSurfaceId} from '../src/assets/surfaceIds';
import {readDff} from '../src/assets/dff';
import {readTxd,decodeTexture} from '../src/assets/txd';
import {readImgIndex} from '../src/assets/img';
import {readIdeAssociations} from '../src/assets/ide';

test('vegetation readers preserve raw alpha, repeated surface rules and reversed ranges',()=>{
 const row='P_SAND rock 16 60 0 360 .9 1 .5 1 -2.4 -3.4 1 0';
 const proc=readProcObjects('# comment\n'+row+'\n'+row+' trailing label');
 expect(proc).toHaveLength(2);expect(proc[0].line).toBe(2);
 expect(proc[0].values).toMatchObject({minDistance:60,minOffsetZ:-2.4,maxOffsetZ:-3.4});
 const plants=readPlants('; comment\nGRASS_SHORT_LUSH 0 0 2 1 190 250 165 100 0 25 .1 .11 .1 .1 -1 3 .02\n;the end\nignored');
 expect(plants).toHaveLength(1);expect(plants[0].values).toMatchObject({alpha:25,windBend:-1,density:.02});
 expect(()=>readProcObjects(row.replace('16','Infinity'))).toThrow('spacing');
 expect(()=>readPlants('GRASS_SHORT_LUSH 0')).toThrow('incomplete');
 expect(()=>readProcObjects(row.replace('360','360.5'))).toThrow('signed integer');
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('public vegetation tables, grass models and texture dictionary match the content lock',async()=>{
 const depot=process.env.GTA_CONTENT_DIR!,lock=JSON.parse(await readFile('scripts/content/world-sources.json','utf8'));
 const files=lock.resources.filter((r:{path:string})=>['plants.dat','procobj.dat'].includes(r.path)||r.path.startsWith('models/grass/'));
 expect(files).toHaveLength(11);
 for(const file of files){const bytes=await readFile(join(depot,file.path));expect(bytes.length).toBe(file.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);}
 const plants=readPlants(await readFile(join(depot,'plants.dat'),'utf8')),proc=readProcObjects(await readFile(join(depot,'procobj.dat'),'utf8'));
 expect(plants).toHaveLength(68);expect(proc).toHaveLength(95);
 for(const row of [...plants,...proc])expect(nativeSurfaceId(row.surface),row.surface).not.toBeUndefined();
 const textures=readTxd(new Uint8Array(await readFile(join(depot,'models/grass/plant1.txd'))));expect(textures).toHaveLength(9);
 for(const texture of textures)for(let i=0;i<texture.mips.length;i++)expect(decodeTexture(texture,i).length).toBe(texture.mips[i].width*texture.mips[i].height*4);
 for(const record of plants)expect(textures.some(t=>t.name===`txgrass${record.values.slot%2}_${record.values.texture}`)).toBe(true);
 for(const file of files.filter((r:{path:string})=>r.path.endsWith('.dff'))){const model=readDff(new Uint8Array(await readFile(join(depot,file.path))));expect(model.geometries).toHaveLength(1);expect(model.geometries[0].positions.length/3).toBe(32);expect(model.geometries[0].indices.length/3).toBe(30);}
 const manifest=JSON.parse(await readFile(join(depot,'scenes.json'),'utf8')).sa,definitions=[];
 for(const path of manifest.paths.ide)definitions.push(...readIdeAssociations(await readFile(join(depot,'ide',path+'.ide'),'utf8')));
 const entries=new Set((await readImgIndex(await openAsBlob(join(depot,'gta3.img')))).map(entry=>entry.name.toLowerCase()));
 for(const name of new Set(proc.map(record=>record.modelName!))){
  const matches=definitions.filter(def=>def.model.toLowerCase()===name.toLowerCase());expect(matches.length,name).toBeGreaterThan(0);
  expect(entries.has(name.toLowerCase()+'.dff'),name).toBe(true);
  for(const def of matches)expect(entries.has(def.dictionary.toLowerCase()+'.txd'),def.dictionary).toBe(true);
 }
},30000);
