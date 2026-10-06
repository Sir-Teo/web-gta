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

// CConversationForPed::Update (AUTHORED): CJ stepping up to a dealer starts dealer.scm's conversation ("You want some
// stuff?", DEAL1, unsubtitled in English as the script asks); the script shows TALK_1's yes-or-no help, and Y answers
// yes, which takes the conversation to the dealer's DEAL2 that the script waits on.
test('a dealer asks CJ if he wants some, and Y answers him',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await expect.poll(async()=>(await state(page)).player.grounded,{timeout:60000}).toBe(true);
 await expect.poll(async()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.game.scriptBrains.brains.some((b:any)=>b.typeOfBrain===1)),{timeout:60000}).toBe(true);
 await expect.poll(async()=>page.evaluate(async()=>{
  const g=(window as any).__game,p=g.pedestrians(),me=g.sim.player.position,node=p.nearestNode({x:me.x+8,y:me.y,z:me.z});
  if(!node)return false;await p.spawnDealer(node,{x:me.x,z:me.z});return g.state().pedestrians.people.some((q:any)=>/drug/i.test(String(q.model)));
 }),{timeout:60000,intervals:[3000]}).toBe(true);
 await expect.poll(async()=>(await threads(page)).includes('DEALER'),{timeout:30000}).toBe(true);
 const dealer=await page.evaluate(()=>(window as any).__game.state().pedestrians.people.find((q:any)=>/drug/i.test(String(q.model))).id);
 await expect.poll(async()=>(await state(page)).pedestrians.people.find((q:any)=>q.id===dealer)?.reaction,{timeout:30000}).toBe('dealer_idle');
 const handle=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return m.runtime.game.conversations.all.find((c:any)=>c.ped!==undefined)?.ped;});
 expect(handle).toBeDefined();
 // CConversationForPed::Update greets a player who has not been in position for 10 s (m_LastTimeWeWereCloseEnough is
 // 0 at set-up), so the game clock must be past 10 s, as it is in play.
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().clockMs),{timeout:30000}).toBeGreaterThan(10500);
 // CJ steps up in front of him and faces him: IsPlayerInPositionForConversation wants the two within 4 units, facing
 // other ways (their forwards' dot no more than 0), and CJ standing.
 await page.evaluate(id=>{const g=(window as any).__game,a=g.pedestrians().people.find((x:any)=>x.id===id).actor.player,q=a.position,h=a.heading;
  g.placePlayer(q.x+Math.sin(h)*2.5,q.y,q.z+Math.cos(h)*2.5);g.sim.player.heading=h+Math.PI;},dealer);
 const conversation=()=>page.evaluate(h=>{const c=(window as any).__game.missionForProfiling().runtime.game.conversations.forPed(h);return {status:c?.status,node:c?.currentNode};},handle);
 await expect.poll(async()=>(await conversation()).status,{timeout:20000}).toBe(3);
 expect((await conversation()).node).toBe('DEAL1');
 await expect.poll(async()=>page.evaluate(()=>(document.querySelector('.help-box') as HTMLElement)?.textContent??''),{timeout:10000}).toContain('reply');
 await page.screenshot({path:'artifacts/dealer-conversation.png'});
 await page.keyboard.press('KeyY');
 await expect.poll(async()=>(await conversation()).node,{timeout:10000}).toBe('DEAL2');
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp)).toEqual([]);
 expect(errors).toEqual([]);
});
