import {test,expect} from '@playwright/test';
/** CStuntJumpManager's list is built by the script's own ADD_STUNT_JUMP. The browser read a list out of the
 * script's bytes ahead of time; it now uses the one the running script built. */
test('the stunt jumps are the ones the running script added',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling().scriptStuntJumps().length),{timeout:30000}).toBeGreaterThan(0);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const live=mission.scriptStuntJumps();
  // Wait for the frame that hands the live list over.
  for(let i=0;i<40&&game.state().stuntJumps.jumps!==live.length;i++)await new Promise(r=>setTimeout(r,100));
  const jumps=game.stuntJumps?.()?.jumps??[];
  return {browser:game.state().stuntJumps.jumps,live:live.length,
   sameFirstId:jumps[0]?.id===live[0]?.id,sameLastId:jumps[jumps.length-1]?.id===live[live.length-1]?.id,
   // Every id is the offset of the command that added it, which is how the save keys survive the swap.
   idsAreOffsets:live.every((j:any)=>j.id===`jump:${j.offset}`)};
 });
 // Running the opening produced the same jumps the read-ahead found, which is what makes the swap safe.
 expect(out.live).toBeGreaterThan(0);
 expect(out.browser).toBe(out.live);
 expect(out.sameFirstId).toBe(true);
 expect(out.sameLastId).toBe(true);
 expect(out.idsAreOffsets).toBe(true);
 expect(errors).toEqual([]);
});
