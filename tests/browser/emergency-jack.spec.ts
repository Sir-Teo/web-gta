import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
type Crew='ambulanceAboard'|'ambulanceAway'|'fireTruck'|'roadblock';

/** An emergency vehicle or a roadblock car on Grove Street's open tarmac, its crew as `crew` says, held for CJ, who
 * presses enter beside the driver's door (or the passenger's); the occupant views of the car each frame until he is
 * seated, and the peds standing about it after. */
async function enter(page:Page,crew:Crew,side:'left'|'right'='left'){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.emergency()&&!!(window as any).__game.police()),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 const made=await page.evaluate(async crew=>{
  const g=(window as any).__game,em=g.emergency(),police=g.police(),fleet=g.fleet(),at={x:2480,y:g.groundAt(2480,1668,40),z:1668};
  for(const c of [...fleet.cars])if(!c.occupied&&c.autopilot)fleet.removeTrafficCar(c);
  if(crew==='roadblock'){
   police.canSpawn=()=>true;const car=await police.spawnPatrol(at,Math.PI/2);if(!car)return null;
   // A roadblock's crew stand at the block at once; the car waits on its brakes.
   const u=police.units.find((u:any)=>u.car===car);u.mission='roadblock';u.seats.fill(false);
   car.holdForEntry=true;(window as any).__car=car;return 'roadblock';
  }
  const car=await fleet.spawnTrafficCar(crew==='fireTruck'?407:416,at,Math.PI/2);if(!car)return null;
  car.autopilot={throttle:0,brake:0,steering:0,handbrake:false};car.holdForEntry=true;(window as any).__car=car;
  if(crew==='fireTruck'){em.trucks.push({car,model:'lafd1',mission:'wander',aim:{yaw:0,pitch:0}});return 'lafd1';}
  // The van waiting on its brakes (MISSION_NONE) with both medics out treating a body, or both aboard.
  const away=crew==='ambulanceAway';
  em.units.push({car,model:'laemt1',mission:away?'crewOut':'wander',medics:[0,2].map((seat:number)=>({seat,state:away?'foot':'seated',time:0,best:Infinity,stall:0,leftOnce:away}))});
  em.driving.clear(car);return 'laemt1';
 },crew);
 expect(made).not.toBeNull();
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.waitForTimeout(2000);
 await page.evaluate(k=>{const g=(window as any).__game,car=(window as any).__car,t=car.car.body.translation(),h=car.heading();g.placePlayer(t.x+k*Math.cos(h)*2.6,t.y-.5,t.z-k*Math.sin(h)*2.6);},side==='left'?1:-1);
 await page.waitForTimeout(1200);
 await page.keyboard.press('KeyF');
 const frames:{phase:string|null;npc:string|null;views:string[]}[]=[];
 for(let i=0;i<240;i++){
  const s=await page.evaluate(()=>{const g=(window as any).__game,e=g.state().carEntry,car=(window as any).__car,handle=String(car.car.body.handle);
   return {phase:e.phase as string|null,npc:(e.npc?.kind??null) as string|null,views:[...g.occupants().views].filter(([k]:any)=>k.includes(handle)).map(([k,v]:any)=>`${k.split(':')[0]}:${k.split(':').at(-1)}=${v.model}`)};});
  frames.push(s);if(s.phase==='seated'&&!s.npc)break;
  await page.waitForTimeout(50);
 }
 expect(frames.at(-1)!.phase).toBe('seated');
 const peds=():Promise<{fallClip:string|null;crew:boolean}[]>=>page.evaluate(m=>{const g=(window as any).__game,car=(window as any).__car,t=car.car.body.translation();
  return g.pedestrians().people.filter((p:any)=>p.modelRef===m&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<16).map((p:any)=>({fallClip:(p.fallClip??null) as string|null,crew:!!p.crew}));},made);
 return {model:made!,frames,peds};
}

test('nobody is dragged out of an ambulance whose medics are away, or of a roadblock car whose crew stand at the block',async({page})=>{
 test.setTimeout(240000);
 const {frames}=await enter(page,'ambulanceAway');
 // IsCarSlowJackRequired asks for m_pDriver, not for a car being held: CJ opens the door and gets in.
 expect(frames.some(f=>f.phase==='pullout'||f.npc)).toBe(false);
 expect(frames.flatMap(f=>f.views).filter(v=>v.startsWith('leaving:'))).toEqual([]);
 const roadblock=await enter(page,'roadblock');
 expect(roadblock.frames.some(f=>f.phase==='pullout'||f.npc)).toBe(false);
});

test('jacking an ambulance drags its medic out, and the medic behind gets out once CJ is in',async({page})=>{
 test.setTimeout(240000);
 const {model,frames,peds}=await enter(page,'ambulanceAboard');
 expect(frames.filter(f=>f.phase==='pullout').slice(1).every(f=>f.views.includes(`leaving:0=${model}`)&&!f.views.includes(`emergency:0=${model}`))).toBe(true);
 // The rear medic is drawn in his seat until CJ is in, then in his exit clip, never again once out.
 expect(frames.filter(f=>f.phase==='getIn').some(f=>f.views.includes(`emergency:2=${model}`))).toBe(true);
 await expect.poll(async()=>(await peds()).length,{timeout:10000}).toBe(2);
 const out=await peds();
 expect(out.filter(p=>p.fallClip?.includes('jacked')).length).toBe(1);
 expect(out.every(p=>!p.crew)).toBe(true);
});

test('at a fire engine\'s passenger door CJ drags the second fireman out and the driver leaves; at the driver\'s, the second fireman gets out',async({page})=>{
 test.setTimeout(240000);
 const right=await enter(page,'fireTruck','right');
 expect(right.frames.filter(f=>f.phase==='pullout').slice(1).every(f=>f.views.includes(`leaving:1=${right.model}`)&&!f.views.includes(`emergency:1=${right.model}`))).toBe(true);
 expect(right.frames.some(f=>f.npc==='getOut'&&f.views.includes(`leaving:0=${right.model}`))).toBe(true);
 await expect.poll(async()=>(await right.peds()).length,{timeout:10000}).toBe(2);
 const left=await enter(page,'fireTruck','left');
 expect(left.frames.filter(f=>f.phase==='pullout').slice(1).every(f=>f.views.includes(`leaving:0=${left.model}`))).toBe(true);
 await expect.poll(async()=>(await left.peds()).length,{timeout:10000}).toBe(2);
});
