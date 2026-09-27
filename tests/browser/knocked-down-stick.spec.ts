import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** PlayerControlZelda does not run under CTaskComplexFallAndGetUp: the stick held while CJ is down does not build up the
 * move clips' blend ratio, so he gets up from standing rather than already running. */
test('the stick held through a knockdown does not wind up the move blend',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const state=()=>page.evaluate(()=>{const s=(window as any).__game.state();return {knockdown:s.knockdown,grounded:s.player.grounded,blend:s.nativeCharacter?.moveBlend??0};});
 await expect.poll(async()=>(await state()).grounded,{timeout:60000}).toBe(true);
 await page.evaluate(()=>{(window as any).__game.sim.knockdown=3;});
 await page.keyboard.down('KeyW');
 let peak=0;for(let s=await state();s.knockdown>0;s=await state()){peak=Math.max(peak,s.blend);await page.waitForTimeout(100);}
 await page.keyboard.up('KeyW');
 expect(peak).toBeLessThan(.05);
 expect(errors).toEqual([]);
});
