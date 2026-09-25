import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** TASK_PLAY_ANIM: a PED clip plays once and the task ends with it; a clip from another block (ATTRACTORS) is read from
 * the archive, loops, and ends with the script's time. */
test('a script ped plays a named clip from ped.ifp and from a script animation block',async({page})=>{
 test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(async()=>await page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{
  const game=(window as any).__game,mission=game.missionForProfiling(),p=game.state().player.position;
  return mission.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});
 });
 await page.waitForFunction((handle:number)=>!!(window as any).__game.missionForProfiling().peds.entity(handle),ped,{timeout:45000});
 const PLAY=0x0605;
 const play=(file:string,name:string,loop:boolean,hold:boolean,time:number)=>page.evaluate(({handle,opcode,file,name,loop,hold,time})=>
  (window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(handle,{kind:'playAnim',animationName:name,animationFile:file,blendSpeed:4,loop,lockX:false,lockY:false,keepLastFrame:hold,time,interruptable:true},opcode),
  {handle:ped,opcode:PLAY,file,name,loop,hold,time});
 const status=()=>page.evaluate(({handle,opcode})=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(handle,opcode),{handle:ped,opcode:PLAY});
 const playing=(name:string)=>page.evaluate(({handle,name})=>(window as any).__game.missionForProfiling().runtime.world.pedIsPlayingAnim?.(handle,name)??(window as any).__game.missionForProfiling().peds.entity(handle).view.reactionName===name.toLowerCase(),{handle:ped,name});
 await play('PED','IDLE_chat',false,false,-1);
 await expect.poll(()=>playing('IDLE_chat'),{timeout:10000}).toBe(true);
 await expect.poll(status,{timeout:30000}).toBe(7);
 expect(await playing('IDLE_chat')).toBe(false);
 await play('ATTRACTORS','Stepsit_loop',true,false,1500);
 await expect.poll(()=>playing('Stepsit_loop'),{timeout:20000}).toBe(true);
 await expect.poll(status,{timeout:20000}).toBe(7);
 expect(await playing('Stepsit_loop')).toBe(false);
 // A clip no block has ends the task at once.
 await play('ATTRACTORS','no_such_clip',false,false,-1);
 await expect.poll(status,{timeout:20000}).toBe(7);
 expect(errors).toEqual([]);
});
