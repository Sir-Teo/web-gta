import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a street ped spawns on the Grove Street porch steps and sits through the seat clips',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await endStoryMission(page);
 await expect.poll(async()=>(await state()).pedestrians.people.some((p:any)=>!p.officer&&p.health>0),{timeout:60000}).toBe(true);
 // The porch steps of the Grove Street house at native (2512.6, -1651): 46 m north of CJ facing them (heading π faces -z; the
 // on-screen band, 42.5 to 50.5) or 20 m north of CJ facing away (the off-screen band, 15 to 25). The camera hangs on its
 // string, so the spec tries both stands; each refills the street, and every successful spawn tries an attractor.
 const stands=[{z:1697,heading:Math.PI},{z:1671,heading:0}];
 let near:any[]=[];
 for(const stand of stands){
  await page.evaluate(({z,heading})=>{const g=(window as any).__game;g.placePlayer(2512,g.groundAt(2512,z,300)+.05,z);g.turnPlayer(heading);},stand);
  await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.attractorsNear(60).filter((a:any)=>a.type===9).length)),{timeout:20000}).toBeGreaterThan(0);
  near=await page.evaluate(()=>(window as any).__game.attractorsNear(60));
  await page.waitForTimeout(3000);
  await page.evaluate(()=>(window as any).__game.pedestrians().removeAllRandomPeds());
  const t0=Date.now();let sat=false;
  while(Date.now()-t0<20000&&!sat){await page.waitForTimeout(500);sat=(await state()).pedestrians.people.some((p:any)=>p.attract);}
  if(sat)break;
 }
 expect((await state()).pedestrians.people.some((p:any)=>p.attract)).toBe(true);
 const s=await state();
 const sitter=s.pedestrians.people.find((p:any)=>p.attract);
 expect(['sit','idle','up']).toContain(sitter.attract.phase);
 // Steps sit on the attractors block's Stepsit clips, not the bench's SEAT clips.
 expect(sitter.reaction).toMatch(/^stepsit_(in|loop|out)$/);
 expect(sitter.attract.type).toBe(9);
 // The ped sits on the effect point: within a unit of the placed attractor it registered with.
 const at=near.find((a:any)=>a.key===sitter.attract.key);
 expect(at).toBeDefined();
 expect(Math.hypot(sitter.position.x-at.position[0],sitter.position.z+at.position[1])).toBeLessThan(1);
 expect(s.pedestrians.attractors).toBeGreaterThanOrEqual(1);
 expect(errors).toEqual([]);
});
