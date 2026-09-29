import {test,expect} from '@playwright/test';

test('a three-star roadblock stands its crew beside the cars at once instead of walking them out of the doors',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).pedestrians?.ready,{timeout:30000}).toBe(true);
 await expect.poll(async()=>(await state()).nativeCar!=null,{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar?.occupied,{timeout:15000}).toBe(true);
 await page.waitForTimeout(800);
 // Onto the East Beach road at three stars. ROADBLOX.DAT nodes roll a 12-in-128 chance, so the probe registers a
 // script roadblock across the road 40 units on (CRoadBlocks::RegisterScriptRoadBlock), which goes up at once
 // with the player within 90 units of it.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2839,120,1850);});
 await page.waitForTimeout(500);await expect.poll(async()=>(await state()).player.grounded,{timeout:90000}).toBe(true);
 // The browser's own pop-in guard keeps roadblocks out of view; the probe lifts it so the block forms in the open.
 await page.evaluate(()=>{const g=(window as any).__game;const y=g.groundAt(2839,1850,60)??10;g.placeCar(2839,y+.8,1850,Math.PI);g.setWantedLevel(3);g.police().canSpawn=()=>true;
  const z=g.groundAt(2839,1890,60)??y;g.police().registerScriptRoadblock({x:2833,y:-1890,z},{x:2845,y:-1890,z},false);});
 await page.keyboard.down('KeyW');
 let unit:any=null,officersBefore=0;
 for(let i=0;i<120&&!unit;i++){
  await page.waitForTimeout(250);
  const s=await state();unit=(s.police?.units??[]).find((u:any)=>u.mission==='roadblock')??null;
  if(!unit)officersBefore=(s.pedestrians.people as any[]).filter(p=>p.officer).length;
 }
 await page.keyboard.up('KeyW');
 expect(unit).not.toBeNull();
 // The crew was placed, not sent through the doors: nothing is leaving and the seats are already empty.
 expect(unit.leaving).toBe(0);
 await expect.poll(async()=>((await state()).police.units as any[]).find(u=>u.mission==='roadblock')?.crew??-1,{timeout:5000}).toBe(0);
 await expect.poll(async()=>((await state()).pedestrians.people as any[]).filter(p=>p.officer).length,{timeout:8000}).toBeGreaterThanOrEqual(officersBefore+2);
 // Down to two stars the block still stands (roadblock cops give up only at a clean level), its crew at their posts.
 const crewAt=await page.evaluate(()=>(window as any).__game.pedestrians().people.filter((p:any)=>p.crew?.roadblock).map((p:any)=>({x:p.actor.player.position.x,z:p.actor.player.position.z})));
 expect(crewAt.length).toBeGreaterThan(0);
 await page.evaluate(()=>(window as any).__game.setWantedLevel(2));await page.waitForTimeout(2000);
 expect(((await state()).police.units as any[]).some(u=>u.mission==='roadblock')).toBe(true);
 const moved=await page.evaluate(start=>(window as any).__game.pedestrians().people.filter((p:any)=>p.crew?.roadblock).map((p:any,i:number)=>Math.hypot(p.actor.player.position.x-start[i].x,p.actor.player.position.z-start[i].z)),crewAt);
 expect(Math.max(...moved)).toBeLessThan(1.5);
 expect(errors).toEqual([]);
});
