import {expect,test,vi} from 'vitest';
import {ClampToEdgeWrapping,DataTexture,LinearFilter} from 'three';
import {LocalSunTexture} from '../src/render/LocalSunTexture';
import type {ModelTexture} from '../src/assets/modelTextures';
const source:ModelTexture={name:'coronastar',filter:2,addressU:3,addressV:3,hasAlpha:false,mips:[{width:1,height:1,data:new Uint8ClampedArray([255,0,0,255])}]};
function setup(){
  const workers:any[]=[];const owner=new LocalSunTexture(()=>{const w={onmessage:null,onerror:null,onmessageerror:null,postMessage:()=>{},terminate:()=>w.terminated++ ,terminated:0};workers.push(w);return w;});
  const file=new File(['fixture'],'particle.txd');return {owner,workers,file};
}
test('replacement commits atomically, failure preserves the current raster, and owners release once',async()=>{
  const {owner,workers,file}=setup();const first=owner.load(file);workers[0].onmessage({data:{texture:source}});expect(await first).toBe(true);
  const original=owner.texture!;let released=0;original.addEventListener('dispose',()=>released++);
  const failed=owner.load(file);const rejection=expect(failed).rejects.toThrow('bad dictionary');workers[1].onmessage({data:{error:'bad dictionary'}});await rejection;
  expect(owner.texture).toBe(original);expect(released).toBe(0);
  const next=owner.load(file);workers[2].onmessage({data:{texture:source}});await next;expect(released).toBe(1);expect(owner.texture).not.toBe(original);
  let nextReleased=0;owner.texture!.addEventListener('dispose',()=>nextReleased++);owner.dispose();owner.dispose();expect(nextReleased).toBe(1);expect(owner.texture).toBeUndefined();
  expect(workers.map(w=>w.terminated)).toEqual([1,1,1]);await expect(owner.load(file)).rejects.toThrow('disposed');
});
test('new loads, clear and disposal cancel pending work and ignore late results',async()=>{
  const {owner,workers,file}=setup();const first=owner.load(file),stale=workers[0].onmessage;
  const second=owner.load(file);expect(await first).toBe(false);stale({data:{texture:source}});expect(owner.texture).toBeUndefined();
  const staleSecond=workers[1].onmessage;owner.clear();expect(await second).toBe(false);staleSecond({data:{texture:source}});expect(owner.texture).toBeUndefined();
  const third=owner.load(file);owner.dispose();expect(await third).toBe(false);expect(workers.map(w=>w.terminated)).toEqual([1,1,1]);
});
test('worker startup and decoding transport errors settle without replacing the texture',async()=>{
  const {owner,workers,file}=setup();const load=owner.load(file),failure=expect(load).rejects.toThrow('message could not be read');workers[0].onmessageerror();await failure;
  expect(workers[0].terminated).toBe(1);expect(owner.texture).toBeUndefined();
  const broken=new LocalSunTexture(()=>{throw new Error('worker unavailable');});await expect(broken.load(file)).rejects.toThrow('worker unavailable');broken.dispose();
});

test('cloud allocation failure rolls back the pair and sun-only replacement releases the old cloud',async()=>{
 const {owner,workers,file}=setup(),cloud={...source,name:'cloud1'};
 const first=owner.load(file);workers[0].onmessage({data:{texture:source,cloud}});await first;
 const oldSun=owner.texture,oldCloud=owner.cloudTexture;const disposal=vi.spyOn(DataTexture.prototype,'dispose');
 try{
  const load=owner.load(file),failed=expect(load).rejects.toThrow();
  workers[1].onmessage({data:{texture:source,cloud:{...cloud,mips:[]}}});await failed;
  expect(owner.texture).toBe(oldSun);expect(owner.cloudTexture).toBe(oldCloud);
  expect(disposal).toHaveBeenCalledTimes(1);expect(disposal.mock.contexts[0]).not.toBe(oldSun);
  const sunOnly=owner.load(file);workers[2].onmessage({data:{texture:source}});await sunOnly;
  expect(owner.cloudTexture).toBeUndefined();expect(disposal.mock.contexts).toContain(oldCloud);expect(disposal.mock.contexts).toContain(oldSun);
  owner.dispose();
 }finally{disposal.mockRestore();owner.dispose();}
});

test('water preparation fails atomically and the optional raster is released on sun-only replacement',async()=>{
 const {owner,workers,file}=setup();const first=owner.load(file);workers[0].onmessage({data:{texture:source,cloud:{...source,name:'cloud1'},water:{...source,name:'waterclear256'}}});await first;
 const sun=owner.texture,cloud=owner.cloudTexture,water=owner.waterTexture!;let released=0;water.addEventListener('dispose',()=>released++);
 const spy=vi.spyOn(DataTexture.prototype,'dispose'),failed=owner.load(file),rejection=expect(failed).rejects.toThrow();
 workers[1].onmessage({data:{texture:source,cloud:source,water:{...source,mips:[]}}});await rejection;expect(spy).toHaveBeenCalledTimes(2);spy.mockRestore();
 expect(owner.texture).toBe(sun);expect(owner.cloudTexture).toBe(cloud);expect(owner.waterTexture).toBe(water);expect(released).toBe(0);
 const replacement=owner.load(file);workers[2].onmessage({data:{texture:source}});await replacement;expect(released).toBe(1);expect(owner.waterTexture).toBeUndefined();owner.dispose();
});

test('the moving fog mask takes MovingFogRender sampler states and is released with its set',async()=>{
 const {owner,workers,file}=setup();const first=owner.load(file);workers[0].onmessage({data:{texture:source,fog:{...source,name:'cloudmasked',filter:1,addressU:1,addressV:1}}});await first;
 const fog=owner.fogTexture!;let released=0;fog.addEventListener('dispose',()=>released++);
 expect([fog.magFilter,fog.minFilter,fog.wrapS,fog.wrapT]).toEqual([LinearFilter,LinearFilter,ClampToEdgeWrapping,ClampToEdgeWrapping]);
 const sunOnly=owner.load(file);workers[1].onmessage({data:{texture:source}});await sunOnly;
 expect(owner.fogTexture).toBeUndefined();expect(released).toBe(1);owner.dispose();
});
