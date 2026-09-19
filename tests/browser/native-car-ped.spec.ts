import {test,expect} from '@playwright/test';

test('a car at speed kills a pedestrian through the native kill task and keeps going',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680));await page.waitForTimeout(300);
 const trace:{speed:number;health?:number}[]=[];let id:number|null=null;
 await page.keyboard.down('KeyW');
 for(let i=0;i<60;i++){
  await page.waitForTimeout(50);
  const s=await state(),car=s.nativeCar,speed=Math.hypot(car.velocity.x,car.velocity.z);
  // Stand a civilian five metres ahead once the car passes 11 m/s.
  if(id===null&&speed>11)id=await page.evaluate(([x,z])=>(window as any).__game.placePed(x,12.55,z-5),[car.position.x,car.position.z]);
  const ped=id===null?undefined:s.pedestrians.people.find((p:any)=>p.id===id);
  trace.push({speed,health:ped?.health});
  if(ped&&ped.health<=0&&trace.filter(t=>t.health===0).length>3)break;
 }
 await page.keyboard.up('KeyW');
 expect(id,JSON.stringify(trace)).not.toBeNull();
 const hit=trace.findIndex(t=>t.health===0);
 expect(hit,JSON.stringify(trace)).toBeGreaterThan(0);
 // The ped takes the impact; the car loses only the task's push back, not its whole speed.
 expect(trace[hit].speed).toBeGreaterThan(trace[hit-1].speed*.6);
 const ped=(await state()).pedestrians.people.find((p:any)=>p.id===id);
 expect(ped).toMatchObject({state:'dead',health:0});
 expect(errors).toEqual([]);
});
