import {test,expect} from '@playwright/test';
/** CTaskSimpleCarJumpOut::ProcessPed hands the ped the vehicle's move speed, and CanPedJumpOutCar lets him leave an
 * aircraft at any speed: bailing out of a fast helicopter carries CJ on along its track, not straight down. */
test('bailing out of a moving helicopter keeps its speed',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.waitForFunction(()=>!!(window as any).__game.fleet(),undefined,{timeout:60000});
 const ok=await page.evaluate(async()=>{const g=(window as any).__game,p=g.state().player;const heli=await g.fleet().spawnCheatVehicle(487,p.position,p.heading);if(!heli)return false;
  heli.finishEnter();const t=heli.body.translation();heli.body.setTranslation({x:t.x,y:t.y+150,z:t.z},true);return true;});
 expect(ok).toBe(true);
 await page.waitForTimeout(1500);
 const start=await page.evaluate(()=>{const g=(window as any).__game,heli=[...g.fleet().planes].find((p:any)=>p.occupied);
  heli.body.setLinvel({x:25,y:0,z:0},true);heli.exitAir();return {...g.state().player.position};});
 // Still in the air (150 m up), he drifts east at the helicopter's 25 m/s; with the speed dropped he falls straight
 // and never does. Polled, since the headless frame rate sets how much game time a wall-clock wait covers.
 await expect.poll(()=>page.evaluate(x=>{const s=(window as any).__game.state().player;return s.grounded?-1:s.position.x-x;},start.x),{timeout:20000}).toBeGreaterThan(5);
 expect(errors).toEqual([]);
});
