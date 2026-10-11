import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The original has the car the moment CREATE_CAR returns. GUNS1 makes its Boxville and, with no WAIT between, hands CJ
 * a sequence that walks to it and gets in as driver: here the car is still being built then, and the sequence waits at
 * its command (the thread runs it again the next frame) instead of reading the car as one the player cannot board. */
test('a sequence into a car still being built waits for it, then the player gets in',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const PERFORM_SEQUENCE_TASK=0x0618;
 const first=await page.evaluate(PERFORM=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  const car=m.vehicles.create(609,{x:p.x+6,y:-p.z,z:p.y},0);
  const tasks=[{kind:'goStraightToCoord',x:p.x+3,y:-p.z,z:p.y,speed:4,time:6000},{kind:'enterCarAsDriver',vehicle:car,time:5000}];
  let thrown='';
  try{m.runtime.world.givePedSequence(1,tasks,false,PERFORM);}catch(error:any){thrown=String(error?.message??error);}
  return {car,built:!!m.vehicles.entity(car),thrown,tasks};
 },PERFORM_SEQUENCE_TASK);
 expect(first.built).toBe(false);
 expect(first.thrown).toContain('AN_ENTITY_THE_BROWSER_IS_STILL_BUILDING');
 expect(first.thrown).not.toContain('A_TASK_THE_BROWSER_DOES_NOT_RUN');
 await page.waitForFunction((car:number)=>!!(window as any).__game.missionForProfiling().vehicles.entity(car),first.car,{timeout:45000});
 // Run again once the car is there, as the waiting thread does: the sequence is taken and CJ ends at the wheel.
 await page.evaluate(({tasks,PERFORM})=>(window as any).__game.missionForProfiling().runtime.world.givePedSequence(1,tasks,false,PERFORM),{tasks:first.tasks,PERFORM:PERFORM_SEQUENCE_TASK});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)??null),{timeout:60000}).toBe(first.car);
 expect(errors).toEqual([]);
});
