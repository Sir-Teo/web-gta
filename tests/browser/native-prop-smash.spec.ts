import {test,expect} from '@playwright/test';

test('the world car ploughs through OBJECT.DAT street props instead of stopping dead',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 // Props only respond once OBJECT.DAT has classified the placements as dummies.
 await expect.poll(async()=>(await state()).objectKinds.includes('dummy'),{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied).toBe(true);
 await page.waitForTimeout(1500);
 // Drive north out of the Johnson house drive, through the bag, box and lamppost on the kerb.
 const trace:{z:number;speed:number;smashed:number}[]=[];
 await page.keyboard.down('KeyW');
 for(let i=0;i<14;i++){
  await page.waitForTimeout(200);
  const car=(await state()).nativeCar;trace.push({z:car.position.z,speed:Math.hypot(car.velocity.x,car.velocity.z),smashed:car.propsSmashed});
 }
 await page.keyboard.up('KeyW');
 const smashed=await page.evaluate(()=>(window as any).__game.smashedProps());
 const first=trace.findIndex(t=>t.smashed>0);
 expect(first,JSON.stringify(trace)).toBeGreaterThan(0);
 expect(smashed.map((p:{model:string})=>p.model.toLowerCase())).toEqual(expect.arrayContaining(['blackbag2']));
 // The prop's native push back costs speed, but the car carries on past the kerb line.
 const before=trace[first-1].speed,after=trace[first].speed;
 expect(before).toBeGreaterThan(12);
 expect(after).toBeGreaterThan(before*.3);
 expect(Math.min(...trace.map(t=>t.z))).toBeLessThan(1653);
 // lamppost3 is BREAKABLE: BreakObject_c throws its three material groups, which land and fade out.
 expect(smashed.map((p:{model:string})=>p.model.toLowerCase())).toContain('lamppost3');
 const pieces=(await state()).breakObjects;
 expect(pieces.active).toBe(1);expect(pieces.drawn).toBe(1);expect(pieces.groups[0]).toHaveLength(3);
 await expect.poll(async()=>(await state()).breakObjects.groups[0]?.every((g:{stopped:boolean})=>g.stopped)??true,{timeout:10000}).toBe(true);
 await expect.poll(async()=>(await state()).breakObjects.active,{timeout:15000}).toBe(0);
 // Streaming windows replaced meanwhile must not bring the smashed props back.
 expect(await page.evaluate(()=>(window as any).__game.revivedProps())).toBe(0);
 expect(errors).toEqual([]);
});

test('a car uproots a fire hydrant and keeps most of its speed',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 await expect.poll(async()=>(await state()).player.grounded).toBe(true);
 await expect.poll(async()=>(await state()).objectKinds.includes('dummy'),{timeout:30000}).toBe(true);
 await page.keyboard.press('KeyF');
 await expect.poll(async()=>(await state()).nativeCar.occupied).toBe(true);
 await page.waitForTimeout(1500);
 // Line up on the hydrant at native (2495.3, -1653.7): uproot limit 100, mass 150.
 await page.evaluate(()=>(window as any).__game.placeCar(2495.3,13.3,1668));await page.waitForTimeout(500);
 const trace:{speed:number;uprooted:number}[]=[];
 await page.keyboard.down('KeyW');
 for(let i=0;i<60;i++){
  await page.waitForTimeout(50);
  const car=(await state()).nativeCar;trace.push({speed:Math.hypot(car.velocity.x,car.velocity.z),uprooted:car.propsUprooted});
  if(car.propsUprooted&&trace.length>trace.findIndex(t=>t.uprooted)+2)break;
 }
 await page.keyboard.up('KeyW');
 const hit=trace.findIndex(t=>t.uprooted>0);
 expect(hit,JSON.stringify(trace)).toBeGreaterThan(0);
 // The general two-body branch: a 150 kg hydrant takes little of the car's momentum.
 expect(trace[hit].speed).toBeGreaterThan(trace[hit-1].speed*.8);
 const moved=async()=>(await page.evaluate(()=>(window as any).__game.movedProps()))[0];
 await expect.poll(async()=>(await moved())?.dynamic).toBe(true);
 await page.waitForTimeout(3000);
 // Knocked off its spot, and still there after any streaming window replacement.
 const after=await moved();
 expect(after.key).toBe('fire_hydrant:2495.27:-1653.67:12.91');
 expect(after.dynamic).toBe(true);
 expect(Math.hypot(after.at.x-2495.27,after.at.z-1653.67)).toBeGreaterThan(2);
 expect(errors).toEqual([]);
});
