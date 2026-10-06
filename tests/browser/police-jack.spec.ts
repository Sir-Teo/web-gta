import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());

test('a cop the player drags out of his patrol car is drawn as the cop through the jacked clip and gets up an armed officer',async({page})=>{
 test.setTimeout(240000);
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.police()),{timeout:60000}).toBe(true);
 // Grove Street's open tarmac, a patrol car beside CJ with its crew aboard and held for him.
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 const spawned=await page.evaluate(async()=>{
  const g=(window as any).__game,police=g.police(),fleet=g.fleet();police.canSpawn=()=>true;
  for(const c of [...fleet.cars])if(!c.occupied&&c.autopilot)fleet.removeTrafficCar(c);
  const car=await police.spawnPatrol({x:2480,y:g.groundAt(2480,1668,40),z:1668},Math.PI/2);if(!car)return null;
  car.holdForEntry=true;(window as any).__copCar=car;
  return {model:police.units.find((u:any)=>u.car===car).member.model as string};
 });
 expect(spawned).not.toBeNull();
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.waitForTimeout(2000);
 // CJ beside the driver's door, then the enter press.
 await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation(),h=car.heading();g.placePlayer(t.x+Math.cos(h)*2.2,t.y-.5,t.z-Math.sin(h)*2.2);});
 await page.waitForTimeout(1200);
 await page.keyboard.press('KeyF');
 const frames:{phase:string|null;npc:string|null;views:string[]}[]=[];
 for(let i=0;i<200;i++){
  const s=await page.evaluate(()=>{const g=(window as any).__game,e=g.state().carEntry,car=(window as any).__copCar,handle=String(car.car.body.handle);
   return {phase:e.phase as string|null,npc:(e.npc?.kind??null) as string|null,views:[...g.occupants().views].filter(([k]:any)=>k.includes(handle)).map(([k,v]:any)=>`${k.split(':')[0]}${k.startsWith('police')?':'+k.split(':').at(-1):''}=${v.model}`)};});
  frames.push(s);if(s.phase==='seated'&&!s.npc)break;
  await page.waitForTimeout(50);
 }
 const pulling=frames.filter(f=>f.phase==='pullout'&&f.npc==='jacked');
 expect(pulling.length).toBeGreaterThan(5);
 // CTaskComplexCarSlowBeDraggedOut on the unit's own ped: the leaving view is the cop's model, never a civilian's,
 // and from the frame after the pull-out starts he is no longer drawn in the driver's seat as well.
 const leaving=frames.flatMap(f=>f.views.filter(v=>v.startsWith('leaving=')));
 expect(leaving.length).toBeGreaterThan(5);
 expect(new Set(leaving)).toEqual(new Set([`leaving=${spawned!.model}`]));
 expect(pulling.slice(1).some(f=>f.views.includes(`police:0=${spawned!.model}`))).toBe(false);
 expect(frames.at(-1)!.phase).toBe('seated');
 // He lies on the clip's last frame, gets up and goes on an officer on foot with his gun.
 // (The street's own cops may come by once he is wanted; the dragged one is the officer lying beside the car.)
 const officers=async()=>page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation();
  return g.pedestrians().people.filter((p:any)=>p.officer&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<10).map((p:any)=>({id:p.id,model:p.modelRef,down:p.down,fallClip:p.fallClip??null,weapon:p.weapon?.info?.type??null,health:p.health}));});
 await expect.poll(async()=>(await officers()).some(c=>c.down>0),{timeout:10000}).toBe(true);
 const cop=(await officers()).find(c=>c.down>0)!;
 expect(cop.model).toBe(spawned!.model);expect(cop.fallClip).toBe('car_jackedlhs');expect(cop.weapon).not.toBeNull();expect(cop.health).toBeGreaterThan(0);
 await expect.poll(async()=>(await officers()).find(c=>c.id===cop.id)?.down??-1,{timeout:10000}).toBe(0);
 const civilians=await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation();
  return g.pedestrians().people.filter((p:any)=>!p.officer&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<6).length;});
 expect(civilians).toBe(0);
});
