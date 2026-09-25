import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CGameLogic's trip skip: SET_UP_SKIP offers it; in a car the HUD shows the skip icon and "Trip Skip" (CHud::DrawTripSkip);
 * CONVERSATION_YES (the D-pad right, Y on the PC) fades out, and three seconds on the car is set down at the skip's
 * point, "Later that day..." (SKIP) in the bottom-right style. */
test('a trip skip takes the player’s car to the point the script set up',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x+6,y:-p.z+7,z:p.y},90);});
 await page.waitForFunction(car=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),car,{timeout:45000});
 await page.evaluate(car=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,car),car);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.state().nativeCar?.occupied||!!(window as any).__game.state().fleet?.occupied),{timeout:20000}).toBe(true);
 // Grove Street's own road, well away west: 250 units along it.
 const target=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,w=g.missionForProfiling().runtime.world;
  const node=w.nthClosestVehicleNode(p.x-250,-p.z,p.y,1);w.setUpSkip(node.x,node.y,node.z,90);return node;});
 await expect(page.locator('.trip-skip')).toBeVisible({timeout:10000});
 await expect(page.locator('.trip-skip span')).toHaveText(/trip skip/i);
 // Held a while: the headless page runs few frames a second, and the edge is read a frame after the pad sees the key.
 await page.keyboard.down('KeyY');await page.waitForTimeout(1500);await page.keyboard.up('KeyY');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.messages.big[1][0]?.key??null),{timeout:10000}).toBe('SKIP');
 await expect.poll(()=>page.evaluate(({car,target})=>{const q=(window as any).__game.missionForProfiling().vehicles.positionOf(car);return Math.hypot(q.x-target.x,q.y-target.y);},{car,target}),{timeout:30000}).toBeLessThan(6);
 await expect(page.locator('.trip-skip')).toBeHidden();
 expect(errors).toEqual([]);
});
