import {test,expect} from 'vitest';
import {assemblePlayerBody,PLAYER_BODY_PARTS,type PlayerBodyPart} from '../src/assets/assemblePlayerBody';
import {readDff,type DffModel} from '../src/assets/dff';
test('native body assembly preserves inputs, supplies template palettes and rejects mixed variants',async()=>{
 const root=process.env.GTA_CONTENT_DIR;if(!root)return;
 const {readFile}=await import('node:fs/promises');
 const bytes=Object.fromEntries(await Promise.all(['player',...PLAYER_BODY_PARTS].map(async n=>[n,new Uint8Array(await readFile(`${root}/player/${n}.dff`))])));
 const template=readDff(bytes.player),parts=Object.fromEntries(PLAYER_BODY_PARTS.map(n=>[n,readDff(bytes[n],2)])) as Record<PlayerBodyPart,DffModel>;
 const bindings={torso:'torso',head:'head8bit',hands:'torso',legs:'legs',feet:'feet8bit'};
 const model=assemblePlayerBody(template,parts,bindings);
 expect(model.geometries).toHaveLength(5);expect(model.atomics).toHaveLength(5);expect(model.frames).toEqual(template.frames);expect(model.frames).not.toBe(template.frames);
 expect(model.geometries.map(g=>g.skin!.boneCount)).toEqual([32,32,32,32,32]);expect(model.geometries.reduce((n,g)=>n+g.positions.length/3,0)).toBe(1745);
 expect(model.geometries.flatMap(g=>g.materials.map(m=>m.texture))).toEqual(['torso','head8bit','head8bit','torso','legs','feet8bit']);
 const value=parts.torso.geometries[0].positions[0];model.geometries[0].positions[0]=999;expect(parts.torso.geometries[0].positions[0]).toBe(value);expect(parts.torso.geometries[0].materials[0].texture).toBe('');
 expect(()=>assemblePlayerBody(template,{...parts,head:readDff(bytes.head,0)},bindings)).toThrow('consistent named');
 expect(()=>assemblePlayerBody(template,parts,{...bindings,head:''})).toThrow('explicit texture');
});
