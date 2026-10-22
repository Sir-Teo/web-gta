import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('the script override produces new Berkley vans in civilian traffic and cleanup restores selection',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling();
  // ZERO5's actual 09BF parameter is 459. Keep this mission thread asleep until the live traffic appears.
  const bytes=new Uint8Array([0xbf,9,5,203,1,1,0,1,0x60,0xea,0,0,0x4e,0]);
  const slot=m.runtime.start(0,[],{space:bytes,mission:true});slot.thread.name='forced';
  for(const car of [...g.fleet().cars] as any[])if(car.trafficOrigin)g.fleet().removeTrafficCar(car);
 });
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.fleet().forceRandomCarModel())).toBe(459);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.state().traffic.cars.some((c:any)=>c.modelId===459)),{timeout:45000}).toBe(true);
 const probe=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),picks=Array.from({length:100},()=>g.fleet().trafficPick());
  const civilian=picks.filter((p:any)=>p.gang===undefined).map((p:any)=>p.modelId);
  m.runtime.terminateAllWithName('forced');
  return {civilian,after:g.fleet().forceRandomCarModel(),gaveUp:m.snapshot().gaveUp,skipped:m.snapshot().skipped,error:g.state().traffic.error};
 });
 expect(probe.civilian.length).toBeGreaterThan(0);expect(new Set(probe.civilian)).toEqual(new Set([459]));
 expect(probe.after).toBe(-1);expect(probe.gaveUp).toEqual([]);expect(probe.skipped).toEqual([]);expect(probe.error).toBeNull();expect(errors).toEqual([]);
});
