import type {Page} from '@playwright/test';
/** The game opens on INTRO, which takes CJ into the police car a few seconds in. A spec about something else ends it
 * (and any other mission script) once MAIN has launched it, and plays on in free roam. */
export async function endStoryMission(page:Page){
 await page.waitForFunction(()=>(window as any).__game?.missionForProfiling()?.runtime.active.some((a:any)=>a.thread.base>0),undefined,{timeout:60000}).catch(()=>{});
 await page.evaluate(()=>{
  const r=(window as any).__game.missionForProfiling().runtime;
  for(const slot of [...r.active])if(slot.thread.base>0)r.terminateAllWithName(slot.thread.name);
  r.game.alreadyRunningAMissionScript=false;
 });
}
