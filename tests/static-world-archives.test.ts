import {expect,test} from 'vitest';
import {combineImgs} from '../src/assets/staticWorldArchive';
import {readImgIndex,readImgEntry} from '../src/assets/img';

/** A VER2 IMG in memory: each entry one sector filled with its index. */
function img(names:string[],firstSector=1){
 const bytes=new Uint8Array((firstSector+names.length)*2048),view=new DataView(bytes.buffer);
 bytes.set([86,69,82,50]);view.setUint32(4,names.length,true);
 names.forEach((name,i)=>{const at=8+i*32;view.setUint32(at,firstSector+i,true);view.setUint16(at+4,1,true);for(let c=0;c<name.length;c++)bytes[at+8+c]=name.charCodeAt(c);bytes.fill(i+1+names.length*10,(firstSector+i)*2048,(firstSector+i+1)*2048);});
 return bytes;
}
const blob=(size:number,read:(a:number,b:number)=>Promise<Uint8Array>)=>({size,slice:(a:number,b:number)=>({arrayBuffer:async()=>(await read(a,b)).slice().buffer})}) as unknown as Blob;
const source=(bytes:Uint8Array)=>blob(bytes.length,async(a,b)=>bytes.slice(a,b));

test('CStreaming opens gta_int.img after gta3.img: one virtual directory, the first IMG keeping duplicate names',async()=>{
 const a=img(['a.dff','shared.txd','b.col']),b=img(['int.dff','SHARED.txd','int_la_stream0.ipl']);
 const images=await Promise.all([a,b].map(async bytes=>({entries:await readImgIndex(source(bytes)),bytes:bytes.length,read:async(from:number,to:number)=>bytes.slice(from,to)})));
 const combined=combineImgs(images),file=blob(combined.size,combined.read),entries=await readImgIndex(file);
 expect(entries.map(e=>e.name)).toEqual(['a.dff','shared.txd','b.col','int.dff','int_la_stream0.ipl']);
 // Entry bytes come through unchanged from the image that owns them.
 const shared=await readImgEntry(file,entries[1]);expect(shared[0]).toBe(2+30);
 const stream=await readImgEntry(file,entries[4]);expect(stream[0]).toBe(3+30);
 // The combined directory sits before every shifted entry, and reads must still select whole entries.
 expect(Math.min(...entries.map(e=>e.offset))).toBeGreaterThanOrEqual(2048);
 await expect(combined.read(entries[0].offset,entries[0].offset+10)).rejects.toThrow('complete native entry');
});

test('a packed loose resource is fetched as its gzip copy and checked by the expanded bytes',async()=>{
 const {fetchStaticWorldBytes}=await import('../src/assets/staticWorldArchive');
 const {gzipSync}=await import('node:zlib'),{createHash}=await import('node:crypto');
 const raw=new TextEncoder().encode('# ped.dat\n'.repeat(500)),packed=gzipSync(raw);
 const resource={bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
 const original=globalThis.fetch,requested:string[]=[];
 globalThis.fetch=(async(url:URL)=>{requested.push(String(url));return new Response(packed);}) as typeof fetch;
 try{
  const bytes=await fetchStaticWorldBytes(new URL('https://pages.invalid/world/packed/abc.bin'),resource,undefined,true);
  expect(new TextDecoder().decode(bytes)).toBe(new TextDecoder().decode(raw));
  expect(requested).toEqual(['https://pages.invalid/world/packed/abc.bin']);
  // The same gzip bytes do not pass as the raw file.
  await expect(fetchStaticWorldBytes(new URL('https://pages.invalid/world/files/ped.dat'),{...resource,bytes:packed.length},undefined,false)).rejects.toThrow('checksum');
 }finally{globalThis.fetch=original;}
});

test('a download the connection loses is a WorldDownloadError, which fails the window; a missing file or bad bytes are not',async()=>{
 const {fetchStaticWorldBytes,WorldDownloadError}=await import('../src/assets/staticWorldArchive');
 const {AssetFormatError}=await import('../src/assets/binary');
 const {createHash}=await import('node:crypto');
 const raw=new TextEncoder().encode('chunk'),resource={bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
 const original=globalThis.fetch;let answer:()=>Response|Promise<Response>=()=>new Response(raw);
 globalThis.fetch=(async()=>answer()) as unknown as typeof fetch;
 const url=new URL('https://pages.invalid/world/chunks/a.bin'),get=()=>fetchStaticWorldBytes(url,resource);
 try{
  // No connection: fetch itself rejects (after its retries).
  answer=()=>Promise.reject(new TypeError('Failed to fetch'));
  await expect(get()).rejects.toBeInstanceOf(WorldDownloadError);
  // A server error that outlasts the retries.
  answer=()=>new Response('busy',{status:503});
  await expect(get()).rejects.toBeInstanceOf(WorldDownloadError);
  // A body cut off mid-way.
  answer=()=>new Response(new ReadableStream({start(c){c.enqueue(raw.slice(0,2));c.error(new TypeError('network error'));}}));
  await expect(get()).rejects.toBeInstanceOf(WorldDownloadError);
  // A file the server does not have, or bytes that are not the file: the model is left out, as before.
  answer=()=>new Response('missing',{status:404});
  await expect(get()).rejects.toBeInstanceOf(AssetFormatError);
  answer=()=>new Response(new TextEncoder().encode('other'));
  const wrong=get();await expect(wrong).rejects.toBeInstanceOf(AssetFormatError);await expect(wrong).rejects.not.toBeInstanceOf(WorldDownloadError);
  // The caller's own abort stays an abort.
  const caller=new AbortController();caller.abort(new DOMException('left','AbortError'));answer=()=>Promise.reject(caller.signal.reason);
  await expect(fetchStaticWorldBytes(url,resource,caller.signal)).rejects.not.toBeInstanceOf(WorldDownloadError);
 }finally{globalThis.fetch=original;}
},20000);

test('a phone\'s chunk budget keeps fewer decoded chunks, and a dropped one is inflated again when read',async()=>{
 const {openStaticWorld,setChunkCacheBudget}=await import('../src/assets/staticWorldArchive');
 const {gzipSync}=await import('node:zlib'),{createHash}=await import('node:crypto');
 const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 // gta3.img of four entries, each in a chunk of its own (one sector), the header its directory.
 const names=['a.dff','b.dff','c.dff','d.dff'],whole=img(names),directory=whole.slice(0,2048),files:Record<string,Uint8Array>={'directory.bin':directory};
 const chunks=names.map((_,i)=>{const raw=whole.slice((1+i)*2048,(2+i)*2048),packed=new Uint8Array(gzipSync(raw)),file=`chunks/${i}.bin`;files[file]=packed;return {file,bytes:packed.length,expandedBytes:raw.length,sha256:sha(packed)};});
 const manifest={version:1,archive:{name:'gta3.img',bytes:whole.length,directory:{file:'directory.bin',bytes:directory.length,sha256:sha(directory)}},chunks,
  ranges:names.map((_,i)=>({offset:(1+i)*2048,length:2048,chunk:i,start:0})),resources:[]};
 files['manifest.json']=new TextEncoder().encode(JSON.stringify(manifest));
 const original=globalThis.fetch,base='https://pages.invalid/world/';
 globalThis.fetch=(async(url:URL)=>{const bytes=files[String(url).slice(base.length)];return bytes?new Response(bytes.slice()):new Response('missing',{status:404});}) as typeof fetch;
 try{
  // Two chunks' worth: reading the four leaves the last two decoded.
  setChunkCacheBudget(2*2048);
  const archive=await openStaticWorld(base,new AbortController().signal);
  for(const entry of archive.entries)expect((await readImgEntry(archive.file,entry))[0]).toBe(archive.entries.indexOf(entry)+1+40);
  expect(archive.stats()).toMatchObject({downloads:4,retainedBytes:2*2048});
  // The last read is still decoded; the first was dropped and is inflated again.
  await readImgEntry(archive.file,archive.entries[3]);expect(archive.stats().downloads).toBe(4);
  expect((await readImgEntry(archive.file,archive.entries[0]))[0]).toBe(41);expect(archive.stats()).toMatchObject({downloads:5,retainedBytes:2*2048});
 }finally{globalThis.fetch=original;setChunkCacheBudget(64*1024*1024);}
});

test('with Cache Storage keeping the bytes by checksum, a download passes the HTTP cache by, and comes from the kept copy after',async()=>{
 const {fetchStaticWorldBytes,WORLD_CACHE}=await import('../src/assets/staticWorldArchive');
 const {createHash}=await import('node:crypto');
 const raw=new TextEncoder().encode('chunk bytes'),resource={bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};
 const stores=new Map<string,Map<string,Response>>(),opened:string[]=[];
 const fakeCaches={open:async(name:string)=>{opened.push(name);if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name)!;
  return {match:async(key:string)=>store.get(key)?.clone(),put:async(key:string,response:Response)=>{store.set(key,response);}};}};
 const original=globalThis.fetch,hadCaches='caches' in globalThis,originalCaches=(globalThis as {caches?:unknown}).caches,modes:(RequestCache|undefined)[]=[];
 globalThis.fetch=(async(_url:URL,init?:RequestInit)=>{modes.push(init?.cache);return new Response(raw);}) as typeof fetch;
 (globalThis as {caches?:unknown}).caches=fakeCaches;
 try{
  const url=new URL('https://pages.invalid/world/chunks/k.bin');
  expect(new TextDecoder().decode(await fetchStaticWorldBytes(url,resource))).toBe('chunk bytes');
  expect(modes).toEqual(['no-store']);
  // The store is written after the bytes are handed back; once it has them, the network is not asked again.
  await expect.poll(()=>stores.get(WORLD_CACHE)?.size??0).toBe(1);
  expect(new TextDecoder().decode(await fetchStaticWorldBytes(url,resource))).toBe('chunk bytes');
  expect(modes).toEqual(['no-store']);expect(opened.every(name=>name===WORLD_CACHE)).toBe(true);
 }finally{globalThis.fetch=original;if(hadCaches)(globalThis as {caches?:unknown}).caches=originalCaches;else delete (globalThis as {caches?:unknown}).caches;}
});

test('a chunk kept in Cache Storage is checked by its gzip CRC rather than hashed again, and a damaged one is fetched again',async()=>{
 const {openStaticWorld,worldCacheKey,WORLD_CACHE}=await import('../src/assets/staticWorldArchive');
 const {gzipSync}=await import('node:zlib'),{createHash}=await import('node:crypto'),{vi}=await import('vitest');
 const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
 const names=['a.dff','b.dff','c.dff'],whole=img(names),directory=whole.slice(0,2048),files:Record<string,Uint8Array>={'directory.bin':directory};
 const chunks=names.map((_,i)=>{const raw=whole.slice((1+i)*2048,(2+i)*2048).fill(i,100,2048),packed=new Uint8Array(gzipSync(raw)),file=`chunks/${i}.bin`;files[file]=packed;return {file,bytes:packed.length,expandedBytes:raw.length,sha256:sha(packed)};});
 const manifest={version:1,archive:{name:'gta3.img',bytes:whole.length,directory:{file:'directory.bin',bytes:directory.length,sha256:sha(directory)}},chunks,
  ranges:names.map((_,i)=>({offset:(1+i)*2048,length:2048,chunk:i,start:0})),resources:[]};
 files['manifest.json']=new TextEncoder().encode(JSON.stringify(manifest));
 const store=new Map<string,Uint8Array>(),fakeCaches={open:async(name:string)=>{expect(name).toBe(WORLD_CACHE);return {
  match:async(key:string)=>store.has(key)?new Response(store.get(key)!.slice()):undefined,
  put:async(key:string,response:Response)=>{store.set(key,new Uint8Array(await response.arrayBuffer()));},
  delete:async(key:string)=>store.delete(key)};}};
 const original=globalThis.fetch,hadCaches='caches' in globalThis,originalCaches=(globalThis as {caches?:unknown}).caches,base='https://pages.invalid/world/',fetched:string[]=[];
 globalThis.fetch=(async(url:URL)=>{const path=String(url).slice(base.length);fetched.push(path);const bytes=files[path];return bytes?new Response(bytes.slice()):new Response('missing',{status:404});}) as typeof fetch;
 (globalThis as {caches?:unknown}).caches=fakeCaches;
 const digest=vi.spyOn(crypto.subtle,'digest'),hashed=()=>digest.mock.calls.map(call=>(call[1] as Uint8Array).byteLength);
 const readAll=async()=>{const archive=await openStaticWorld(base,new AbortController().signal);return Promise.all(archive.entries.map(async entry=>(await readImgEntry(archive.file,entry))[200]));};
 try{
  // The first play downloads each chunk, hashes it and keeps it.
  expect(await readAll()).toEqual([0,1,2]);
  expect(fetched.filter(p=>p.startsWith('chunks/')).sort()).toEqual(['chunks/0.bin','chunks/1.bin','chunks/2.bin']);
  await expect.poll(()=>store.size).toBe(4);
  // The next reads them from the kept copies, hashing only the directory.
  fetched.length=0;digest.mockClear();
  expect(await readAll()).toEqual([0,1,2]);
  expect(fetched).toEqual(['manifest.json']);expect(hashed()).toEqual([directory.length]);
  // A kept chunk damaged on disk fails its CRC: dropped, downloaded again (hashed), and kept afresh.
  const key=worldCacheKey(chunks[1].sha256),damaged=store.get(key)!.slice();damaged[damaged.length-6]^=0xff;store.set(key,damaged);
  fetched.length=0;digest.mockClear();
  expect(await readAll()).toEqual([0,1,2]);
  expect(fetched).toEqual(['manifest.json','chunks/1.bin']);expect(hashed()).toEqual([directory.length,chunks[1].bytes]);
  await expect.poll(()=>sha(store.get(key)!)).toBe(chunks[1].sha256);
 }finally{digest.mockRestore();globalThis.fetch=original;if(hadCaches)(globalThis as {caches?:unknown}).caches=originalCaches;else delete (globalThis as {caches?:unknown}).caches;}
});
