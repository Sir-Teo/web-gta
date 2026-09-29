import {test,expect} from '@playwright/test';
/** INTRO asks for a random car and its driver on the way to Grove Street; when the car could not be made (a stock
 * CARCOLS index past the colour table threw), TASK_CAR_DRIVE_TO_COORD found no driver and the thread gave up in the
 * cop car's back seat, SET_PLAYER_CONTROL off, and the game stood still for good. Any mission thread that gives up
 * now hands the player his controls back. The thread is made to fail here directly, mid-ride. */
test('a mission thread that gives up hands the player back his controls',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 // The ride: INTRO has taken the controls away.
 await expect.poll(()=>page.evaluate(()=>{const m=(window as any).__game?.missionForProfiling();
  return !!m&&m.runtime.active.some((a:any)=>a.thread.name==='INTRO')&&m.snapshot().playerControl===false;}),{timeout:120000}).toBe(true);
 await page.evaluate(()=>{const r=(window as any).__game.missionForProfiling().runtime;const slot=r.active.find((a:any)=>a.thread.name==='INTRO');
  slot.thread.run=()=>{throw new Error('a command this test makes fail');};});
 await expect.poll(()=>page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();
  return {intro:m.runtime.active.some((a:any)=>a.thread.name==='INTRO'),gaveUp:m.snapshot().gaveUp.some((g:any)=>g.thread==='INTRO'),control:m.snapshot().playerControl};}),{timeout:30000})
  .toEqual({intro:false,gaveUp:true,control:true});
 // The screen comes back in if the script had faded it out.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:10000}).toBe(0);
 expect(errors).toEqual([]);
});
