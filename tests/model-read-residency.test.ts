import {expect,test,vi} from 'vitest';
import {ModelReadCache} from '../src/assets/readModel';
import type {NativeTexture} from '../src/assets/txd';

test('simultaneous dictionary requests share reads and decoded identity; failures retry',async()=>{
  const file=new File(['source'],'shared.txd');
  const read=vi.spyOn(file,'arrayBuffer');const cache=new ModelReadCache(file,[],[file]);
  const [a,b]=await Promise.all([cache.dictionaryFile(file),cache.dictionaryFile(file)]);
  expect(a).toBe(b);expect(read).toHaveBeenCalledTimes(1);
  expect(await cache.dictionaryFile(file)).toBe(a);
  expect(cache.matches(file,[file])).toBe(true);
  expect(cache.matches(file,[new File(['source'],'shared.txd')])).toBe(false);
  const failed=new File(['x'],'retry.txd');const retry=vi.spyOn(failed,'arrayBuffer').mockRejectedValueOnce(Error('failed'));
  await expect(cache.dictionaryFile(failed)).rejects.toThrow('failed');
  expect((await cache.dictionaryFile(failed)).byteLength).toBe(1);expect(retry).toHaveBeenCalledTimes(2);
});

test('residency budget includes decoded pixels and evicts least recently used source',async()=>{
  const archive=new File([],'gta3.img'),cache=new ModelReadCache(archive,[]);
  const a=new File(['a'],'a.txd'),b=new File(['b'],'b.txd');
  const bytesA=await cache.dictionaryFile(a),bytesB=await cache.dictionaryFile(b);
  const native={} as NativeTexture;
  cache.decode.dictionaries.set(bytesA,[native]);
  cache.decode.textures.set(native,{name:'large',filter:1,addressU:1,addressV:1,hasAlpha:false,mips:[{width:4096,height:4096,data:new Uint8ClampedArray(64*1024*1024)}]});
  const stats=cache.trimDecoded();expect(stats.retainedBytes).toBe(1);expect(stats.dictionaries).toBe(1);
  expect(await cache.dictionaryFile(b)).toBe(bytesB);expect(await cache.dictionaryFile(a)).not.toBe(bytesA);
});
