import type {Page} from '@playwright/test';
/** The game opens on INITIAL (the world's setup) and then INTRO, which takes CJ into the police car a few seconds in.
 * A spec about something else waits for INTRO itself, so INITIAL finishes its setup, then ends it and plays on in
 * free roam, with the screen faded back in. */
export async function endStoryMission(page:Page){
 await page.waitForFunction(()=>(window as any).__game?.missionForProfiling()?.runtime.active.some((a:any)=>a.thread.base>0&&a.thread.name==='INTRO'),undefined,{timeout:60000}).catch(()=>{});
 await page.evaluate(()=>{
  const r=(window as any).__game.missionForProfiling().runtime;
  for(const slot of [...r.active])if(slot.thread.base>0)r.terminateAllWithName(slot.thread.name);
  r.game.alreadyRunningAMissionScript=false;
  // The story faded the screen out (MAIN's opening DO_FADE 0 0) and turned zone names off until INTRO's end; free
  // roam comes back in at once with names on.
  // (A 0 ms fade-in never ends in CCamera::ProcessFade, so the shortest that does.)
  r.world.fade(1,1,performance.now());r.game.displayAreaName=true;
 });
}
