import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {BufferGeometry,Material,Skeleton} from 'three';
import {readDff} from '../src/assets/dff';
import {modelObject} from '../src/assets/ModelObjects';
import {TexturePool} from '../src/assets/TexturePool';
import {decodeModelTextures} from '../src/assets/modelTextures';
import {textureFixture,txdFixture} from './fixtures/native-assets';
const model=(name='dragonff-model')=>readDff(new Uint8Array(readFileSync(`tests/fixtures/${name}.dff`)));
test('failed later texture allocation releases earlier references while preserving existing owners',()=>{
 const data=model(),textures=decodeModelTextures(data,txdFixture(textureFixture())),pool=new TexturePool();
 const existing=modelObject(data,textures,undefined,pool),raster=pool.acquire(textures[0]);pool.release(textures[0]);let disposals=0;raster.addEventListener('dispose',()=>disposals++);
 expect(()=>modelObject(data,[...textures,{...textures[0],name:'invalid',mips:[]}],undefined,pool)).toThrow();
 expect(disposals).toBe(0);existing.dispose();expect(disposals).toBe(1);
});
test('failed geometry construction disposes completed and incomplete geometries plus earlier materials',()=>{
 const data=model();data.geometries.push({...data.geometries[0],materialIds:new Uint16Array([65535])});
 const geometries:BufferGeometry[]=[],materials:Material[]=[];
 const gd=BufferGeometry.prototype.dispose,md=Material.prototype.dispose;
 const gs=vi.spyOn(BufferGeometry.prototype,'dispose').mockImplementation(function(this:BufferGeometry){geometries.push(this);gd.call(this);});
 const ms=vi.spyOn(Material.prototype,'dispose').mockImplementation(function(this:Material){materials.push(this);md.call(this);});
 try{
  expect(()=>modelObject(data)).toThrow();
  expect(geometries).toHaveLength(data.geometries.length);expect(new Set(geometries).size).toBe(geometries.length);
  expect(materials.length).toBe(data.geometries.slice(0,-1).reduce((n,g)=>n+g.materials.length,0));expect(new Set(materials).size).toBe(materials.length);
 }finally{gs.mockRestore();ms.mockRestore();}
});
test('failed skinned atomic attachment releases its skeleton and permits a clean retry',()=>{
 const data=model('dragonff-skin'),originalFrame=data.atomics[0].frame;data.atomics[0].frame=9999;
 const disposed:Skeleton[]=[],original=Skeleton.prototype.dispose;
 const spy=vi.spyOn(Skeleton.prototype,'dispose').mockImplementation(function(this:Skeleton){disposed.push(this);original.call(this);});
 try{
  expect(()=>modelObject(data)).toThrow();expect(disposed).toHaveLength(1);
  data.atomics[0].frame=originalFrame;const recovered=modelObject(data);recovered.dispose();recovered.dispose();expect(disposed).toHaveLength(2);expect(new Set(disposed).size).toBe(2);
 }finally{spy.mockRestore();}
});
