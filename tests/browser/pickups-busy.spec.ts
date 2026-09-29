import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CPickups::Update skips the player's pickups while he runs CTaskComplexEnterCarAsDriver, the walk to the door
 * included: cash under CJ as he heads for a car is not taken until he is on his own again. */
test('cash is not picked up while CJ walks to a car door',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().nativeCar!=null),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().carEntry.phase),{timeout:10000}).toBe('approach');
 const before=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;g.moneyDrops().drop({...p},50);return g.sim.money;});
 // A few frames of the walk over the wads.
 const during=await page.evaluate(()=>new Promise<number>(resolve=>{let n=0;const g=(window as any).__game,f=()=>{if(++n<20&&g.state().carEntry.phase==='approach')requestAnimationFrame(f);else resolve(g.sim.money);};requestAnimationFrame(f);}));
 expect(during).toBe(before);
 expect(errors).toEqual([]);
});
