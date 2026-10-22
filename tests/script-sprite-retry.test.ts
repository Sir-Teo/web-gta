import {readFileSync} from 'node:fs';
import {afterEach,expect,test,vi} from 'vitest';
import {readTxd} from '../src/assets/txd';
import {AssetFormatError,WorldDownloadError} from '../src/assets/binary';
import {NativeScriptSprites,createNativeScriptSprites} from '../src/ui/NativeScriptSprites';
const open=vi.hoisted(()=>vi.fn());vi.mock('../src/assets/staticWorldArchive',()=>({openStaticWorld:(...args:unknown[])=>open(...args)}));
const textures=()=>readTxd(readFileSync('public/play/world/files/models/txd/ld_otb2.txd')),binding=[{dictionary:'ld_otb2',name:'backbet'}];
afterEach(()=>vi.useRealTimers());
test('a connection failure retries unchanged bound slots after the delay and invalidates the cached frame',async()=>{
 vi.useFakeTimers();let calls=0;const sprites=new NativeScriptSprites(async()=>{if(++calls===1)throw new WorldDownloadError('connection dropped');return textures();});
 try{sprites.setBindings(binding);await sprites.settled();const failed=sprites.revision;expect(sprites.state()).toMatchObject({pending:0,retrying:1,loaded:[]});sprites.setBindings(binding);await vi.advanceTimersByTimeAsync(1999);expect(calls).toBe(1);await vi.advanceTimersByTimeAsync(1);await sprites.settled();expect(calls).toBe(2);expect(sprites.pixelsFor(0)?.width).toBe(512);expect(sprites.revision).toBeGreaterThan(failed);expect(sprites.state()).toMatchObject({retrying:0,loaded:['ld_otb2'],errors:[]});}finally{sprites.dispose();}
});
test('repeated connection failures back off and removal/disposal cancel their pending retries',async()=>{
 vi.useFakeTimers();let calls=0;const sprites=new NativeScriptSprites(async()=>{calls++;throw new WorldDownloadError('offline');});
 try{sprites.setBindings(binding);await sprites.settled();await vi.advanceTimersByTimeAsync(2000);expect(calls).toBe(2);await vi.advanceTimersByTimeAsync(3999);expect(calls).toBe(2);await vi.advanceTimersByTimeAsync(1);expect(calls).toBe(3);sprites.setBindings([]);expect(sprites.state().retrying).toBe(0);await vi.advanceTimersByTimeAsync(30000);expect(calls).toBe(3);sprites.setBindings(binding);await sprites.settled();expect(calls).toBe(4);sprites.dispose();await vi.advanceTimersByTimeAsync(30000);expect(calls).toBe(4);}finally{sprites.dispose();}
});
test('format errors remain visible and do not schedule network retries',async()=>{
 vi.useFakeTimers();const fetch=vi.fn(async()=>{throw new AssetFormatError('missing or invalid dictionary');}),sprites=new NativeScriptSprites(fetch);
 try{sprites.setBindings(binding);await sprites.settled();expect(sprites.state()).toMatchObject({retrying:0,errors:['Error: missing or invalid dictionary']});await vi.advanceTimersByTimeAsync(60000);expect(fetch).toHaveBeenCalledTimes(1);}finally{sprites.dispose();}
});
test('a retry finishing after removal cannot revive its old dictionary generation',async()=>{
 vi.useFakeTimers();let calls=0,finish!:(value:ReturnType<typeof textures>)=>void;const sprites=new NativeScriptSprites(()=>{if(++calls===1)return Promise.reject(new WorldDownloadError('offline'));return new Promise(resolve=>finish=resolve);});
 try{sprites.setBindings(binding);await sprites.settled();await vi.advanceTimersByTimeAsync(2000);const late=sprites.settled();expect(calls).toBe(2);sprites.setBindings([]);finish(textures());await late;expect(sprites.state()).toMatchObject({pending:0,retrying:0,loaded:[],decoded:0});}finally{sprites.dispose();}
});

test('a failed archive open is released so the dictionary retry can open a fresh source',async()=>{
 vi.useFakeTimers();const bytes=Uint8Array.from(readFileSync('public/play/world/files/models/txd/ld_otb2.txd'));open.mockRejectedValueOnce(new WorldDownloadError('manifest connection failed')).mockResolvedValue({manifest:{resources:[{path:'models/txd/ld_otb2.txd'}]},resource:async()=>({arrayBuffer:async()=>bytes.buffer})});const sprites=createNativeScriptSprites('fixture/');
 try{sprites.setBindings(binding);await sprites.settled();expect(open).toHaveBeenCalledTimes(1);expect(sprites.state().retrying).toBe(1);await vi.advanceTimersByTimeAsync(2000);await sprites.settled();expect(open).toHaveBeenCalledTimes(2);expect(sprites.pixelsFor(0)?.width).toBe(512);expect(sprites.state().errors).toEqual([]);}finally{sprites.dispose();open.mockReset();}
});
