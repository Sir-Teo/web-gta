import {test,expect,type Page} from '@playwright/test';
import {endStoryMission} from './freeRoam';

const state=(page:Page)=>page.evaluate(()=>(window as any).__game.state());
const threads=(page:Page)=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.active.map((a:any)=>a.thread.name as string));

// CScriptsForBrains' random-ped brains (AUTHORED trigger): MAIN gives dealer.scm to the dealer models (28, 29, 30, 254)
// at 100%. A dealer the street makes gets the script, which gives him $2000, his DEALER_IDLE loop, and ends once he is
// dead.
test('a street dealer runs dealer.scm: his money, his idle, and the script ends with him',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.scriptBrains.brains.some((b:any)=>b.typeOfBrain===1)),{timeout:60000}).toBe(true);
 // A dealer on the path node nearest CJ, as CPopulation would place one in a dealer zone.
 await expect.poll(async()=>page.evaluate(async()=>{
  const g=(window as any).__game,p=g.pedestrians(),me=g.sim.player.position,node=p.nearestNode({x:me.x+4,y:me.y,z:me.z});
  if(!node)return false;await p.spawnDealer(node,{x:me.x,z:me.z});return g.state().pedestrians.people.some((q:any)=>/drug/i.test(String(q.model)));
 }),{timeout:60000,intervals:[3000]}).toBe(true);
 await expect.poll(async()=>(await threads(page)).includes('DEALER'),{timeout:30000}).toBe(true);
 const dealer=await page.evaluate(()=>(window as any).__game.state().pedestrians.people.find((q:any)=>/drug/i.test(String(q.model))));
 // SET_CHAR_MONEY 0@ 2000, and TASK_PLAY_ANIM DEALER_IDLE once his first task is done.
 await expect.poll(async()=>page.evaluate(id=>(window as any).__game.pedestrians().people.find((q:any)=>q.id===id)?.money,dealer.id),{timeout:20000}).toBe(2000);
 await expect.poll(async()=>(await state(page)).pedestrians.people.find((q:any)=>q.id===dealer.id)?.reaction,{timeout:30000}).toBe('dealer_idle');
 await page.screenshot({path:'artifacts/ped-brains-dealer.png'});
 // Dead, the dealer's script runs its cleanup and ends.
 await page.evaluate(id=>(window as any).__game.killPed(id),dealer.id);
 await expect.poll(async()=>(await threads(page)).includes('DEALER'),{timeout:30000}).toBe(false);
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp)).toEqual([]);
 expect(errors).toEqual([]);
});
