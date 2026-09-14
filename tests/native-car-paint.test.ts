import {expect,test} from 'vitest';
import {MeshBasicMaterial} from 'three';
import {readFileSync} from 'node:fs';
import {readDff} from '../src/assets/dff';
import {modelObject,type ModelMaterialBinding} from '../src/assets/ModelObjects';
import {nativeCarPaintSlot,bindNativeCarPaint,type NativeCarColors} from '../src/render/nativeCarPaint';
import type {ModelTexture} from '../src/assets/modelTextures';
const colors:NativeCarColors=[[10,20,30],[40,50,60],[70,80,90],[100,110,120]];
const markers=[[60,255,0],[255,0,175],[0,255,255],[255,0,255]];
function binding(rgb:number[],flags=64):ModelMaterialBinding{
 return {material:new MeshBasicMaterial({opacity:.25}),source:{color:[...rgb,64],texture:'',mask:'',filter:1,addressU:1,addressV:1,surface:[1,1,1]},geometryFlags:flags};
}
test('all four source RGB markers select distinct slots regardless of alpha, without near-color matches',()=>{
 markers.forEach((rgb,i)=>{for(const alpha of [0,64,255])expect(nativeCarPaintSlot([...rgb,alpha])).toBe(i);});
 expect(nativeCarPaintSlot([61,255,0,255])).toBeUndefined();expect(nativeCarPaintSlot([255,175,0,255])).toBeUndefined();
});
test('paint preserves alpha and source data, excludes light texture identity and unmodulated geometry, and validates atomically',()=>{
 const targets=markers.map(rgb=>binding(rgb)),plain=binding([3,4,5]),unmodulated=binding(markers[0],0),light=binding(markers[0]),sameName=binding(markers[1]);
 const texture={name:'vehiclelights128'} as ModelTexture;light.texture=texture;sameName.texture={...texture};
 const all=[...targets,plain,unmodulated,light,sameName],before=structuredClone(all.map(b=>b.source));
 const paint=bindNativeCarPaint(all,texture);expect(paint.count).toBe(5);paint.setColors(colors);
 targets.forEach((b,i)=>{expect(b.material.color.toArray()).toEqual(colors[i].map(v=>v/255));expect(b.material.opacity).toBe(.25);expect(b.material.userData.nativeFadeColor).toEqual(colors[i].map(v=>v/255));});
 for(const b of [plain,unmodulated,light])expect(b.material.color.toArray()).toEqual([1,1,1]);
 expect(sameName.material.color.toArray()).toEqual(colors[1].map(v=>v/255));expect(all.map(b=>b.source)).toEqual(before);
 const saved=all.map(b=>b.material.color.toArray());expect(()=>paint.setColors([[1,2,3],[4,5,6],[7,8,9],[10,11,256]])).toThrow(/byte RGB/);expect(all.map(b=>b.material.color.toArray())).toEqual(saved);
 all.forEach(b=>b.material.dispose());
});
test('two rendered instances repaint independently and keep original marker selection across repeated updates',()=>{
 const model=readDff(new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff')));
 model.geometries.forEach(g=>{g.flags|=64;g.materials.forEach(m=>m.color=[60,255,0,128]);});
 const a=modelObject(model),b=modelObject(model);
 try{
  const pa=bindNativeCarPaint(a.materialBindings),pb=bindNativeCarPaint(b.materialBindings);pa.setColors(colors);pb.setColors([...colors].reverse() as unknown as NativeCarColors);
  expect(a.materialBindings[0].material.color.toArray()).toEqual(colors[0].map(v=>v/255));expect(b.materialBindings[0].material.color.toArray()).toEqual(colors[3].map(v=>v/255));
  pa.setColors([[0,1,2],colors[1],colors[2],colors[3]]);expect(a.materialBindings[0].material.color.toArray()).toEqual([0,1/255,2/255]);
  expect(model.geometries[0].materials[0].color).toEqual([60,255,0,128]);
 }finally{a.dispose();b.dispose();}
});
