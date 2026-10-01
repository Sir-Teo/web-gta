import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
/** Idlewood's Pay 'n' Spray: the first sprLAe grge row (2056.6, -1835.9) to (2071.3, -1826.97), door flag 0x1. */
const spray=(page:Page)=>page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),garage=m.runtime.game.garages.garages.find((x:any)=>x.name==='sprLAe'&&x.box.base[0]>2000);
 return {doorState:garage.doorState,doorPosition:garage.doorPosition,usedRespray:garage.usedRespray,doors:m.garageDoorsSnapshot().filter((d:any)=>d.garage==='sprLAe')};});

// CGarage::Update's PAYNSPRAY case (AUTHORED from re3): CJ wanted, his car parked still inside; the door shuts, two
// seconds later the car is fixed and repainted, the stars go, $100 is taken with GA_2, and the door opens again.
test('the Idlewood Pay \'n\' Spray resprays a wanted car: door down, stars off, $100, new paint, door up',async({page})=>{
 test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>(await state(page)).nativeCar!=null,{timeout:30000}).toBe(true);
 // CJ beside the garage first, so the window around it streams in and the door is found.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2064,g.groundAt(2064,-1845,300)+.05,1845);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:120000}).toBe(true);
 await expect.poll(async()=>(await spray(page)).doors.length,{timeout:120000,intervals:[2000]}).toBeGreaterThan(0);
 // The door starts up: the map's copy is out and the object stands raised and turned.
 await expect.poll(async()=>(await spray(page)).doors[0].taken,{timeout:30000}).toBe(true);
 const raised=(await spray(page)).doors[0];
 expect(raised.model.toLowerCase()).toBe('laespraydoor1');
 expect(Math.abs(raised.up.z)).toBeLessThan(.01);
 // Seen from ten units out in front of it, the camera turned onto it.
 await page.evaluate(d=>{const g=(window as any).__game,cx=2063.95,cy=-1831.435,dx=d.position.x-cx,dy=d.position.y-cy,l=Math.hypot(dx,dy),x=d.position.x+dx/l*10,y=d.position.y+dy/l*10;
  g.placePlayer(x,g.groundAt(x,-y,d.position.z+3)+.05,-y);g.render().yaw=Math.atan2(d.position.x-x,-d.position.y+y)+Math.PI;},raised);
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.screenshot({path:'artifacts/pay-n-spray-open.png'});
 // CJ inside at the garage's west end facing east, a Landstalker made ahead of him (the starter car is a police car,
 // which IsCarSprayable refuses), and CJ in it. The ground is looked for under the roof.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2058.5,g.groundAt(2058.5,1831.4,15)+.05,1831.4);g.turnPlayer(Math.PI/2);});
 await expect.poll(async()=>{const s=await state(page);return !s.terrainHold&&s.player.grounded;},{timeout:30000}).toBe(true);
 await page.evaluate(()=>(window as any).__game.spawnVehicle(400));
 await expect.poll(async()=>page.evaluate(()=>[...(window as any).__game.fleet().cars].some((c:any)=>c.modelId===400)),{timeout:60000}).toBe(true);
 // The money and the stars first: seated with less than $100 he would get GA_3 and the door would wait for him to go.
 const before=await page.evaluate(()=>{const g=(window as any).__game;g.sim.money=1000;g.setWantedLevel(2);return {money:g.state().money};});
 const colours=()=>page.evaluate(()=>{const car=[...(window as any).__game.fleet().cars].find((c:any)=>c.modelId===400);return [...car.assets.colourIndices];});
 const paint=await colours();
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state(page)).carEntry.phase,{timeout:60000}).toBe('seated');
 expect((await state(page)).wanted.level).toBe(2);
 // The door comes down on him.
 await expect.poll(async()=>(await spray(page)).doorState,{timeout:30000,intervals:[200]}).toBe(0);
 const shut=(await spray(page)).doors[0];expect(Math.abs(shut.up.z-1)).toBeLessThan(.01);
 await page.screenshot({path:'artifacts/pay-n-spray-shut.png'});
 // Two seconds later it opens on the resprayed car.
 await expect.poll(async()=>(await spray(page)).usedRespray,{timeout:30000,intervals:[200]}).toBe(true);
 const after=await state(page);
 expect(after.wanted.level).toBe(0);
 expect(after.money).toBe(before.money-100);
 // ChooseVehicleColour again until the two main colours differ.
 expect((await colours()).slice(0,2)).not.toEqual(paint.slice(0,2));
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.garageMessage.id)).toBe('GA_2');
 await expect.poll(async()=>(await spray(page)).doorState,{timeout:30000}).toBe(4);
 await page.screenshot({path:'artifacts/pay-n-spray-done.png'});
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp)).toEqual([]);
 expect(errors).toEqual([]);
});
