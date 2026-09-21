import {test,expect} from '@playwright/test';
/** CSetPieces' table is the script's own: ADD_SET_PIECE fills it and Init empties it. The browser read a list
 * out of the script's bytes ahead of time; it now uses the one the running script built. */
test('the set pieces are the ones the running script added',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling().scriptSetPieces().length),{timeout:30000}).toBeGreaterThan(0);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const live=mission.scriptSetPieces();
  for(let i=0;i<40&&game.state().setPieces.count!==live.length;i++)await new Promise(r=>setTimeout(r,100));
  const browser=game.setPieces?.()?.pieces??[];
  const same=(a:any,b:any)=>JSON.stringify(a)===JSON.stringify(b);
  return {count:game.state().setPieces.count,live:live.length,
   sameFirst:same(browser[0],live[0]),sameLast:same(browser[browser.length-1],live[live.length-1]),
   // CSetPieces::AddOne sorts the corners into a rect, so left is never past right nor bottom past top.
   sorted:live.every((p:any)=>p.area[0]<=p.area[2]&&p.area[1]<=p.area[3])};
 });
 // Running the opening produced the same table the read-ahead found, which is what makes the swap safe.
 expect(out.live).toBeGreaterThan(0);
 expect(out.count).toBe(out.live);
 expect(out.sameFirst).toBe(true);
 expect(out.sameLast).toBe(true);
 expect(out.sorted).toBe(true);
 expect(errors).toEqual([]);
});
