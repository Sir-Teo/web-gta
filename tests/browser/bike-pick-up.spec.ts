import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskComplexEnterCar on an abandoned bike lying on its side runs CTaskSimplePickUpBike (CAR_ALIGN(HI)_LHS/RHS) before
 * the jump-on: CJ stands the bike up and rides it, instead of mounting it on its side or being thrown off at once. */
test('a bike lying on its side is picked up and ridden',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await page.evaluate(()=>(window as any).__game.spawnVehicle(522));
 await expect.poll(()=>page.evaluate(()=>[...(window as any).__game.fleet().bikes].length),{timeout:30000}).toBeGreaterThan(0);
 await page.waitForTimeout(1500);
 // Lay it on its side: a quarter turn about its forward axis, resting on the ground.
 await page.evaluate(()=>{const bike=[...(window as any).__game.fleet().bikes][0],b=bike.body,h=bike.heading(),t=b.translation();
  const yaw={x:0,y:Math.sin(h/2),z:0,w:Math.cos(h/2)},roll={x:0,y:0,z:Math.sin(Math.PI/4),w:Math.cos(Math.PI/4)};
  const q={w:yaw.w*roll.w-yaw.y*roll.y*0,x:yaw.w*roll.x+yaw.y*roll.z,y:yaw.y*roll.w,z:yaw.w*roll.z-yaw.y*roll.x};b.setRotation(q,true);b.setTranslation({x:t.x,y:t.y-.2,z:t.z},true);b.setLinvel({x:0,y:0,z:0},true);b.setAngvel({x:0,y:0,z:0},true);});
 await page.waitForTimeout(1500);
 const lying=await page.evaluate(()=>{const q=[...(window as any).__game.fleet().bikes][0].body.rotation();return Math.abs(2*(q.x*q.y+q.w*q.z));});
 expect(lying).toBeGreaterThan(.5);
 // The bike group's clips (the jump-on and the pick-up) loaded, and CJ beside it.
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game;return g.bikeMount().ready([...g.fleet().bikes][0]);}),{timeout:30000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game,t=[...g.fleet().bikes][0].body.translation();g.placePlayer(t.x+1.5,g.groundAt(t.x+1.5,t.z,t.y+5)+.05,t.z);});
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__game.state();return !s.terrainHold&&s.player.grounded;}),{timeout:30000}).toBe(true);
 await page.waitForTimeout(500);
 await page.keyboard.press('KeyF');
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.bikeMount().phase??null),{timeout:10000}).toBe('pickUp');
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.fleet().occupiedBike),{timeout:90000}).toBe(true);
 await page.waitForTimeout(1500);
 const after=await page.evaluate(()=>{const g=(window as any).__game,q=[...g.fleet().bikes][0].body.rotation();return {rightY:2*(q.x*q.y+q.w*q.z),riding:!!g.fleet().occupiedBike};});
 expect(Math.abs(after.rightY)).toBeLessThan(.5);
 expect(after.riding).toBe(true);
 expect(errors).toEqual([]);
});
