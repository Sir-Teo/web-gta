import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CEntryExitManager's flags are the script's. The browser applied a read-ahead list at load and ignored the
 * running script's calls; they now reach the same entrances, so a change the script makes later lands too. */
test('the entrances the script switches are switched',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // The opening makes its own switch calls; they are counted as they are made.
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().entryExitFlags),{timeout:30000}).toBeGreaterThan(0);

 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const manager=game.entryExits();
  const named=manager.pool.find((e:any)=>e.name);
  const adapter=(mission as any).runtime.world;
  const before=named.flags;
  // ENABLE_ENTRY_EXIT by name reaches the entrance the manager holds.
  adapter.switchEntryExit(named.name,false);
  const off=named.flags;
  adapter.switchEntryExit(named.name,true);
  const on=named.flags;
  // SET_CLOSEST_ENTRY_EXIT_FLAG reaches the nearest one to a point.
  // m_recEntrance as left, bottom, right, top: the centre of it is the point to ask from.
  const [left,bottom,right,top]=named.rect;
  adapter.setClosestEntryExitFlag((left+right)/2,(bottom+top)/2,10,1,!(named.flags&1));
  const closest=named.flags;
  named.flags=before;
  return {before,off,on,closest,changedByName:off!==on,changedByPoint:closest!==on};
 });
 expect(out.changedByName).toBe(true);
 expect(out.changedByPoint).toBe(true);
 expect(errors).toEqual([]);
});
