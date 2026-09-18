import {test,expect} from '@playwright/test';

test('a grenade blast wrecks the car beside it, kills a pedestrian and clears street props',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).objectKinds.includes('dummy'),{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 // Move CJ well clear, stand a civilian three metres from the Greenwood, and blow a grenade at the car's side.
 await page.evaluate(()=>(window as any).__game.placePlayer(2470,12.6,1690));
 const car=(await state()).nativeCar.position,blast={x:car.x-2.2,y:car.y,z:car.z+2.5};
 const id=await page.evaluate(([x,y,z])=>(window as any).__game.placePed(x,y,z),[blast.x-2,12.55,blast.z+1]);
 await page.waitForTimeout(300);
 await page.evaluate(({x,y,z})=>(window as any).__game.explodeAt(x,y,z,0),blast);
 // 1100 x falloff inside half the 9-unit radius: the car is destroyed outright.
 await expect.poll(async()=>(await state()).fleet.cars.find((c:any)=>c.id==='starter')?.wrecked,{timeout:5000}).toBe(true);
 // 250 x falloff for the pedestrian.
 await expect.poll(async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id)?.health??0).toBe(0);
 // The black bag by the Johnson house (native 2488.8, -1684.8) is thrown loose and smashed by ObjectDamage(300 x falloff).
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.smashedProps())).some((p:any)=>p.model==='blackbag2'&&Math.abs(p.position[0]-2488.8)<.2&&Math.abs(p.position[1]+1684.8)<.2)).toBe(true);
 expect(errors).toEqual([]);
});
