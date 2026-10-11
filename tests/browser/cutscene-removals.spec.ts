import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** HideRequestedObjects: a .cut's remove line hides the objects of its model within 1.5 of its point, the script's own as
 * well as the map's (CWorld::FindObjectsOfTypeInRange), and DeleteCutsceneData shows them again. ZERO_2 swaps Zero's
 * wardrobe for the cast's copy. */
test('a cutscene hides the script object its remove line names, and shows it again on clear',async({page})=>{
 test.setTimeout(600000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:180000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:180000});
 await endStoryMission(page);
 const handle=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.game.currentArea=6;
  const o=m.runtime.game.objects.create('zerowardrobe',{x:-2221.58,y:133.35,z:1036.4},{external:false,missionCleanup:false});return o.handle;});
 const visible=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().scriptObjects().find((o:any)=>o.handle===h)?.visible,handle);
 expect(await visible()).toBe(true);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().world.loadCutscene('ZERO_2'));
 await page.waitForFunction(()=>(window as any).__game.missionForProfiling().world.cutsceneState()?.state==='loaded',undefined,{timeout:180000});
 await page.evaluate(()=>(window as any).__game.missionForProfiling().world.startCutscene());
 await expect.poll(visible,{timeout:30000}).toBe(false);
 expect(await visible()).toBe(false);
 await page.evaluate(()=>{(window as any).__game.skipCutscene();(window as any).__game.missionForProfiling().world.clearCutscene();});
 expect(await visible()).toBe(true);
 expect(errors).toEqual([]);
});
