import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTheCarGenerators holds the script's generators in the same array as the world's, and CStreaming will not
 * bring in a model the script has suppressed. Both reach the browser's fleet. */
test('a car generator the script makes joins the world’s, and a suppressed model is passed over',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);

 const made=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  // The opening's own generators reach the fleet on the first frame after the script starts; wait for that to
  // settle so what follows measures the one this test makes.
  let settled=game.state().fleet.records;
  for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,100));const now=game.state().fleet.records;if(now===settled)break;settled=now;}
  const before=settled,scriptedBefore=mission.scriptCarGenerators().length;
  const slot=mission.runtime.game.carGenerators.create({position:[p.x+8,-p.z,p.y],angle:0,modelId:411,
   primaryColour:-1,secondaryColour:-1,forceSpawn:true,alarmChance:0,doorLockChance:0,minDelay:0,maxDelay:0},0);
  await new Promise(r=>setTimeout(r,600));
  return {slot,before,after:game.state().fleet.records,scriptedBefore,scripted:mission.scriptCarGenerators().length};
 });
 // The opening already made generators of its own, so this one joins them rather than being the first.
 expect(made.slot).toBeGreaterThanOrEqual(0);
 expect(made.scriptedBefore).toBeGreaterThan(100);
 expect(made.scripted).toBe(made.scriptedBefore+1);
 // The fleet's record list grew by the one just made.
 expect(made.after).toBe(made.before+1);

 // SUPPRESS_CAR_MODEL takes a model out of the traffic draw and the clearing form puts it back.
 const suppressed=await page.evaluate(async()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),fleet=game.fleet();
  const draws=()=>Array.from({length:60},()=>fleet.trafficModel());
  const freely=new Set(draws());
  const pick=[...freely][0];
  mission.runtime.game.suppressedCarModels.add(pick);
  const after=new Set(draws());
  mission.runtime.game.suppressedCarModels.delete(pick);
  const restored=new Set(draws());
  return {pick,drawnBefore:freely.has(pick),drawnWhileSuppressed:after.has(pick),drawnAfter:restored.has(pick),
   stillDraws:after.size>0};
 });
 expect(suppressed.drawnBefore).toBe(true);
 expect(suppressed.drawnWhileSuppressed).toBe(false);
 // Suppressing one model does not stop traffic having models to draw.
 expect(suppressed.stillDraws).toBe(true);
 expect(errors).toEqual([]);
});
