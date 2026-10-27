import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
type Officer={id:number;model:string;down:number;fallClip:string|null;weapon:number|null;health:number};

/** A patrol car on Grove Street's open tarmac with two cops aboard, held for CJ, who presses enter beside the
 * driver's door (left) or the passenger's (right); the occupant views of the car each frame until he is seated. */
async function jack(page:Page,side:'left'|'right',deadPassenger=false){
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(()=>page.evaluate(()=>!!(window as any).__game.police()),{timeout:60000}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__game;g.placePlayer(2486,g.groundAt(2486,1662,40)+.05,1662);});
 await page.waitForTimeout(2500);
 const model=await page.evaluate(async()=>{
  const g=(window as any).__game,police=g.police(),fleet=g.fleet();police.canSpawn=()=>true;
  for(const c of [...fleet.cars])if(!c.occupied&&c.autopilot)fleet.removeTrafficCar(c);
  const car=await police.spawnPatrol({x:2480,y:g.groundAt(2480,1668,40),z:1668},Math.PI/2);if(!car)return null;
  car.holdForEntry=true;(window as any).__copCar=car;
  const unit=police.units.find((u:any)=>u.car===car);unit.seats[0]=unit.seats[1]=true;
  return unit.member.model as string;
 });
 expect(model).not.toBeNull();
 await page.locator('canvas.world').click({position:{x:400,y:300}});
 await page.waitForTimeout(2000);
 await page.evaluate(k=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation(),h=car.heading();g.placePlayer(t.x+k*Math.cos(h)*2.2,t.y-.5,t.z-k*Math.sin(h)*2.2);},side==='left'?1:-1);
 await page.waitForTimeout(1200);
 let fatal:any;
 if(deadPassenger)fatal=await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar,stats=g.missionForProfiling().runtime.game.stats,snapshot=()=>Object.fromEntries([120,121,176,68].map(id=>[id,stats.get(id)])),before=snapshot(),hit=g.police().crewShot(car,1,25,22,true,'remote');return {before,after:snapshot(),hit};});
 await page.keyboard.press('KeyF');
 const frames:{phase:string|null;npc:string|null;views:string[]}[]=[];
 for(let i=0;i<240;i++){
  const s=await page.evaluate(()=>{const g=(window as any).__game,e=g.state().carEntry,car=(window as any).__copCar,handle=String(car.car.body.handle);
   return {phase:e.phase as string|null,npc:(e.npc?.kind??null) as string|null,views:[...g.occupants().views].filter(([k]:any)=>k.includes(handle)).map(([k,v]:any)=>`${k.split(':')[0]}:${k.split(':').at(-1)}=${v.model}`)};});
  frames.push(s);if(s.phase==='seated'&&!s.npc)break;
  await page.waitForTimeout(50);
 }
 expect(frames.at(-1)!.phase).toBe('seated');
 const officers=async():Promise<Officer[]>=>page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation();
  return g.pedestrians().people.filter((p:any)=>p.officer&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<10).map((p:any)=>({id:p.id,model:p.modelRef,down:p.down,fallClip:p.fallClip??null,weapon:p.weapon?.info?.type??null,health:p.health}));});
 return {model:model!,frames,officers,fatal};
}

test('a cop dragged out of the driver\'s seat is drawn as the cop and gets up an officer; his partner climbs out once CJ is in',async({page})=>{
 test.setTimeout(240000);
 const {model,frames,officers}=await jack(page,'left');
 const pulling=frames.filter(f=>f.phase==='pullout'&&f.npc==='jacked');
 expect(pulling.length).toBeGreaterThan(5);
 // CTaskComplexCarSlowBeDraggedOut on the unit's own ped: the leaving view is the cop's model, never a civilian's,
 // and from the frame after the pull-out starts he is no longer drawn in the driver's seat as well.
 const leaving=frames.flatMap(f=>f.views.filter(v=>v.startsWith('leaving:')));
 expect(leaving.length).toBeGreaterThan(5);
 expect(new Set(leaving)).toEqual(new Set([`leaving:0=${model}`]));
 expect(pulling.slice(1).some(f=>f.views.includes(`police:0=${model}`))).toBe(false);
 // He lies on the clip's last frame, gets up and goes on an officer on foot with his gun; the partner CJ left aboard
 // gets out by his own door (MakeUndraggedPassengerPedsLeaveCar) and is an officer on foot too, and the car's views end.
 await expect.poll(async()=>(await officers()).some(c=>c.fallClip==='car_jackedlhs'),{timeout:10000}).toBe(true);
 const dragged=(await officers()).find(c=>c.fallClip==='car_jackedlhs')!;
 expect(dragged.model).toBe(model);expect(dragged.weapon).not.toBeNull();expect(dragged.health).toBeGreaterThan(0);
 await expect.poll(async()=>(await officers()).find(c=>c.id===dragged.id)?.down??-1,{timeout:10000}).toBe(0);
 await expect.poll(async()=>(await officers()).filter(c=>c.model===model&&c.id!==dragged.id&&c.fallClip===null).length,{timeout:10000}).toBeGreaterThanOrEqual(1);
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar;return !g.police().units.some((u:any)=>u.car===car)&&![...g.occupants().views.keys()].some((k:string)=>k.includes(String(car.car.body.handle)));}),{timeout:10000}).toBe(true);
 const civilians=await page.evaluate(()=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation();
  return g.pedestrians().people.filter((p:any)=>!p.officer&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<6).length;});
 expect(civilians).toBe(0);
});

test('at the passenger\'s door CJ drags the cop in that seat out with the right-hand clips, and the driver gets out',async({page})=>{
 test.setTimeout(240000);
 const {model,frames,officers}=await jack(page,'right');
 // ComputeSlowJackedPed for the right front door: m_apPassengers[0], CAR_jackedRHS; CJ never sits in on him.
 const pulling=frames.filter(f=>f.phase==='pullout'&&f.npc==='jacked');
 expect(pulling.length).toBeGreaterThan(5);
 expect(pulling.slice(1).every(f=>f.views.includes(`leaving:1=${model}`)&&!f.views.includes(`police:1=${model}`))).toBe(true);
 // The driver stays at the wheel while CJ gets in, then leaves by his own door as himself.
 expect(frames.filter(f=>f.phase==='getIn').every(f=>f.views.includes(`police:0=${model}`))).toBe(true);
 expect(frames.some(f=>f.npc==='getOut'&&f.views.includes(`leaving:0=${model}`))).toBe(true);
 expect(frames.flatMap(f=>f.views).filter(v=>v.startsWith('leaving:')&&!v.endsWith(`=${model}`))).toEqual([]);
 await expect.poll(async()=>(await officers()).some(c=>c.fallClip==='car_jackedrhs'),{timeout:10000}).toBe(true);
 await expect.poll(async()=>(await officers()).filter(c=>c.model===model).length,{timeout:10000}).toBeGreaterThanOrEqual(2);
});

test('dragging a previously counted dead cop out preserves his corpse without another kill',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const {model,fatal}=await jack(page,'right',true);
 expect(fatal.hit).toBe('killed');expect(fatal.after[120]-fatal.before[120]).toBe(1);expect(fatal.after[121]).toBe(fatal.before[121]);expect(fatal.after[176]).toBe(fatal.before[176]);expect(fatal.after[68]).toBe(fatal.before[68]);
 await page.waitForFunction(model=>{const g=(window as any).__game,car=(window as any).__copCar,t=car.car.body.translation();return g.pedestrians().people.some((p:any)=>p.modelRef===model&&p.health===0&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<10);},model,{timeout:15000});
 const result=await page.evaluate(model=>{const g=(window as any).__game,stats=g.missionForProfiling().runtime.game.stats,car=(window as any).__copCar,t=car.car.body.translation(),body=g.pedestrians().people.find((p:any)=>p.modelRef===model&&p.health===0&&Math.hypot(p.actor.player.position.x-t.x,p.actor.player.position.z-t.z)<10);return {health:body.health,armour:body.armour,money:body.money,stats:Object.fromEntries([120,121,176,68].map(id=>[id,stats.get(id)]))};},model);
 expect(result).toEqual({health:0,armour:0,money:0,stats:fatal.after});expect(errors).toEqual([]);
});
