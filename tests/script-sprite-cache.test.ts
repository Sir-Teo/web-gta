import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {readTxd} from '../src/assets/txd';
import {NativeScriptSprites,modulateScriptSprite} from '../src/ui/NativeScriptSprites';
const textures=()=>readTxd(readFileSync('public/play/world/files/models/txd/ld_otb2.txd'));

test('bound slots share a dictionary load, normalize texture names and release decoded resources on removal',async()=>{
 let calls=0;const sprites=new NativeScriptSprites(async name=>{expect(name).toBe('ld_otb2');calls++;return textures();}),bindings=[{dictionary:'ld_otb2',name:'BACKBET'},{dictionary:'ld_otb2',name:'ric1'}];
 sprites.setBindings(bindings);await sprites.settled();expect(calls).toBe(1);expect(sprites.pixelsFor(0)?.width).toBe(512);expect(sprites.pixelsFor(1)?.width).toBe(64);const revision=sprites.revision;sprites.setBindings(bindings.map(b=>({...b})));expect(sprites.revision).toBe(revision);expect(sprites.state().decoded).toBe(2);sprites.setBindings([]);expect(sprites.pixelsFor(0)).toBeUndefined();expect(sprites.state()).toMatchObject({pending:0,loaded:[],decoded:0,errors:[]});sprites.dispose();
});

test('an old dictionary request cannot replace a later binding generation or resurrect removed sprites',async()=>{
 const pending:((value:ReturnType<typeof textures>)=>void)[]=[],sprites=new NativeScriptSprites(()=>new Promise(resolve=>pending.push(resolve))),binding=[{dictionary:'ld_otb2',name:'backbet'}];
 sprites.setBindings(binding);const old=sprites.settled();await Promise.resolve();sprites.setBindings([]);sprites.setBindings(binding);const current=sprites.settled();await Promise.resolve();expect(pending.length).toBe(2);pending[0](textures());await old;expect(sprites.state()).toMatchObject({pending:1,loaded:[]});pending[1](textures());await current;expect(sprites.pixelsFor(0)?.height).toBe(512);sprites.dispose();expect(sprites.pixelsFor(0)).toBeUndefined();expect(sprites.state().loaded).toEqual([]);
});

test('missing textures and dictionary failures are observable and disposal ignores a late load',async()=>{
 const sprites=new NativeScriptSprites(async name=>{if(name==='missing')throw Error('dictionary download failed');return textures();});sprites.setBindings([{dictionary:'ld_otb2',name:'absent'},{dictionary:'missing',name:'test'}]);await sprites.settled();expect(sprites.pixelsFor(0)).toBeUndefined();expect(sprites.state().errors.join(' ')).toContain('dictionary download failed');expect(sprites.state().errors.join(' ')).toContain('ld_otb2/absent');sprites.dispose();
 let finish!:(value:ReturnType<typeof textures>)=>void;const late=new NativeScriptSprites(()=>new Promise(resolve=>finish=resolve));late.setBindings([{dictionary:'ld_otb2',name:'backbet'}]);const done=late.settled();await Promise.resolve();late.dispose();finish(textures());await done;expect(late.state()).toMatchObject({pending:0,loaded:[],decoded:0});
});

test('sprite tint multiplies RGB channels without replacing the source alpha',()=>{
 const input=new Uint8Array([255,128,64,192,8,16,32,0]);expect([...modulateScriptSprite(input,[128,64,255,99])]).toEqual([128,32,64,192,4,4,32,0]);expect([...input]).toEqual([255,128,64,192,8,16,32,0]);
});
