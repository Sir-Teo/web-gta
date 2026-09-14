import {test,expect} from 'vitest';
import {readFileSync,openAsBlob} from 'node:fs';
import {join} from 'node:path';
import {readDff} from '../src/assets/dff';
import {readCol} from '../src/assets/col';
import {readModel} from '../src/assets/readModel';
import {BinaryReader,readChunk} from '../src/assets/binary';
import {readImgIndex} from '../src/assets/img';
import {chunk,concat} from './fixtures/native-assets';
const model=()=>new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'));
const collision=()=>new Uint8Array(readFileSync('tests/fixtures/dragonff-collision-v3.col'));
function embed(col:Uint8Array,repeat=false){
 const root=readChunk(new BinaryReader(model())),r=new BinaryReader(root.bytes),parts=[];
 while(r.position<r.bytes.length){const part=readChunk(r);if(part.type!==3)parts.push(chunk(part.type,part.bytes));}
 const plugin=chunk(0x253f2fa,col);
 return chunk(0x10,concat(...parts,chunk(3,repeat?concat(plugin,plugin):plugin)));
}
test('embedded COL preserves native primitives, triangles and per-face metadata',()=>{
 const parsed=readDff(embed(collision()));expect(parsed.embeddedCollisions).toEqual(readCol(collision()));
 expect(readDff(model()).embeddedCollisions).toBeUndefined();
 expect(()=>readDff(embed(collision(),true))).toThrow('Repeated embedded collision');
 expect(()=>readDff(embed(collision().subarray(0,100)))).toThrow();
});
test('collision follows the explicitly selected clump and is not collected from other clumps',()=>{
 const combined=concat(model(),embed(collision()));
 expect(()=>readDff(combined)).toThrow('multiple clumps');
 expect(readDff(combined,0).embeddedCollisions).toBeUndefined();
 expect(readDff(combined,1).embeddedCollisions).toEqual(readCol(collision()));
});
test('model loading resolves embedded collision by clump and respects explicit external selection',async()=>{
 const expected=readCol(collision())[0],file=new File([embed(collision())],`${expected.name}.dff`);
 const loaded=await readModel({file});expect(loaded.collision).toEqual(expected);expect(loaded.collisionSource).toBe(`${expected.name}.dff / embedded COL`);
 const external={...expected,id:42};expect((await readModel({file,collisionModels:[external]})).collision).toBe(external);
 expect((await readModel({file,collisionModels:[]})).collision).toBeUndefined();
 const wrong=await readModel({file:new File([embed(collision())],'different.dff')});expect(wrong.collision).toEqual(expected);
 const unmatched=await readModel({file:new File([embed(collision())],'different.dff'),collisionModels:[expected]});expect(unmatched.collision).toBeUndefined();
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('native Greenwood resolves the collision embedded in its public archive model',async()=>{
 const archive=await openAsBlob(join(process.env.GTA_CONTENT_DIR!,'gta3.img'));Object.defineProperty(archive,'name',{value:'gta3.img'});
 const file=archive as File,entries=await readImgIndex(file),entry=entries.find(e=>e.name==='greenwoo.dff');expect(entry).toBeDefined();
 const loaded=await readModel({file,entry:entry!});
 expect(loaded.collision?.name).toBe('greenwoo_col');expect(loaded.collision?.version).toBe(3);
 expect(loaded.collisionSource).toBe('greenwoo.dff / embedded COL');
 expect(loaded.collision!.spheres).toHaveLength(19);expect(loaded.collision!.boxes).toHaveLength(0);expect(loaded.collision!.mesh.indices).toHaveLength(36);
 expect(loaded.model.frames.some(f=>f.name==='wheel_rf_dummy')).toBe(true);
 console.log(JSON.stringify({frames:loaded.model.frames.length,atomics:loaded.model.atomics.length,spheres:loaded.collision!.spheres.length,boxes:loaded.collision!.boxes.length,triangles:loaded.collision!.mesh.indices.length/3}));
});
