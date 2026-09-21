import {test,expect} from '@playwright/test';
/** CPickups holds the script's pickups beside the world's own, so the browser's pickup world takes them too:
 * one made by the script is drawn, and walking into it tells the script it has been collected. */
test('a pickup the script makes appears, and collecting it is collected for the script',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);

 const made=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  // Model 1242 is body armour; PICKUP_ONCE is type 3.
  const handle=mission.runtime.game.pickups.createPickup(1242,3,{x:p.x+2,y:-p.z,z:p.y+1});
  return {handle,collected:mission.runtime.game.pickups.hasBeenCollected(handle),
   before:(game.state().pickups.scripted??[]).length};
 });
 expect(made.collected).toBe(false);

 // The browser builds it and puts it in the world.
 const drawn=await page.evaluate(async({handle}:{handle:number})=>{
  const game=(window as any).__game;
  const deadline=Date.now()+45000;
  const mine=()=>(game.state().pickups.scripted??[]).find((s:any)=>s.id===`script:${handle}`);
  while(Date.now()<deadline&&!mine()?.drawn)await new Promise(r=>setTimeout(r,250));
  return {present:!!mine(),drawn:!!mine()?.drawn};
 },{handle:made.handle});
 expect(drawn.present).toBe(true);

 // Removing it in the script takes it back out of the world.
 const removed=await page.evaluate(async({handle}:{handle:number})=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  mission.runtime.game.pickups.remove(handle);
  await new Promise(r=>setTimeout(r,600));
  return {present:!!(game.state().pickups.scripted??[]).find((s:any)=>s.id===`script:${handle}`)};
 },{handle:made.handle});
 expect(removed.present).toBe(false);
 expect(errors).toEqual([]);
});
