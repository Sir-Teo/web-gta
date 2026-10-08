import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** CREATE_SEARCHLIGHT and IS_CHAR_IN_SEARCHLIGHT (MAF4's Area 69, WUZI2): CTheScripts' script searchlights, whose
 * beam CHeli::SearchLightCone draws and whose lit ellipse on the ground the scripts test (ScmSearchlights.ts). None of
 * the searchlight commands had a world hook: the beams were never drawn and the stealth tests never answered. */
test('a script searchlight lights CJ where its beam meets the ground, and lets him go when it is pointed away',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const light=await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world,p=w.pedPosition(1);
  return w.createSearchlight({x:p.x+6,y:p.y,z:p.z+15},{x:p.x,y:p.y,z:p.z-1},20,.3);});
 const lit=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.pedIsInSearchlight(h,1),light);
 await expect.poll(lit,{timeout:5000}).toBe(true);
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.charInAnySearchlight(1))).toBe(light);
 await page.screenshot({path:test.info().outputPath('searchlight.png')});
 // Swung 15 units off along the ground at 2 a frame: he is in the dark.
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world,p=w.pedPosition(1);w.moveSearchlightBetweenCoords(h,{x:p.x+15,y:p.y+15,z:p.z},{x:p.x+16,y:p.y+16,z:p.z},2);},light);
 await expect.poll(lit,{timeout:5000}).toBe(false);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deleteSearchlight(h),light);
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.searchlightExists(h),light)).toBe(false);
 expect(errors).toEqual([]);
});
