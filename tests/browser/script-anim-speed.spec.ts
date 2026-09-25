import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SET_CHAR_ANIM_SPEED and SET_CHAR_ANIM_CURRENT_TIME (SMOKE2, SWEET6, CRASH1): the association the ped plays under that
 * name takes the speed or the time, a stopped clip holds its place and its task, and the player's clip answers too. */
test('a script stops, moves and restarts the clip a ped plays, and the player\'s',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:60000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});});
 await page.waitForFunction((h:number)=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 const PLAY=0x0605;
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 const play=(handle:number)=>w('givePedScriptedTask',handle,{kind:'playAnim',animationName:'IDLE_chat',animationFile:'PED',blendSpeed:4,loop:false,lockX:false,lockY:false,keepLastFrame:false,time:-1,interruptable:true},PLAY);
 for(const handle of [ped,1]){
  await play(handle);
  await expect.poll(()=>w('pedIsPlayingAnim',handle,'IDLE_chat'),{timeout:10000}).toBe(true);
  await w('setPedAnimSpeed',handle,'idle_chat',0);
  await w('setPedAnimProgress',handle,'IDLE_CHAT',.5);
  const held=await w('pedAnimProgress',handle,'IDLE_chat') as number;
  expect(held).toBeCloseTo(.5,2);
  // Stopped, the clip stays where it was put and the task goes on past the clip's length.
  const length=await page.evaluate(h=>(window as any).__game.missionForProfiling().peds.entity(h).view.reactionDuration('idle_chat'),ped) as number;
  await page.waitForTimeout(length*1000+500);
  expect(await w('pedAnimProgress',handle,'IDLE_chat')).toBeCloseTo(.5,2);
  expect(await w('pedIsPlayingAnim',handle,'IDLE_chat')).toBe(true);
  // A name the ped is not playing changes nothing.
  await w('setPedAnimProgress',handle,'IDLE_tired',.9);
  expect(await w('pedAnimProgress',handle,'IDLE_chat')).toBeCloseTo(.5,2);
  await w('setPedAnimSpeed',handle,'IDLE_chat',2);
  await expect.poll(()=>w('pedIsPlayingAnim',handle,'IDLE_chat'),{timeout:20000}).toBe(false);
 }
 expect(errors).toEqual([]);
});
