import {test,expect} from '@playwright/test';

/** INITIAL sets the world up in one frame, with no WAIT, and MAIN loads INITIL2 into the same mission space straight
 * after. A command that suspended INITIAL (CREATE_OBJECT once waited for a model's collision) left it to resume in
 * INITIL2's bytes: both gave up, and everything after, Sweet's car point ($142) among it, never ran. */
test('INITIAL and INITIL2 run to their end at the start of the story',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await page.waitForFunction(()=>(window as any).__game.missionForProfiling()?.runtime.active.some((a:any)=>a.thread.name==='INTRO'),undefined,{timeout:60000});
 const setup=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),r=m.runtime;
  const main=r.active.find((a:any)=>a.thread.name==='MAIN').thread.globals as DataView;
  return {gaveUp:m.snapshot().gaveUp,setupRunning:r.active.some((a:any)=>/^INITI/.test(a.thread.name)),
   sweetsCar:[142,143,144].map(n=>Math.round(main.getFloat32(n*4,true)*100)/100)};});
 expect(setup).toEqual({gaveUp:[],setupRunning:false,sweetsCar:[2473.53,-1690.21,13]});
 expect(errors).toEqual([]);
});
