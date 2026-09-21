import {test,expect} from '@playwright/test';

test('the Rhino aims its turret at the camera, fires its cannon on Ctrl and blows up the car it drives into',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.waitForTimeout(1000);
 // The Greenwood starts where the tank will land (ClearSpaceForMissionEntity would remove it): park it 20 m aside first.
 const greenwood=await page.evaluate(()=>{const g=(window as any).__game;const s=g.state();const p=s.player.position,h=s.player.heading,c=s.fleet.cars.find((c:any)=>c.id==='starter');g.placeFleetCar('starter',p.x+Math.cos(h)*20,p.y+.6,p.z-Math.sin(h)*20,h);return c.handle;});
 // The Rhino cheat drops a tank at CJ's feet; F boards it.
 await page.keyboard.type('AIWPRTON');
 await expect.poll(async()=>((await state()).fleet?.cars??[]).some((c:any)=>c.modelId===432),{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).tank!=null,{timeout:20000}).toBe(true);
 await page.waitForTimeout(500);
 const before=(await state()).weapons.explosions;
 // Ctrl fires: an EXPLOSION_TANK_FIRE within 800 ms, and no more than one a second.
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(1000);await page.keyboard.up('ControlLeft');
 const shots=(await state()).weapons.explosions-before;
 expect(shots).toBeGreaterThanOrEqual(1);expect(shots).toBeLessThanOrEqual(2);
 // The turret follows the camera: a look to the side turns the yaw away from 0.
 const aim0=(await state()).tank;
 await page.mouse.move(720,450);await page.mouse.down();await page.mouse.move(420,450,{steps:10});await page.mouse.up();
 await page.waitForTimeout(1500);
 const aim1=(await state()).tank;
 expect(Math.abs(aim1.yaw-aim0.yaw)).toBeGreaterThan(0.1);
 // BlowUpCarsInPath: the starter Greenwood parked 35 m down the street is wrecked when the tank drives through it
 // (the tank needs the run-up to pass 5 m/s, and it is the world car itself now that CJ drives it).
 await page.evaluate((greenwood:number)=>{const g=(window as any).__game;const s=g.state();const t=s.fleet.cars.find((c:any)=>c.modelId===432);const p=t.position,h=t.heading;g.placeFleetCar('handle:'+greenwood,p.x-35*Math.sin(h),p.y+.5,p.z-35*Math.cos(h),h);},greenwood);
 await page.waitForTimeout(500);
 const starter=async()=>(await state()).fleet.cars.find((c:any)=>c.handle===greenwood);
 // The car has to still be in the fleet before the run-up means anything. It is not always: the starter
 // Greenwood is sometimes gone by here, and waiting says so plainly instead of reading `wrecked` off nothing.
 await expect.poll(async()=>!!(await starter()),{timeout:10000}).toBe(true);
 expect((await starter()).wrecked).toBe(false);
 await page.keyboard.down('KeyW');
 const trace:any[]=[];
 for(let i=0;i<50;i++){await page.waitForTimeout(500);const s=await state();const t=s.fleet.cars.find((c:any)=>c.modelId===432),o=s.fleet.cars.find((c:any)=>c.handle===greenwood);trace.push({i,speed:+Math.hypot(s.nativeCar.velocity.x,s.nativeCar.velocity.z).toFixed(1),gap:+Math.hypot(t.position.x-o.position.x,t.position.z-o.position.z).toFixed(1),wrecked:o.wrecked});if(o.wrecked)break;}
 await page.keyboard.up('KeyW');
 console.log('TRACE '+JSON.stringify(trace));
 expect(trace[trace.length-1].wrecked).toBe(true);
 expect(errors).toEqual([]);
});
