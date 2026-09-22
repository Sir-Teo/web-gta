import {test,expect,type Page} from '@playwright/test';

async function start(page:Page){
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await page.evaluate(()=>(window as any).__game.placePlayer(2491,12.6,1668));
 // The empty car twelve metres behind, facing CJ.
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680,0));
 await page.waitForTimeout(800);
 return {state,errors};
}

test('a car at 30 m/s knocks CJ down for 30 health and does not stop dead',async({page})=>{
 test.setTimeout(120000);const {state,errors}=await start(page);
 await page.evaluate(()=>(window as any).__game.launchCar(30));
 await expect.poll(async()=>(await state()).playerCarHits.hurt,{timeout:3000}).toBe(1);
 const s=await state();
 // The contact that hurt him; CJ's look back at the car can be recorded after it.
 expect(s.playerCarHits.hurtBy).toBe('hit');
 // 30 x NATIVE_PLAYER_DEFEND_MULT (0.4), the player's damage scaling.
 expect(s.player.health).toBe(88);expect(s.knockdown).toBeGreaterThan(0);
 // The ped branch counts the car ten times heavier: it keeps most of its speed.
 expect(Math.hypot(s.nativeCar.velocity.x,s.nativeCar.velocity.z)).toBeGreaterThan(15);
 expect(errors).toEqual([]);
});

test('a slow car shoves a standing CJ aside without hurting him',async({page})=>{
 test.setTimeout(120000);const {state,errors}=await start(page);
 const before=(await state()).player.position;
 // An empty car brakes, so it is held at 5 m/s as a driver would.
 for(let i=0;i<50;i++){await page.evaluate(()=>(window as any).__game.launchCar(5));await page.waitForTimeout(50);}
 expect((await state()).playerCarHits.contacts).toBeGreaterThan(0);
 const s=await state();
 expect(s.player.health).toBe(100);expect(s.playerCarHits.hurt).toBe(0);
 // CJ is moved out of the car's path instead of the car meeting a wall.
 expect(Math.hypot(s.player.position.x-before.x,s.player.position.z-before.z)).toBeGreaterThan(.5);
 expect(errors).toEqual([]);
});
