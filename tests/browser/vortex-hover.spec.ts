import {test,expect} from '@playwright/test';

test('the Vortex rides its suspension on the water surface and drives across it (DoHoverSuspensionRatios)',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 // The Vortex cheat spawner, boarded with F.
 await page.evaluate(()=>(window as any).__game.spawnVehicle(539));
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===539),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 // The Vortex has no doors and its own align clips; the door flow is not wired for it yet, so CJ is warped in.
 await page.evaluate(()=>{const g=(window as any).__game;const car=[...g.fleet().cars].find((c:any)=>c.modelId===539);g.carEntry().warpIn(car);});
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===539&&c.occupied),{timeout:20000}).toBe(true);
 await page.waitForTimeout(800);
 // Off Santa Maria Beach the sea floor lies 5.9 m under the surface (water level 0). Held a metre and a half over the
 // water until the area streams in, then dropped: the wheel lines ride the water plane instead of sinking to the floor.
 const vortex=(await state()).fleet.cars.find((c:any)=>c.modelId===539).handle;
 const hold=()=>page.evaluate((h:number)=>{const g=(window as any).__game;g.placeFleetCar('handle:'+h,560,1.5,1950,Math.PI);return g.groundAt(560,1950,55)!=null;},vortex);
 let streamed=false;for(let i=0;i<150&&!streamed;i++){streamed=await hold();if(!streamed)await page.waitForTimeout(400);}
 expect(streamed).toBe(true);
 await page.waitForTimeout(4000);
 const settled=(await state()).nativeCar;
 expect(settled.position.y).toBeGreaterThan(-1.2);expect(settled.position.y).toBeLessThan(1.5);
 expect(settled.wrecked).toBe(false);
 // Throttle: it drives across the water.
 // Throttle for four seconds: a hovercraft on 0.05 traction gathers way slowly, but it moves and stays afloat.
 await page.keyboard.down('KeyW');await page.waitForTimeout(4000);await page.keyboard.up('KeyW');
 const driven=(await state()).nativeCar;
 expect(Math.hypot(driven.position.x-settled.position.x,driven.position.z-settled.position.z)).toBeGreaterThan(3);
 expect(driven.position.y).toBeGreaterThan(-1.2);
 expect(errors).toEqual([]);
});
