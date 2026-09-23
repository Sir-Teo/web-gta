import {expect,type Page} from '@playwright/test';
/** CClock is one clock for the script and the world, and MAIN.SCM's opening sets it twice in its first seconds (eight
 * o'clock, then INTRO's half past six, with INTRO's second cutscene request). A spec that sets its own time of day
 * waits for those first, or the script's setting lands over the spec's. */
export async function scriptClockSettled(page:Page){
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.scm()?.cutscenes??0),{timeout:60000}).toBeGreaterThanOrEqual(2);
}
