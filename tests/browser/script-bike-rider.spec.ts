import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** INTRO1's homies get on their BMXs by TASK_ENTER_CAR_AS_DRIVER. Resolving a bike for a ped's enter task used to
 * read a car's frames off it and threw every frame, which stopped every street and script ped. */
test('a script ped gets on a script BMX, and the peds keep stepping',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[],faults:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&m.text().includes('Subsystem fault'))faults.push(m.text());});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return {bike:m.vehicles.create(481,{x:p.x+8,y:-p.z,z:-100},90),ped:m.peds.create(4,'MALE01',{x:p.x+6,y:-p.z+3,z:p.y})};
 });
 await page.waitForFunction(({bike,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(bike)&&!!m.peds.entity(ped);},made,{timeout:60000});
 await page.evaluate(({ped,bike})=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(ped,{kind:'enterCarAsDriver',vehicle:bike,time:-1},0x05cb),made);
 await expect.poll(()=>page.evaluate(({ped,bike})=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(ped)===bike,made),{timeout:60000}).toBe(true);
 expect(faults).toEqual([]);expect(errors).toEqual([]);
});
