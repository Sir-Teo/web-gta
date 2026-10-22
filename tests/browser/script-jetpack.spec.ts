import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('MAF4 and DES10 give CJ a controllable jetpack task which reports status and clears without a dropped pickup',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{const g=(window as any).__game,original=g.sim.onJetPackDropped;(window as any).__scriptJetDrops=0;g.sim.onJetPackDropped=(p:any)=>{(window as any).__scriptJetDrops++;original?.(p);};});
 const assign=(mission:number)=>page.evaluate(async mission=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[mission],site=decodeScmInstructions(script,block.start,block.end).find((i:any)=>i.opcode===0x7a7),code=new Uint8Array(site.end-site.offset+2);new DataView(m.runtime.scriptSpace.buffer).setInt32(12,1,true);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),100,1);
 },mission);
 const state=()=>page.evaluate(()=>(window as any).__game.state());
 const status=()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,0x7a7));
 await assign(81);await expect.poll(async()=>(await state()).jetPack?.worn,{timeout:15000}).toBe(true);await expect.poll(status,{timeout:5000}).toBe(1);
 const start=(await state()).player.position.y;await page.keyboard.down('Space');
 await expect.poll(async()=>(await state()).jetPack?.thrustFwd,{timeout:8000}).toBe(1);await expect.poll(async()=>(await state()).player.grounded,{timeout:10000}).toBe(false);await expect.poll(async()=>(await state()).player.position.y-start,{timeout:15000}).toBeGreaterThan(2);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPlayerControl(0,false));await expect.poll(async()=>(await state()).jetPack?.thrustFwd,{timeout:5000}).toBe(0);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPlayerControl(0,true));await expect.poll(async()=>(await state()).jetPack?.thrustFwd,{timeout:5000}).toBe(1);await page.keyboard.up('Space');expect(await status()).toBe(1);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.clearPedTasks(1));await expect.poll(async()=>(await state()).jetPack,{timeout:5000}).toBeNull();expect(await status()).toBe(7);
 await assign(82);await expect.poll(async()=>(await state()).jetPack?.worn,{timeout:10000}).toBe(true);await expect.poll(status,{timeout:5000}).toBe(1);
 // A priority-53 script command is refused; a direct looped named animation has priority 71 and can abort the pack.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'standStill',time:100},0x5ba));expect((await state()).jetPack).not.toBeNull();expect(await status()).toBe(1);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.givePedScriptedTask(1,{kind:'playAnim',animationName:'IDLE_CHAT',animationFile:'PED',blendSpeed:4,loop:true,lockX:false,lockY:false,keepLastFrame:false,time:1000,interruptable:true},0x605));await expect.poll(async()=>(await state()).jetPack,{timeout:5000}).toBeNull();expect(await status()).toBe(7);
 const result=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return {drops:(window as any).__scriptJetDrops,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});expect(result.drops).toBe(0);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
