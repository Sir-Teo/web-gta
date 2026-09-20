import {test,expect} from '@playwright/test';
test('the spawn window with its LOD ring loads before the player moves',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state().player.grounded);
 const before=await page.evaluate(()=>(window as any).__game.state().importedInstances);
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__game.state();return s.following.requests>=1&&s.following.pending===null&&s.importedInstances>0?s.importedInstances:0;}),{timeout:30000}).toBeGreaterThan(before);
 const s=await page.evaluate(()=>{const s=(window as any).__game.state();return {requests:s.following.requests,instances:s.importedInstances,holds:s.following.holds,swap:s.following.lastSwap&&{latency:s.following.lastSwap.latencyMs,parts:s.following.lastSwap.parts,ms:s.following.lastSwap.ms},pos:s.player.position};});
 console.log('PRIME '+JSON.stringify({before,...s,errors}));
 expect(errors).toEqual([]);expect(s.holds.count).toBe(0);
});
