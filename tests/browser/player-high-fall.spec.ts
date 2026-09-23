import {test,expect} from '@playwright/test';
// CTaskSimpleInAir and CTaskComplexInAirAndLand for CJ: a long drop goes into FALL_FALL and, past 0.4 units a frame,
// lands as a knockdown (KO_SKID_BACK for 700 ms) with a get-up after it; a shorter fall collapses.
test('CJ dropped from a height falls in FALL_FALL, is knocked flat on landing and gets up',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.length??0,{timeout:30000}).toBeGreaterThan(0);
 await page.evaluate(()=>{const g=(window as any).__game;g.setCheat?.('infiniteHealth',true);g.placePlayer(2480,45,1676);});
 await expect.poll(async()=>(await state()).nativeCharacter?.reaction,{timeout:5000}).toBe('fall_fall');
 await expect.poll(async()=>(await state()).nativeCharacter?.reaction,{timeout:8000}).toBe('ko_skid_back');
 expect((await state()).knockdown).toBeGreaterThan(0);
 await expect.poll(async()=>(await state()).knockdown,{timeout:8000}).toBe(0);
 expect(errors).toEqual([]);
});
