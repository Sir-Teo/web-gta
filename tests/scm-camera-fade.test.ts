import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmCameraFade} from '../src/engine/ScmCameraFade';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {readScmHeader} from '../src/assets/scm';

test('native screen fade retains its extra completion frame and reverses from the current alpha',()=>{
 const fade=new ScmCameraFade();fade.fade(1000,0,100);
 fade.process(0.5);expect(fade.value).toBe(127);expect(fade.fading).toBe(true);
 fade.process(0.5);expect(fade.value).toBe(255);expect(fade.fading).toBe(true);
 fade.process(0.02);expect(fade.fading).toBe(false);
 fade.fade(1000,1,1120);fade.process(0.25);expect(fade.value).toBe(191);
 fade.fade(1000,0,1370);fade.process(0.25);expect(fade.value).toBe(255);
 fade.fade(1000,1,1620);fade.process(1);expect(fade.value).toBe(0);expect(fade.fading).toBe(false);
});

test('zero-duration fade preserves the source asymmetric branches',()=>{
 const fade=new ScmCameraFade();fade.fade(0,0,0);fade.process(0);
 expect(fade.value).toBe(255);expect(fade.fading).toBe(true);
 fade.process(0);expect(fade.fading).toBe(false);
 fade.fade(0,1,0);fade.process(1);expect(fade.value).toBe(255);expect(fade.fading).toBe(true);
});

test('original MAIN invokes its fade, runs the game-state prologue and stops at the first world request',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
 const fade=new ScmCameraFade(),runtime=new ScmRuntime(bytes,fade);
 const main=runtime.start(readScmHeader(bytes).entry).thread;
 expect(()=>runtime.process(100,20)).toThrow('REQUEST_COLLISION');
 expect(main.ip).toBe(56022);expect(fade.fading).toBe(true);expect(fade.duration).toBe(0);
 expect(runtime.game.totalNumberOfMissions).toBe(147);expect(runtime.game.clock.hours).toBe(8);
 expect(fade.direction).toBe(0);expect(fade.startedAt).toBe(100);
 fade.process(0.02);expect(fade.value).toBe(255);
});
