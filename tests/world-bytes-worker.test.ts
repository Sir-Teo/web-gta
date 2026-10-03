import {afterEach,expect,test,vi} from 'vitest';

/** The page's world bytes go to a worker; it answers by id, and the page rebuilds the error kinds the callers tell
 * apart. A worker that cannot start leaves the page to do the work itself. */
type Posted={id:number;abort?:boolean;url:string;resource:{bytes:number;sha256:string};chunk?:boolean;gzip?:boolean};
class FakeWorker{
 static last?:FakeWorker;static fail=false;
 posted:Posted[]=[];onmessage?:(event:{data:unknown})=>void;onerror?:()=>void;terminated=false;
 constructor(readonly url:URL){FakeWorker.last=this;if(FakeWorker.fail)queueMicrotask(()=>this.onerror?.());}
 postMessage(data:Posted){this.posted.push(data);}
 reply(data:unknown){this.onmessage?.({data});}
 terminate(){this.terminated=true;}
}
const g=globalThis as {document?:unknown;Worker?:unknown};
afterEach(()=>{delete g.document;delete g.Worker;FakeWorker.last=undefined;FakeWorker.fail=false;vi.resetModules();});
async function load(){
 g.document={};g.Worker=FakeWorker;vi.resetModules();
 return {...await import('../src/assets/staticWorldArchive'),...await import('../src/assets/binary')};
}
const resource={bytes:3,sha256:'a'.repeat(64)},url=new URL('https://pages.invalid/world/chunks/0.bin');

test('a page request is answered by the worker, by id, with its bytes or the kind of failure',async()=>{
 const {fetchStaticWorldBytes,worldChunk,WorldDownloadError,AssetFormatError}=await load();
 const first=fetchStaticWorldBytes(url,resource),second=worldChunk(url,{...resource,expandedBytes:9}),third=fetchStaticWorldBytes(url,resource,undefined,true);
 const worker=FakeWorker.last!;expect(String(worker.url)).toMatch(/worldBytes\.worker\.ts$/);
 expect(worker.posted.map(p=>[p.id,!!p.chunk,!!p.gzip])).toEqual([[0,false,false],[1,true,false],[2,false,true]]);
 expect(worker.posted[1].resource).toEqual({bytes:3,sha256:resource.sha256,expandedBytes:9});
 worker.reply({id:1,error:{kind:'format',message:'Incomplete expanded world chunk.'}});
 worker.reply({id:0,bytes:new Uint8Array([1,2,3])});
 worker.reply({id:2,error:{kind:'download',message:'World content download failed (503)'}});
 expect([...await first]).toEqual([1,2,3]);
 await expect(second).rejects.toBeInstanceOf(AssetFormatError);await expect(second).rejects.toThrow('Incomplete');
 await expect(third).rejects.toBeInstanceOf(WorldDownloadError);
});

test('an abort settles at once and tells the worker; a late answer is dropped',async()=>{
 const {fetchStaticWorldBytes}=await load();
 const controller=new AbortController(),request=fetchStaticWorldBytes(url,resource,controller.signal),worker=FakeWorker.last!;
 controller.abort(new DOMException('left','AbortError'));
 await expect(request).rejects.toThrow('left');
 expect(worker.posted.at(-1)).toEqual({id:0,abort:true});
 worker.reply({id:0,bytes:new Uint8Array(3)});
 // An already-aborted signal posts nothing.
 const gone=new AbortController();gone.abort(new Error('gone'));
 await expect(fetchStaticWorldBytes(url,resource,gone.signal)).rejects.toThrow('gone');expect(worker.posted).toHaveLength(2);
});

test('a worker that cannot start leaves the work to the page',async()=>{
 FakeWorker.fail=true;
 const {fetchStaticWorldBytes}=await load();
 const {createHash}=await import('node:crypto');const raw=new Uint8Array([7,8,9]);
 const original=globalThis.fetch;globalThis.fetch=(async()=>new Response(raw)) as unknown as typeof fetch;
 try{
  const bytes=await fetchStaticWorldBytes(url,{bytes:3,sha256:createHash('sha256').update(raw).digest('hex')});
  expect([...bytes]).toEqual([7,8,9]);expect(FakeWorker.last!.terminated).toBe(true);
  // Later requests go straight to the page's own fetch.
  const posted=FakeWorker.last!.posted.length;
  await fetchStaticWorldBytes(url,{bytes:3,sha256:createHash('sha256').update(raw).digest('hex')});
  expect(FakeWorker.last!.posted.length).toBe(posted);
 }finally{globalThis.fetch=original;}
});
