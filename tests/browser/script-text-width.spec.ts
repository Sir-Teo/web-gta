import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('original betting-shop and pool width instructions measure control names and numbers in the pending text style',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.nativeScriptFonts?.ready,undefined,{timeout:30000});
 const result=await page.evaluate(async()=>{
  const paths=['/src/assets/scm.ts','/src/assets/gxt.ts'],[decoder,text]=await Promise.all(paths.map(p=>import(/* @vite-ignore */ p))),g=(window as any).__game,m=g.missionForProfiling(),r=m.runtime,b=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),h=decoder.readScmHeader(b),otb=decoder.decodeScmInstructions(b,h.missions[7].start,h.missions[7].end),pool=decoder.decodeScmInstructions(b,h.missions[8].start,h.missions[8].end),intro=r.game.introText;
  const run=(first:number,last:number,locals:Record<number,number>={},floats:Record<number,number>={})=>{const code=new Uint8Array(last-first+2);code.set(b.subarray(first,last));code.set([0x4e,0],last-first);const slot=r.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;for(const [k,v] of Object.entries(locals))slot.thread.locals.setInt32(Number(k)*4,v,true);for(const [k,v] of Object.entries(floats))slot.thread.locals.setFloat32(Number(k)*4,v,true);slot.thread.run(g.gameTimeMs(),100,1);return slot.thread;};
  const style=(scale:number,font=0)=>Object.assign(intro.pending,{scale:{x:scale,y:2},fontStyle:font,proportional:true,textEdge:0});
  text.loadedText().loadMissionText('OTB');text.useTouchControlNames(false);text.setControlNaming({keys:true,pad:undefined});intro.count=0;intro.useTextCommands=2;style(Math.fround(.527));
  const site=otb.find((i:any)=>i.offset===352038),last=otb.find((i:any)=>i.offset===352087),thread=run(site.offset,last.end,{}, {454:60.1776008605957}),keyboard={width:thread.locals.getInt32(455*4,true),nextX:thread.locals.getFloat32(454*4,true),line:intro.lines[0].key};
  style(.5);const exit=otb.find((i:any)=>i.offset===352134),back=otb.find((i:any)=>i.offset===352174),ex=run(exit.offset,exit.end).locals.getInt32(455*4,true),bk=run(back.offset,back.end).locals.getInt32(455*4,true);
  text.setControlNaming({keys:false});text.useTouchControlNames(true);style(.5);const touch=run(site.offset,site.end).locals.getInt32(455*4,true);text.useTouchControlNames(false);text.setControlNaming({keys:true});
  text.loadedText().loadMissionText('POOL');style(.5);const numbered=pool.find((i:any)=>i.offset===418612),positive=run(numbered.offset,numbered.end,{39:1234}).locals.getInt32(41*4,true),negative=run(numbered.offset,numbered.end,{39:-12}).locals.getInt32(41*4,true);
  return {keyboard,ex,bk,touch,positive,negative,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 });
 expect(result.keyboard.width).toBe(97);expect(result.keyboard.nextX).toBeCloseTo(165.1776,3);expect(result.keyboard.line).toBe('XSELECT');expect(result.ex).toBe(43);expect(result.bk).toBe(44);expect(result.touch).toBeGreaterThan(0);expect(result.touch).not.toBe(92);expect(result.positive).toBe(63);expect(result.negative).toBe(41);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
