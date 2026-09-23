import {test,expect,type Page} from '@playwright/test';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
/** The placed civilian by id. */
const ped=(page:Page,id:number)=>page.evaluate(id=>{
 const best=((window as any).__game.pedestrians().people as any[]).find(p=>p.id===id);
 return best?{down:Number.isFinite(best.down)?best.down:-1,stuck:!!best.stuckUnderCar,reaction:best.view.reactionName??null,fall:best.fallClip??null,health:best.health,evade:best.evade?.kind??null,alpha:best.alpha,fadeOut:best.fadeOut,x:best.actor.player.position.x,y:best.actor.player.position.y,z:best.actor.player.position.z}:null;
},id);

test('a car parked over a fallen ped or CJ keeps them down until it moves; the get-up clip follows the fall clip',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await expect.poll(async()=>(await state(page)).player.grounded).toBe(true);
 // CJ: the empty starter car twelve metres behind runs him down at 30 m/s.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2491,12.6,1668);g.placeCar(2491,13.3,1680,0);});
 await page.waitForTimeout(800);
 await page.evaluate(()=>(window as any).__game.launchCar(30));
 await expect.poll(async()=>(await state(page)).knockdown,{timeout:3000}).toBeGreaterThan(0);
 const hurt=(await state(page)).player.health;
 // Parked back over him (peds and cars share no solver group, so it settles on the road) he stays down, run over for
 // the time step a frame.
 await page.evaluate(()=>{const g=(window as any).__game,s=g.state();g.placeCar(s.player.position.x,s.player.position.y+.7,s.player.position.z,0);});
 await expect.poll(async()=>(await state(page)).stuckUnderCar,{timeout:8000}).toBe(true);
 await page.waitForTimeout(600);
 const stuck=await state(page);expect(stuck.knockdown).toBeGreaterThan(0);expect(stuck.player.health).toBeLessThan(hurt-10);
 // The car moved off, he gets up and the bleeding stops.
 await page.evaluate(()=>{const g=(window as any).__game,s=g.state();g.placeCar(s.player.position.x+15,s.player.position.y+.7,s.player.position.z,0);});
 await expect.poll(async()=>(await state(page)).stuckUnderCar,{timeout:3000}).toBe(false);
 const freed=(await state(page)).player.health;
 await expect.poll(async()=>(await state(page)).knockdown,{timeout:6000}).toBe(0);
 expect((await state(page)).player.health).toBe(freed);
 // A civilian three metres ahead of the car, too close to step aside, is knocked down at 6 m/s (twice that kills, pedIntensity over 12).
 // The hooks move the car nearest CJ, so he stands off to the side, nearer this car than the script's parked ones.
 const id=await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2480,12.6,1676);g.placeCar(2491,13.3,1680,0);return g.placePed(2491,12.6,1676.5);});
 expect(typeof id).toBe('number');
 await page.waitForTimeout(500);
 // A parked car's brakes stop a single push within a metre, so the launch repeats until the strike.
 const trail:string[]=[];
 for(let i=0;i<60&&!((await ped(page,id))!.down>0);i++){await page.evaluate(()=>(window as any).__game.launchCar(6));const p=(await ped(page,id))!;trail.push(`${p.down}/${p.evade}/${p.x.toFixed(1)},${p.z.toFixed(1)}`);await page.waitForTimeout(50);}
 const fallen=(await ped(page,id))!;expect(fallen.down,trail.join(' ')).toBeGreaterThan(0);expect(fallen.health).toBeGreaterThan(0);expect(fallen.fall).toBeTruthy();
 // Once the skid has stopped (a second), the car parked over the ped keeps it lying past the knockdown's 3.5 s with
 // no get-up clip.
 await page.waitForTimeout(1000);
 const rest=(await ped(page,id))!;
 await page.evaluate(([x,y,z])=>(window as any).__game.placeCar(x,y+.7,z,0),[rest.x,rest.y,rest.z] as const);
 const after:string[]=[];
 for(let i=0;i<80&&!(await ped(page,id))?.stuck;i++){const p=await ped(page,id);const n=await page.evaluate(()=>((window as any).__game.pedestrians().people as any[]).length);after.push(p?`${p.down.toFixed(2)}/${p.health}/${p.reaction}/${p.stuck}/${n}/y${p.y.toFixed(2)}/a${p.alpha}${p.fadeOut?'F':''}`:`gone/${n}`);await page.waitForTimeout(100);}
 {const gone=after.findIndex(e=>e.startsWith('gone'));expect((await ped(page,id))?.stuck,after.slice(Math.max(0,gone-8),gone+1).join(' ')).toBe(true);}
 await page.waitForTimeout(2000);
 const held=(await ped(page,id))!;expect(held.down).toBeGreaterThan(0);expect(held.stuck).toBe(true);expect(held.reaction).not.toMatch(/^getup/);
 // The car moved away, the get-up plays: GETUP_FRONT only after a front fall.
 await page.evaluate(([x,y,z])=>(window as any).__game.placeCar(x+15,y+.7,z,0),[fallen.x,fallen.y,fallen.z] as const);
 await expect.poll(async()=>(await ped(page,id))?.reaction,{timeout:4000}).toMatch(/^getup/);
 const rising=(await ped(page,id))!;
 expect(rising.reaction).toBe(['ko_shot_front','ko_skid_back','floor_hit_f'].includes(fallen.fall)?'getup_front':'getup');
 await expect.poll(async()=>(await ped(page,id))?.down,{timeout:6000}).toBe(0);
 expect(errors).toEqual([]);
});
