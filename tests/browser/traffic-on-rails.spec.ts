import {test,expect} from '@playwright/test';
// CCarCtrl::UpdateCarOnRails (Vice City; SA's is a stub): traffic beyond the physics radius drives on rails instead of freezing.
test('traffic beyond the active radius keeps driving its lane on rails',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state().traffic?.ready&&(window as any).__game.state().nativeCharacter,undefined,{timeout:60000});
 await page.waitForFunction(()=>((window as any).__game.state().traffic?.cars??[]).length>=2,undefined,{timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const railed=async()=>(await state()).traffic.cars.find((c:any)=>c.rails);
 for(let attempt=0;attempt<4&&!(await railed());attempt++){
  // Step 70 units away from a car so it falls past 100.
  const s=await state(),p=s.player.position,c=s.traffic.cars[0].position,l=Math.hypot(p.x-c.x,p.z-c.z)||1;
  await page.evaluate(([x,y,z])=>(window as any).__game.placePlayer(x,y,z),[p.x+(p.x-c.x)/l*70,p.y,p.z+(p.z-c.z)/l*70]);
  await page.waitForTimeout(3000);
 }
 const car=await railed();expect(car).toBeTruthy();
 const before=car.position;await page.waitForTimeout(1000);
 const after=(await state()).traffic.cars.find((c:any)=>c.rails&&Math.hypot(c.position.x-before.x,c.position.z-before.z)<20);
 expect(after).toBeTruthy();
 expect(Math.hypot(after.position.x-before.x,after.position.z-before.z)).toBeGreaterThan(1.5);
 expect(after.alignment).toBeGreaterThan(.95);expect(after.laneError).toBeLessThan(1);
 expect(errors).toEqual([]);
});
