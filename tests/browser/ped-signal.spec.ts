import {test,expect} from '@playwright/test';
// CTrafficLights::DisplayActualLight's pedestrian sign through CShinyTexts: the Ganton signal shows its hand or
// walking man from the `handman` raster, red for red and white for green, additively over the pole.
test('a traffic signal shows its pedestrian walk or don\'t-walk sign',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state()).coronas.lit,{timeout:60000}).toBeGreaterThan(10);
 const light=(await page.evaluate(()=>(window as any).__game.litPlacements())).find((l:any)=>l.name==='trafficlight1');
 expect(light).toBeDefined();
 const x=light.position[0]+light.forward[0]*12,y=light.position[1]+light.forward[1]*12;
 await page.evaluate(({x,y})=>{const g=(window as any).__game;g.placePlayer(x,g.groundAt(x,-y,40),-y);},{x,y});
 await page.waitForTimeout(1500);
 // Within 60 units of a signal model the sign is registered every frame (the yellow blink can drop single frames).
 await expect.poll(async()=>(await state()).shinyTexts,{timeout:10000}).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
