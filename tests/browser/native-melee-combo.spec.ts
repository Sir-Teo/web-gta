import {test,expect} from '@playwright/test';

test('left clicks punch through the native combo and kick a downed pedestrian',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.people?.filter((p:any)=>!p.officer&&p.health>0).length??0,{timeout:30000}).toBeGreaterThan(0);
 await expect.poll(async()=>(await state()).weapons.ready).toBe(true);
 // Stand a civilian 1.1 m in front of CJ, facing him.
 const s0=await state(),h=s0.player.heading,at={x:s0.player.position.x+Math.sin(h)*1.1,y:s0.player.position.y,z:s0.player.position.z+Math.cos(h)*1.1};
 // Street civilians arrive once the popcycle targets and the zone roster exist; the debug ped is one of them.
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 const id=await page.evaluate(([x,y,z])=>(window as any).__game.placePed(x,y,z),[at.x,at.y,at.z]);
 expect(id).not.toBeNull();
 await page.waitForTimeout(300);
 const ped=async()=>(await state()).pedestrians.people.find((p:any)=>p.id===id);
 const click=async()=>{await page.mouse.move(700,450);await page.mouse.down();await page.waitForTimeout(40);await page.mouse.up();};
 // A short, still left click attacks without aiming, as SA's left button does.
 const health:number[]=[],down:number[]=[];
 // Each blow lands on its melee.dat hit frame (5, 8 and 10 of 30 fps) after its move starts; a press during a move
 // starts the next one at the chain frame.
 // Presses follow each blow as a player mashing would: a punched ped turns to flee once its hit clip ends.
 let last=100;
 for(let i=0;i<3;i++){await click();await expect.poll(async()=>(await ped()).health,{intervals:[30]}).toBeLessThan(last);const p=await ped();last=p.health;health.push(p.health);down.push(p.down);}
 // UNARMED_1 damage 6, 9 and 15 (scaled for the player), chained inside each chain frame.
 expect(100-health[0]).toBeGreaterThan(0);
 expect(health[0]-health[1]).toBeCloseTo((100-health[0])*9/6,0);
 // The jab and cross only stagger; the third blow floors the victim.
 expect(down[0]).toBe(0);expect(down[1]).toBe(0);expect(down[2]).toBeGreaterThan(0);
 // A downed victim in reach takes the AGROUND kick.
 await page.waitForTimeout(600);
 const before=(await ped()).health;await click();await page.waitForTimeout(500);
 expect((await ped()).health).toBeLessThan(before);
 expect(errors).toEqual([]);
});
