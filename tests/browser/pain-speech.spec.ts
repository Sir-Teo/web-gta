import {test,expect} from '@playwright/test';
/** A ped's pain cry from the PAIN_A pack: the game's own onPain handler asks for the female voice's bank (146), which
 * is fetched, decoded into speech slot 22 and then cried from, out loud. */
test('a hurt ped cries in her PAIN_A voice',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 const fetched:string[]=[];page.on('request',r=>{const u=r.url();if(u.includes('/play/audio/pain/'))fetched.push(u.split('/play/audio/pain/')[1]);});
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.state().fadeAlpha),{timeout:90000}).toBe(0);
 const native=()=>page.evaluate(()=>(window as any).__game.state().audio.native);
 await expect.poll(async()=>(await native())?.banks?.slots?.length??0,{timeout:30000}).toBeGreaterThan(0);
 expect(fetched).toEqual([]);
 const cry=()=>page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position,peds=g.pedestrians();
  // A new ped each time, so each has her own pain timer.
  peds.onPain({pedType:'CIVFEMALE'},{x:p.x+1,y:p.y,z:p.z});});
 await cry();
 await expect.poll(async()=>((await native()).banks.slots as number[][]).some(([slot,bank])=>slot===22&&bank===146),{timeout:20000}).toBe(true);
 expect(fetched).toEqual(['pain.json','bank-146.bin']);
 await cry();
 await expect.poll(async()=>(await native()).painCries,{timeout:5000}).toBe(1);
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state().audio)).rms,{timeout:5000}).toBeGreaterThan(.0005);
 expect(errors).toEqual([]);
});
