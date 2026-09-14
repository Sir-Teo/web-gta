import {readFileSync,openAsBlob} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import {Matrix4,Mesh} from 'three';
import {readDff} from '../src/assets/dff';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {prepareCarModel} from '../src/assets/prepareCarModel';
import {resolveCarWheelFrames} from '../src/assets/carWheelFrames';
import {modelObject} from '../src/assets/ModelObjects';
function fixture(){
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')));
 for(const name of ['wheel_lf_dummy','wheel_lb_dummy','wheel_rf_dummy','wheel_rb_dummy'])model.frames.push({name,parent:0,matrix:new Matrix4().toArray()});
 const wheels=resolveCarWheelFrames(model);
 model.frames.push({name:'wheel',parent:wheels.frontRight,matrix:new Matrix4().makeTranslation(0,7,0).toArray()});
 model.atomics.push({...model.atomics[0],frame:model.frames.length-1});
 for(const name of ['bonnet_dam','plate_damaged','bonnet_ok','DAM','unclassified']){
  model.frames.push({name,parent:0,matrix:new Matrix4().toArray()});model.atomics.push({...model.atomics[0],frame:model.frames.length-1});
 }
 return model;
}
test('prepares wheel clones without child offsets and hides case-sensitive damaged atomics without mutating source',()=>{
 const raw=fixture(),before=structuredClone(raw),model=prepareCarModel(raw),wheels=resolveCarWheelFrames(raw);
 expect(raw).toEqual(before);expect(model.geometries).toBe(raw.geometries);expect(model.frames).toBe(raw.frames);
 const wheelAtomics=model.atomics.filter(a=>Object.values(wheels).includes(a.frame));expect(wheelAtomics).toHaveLength(4);
 expect(new Set(wheelAtomics.map(a=>a.geometry)).size).toBe(1);
 expect(model.atomics.filter(a=>raw.frames[a.frame].name.includes('_dam')).every(a=>a.flags===0)).toBe(true);
 expect(model.atomics.find(a=>raw.frames[a.frame].name==='DAM')!.flags).toBe(raw.atomics[0].flags);
 const visual=modelObject(model);try{
  for(const index of Object.values(wheels)){
   const frame=visual.root.getObjectByName(raw.frames[index].name)!;
   expect(frame.children.filter(c=>c instanceof Mesh)).toHaveLength(1);
   expect(frame.children.find(c=>c instanceof Mesh)!.position.toArray()).toEqual([0,0,0]);
  }
  expect(visual.root.getObjectByName('bonnet_dam')!.children).toHaveLength(0);
 }finally{visual.dispose();}
});
test('ambiguous or already-prepared wheels reject instead of duplicating meshes',()=>{
 const raw=fixture();expect(()=>prepareCarModel(prepareCarModel(raw))).toThrow(/already contains/);
 raw.atomics.push({...raw.atomics[1]});expect(()=>prepareCarModel(raw)).toThrow(/exactly one atomic/);
 const empty=fixture();empty.atomics.splice(1,1);expect(()=>prepareCarModel(empty)).toThrow(/exactly one atomic/);
});
test.skipIf(!process.env.GTA_CONTENT_DIR)('real Greenwood has four shared wheel instances and ten hidden damaged atomics',async()=>{
 const blob=await openAsBlob(join(process.env.GTA_CONTENT_DIR!,'gta3.img'));Object.defineProperty(blob,'name',{value:'gta3.img'});const file=blob as File;
 const entry=(await readImgIndex(file)).find(e=>e.name==='greenwoo.dff')!;
 const raw=readDff(await readImgEntry(file,entry)),model=prepareCarModel(raw),wheels=resolveCarWheelFrames(model);
 expect(raw.atomics).toHaveLength(24);expect(model.atomics).toHaveLength(27);
 expect(model.atomics.filter(a=>a.flags===0)).toHaveLength(10);
 const wheelAtomics=model.atomics.filter(a=>Object.values(wheels).includes(a.frame));expect(wheelAtomics).toHaveLength(4);
 expect(wheelAtomics.map(a=>a.geometry)).toEqual([0,0,0,0]);
 expect(model.atomics.filter(a=>a.flags&4)).toHaveLength(17);
});
