import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {Matrix4} from 'three';
import {build} from 'rolldown';
import {mkdtemp,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import type {NativeAnimation} from '../src/assets/ifp';

async function ifp(){
 const temporary=await mkdtemp(join(tmpdir(),'web-gta-swim-motion-'));
 await build({input:resolve('src/assets/ifp.ts'),platform:'node',output:{file:join(temporary,'ifp.mjs'),format:'esm'}});
 try{return await import(pathToFileURL(join(temporary,'ifp.mjs')).href);}
 finally{await rm(temporary,{recursive:true,force:true});}
}

test('strokes carry root motion, tread/glide/dive stay in place',{timeout:60000},async()=>{
 const {readIfp}=await ifp();
 const {swimMotion,swimRootTrack}=await import('../src/animation/swimMotion');
 const clips=new Map<string,NativeAnimation>(readIfp(new Uint8Array(readFileSync('public/play/world/files/animations/swim.ifp'))).animations.map((a:NativeAnimation)=>[a.name.toLowerCase(),a]));
 const basis=new Matrix4();
 // Breaststroke travels (native x/y plane; loops are in-place, so sample mid-cycle).
 const breast=clips.get('swim_breast')!;
 expect(swimRootTrack(breast)).toBeGreaterThanOrEqual(0);
 const stroke=swimMotion(breast,{track:swimRootTrack(breast)}).between(breast.duration*.1,breast.duration*.4,basis);
 expect(Math.hypot(stroke.x,stroke.y)).toBeGreaterThan(0);
 // Tread, glide and dive are in-place: the servo and dive rate own height.
 for(const name of ['swim_tread','swim_glide','swim_dive_under']){
  expect(swimRootTrack(clips.get(name)!),name).toBe(-1);
 }
 // Missing translation tracks fail before simulation advances.
 expect(()=>swimMotion(breast,{track:999})).toThrow();
});
