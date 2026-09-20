import {test,expect} from '@playwright/test';

test('a pistol shot through the window wounds the driver; the fatal one coasts the car to rest before he dies out of the door or in the seat',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await expect.poll(async()=>((await state()).traffic?.cars??[]).length,{timeout:60000}).toBeGreaterThan(0);
 // A pistol straight into the inventory (the arsenal grid's layout is not under test here).
 await page.evaluate(()=>{const w=(window as any).__game.weapons();w.inventory.give(22,100);w.inventory.select(22);});
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);await page.waitForTimeout(800);
 // A traffic car with its NPC driver, parked beside CJ facing north; CJ stands 3 m off its driver's window.
 const target=await page.evaluate(()=>{const g=(window as any).__game;const s=g.state();const p=s.player.position;
  const car=s.fleet.cars.find((c:any)=>c.autopilot&&!c.occupied&&!c.wrecked);if(!car)return null;
  g.placeFleetCar('handle:'+car.handle,p.x+4,p.y+.5,p.z,0);return car.handle;});
 expect(target).not.toBeNull();
 await page.waitForTimeout(600);
 const shoot=()=>page.evaluate((handle:number)=>{const g=(window as any).__game;const head=g.driverHead(handle);const s=g.state();const p=s.player.position;
  const eye={x:head.x-3,y:head.y,z:head.z};g.placePlayer(eye.x,p.y,eye.z);g.turnPlayer(Math.PI/2);
  const dir={x:1,y:0,z:0};return g.weapons().fire({origin:{x:eye.x,y:head.y,z:eye.z},direction:dir});},target);
 const driver=async()=>{const s=await state();const p=s.player.position;return s.traffic.cars.find((c:any)=>Math.hypot(c.position.x-p.x,c.position.z-p.z)<8);};
 // One hit wounds him: 100 health less the pistol's damage.
 await shoot();await page.waitForTimeout(200);
 await expect.poll(async()=>(await driver())?.health,{timeout:5000}).toBeLessThan(100);
 // Keep firing until the fatal shot; the car then coasts with its cruise speed at zero.
 for(let i=0;i<20&&!((await driver())?.dying||(await driver())?.dead);i++){await shoot();await page.waitForTimeout(250);}
 const dying=await driver();expect(dying.dying||dying.dead).toBe(true);expect(dying.cruiseSpeed).toBe(0);
 // Two seconds on: dead, out of the door (a dead ped by the car) or in the seat while still rolling.
 await expect.poll(async()=>(await driver())?.dead,{timeout:6000}).toBe(true);
 await page.waitForTimeout(3500);
 const s=await state(),car=s.traffic.cars.find((c:any)=>c.dead);
 const body=s.pedestrians.people.find((p:any)=>p.health<=0&&Math.hypot(p.position.x-car.position.x,p.position.z-car.position.z)<6);
 expect(!!body||car.deadInSeat).toBe(true);
 expect(car.speed).toBeLessThan(1.5);
 expect(errors).toEqual([]);
});
