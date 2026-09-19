import {test,expect} from '@playwright/test';

test('rolling over a body at speed bloodies the tyre, which leaves a red trail',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(1500);
 await page.evaluate(()=>(window as any).__game.placeCar(2491,13.3,1680));await page.waitForTimeout(300);
 let id:number|null=null;const trace:{speed:number;z:number;bloody:number}[]=[];
 await page.keyboard.down('KeyW');
 for(let i=0;i<80;i++){
  await page.waitForTimeout(50);
  const s=await state(),car=s.nativeCar,speed=Math.hypot(car.velocity.x,car.velocity.z);
  // Once past 11 m/s, a body 7 m ahead in the left wheels' path.
  if(id===null&&speed>11){
   id=await page.evaluate(([x,z])=>{const g=(window as any).__game,id=g.placePed(x-.95,12.55,z-7);if(id!=null)g.killPed(id);return id;},[car.position.x,car.position.z]);
  }
  trace.push({speed,z:car.position.z,bloody:s.skidmarks.bloody});
  if(s.skidmarks.bloody>0)break;
 }
 await page.waitForTimeout(600);await page.keyboard.up('KeyW');
 await page.screenshot({path:'artifacts/native-tyre-blood.png'});
 expect(id,JSON.stringify(trace)).not.toBeNull();
 expect(trace.at(-1)!.bloody,JSON.stringify(trace)).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
