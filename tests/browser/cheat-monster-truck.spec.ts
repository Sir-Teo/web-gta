import {test,expect} from '@playwright/test';
/** The monster truck cheat (CCheat::MonsterTruckCheat, model 556) builds the truck beside CJ as a car on its MONSTER
 * handling line; CMonsterTruck's own suspension routines are not reversed. */
test('the monster truck cheat puts a drivable Monster beside the player',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 // Under load the player can land before WorldFleet has loaded.
 await page.waitForFunction(()=>!!(window as any).__game.fleet(),undefined,{timeout:60000});
 const out=await page.evaluate(async()=>{
  const game=(window as any).__game,fleet=game.fleet(),p=game.state().player;
  const car=await fleet.spawnCheatVehicle(556,p.position,p.heading);
  if(!car)return {spawned:false,failure:[...fleet.failures?.entries?.()??[]]};
  // Let it settle on its wheels.
  await new Promise(r=>setTimeout(r,2500));
  const t=car.car.body.translation(),q=car.car.body.rotation(),upY=1-2*(q.x*q.x+q.z*q.z);
  return {spawned:true,modelId:car.modelId,near:Math.hypot(t.x-p.position.x,t.z-p.position.z),upright:upY,health:car.health};
 });
 expect(out).toMatchObject({spawned:true,modelId:556});
 // In the truck, CHud::DrawVehicleName shows the GXT text of its game name, MONSTA.
 await page.evaluate(()=>{const g=(window as any).__game,car=[...g.fleet().cars].find((c:any)=>c.modelId===556);g.carEntry().enter(car);});
 await expect(page.locator('.vehicle-name')).toHaveText('Monster',{timeout:40000});
 expect((out as any).near).toBeLessThan(15);expect((out as any).upright).toBeGreaterThan(.9);
 expect(errors).toEqual([]);
});
