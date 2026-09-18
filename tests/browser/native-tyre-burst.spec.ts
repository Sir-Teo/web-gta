import {test,expect} from '@playwright/test';

test('a pistol round bursts the tyre it hits, and the car still drives on it',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.keyboard.press('Tab');await page.locator('[data-weapon="22"]').click();
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 const wheels=await page.evaluate(()=>(window as any).__game.carWheels());
 expect(wheels).toHaveLength(4);
 // eCarWheel 0 is the front left; stand four metres out to its left and shoot it.
 const lf=wheels.find((w:any)=>w.wheel===0),car=(await state()).nativeCar.position;
 const side={x:lf.center.x-car.x,z:lf.center.z-car.z},l=Math.hypot(side.x,side.z);
 await page.evaluate(([x,y,z])=>(window as any).__game.placePlayer(x,y,z),[lf.center.x+side.x/l*4,12.6,lf.center.z+side.z/l*4]);
 await page.waitForTimeout(400);
 expect((await state()).nativeCar.tyres).toEqual([0,0,0,0]);
 await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y,z),lf.center);
 await expect.poll(async()=>(await state()).nativeCar.tyres).toEqual([1,0,0,0]);
 // A round into the body nudges the parked car: ApplyForce(normal x -10 x min(1, mass / 1000)).
 const body=wheels.find((w:any)=>w.wheel===2);
 const speed=async()=>{const v=(await state()).nativeCar.velocity;return Math.hypot(v.x,v.y,v.z);};
 await expect.poll(speed,{timeout:8000}).toBeLessThan(.02);
 await page.evaluate(({x,y,z})=>(window as any).__game.fireAt(x,y+.5,z),{x:(lf.center.x+body.center.x)/2,y:lf.center.y,z:(lf.center.z+body.center.z)/2});
 await expect.poll(speed,{timeout:2000}).toBeGreaterThan(.05);
 // Burst tyres halve grip and wobble, but the car still drives.
 await page.evaluate(()=>(window as any).__game.placePlayer(2495,12.6,1687));await page.waitForTimeout(300);
 await page.keyboard.press('KeyF');await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(1200);
 await page.keyboard.down('KeyW');await page.waitForTimeout(1500);
 const moving=(await state()).nativeCar.velocity;await page.keyboard.up('KeyW');
 expect(Math.hypot(moving.x,moving.z)).toBeGreaterThan(4);
 expect(errors).toEqual([]);
});
