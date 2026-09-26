import {test,expect} from '@playwright/test';
/** Loading a game saved at a save point does not replay the new game's opening: INTRO is ended as it starts, the
 * screen comes up, and the player is where he saved at the saved hour. */
test('a saved game skips INTRO and keeps the save point\'s place and clock',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('web-gta.progress.v1',JSON.stringify({version:1,money:1234,savedLocation:{x:2510,y:-1680,z:13.2,heading:1,timeMinutes:600}}));});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 const intro=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.active.some((a:any)=>a.thread.base>0&&a.thread.name==='INTRO'));
 // MAIN launches INTRO a few seconds in; it must be gone again at once, and stay gone.
 await page.waitForFunction(()=>((window as any).__game.missionForProfiling()?.runtime.active.length??0)>2,undefined,{timeout:60000});
 for(let i=0;i<10;i++){await page.waitForTimeout(3000);expect(await intro()).toBe(false);}
 const state=await page.evaluate(()=>{const s=(window as any).__game.state();return {fade:s.fadeAlpha,p:s.player.position,minutes:s.timeMinutes,heading:s.player.heading};});
 expect(state.fade).toBe(0);
 expect(Math.hypot(state.p.x-2510,state.p.z-1680)).toBeLessThan(3);
 // The saved 10:00 runs on; INTRO's own 6:30 never took.
 expect(state.minutes).toBeGreaterThanOrEqual(600);expect(state.minutes).toBeLessThan(720);
 expect(errors).toEqual([]);
});
