import {afterEach,expect,test,vi} from 'vitest';
import {NativeScriptFontLoader} from '../src/ui/NativeScriptFontLoader';
import type {NativeScriptFonts} from '../src/ui/NativeScriptFonts';
import {AssetFormatError,WorldDownloadError} from '../src/assets/binary';
const font=()=>({dispose:vi.fn()}) as unknown as NativeScriptFonts;
afterEach(()=>vi.useRealTimers());
test('the font loader recovers a connection failure, clears its error and transfers one atlas to the layer',async()=>{
 vi.useFakeTimers();const fonts=font(),install=vi.fn();let calls=0;const loader=new NativeScriptFontLoader(async()=>{if(++calls===1)throw new WorldDownloadError('offline');return fonts;},install);
 try{await loader.settled();expect(loader.state()).toEqual({pending:false,retrying:true,error:'Error: offline'});await vi.advanceTimersByTimeAsync(1999);expect(calls).toBe(1);await vi.advanceTimersByTimeAsync(1);await loader.settled();expect(calls).toBe(2);expect(install).toHaveBeenCalledExactlyOnceWith(fonts);expect(loader.state()).toEqual({pending:false,retrying:false,error:null});loader.dispose();expect(fonts.dispose).not.toHaveBeenCalled();}finally{loader.dispose();fonts.dispose();}
});
test('teardown cancels a scheduled font retry',async()=>{
 vi.useFakeTimers();const load=vi.fn(async()=>{throw new WorldDownloadError('offline');}),loader=new NativeScriptFontLoader(load,vi.fn());await loader.settled();loader.dispose();await vi.advanceTimersByTimeAsync(30000);expect(load).toHaveBeenCalledTimes(1);expect(loader.state()).toEqual({pending:false,retrying:false,error:null});
});
test('an atlas arriving after teardown is disposed rather than installed',async()=>{
 let finish!:(fonts:NativeScriptFonts)=>void;const install=vi.fn(),fonts=font(),loader=new NativeScriptFontLoader(()=>new Promise(resolve=>finish=resolve),install);await Promise.resolve();loader.dispose();finish(fonts);await loader.settled();expect(install).not.toHaveBeenCalled();expect(fonts.dispose).toHaveBeenCalledTimes(1);
});
test('invalid font content stays an observable error without a retry loop',async()=>{
 vi.useFakeTimers();const load=vi.fn(async()=>{throw new AssetFormatError('bad atlas');}),loader=new NativeScriptFontLoader(load,vi.fn());try{await loader.settled();await vi.advanceTimersByTimeAsync(60000);expect(load).toHaveBeenCalledTimes(1);expect(loader.state()).toEqual({pending:false,retrying:false,error:'Error: bad atlas'});}finally{loader.dispose();}
});
test('teardown before the deferred initial load prevents its download from starting',async()=>{
 const load=vi.fn(async()=>font()),loader=new NativeScriptFontLoader(load,vi.fn());loader.dispose();await loader.settled();expect(load).not.toHaveBeenCalled();
});
