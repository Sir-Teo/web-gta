import {test,expect} from '@playwright/test';
/** The ambient scripts that watch the player's car (HJ's stunt bonuses, TRAINSL) keep running once he drives: the
 * player's own car answers through its handle, and a thread that still fails gives up alone. */
test('the scripts keep running while the player drives',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 await page.keyboard.down('KeyW');await page.waitForTimeout(8000);await page.keyboard.up('KeyW');
 // Out, and onto a bike: the player's vehicle of any kind answers the scripts' coordinates and heading.
 await page.keyboard.press('KeyF');await page.waitForTimeout(3000);
 await page.evaluate(async()=>{const g=(window as any).__game,p=g.state().player;const b=await g.fleet().spawnCheatVehicle(522,p.position,p.heading);if(!b)throw new Error('No NRG-500: '+JSON.stringify([...g.fleet().failures]));g.placePlayer(b.body.translation().x+1,p.position.y,b.body.translation().z);});
 await page.waitForTimeout(800);await page.keyboard.press('KeyF');await page.waitForTimeout(4000);
 await page.keyboard.down('KeyW');await page.waitForTimeout(5000);await page.keyboard.up('KeyW');
 const scm=await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot());
 expect(scm.stopped).toBeNull();expect(scm.gaveUp).toEqual([]);
 expect(scm.threads.map((t:any)=>t.name)).toEqual(expect.arrayContaining(['HJ','TRAINSL']));
 expect(errors).toEqual([]);
});
