import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CGameLogic::Update starts WASTED at PEDSTATE_DEAD: CTaskSimpleDie raises CEventDeath only once the death clip has
 * finished and the body stands (or is in water). CJ killed high in the air falls first; "wasted" waits for the ground. */
test('CJ killed in mid-air is wasted only once he lands',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;g.placePlayer(p.x,p.y+60,p.z);g.sim.killPlayer();});
 const wasted=page.locator('.white-middle-message');
 // Record, frame by frame, whether "wasted" showed while he was still off the ground.
 const early=await page.evaluate(()=>new Promise<{earlyWasted:boolean;landed:boolean}>(resolve=>{const g=(window as any).__game;let earlyWasted=false;
  const t=performance.now(),f=()=>{const s=g.state(),shown=document.querySelector('.white-middle-message')?.textContent==='wasted';
   if(shown&&!s.player.grounded&&!s.player.swimming)earlyWasted=true;
   if(s.player.grounded||performance.now()-t>60000)resolve({earlyWasted,landed:s.player.grounded});else requestAnimationFrame(f);};requestAnimationFrame(f);}));
 expect(early.landed).toBe(true);
 expect(early.earlyWasted).toBe(false);
 await expect(wasted).toHaveText('wasted',{timeout:60000});
 expect(errors).toEqual([]);
});
