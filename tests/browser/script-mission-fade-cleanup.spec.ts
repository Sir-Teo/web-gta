import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('terminating a mission with an outstanding fade-out restores the shared camera and control',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const id=await page.evaluate(()=>{
  const m=(window as any).__game.missionForProfiling();
  const integer=(n:number)=>{const b=new Uint8Array(5);b[0]=1;new DataView(b.buffer).setInt32(1,n,true);return [...b];};
  const op=(n:number,...a:number[][])=>[n&255,n>>8,...a.flat()];
  const code=new Uint8Array([...op(0x1b4,integer(0),integer(0)),...op(0x16a,integer(500),integer(0)),...op(1,integer(1500)),...op(0x4e)]);
  return m.runtime.start(0,[],{space:code,mission:true}).id;
 });
 await page.waitForFunction(()=>{const m=(window as any).__game.missionForProfiling();return m.fade.value===255&&m.runtime.game.scriptHasFadedOut;},undefined,{timeout:15000});
 const black=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return{fade:m.snapshot().fade,control:m.playerControl,safe:m.runtime.game.pads.playerSafe[0]};});
 expect(black.control).toBe(false);expect(black.safe).toBe(true);
 await page.waitForFunction(id=>{const m=(window as any).__game.missionForProfiling();return !m.runtime.active.some((s:any)=>s.id===id)&&m.fade.value===0&&!m.fade.fading&&m.playerControl;},id,{timeout:15000});
 const final=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return{fade:m.snapshot().fade,control:m.playerControl,safe:m.runtime.game.pads.playerSafe[0],flag:m.runtime.game.scriptHasFadedOut,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 writeFileSync('artifacts/script-mission-fade-cleanup.json',JSON.stringify({black,final,errors},null,2));
 expect(final.safe).toBe(false);expect(final.flag).toBe(false);expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
