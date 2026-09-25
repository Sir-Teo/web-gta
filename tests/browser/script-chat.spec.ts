import {test,expect} from '@playwright/test';
/** TASK_CHAT_WITH_CHAR (CTaskComplexChat): the lead speaker chats and the other listens. Script peds say nothing, so
 * the lead speaker finishes both chats as soon as the other is listening. With the player as the partner, who never
 * holds a chat task, the lead gives up after fifty silent frames, and a listener keeps listening. */
test('two script peds chat and part; a chat with the player ends for the speaker only',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 const [a,b]=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  return [mission.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y}),mission.peds.create(4,'MALE01',{x:p.x+5,y:-p.z,z:p.y})];
 });
 await page.waitForFunction(([a,b]:number[])=>{const m=(window as any).__game.missionForProfiling();return !!m.peds.entity(a)&&!!m.peds.entity(b);},[a,b],{timeout:45000});
 const CHAT=0x0677;
 const status=(handle:number)=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle,opcode:CHAT});
 const kinds=await page.evaluate(({a,b,opcode})=>{
  const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;
  w.givePedScriptedTask(a,{kind:'chatWithPed',other:b,leadSpeaker:true,unknown:1},opcode);
  w.givePedScriptedTask(b,{kind:'chatWithPed',other:a,leadSpeaker:false,unknown:1},opcode);
  return [m.peds.entity(a).order?.kind,m.peds.entity(b).order?.kind];
 },{a,b,opcode:CHAT});
 expect(kinds).toEqual(['chat','chat']);
 await expect.poll(()=>status(a),{timeout:20000}).toBe(7);
 await expect.poll(()=>status(b),{timeout:20000}).toBe(7);
 // With the player: the speaker's silence runs out, the listener listens on.
 await page.evaluate(({a,b,opcode})=>{
  const w=(window as any).__game.missionForProfiling().runtime.world;
  w.givePedScriptedTask(a,{kind:'chatWithPed',other:1,leadSpeaker:true,unknown:1},opcode);
  w.givePedScriptedTask(b,{kind:'chatWithPed',other:1,leadSpeaker:false,unknown:1},opcode);
 },{a,b,opcode:CHAT});
 await expect.poll(()=>status(a),{timeout:30000}).toBe(7);
 expect(await status(b)).toBe(1);
 expect(await page.evaluate((b:number)=>(window as any).__game.missionForProfiling().peds.entity(b).order?.kind,b)).toBe('chat');
 expect(errors).toEqual([]);
});
