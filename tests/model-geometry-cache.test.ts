import {test,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {ModelGeometryCache,modelGeometryBytes} from '../src/assets/ModelGeometryCache';
import {readDff} from '../src/assets/dff';
import {readImgIndex} from '../src/assets/img';
import {readModel,ModelReadCache} from '../src/assets/readModel';
import {imgFixture} from './fixtures/native-assets';
const bytes=new Uint8Array(readFileSync('tests/fixtures/dragonff-model.dff'));
const archive=()=>new File([imgFixture(['a','b','c'].map(name=>({name:name+'.dff',bytes}))) as BlobPart],'world.img');
test('geometry cache deduplicates pending loads and reuses immutable model data',async()=>{
 const file=archive(),entries=await readImgIndex(file),cache=new ModelGeometryCache(file);
 const [a,b]=await Promise.all([cache.read(entries[0]),cache.read({...entries[0]})]);expect(a).toBe(b);
 expect(await cache.read(entries[0])).toBe(a);expect(a).toEqual(readDff(bytes));
 expect(cache.stats()).toMatchObject({hits:2,decodes:1,models:1,pending:0});
});
test('least recently used geometry is evicted within the byte budget',async()=>{
 const file=archive(),entries=await readImgIndex(file),size=modelGeometryBytes(readDff(bytes)),cache=new ModelGeometryCache(file,size*2);
 const a=await cache.read(entries[0]),b=await cache.read(entries[1]);await cache.read(entries[0]);await cache.read(entries[2]);
 expect(cache.stats()).toMatchObject({models:2,retainedBytes:size*2,evictions:1});expect(await cache.read(entries[0])).toBe(a);expect(await cache.read(entries[1])).not.toBe(b);
 expect(cache.stats().retainedBytes).toBeLessThanOrEqual(cache.limit);
 const tiny=new ModelGeometryCache(file,1);await tiny.read(entries[0]);expect(tiny.stats()).toMatchObject({models:0,retainedBytes:0});
});
test('external file identities, clumps and archive boundaries cannot alias',async()=>{
 const file=archive(),entries=await readImgIndex(file),cache=new ModelGeometryCache(file);
 const first=new File([bytes],'same.dff'),second=new File([bytes],'same.dff');
 expect(await cache.read(undefined,first)).not.toBe(await cache.read(undefined,second));
 await expect(cache.read(undefined,first,99)).rejects.toThrow();expect(cache.stats().pending).toBe(0);
 const other=archive(),readCache=new ModelReadCache(other,await readImgIndex(other),[],cache),before=cache.stats();
 await readModel({file:other,entry:entries[0]},readCache);expect(cache.stats()).toEqual(before);
});
test('failed decodes leave no cached or pending entry and may be retried',async()=>{
 const file=new File([new Uint8Array(20)],'bad.dff'),cache=new ModelGeometryCache(file);
 for(let i=0;i<2;i++){await expect(cache.read()).rejects.toThrow();expect(cache.stats()).toMatchObject({models:0,pending:0,retainedBytes:0});}
});
