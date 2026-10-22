import {expect,test,vi} from 'vitest';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {ScmCameraFade} from '../src/engine/ScmCameraFade';
import type {ScmWorldCommands} from '../src/engine/ScmThread';
import capture from './fixtures/native-mission-fade-cleanup.json';
const integer=(n:number)=>{const b=new Uint8Array(5);b[0]=1;new DataView(b.buffer).setInt32(1,n,true);return [...b];};
const instruction=(op:number,...args:number[][])=>[op&255,op>>8,...args.flat()];
const wait=instruction(1,integer(1000));
for(const [index,row]of capture.fadeCases.entries())test(`DO_FADE owns the native mission fade flag ${index}`,()=>{
 const i=row.input,fade=vi.fn(),code=new Uint8Array([...instruction(0x16a,integer(i.milliseconds),integer(i.direction)),...wait]);
 const runtime=new ScmRuntime(code,{fade}as unknown as ScmWorldCommands);
 runtime.game.scriptHasFadedOut=i.flag;runtime.start(0,[],{mission:i.mission});runtime.process(100,20);
 expect(runtime.game.scriptHasFadedOut).toBe(row.native.flag);
 expect(fade.mock.calls.map(([ms,direction])=>({seconds:ms/1000,direction}))).toEqual(row.native.fades);
});
for(const [index,row]of capture.cleanupCases.entries())test(`mission cleanup follows native fade and restart gate ${index}`,()=>{
 const i=row.input,fade=vi.fn(),setPlayerControl=vi.fn(),world={fade,setPlayerControl,isPlayerRestarting:()=>i.playerState===1||i.playerState===2};
 const runtime=new ScmRuntime(new Uint8Array(wait),world as unknown as ScmWorldCommands);
 runtime.game.scriptHasFadedOut=i.flag;runtime.game.pads.setPlayerSafe(0,!!(i.padFlags&0x20));
 runtime.game.pads.setDisabled(0,'fireWeapon',true);
 runtime.start(0,[],{mission:true});runtime.process(100,20);runtime.terminateAllWithName('noname');
 expect(runtime.game.scriptHasFadedOut).toBe(row.native.flag);
 expect(runtime.game.pads.playerSafe[0]).toBe(!!(row.native.padFlags&0x20));
 expect(runtime.game.pads.disabled[0].fireWeapon).toBe(true);
 expect(fade.mock.calls.map(([ms,direction])=>({seconds:ms/1000,direction}))).toEqual(row.native.fades);
 expect(setPlayerControl.mock.calls).toEqual(row.native.fades.length?[[0,true]]:[]);
 if(row.native.fades.length)expect(fade).toHaveBeenCalledWith(500,1,100);
});
test('a mission which terminates faded out returns the shared camera to a visible scene',()=>{
 const fade=new ScmCameraFade(),world={fade:(ms:number,direction:number,now:number)=>fade.fade(ms,direction,now)};
 const code=new Uint8Array([...instruction(0x16a,integer(0),integer(0)),...instruction(1,integer(0)),...instruction(0x4e)]);
 const runtime=new ScmRuntime(code,world as unknown as ScmWorldCommands);runtime.start(0,[],{mission:true});
 runtime.process(100,20);fade.process(.02);expect(fade.value).toBe(255);
 runtime.process(120,20);for(let i=0;i<31;i++)fade.process(1/60);
 expect(runtime.active).toEqual([]);expect(fade.value).toBe(0);expect(fade.fading).toBe(false);expect(runtime.game.scriptHasFadedOut).toBe(false);
});
