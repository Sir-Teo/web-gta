import {expect,test} from 'vitest';
import {gzipSync} from 'node:zlib';
import {encodeScenePack,readScenePack} from '../src/assets/scenePack';

const read=(bytes:Uint8Array)=>readScenePack('unused',Promise.resolve(new Response(gzipSync(bytes))));
const positions=new Float32Array([1.5,-2,3.25,4]),file=new TextEncoder().encode('2dfx');
// Two views of one buffer, as the builder shares a geometry's buffer between its attributes.
const shared=new Uint16Array([7,8,9,10]);
const scene={parts:[{name:'grove',positions:{$native:'Float32Array',buffer:0,offset:0,length:16},index:{$native:'Uint16Array',buffer:2,offset:2,length:4},
 all:{$native:'Uint16Array',buffer:2,offset:0,length:8},texture:{$native:'File',name:'grove.txd',type:'application/octet-stream',buffer:1}}],spawn:{x:2495,z:1687}};

test('version 2 packages carry their buffers after the JSON and decode to the same typed values',async()=>{
 const pack=await read(encodeScenePack(scene,[new Uint8Array(positions.buffer),file,new Uint8Array(shared.buffer)]));
 const part=pack.parts[0];
 expect([...part.positions]).toEqual([...positions]);
 expect([...part.index]).toEqual([8,9]);expect([...part.all]).toEqual([7,8,9,10]);
 // Every buffer has its own ArrayBuffer; views of the same one share it.
 expect(part.index.buffer).toBe(part.all.buffer);expect(part.positions.buffer.byteLength).toBe(16);
 expect(part.texture.name).toBe('grove.txd');expect(new TextDecoder().decode(await part.texture.arrayBuffer())).toBe('2dfx');
 expect(pack.spawn).toEqual({x:2495,z:1687});
});

test('version 1 packages (base64 buffers inside the JSON) still read',async()=>{
 const b64=(bytes:Uint8Array)=>Buffer.from(bytes).toString('base64');
 const json=JSON.stringify({version:1,buffers:[b64(new Uint8Array(positions.buffer)),b64(file),b64(new Uint8Array(shared.buffer))],scene});
 const pack=await read(new TextEncoder().encode(json));
 expect([...pack.parts[0].positions]).toEqual([...positions]);expect([...pack.parts[0].index]).toEqual([8,9]);
});

test('a buffer table reaching past the package is refused',async()=>{
 const bytes=encodeScenePack(scene,[new Uint8Array(positions.buffer),file,new Uint8Array(shared.buffer)]);
 await expect(read(bytes.subarray(0,bytes.length-3))).rejects.toThrow('Invalid scene buffer');
});

test('the download reports its bytes as they arrive, against the length the server gives',async()=>{
 const gz=gzipSync(encodeScenePack(scene,[new Uint8Array(positions.buffer),file,new Uint8Array(shared.buffer)]));
 // Sent in small pieces, as a slow connection delivers it.
 const body=new ReadableStream<Uint8Array>({start(c){for(let at=0;at<gz.length;at+=16)c.enqueue(gz.subarray(at,at+16));c.close();}});
 const seen:[number,number|undefined][]=[];
 const pack=await readScenePack('unused',Promise.resolve(new Response(body,{headers:{'content-length':String(gz.length)}})),(received,total)=>seen.push([received,total]));
 expect(pack.spawn).toEqual({x:2495,z:1687});
 expect(seen.length).toBeGreaterThan(2);expect(seen.at(-1)).toEqual([gz.length,gz.length]);
 expect(seen.every(([r],i)=>i===0||r>seen[i-1][0])).toBe(true);
 // No length from the server: the bytes alone.
 const unsized:[number,number|undefined][]=[];
 await readScenePack('unused',Promise.resolve(new Response(gzipSync(encodeScenePack(scene,[new Uint8Array(positions.buffer),file,new Uint8Array(shared.buffer)])))),(r,t)=>unsized.push([r,t]));
 expect(unsized.at(-1)?.[1]).toBeUndefined();
});
