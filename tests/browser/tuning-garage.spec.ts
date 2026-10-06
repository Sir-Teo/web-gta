import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const door=(page:Page)=>page.evaluate(()=>{const g=(window as any).__game,gr=g.missionForProfiling().runtime.game.garages.garages.find((x:any)=>x.name==='bodLAwN');return {state:gr.doorState as number,position:+gr.doorPosition.toFixed(3)};});

test('Transfender\'s door opens for a car of its kind within 8 units, not for a street racer, and shuts once he drives off',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 // Transfender (bodLAwN, type 38): its box runs 30 units east and north from (1038.24, -1025.67). CJ goes 5 units south
 // of its middle and waits for the ground there.
 const spot={x:1053.3,z:1030.67};
 await page.evaluate(s=>{const g=(window as any).__game;g.placePlayer(s.x,40,s.z+3);},spot);
 await expect.poll(()=>page.evaluate(s=>(window as any).__game.groundAt(s.x,s.z,60)??-999,spot),{timeout:60000}).toBeGreaterThan(0);
 const enter=async(model:number,z:number)=>page.evaluate(async({model,s,z})=>{
  const g=(window as any).__game,fleet=g.fleet(),y=g.groundAt(s.x,z,60);
  const prev=(window as any).__car;if(prev){g.carEntry().cancel();prev.setPedOut?.({x:s.x+4,y,z},0);fleet.removeScriptCar(prev);}
  const car=await fleet.spawnScriptCar(model,{x:s.x,y,z},Math.PI/2);(window as any).__car=car;g.carEntry().warpIn(car);
  return car.assets.handling.values.handlingFlags;
 },{model,s:spot,z});
 // A Sultan is a STREET_RACER: Transfender stays shut for it.
 expect(await enter(560,spot.z)&0x4000000).not.toBe(0);
 await page.waitForTimeout(2000);
 expect((await door(page)).state).toBe(0);
 // A Premier is neither a lowrider nor a street racer: the door slides up.
 expect(await enter(426,spot.z)&0x6000000).toBe(0);
 await expect.poll(async()=>(await door(page)).state,{timeout:10000}).toBe(1);
 expect((await door(page)).position).toBe(1);
 // Driven off 40 units: no car in the way, the door comes down.
 await page.evaluate(s=>{const car=(window as any).__car,t=car.car.body.translation();car.car.body.setTranslation({x:t.x,y:t.y+.5,z:s.z+40},true);car.car.body.setLinvel({x:0,y:0,z:0},true);},spot);
 await expect.poll(async()=>(await door(page)).state,{timeout:15000}).toBe(0);
});
