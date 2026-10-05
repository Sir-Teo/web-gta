import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
/** The Los Santos bomb shop (lasbomb, type 2, BOMBSHOP_TIMED): x 1843.91 to 1857.1, y -1858.8 to -1853.79, its door
 * (bombdoor_las) at the west end. */
const shop=(page:Page)=>page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),g=m.runtime.game.garages.garages.find((x:any)=>x.name==='lasbomb');
 return {doorState:g.doorState,doorPosition:g.doorPosition,doors:m.garageDoorsSnapshot().filter((d:any)=>d.garage==='lasbomb').length,message:m.runtime.game.garageMessage.id};});

// CGarage::Update's bomb shop case (iOS): CJ parks a car in it with $1000; the door comes down, two seconds on it goes
// up with the timed bomb fitted, $500 gone and GA_6 shown ("Park it, prime it ... and LEG IT!"); the car-gun button arms it (GA_12), and it blows the car up.
test('the Los Santos bomb shop fits a timed bomb for $500, and the car-gun button sets it going',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet()),{timeout:60000}).toBe(true);
 // CJ on the pavement west of the shop first, so the window around it streams in and the door is found. (The ground
 // is looked for from below the roofs there.)
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1829.9,g.groundAt(1829.9,1858.1,20)+.05,1858.1);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 await expect.poll(async()=>(await shop(page)).doors,{timeout:120000,intervals:[2000]}).toBeGreaterThan(0);
 // The shop stands open, as it does from the start.
 expect((await shop(page)).doorState).toBe(1);
 // A Landstalker made out in the street facing north (as a script makes a car, at a given height), CJ in it from its
 // west side (the shop is too narrow to open a door in), and the car then set down in the middle of the shop facing
 // east, his money made up to $1000.
 const landstalker=(page:Page)=>page.evaluate(()=>{const car=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===400&&!c.disposed&&c.missionCar);
  return car&&{handle:car.car.body.handle,bomb:car.bombOnBoard,timer:car.bombTimerMs,byPlayer:car.bombInstalledByPlayer,wrecked:car.wrecked};});
 await page.evaluate(async()=>{const g=(window as any).__game;await g.fleet().spawnScriptCar(400,{x:1825.5,y:g.groundAt(1825.5,1858.1,20),z:1858.1},0);});
 await expect.poll(()=>landstalker(page),{timeout:60000}).toBeTruthy();
 expect((await landstalker(page))!.bomb).toBe(0);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(1823.2,g.groundAt(1823.2,1858.1,20)+.05,1858.1);g.turnPlayer(Math.PI/2);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state(page)).carEntry.phase,{timeout:60000}).toBe('seated');
 await page.evaluate(handle=>{const g=(window as any).__game;g.sim.money=1000;g.placeFleetCar(`handle:${handle}`,1850.5,g.groundAt(1850.5,1856.3,15)+1.2,1856.3,-Math.PI/2);},(await landstalker(page))!.handle);
 // The door comes down on him, and two seconds later goes up on the fitted bomb.
 await expect.poll(async()=>(await shop(page)).doorState,{timeout:30000,intervals:[200]}).toBe(0);
 await expect.poll(async()=>(await shop(page)).doorState,{timeout:30000,intervals:[200]}).not.toBe(0);
 const fitted=(await landstalker(page))!;
 expect(fitted).toMatchObject({bomb:1,timer:0,byPlayer:true,wrecked:false});
 expect((await state(page)).money).toBe(500);
 await expect(page.locator('.help-box')).toContainText('prime it');
 await page.screenshot({path:'artifacts/bomb-shop-fitted.png'});
 // Once the door is up (his controls back from half way) it waits for him to leave; the car-gun button arms the
 // bomb: GA_12 and 7 s on the timer.
 await expect.poll(async()=>(await shop(page)).doorState,{timeout:30000,intervals:[200]}).toBe(4);
 await page.keyboard.down('ControlLeft');await page.waitForTimeout(150);await page.keyboard.up('ControlLeft');
 await expect.poll(async()=>(await landstalker(page))?.bomb,{timeout:10000}).toBe(4);
 const armed=(await landstalker(page))!;expect(armed.timer).toBeGreaterThan(0);expect(armed.timer).toBeLessThanOrEqual(7000);
 expect((await shop(page)).message).toBe('GA_12');
 // It runs out and the car goes up.
 await expect.poll(async()=>(await landstalker(page))?.wrecked,{timeout:60000,intervals:[500]}).toBe(true);
 expect((await landstalker(page))!.bomb).toBe(0);
 expect(errors).toEqual([]);
});
