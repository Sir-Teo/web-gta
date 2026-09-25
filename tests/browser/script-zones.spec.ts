import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTheZones' info records are the script's. The browser read a copy out of the script's bytes before anything
 * ran them, which is a new game's profile and nothing later; it now reads the live table, so what the script
 * changes while it runs is what the population sees. */
test('the zone the fleet reads is the one the script is holding',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fleet?.zone?.zoneInfoIndex??-1),{timeout:30000}).toBeGreaterThanOrEqual(0);

 // At the start the live table and the one read ahead of time agree, which is what running the opening should
 // have produced; the run is only worth making if it lands on the same profile.
 const agreed=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),zone=game.state().fleet.zone;
  const live=mission.scriptZoneInfo(zone.zoneInfoIndex);
  return {index:zone.zoneInfoIndex,popType:zone.populationType,livePopType:live.popType,
   gang:zone.gangStrength,liveGang:live.gangStrength,noCops:zone.noCops,liveNoCops:live.noCops};
 });
 expect(agreed.livePopType).toBe(agreed.popType);
 expect(agreed.liveGang).toEqual(agreed.gang);
 expect(agreed.liveNoCops).toBe(agreed.noCops);

 // And a change the script makes after it has started reaches the fleet, which the read-ahead copy could not do.
 const changed=await page.evaluate(async({index}:{index:number})=>{
  const game=(window as any).__game,mission=game.missionForProfiling();
  const info=mission.runtime.game.zones.at(index);
  const before=game.state().fleet.zone.dealerStrength;
  info.dealerStrength=200;info.noCops=!info.noCops;
  await new Promise(r=>setTimeout(r,800));
  const after=game.state().fleet.zone;
  info.dealerStrength=before;
  return {before,after:after.dealerStrength,noCops:after.noCops,expectedNoCops:info.noCops};
 },{index:agreed.index});
 expect(changed.after).toBe(200);
 expect(changed.noCops).toBe(changed.expectedNoCops);
 expect(errors).toEqual([]);
});
