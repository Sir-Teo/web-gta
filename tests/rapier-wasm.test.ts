import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {useRapierWasmFile} from '../scripts/rapierWasm.mjs';

const wasm=new Uint8Array([0,97,115,109,1,0,0,0]),base64=Buffer.from(wasm).toString('base64');
test('the compat build\'s inlined module, with the buffer taken of it, becomes the file\'s URL',()=>{
 const code=`function mg(){return dg(this,void 0,void 0,(function*(){yield uA({module_or_path:ng.toByteArray("${base64}").buffer})}))}`;
 expect(useRapierWasmFile(code,wasm,'url')).toBe('function mg(){return dg(this,void 0,void 0,(function*(){yield uA({module_or_path:url})}))}');
 expect(useRapierWasmFile(`x(ng.toByteArray("${base64}"))`,wasm,'url')).toBe('x(url)');
});
test('a package that inlines no module, two, or other bytes than the file fails the build',()=>{
 expect(()=>useRapierWasmFile('uA({module_or_path:bytes})',wasm,'url')).toThrow(/0 found/);
 expect(()=>useRapierWasmFile(`a.toByteArray("${base64}");b.toByteArray("${base64}")`,wasm,'url')).toThrow(/2 found/);
 expect(()=>useRapierWasmFile(`a.toByteArray("${base64}")`,new Uint8Array([0,97,115,109,2,0,0,0]),'url')).toThrow(/not the module/);
});
test('the installed package\'s file is the module it inlines',()=>{
 const dist=new URL('../node_modules/@dimforge/rapier3d-compat/dist/',import.meta.url);
 const code=readFileSync(new URL('rapier.mjs',dist),'utf8'),file=readFileSync(new URL('rapier_wasm3d_bg.wasm',dist));
 const out=useRapierWasmFile(code,file,'__rapierWasmUrl');
 expect(out.length).toBeLessThan(code.length/10);expect(out).toContain('module_or_path:__rapierWasmUrl}');
});
