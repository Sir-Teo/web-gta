import {test,expect} from '@playwright/test';

test('a vehicle cheat clears the car and the ped standing where it lands (ClearSpaceForMissionEntity)',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 // The Rhino cheat lands the tank (bound radius + 2) ahead of CJ: park the Greenwood 6 m ahead and stand a civilian
 // 7 m ahead, both inside the tank's box.
 await expect.poll(async()=>(await state()).pedestrians.people.filter((p:any)=>!p.officer&&p.health>0).length,{timeout:30000}).toBeGreaterThan(0);
 const setup=await page.evaluate(()=>{const g=(window as any).__game;const s=g.state();const p=s.player.position,h=s.player.heading;
  const fx=Math.sin(h),fz=Math.cos(h);const cx=p.x+fx*6,cz=p.z+fz*6;const y=g.groundAt(cx,cz,p.y+5)??p.y;
  g.placeFleetCar('starter',cx,y+.6,cz,h);const ped=g.placePed(p.x+fx*7.5,g.groundAt(p.x+fx*7.5,p.z+fz*7.5,p.y+5)??p.y,p.z+fz*7.5);return {ped,px:p.x+fx*7.5,pz:p.z+fz*7.5};});
 await page.waitForTimeout(300);
 const before=await state();
 const greenwood=before.fleet.cars.find((c:any)=>c.modelId===492&&Math.hypot(c.position.x-before.player.position.x,c.position.z-before.player.position.z)<9);
 expect(greenwood).toBeTruthy();
 expect(before.pedestrians.people.some((p:any)=>p.id===setup.ped)).toBe(true);
 await page.keyboard.type('AIWPRTON');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===432),{timeout:30000}).toBe(true);
 const after=await state();
 expect(after.fleet.lastClear).toEqual(expect.objectContaining({cars:1,peds:1}));
 expect(after.fleet.cars.some((c:any)=>c.handle===greenwood.handle)).toBe(false);
 expect(after.pedestrians.people.some((p:any)=>p.id===setup.ped)).toBe(false);
 expect(errors).toEqual([]);
});
