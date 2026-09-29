import {test,expect} from '@playwright/test';

test('Space while treading water poses the jump-out rather than the underwater glide',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2600,2,2600));
 await expect.poll(async()=>(await state()).player.swimming,{timeout:60000}).toBe(true);
 await page.waitForTimeout(1500);
 // Every rendered frame's clip, in order, for a second and a half after the press.
 const watch=page.evaluate(()=>new Promise<string[]>(done=>{const seen:string[]=[],end=performance.now()+1500;const frame=()=>{const c=(window as any).__game.state().nativeCharacter?.vehicleClip;if(c&&seen.at(-1)!==c)seen.push(c);if(performance.now()<end)requestAnimationFrame(frame);else done(seen);};requestAnimationFrame(frame);}));
 await page.keyboard.down('Space');await page.waitForTimeout(200);await page.keyboard.up('Space');
 const clips=await watch;
 // The first quarter of SWIM_JUMPOUT may fall between two frames of a slow renderer; its hand-over is unit tested.
 expect(clips.some(c=>c==='swim_jumpout'||c==='climb_jump'),JSON.stringify(clips)).toBe(true);
 expect(errors).toEqual([]);
});
