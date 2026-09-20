import {readFileSync} from 'node:fs';
import {expect,test,vi} from 'vitest';
import {BufferGeometry,Material,Skeleton,type Mesh,type MeshBasicMaterial} from 'three';
import {readDff} from '../src/assets/dff';
import {modelObject,ModelObjectPool} from '../src/assets/ModelObjects';
import {Box3,Group} from 'three';
import {TexturePool} from '../src/assets/TexturePool';
import {decodeModelTextures} from '../src/assets/modelTextures';
import {textureFixture,txdFixture} from './fixtures/native-assets';
const model=(name='dragonff-model')=>readDff(new Uint8Array(readFileSync(`tests/fixtures/${name}.dff`)));
test('native draw spans retain source index order and material slots while fallback models regroup triangles',()=>{
 for(const native of [true,false]){
  const data=model(),geometry=data.geometries[0];
  geometry.materials=[{...geometry.materials[0],color:[255,0,0,255]},{...geometry.materials[0],color:[0,0,255,255]}];
  geometry.materialIds=new Uint16Array([1,0]);geometry.indices=new Uint32Array([0,1,2,2,1,0]);
  geometry.meshes=native?[{start:0,count:3,material:1,min:0,max:2},{start:3,count:3,material:0,min:0,max:2}]:undefined;
  const original=geometry.indices,object=modelObject(data);
  try{
   let mesh:Mesh<BufferGeometry,MeshBasicMaterial[]>|undefined;
   object.root.traverse(node=>{if((node as Mesh).isMesh)mesh=node as typeof mesh;});
   expect(mesh).toBeTruthy();
   expect([...mesh!.geometry.index!.array]).toEqual(native?[0,1,2,2,1,0]:[2,1,0,0,1,2]);
   if(native)expect(mesh!.geometry.index!.array).toBe(original);
   expect(mesh!.geometry.groups).toEqual([{start:0,count:3,materialIndex:0},{start:3,count:3,materialIndex:1}]);
   expect(mesh!.material[0].userData.nativeFadeColor).toEqual(native?[0,0,1]:[1,0,0]);
   expect(geometry.indices).toBe(original);
  }finally{object.dispose();}
 }
});
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

test('the model pool keeps a released source within its retired budget and revives it, evicting the oldest first',()=>{
 const pool=new ModelObjectPool(100);let built=0,disposed:string[]=[];
 const make=(name:string)=>()=>{built++;return {root:new Group(),setNight(){},dispose(){disposed.push(name);},materialBindings:[],bounds:new Box3(),uvAnimators:[]} as any;};
 const a=pool.acquire('a',make('a'),60),b=pool.acquire('b',make('b'),60);
 expect(built).toBe(2);expect(pool.size).toBe(2);
 pool.release('a');expect(pool.retiredCount).toBe(1);expect(disposed).toEqual([]);
 // Reviving returns the same source without building again.
 expect(pool.acquire('a',make('a'),60)).toBe(a);expect(built).toBe(2);expect(pool.retiredCount).toBe(0);
 // Two retired sources exceed the 100-byte budget: the oldest goes.
 pool.release('a');pool.release('b');expect(disposed).toEqual(['a']);expect(pool.retiredCount).toBe(1);
 expect(pool.acquire('b',make('b'),60)).toBe(b);
 // A source larger than the whole budget is disposed at once.
 pool.acquire('big',make('big'),500);pool.release('big');expect(disposed).toContain('big');
 pool.dispose();expect(disposed).toContain('b');expect(pool.retiredCount).toBe(0);
});

test('a retired source keeps the decoded model it was built from for the next window message',()=>{
 const pool=new ModelObjectPool(1000),model={frames:[],geometries:[{} as any],atomics:[],warnings:[]} as any,textures:any[]=[];
 const make=()=>({root:new Group(),setNight(){},dispose(){},materialBindings:[],bounds:new Box3(),uvAnimators:[]} as any);
 pool.acquire('lamp',make,10,{model,textures});expect(pool.retiredModels().size).toBe(0);
 pool.release('lamp');expect([...pool.retiredModels().keys()]).toEqual(['lamp']);expect(pool.retiredModels().get('lamp')!.model).toBe(model);
 pool.acquire('lamp',make,10);expect(pool.retiredModels().size).toBe(0);pool.dispose();
});
