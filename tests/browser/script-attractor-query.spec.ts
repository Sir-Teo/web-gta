import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('CASINO6’s original attractor queries follow live arrival, completion, task clearing and created users',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const made=await page.evaluate(async()=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[90],sites=decodeScmInstructions(bytes,block.start,block.end).filter((i:any)=>i.opcode===0x642),p=g.sim.player.position;
  const sequence=m.runtime.game.sequences.open();m.runtime.game.sequences.addTaskToActiveSequence({kind:'standStill',time:2000});m.runtime.game.sequences.close(sequence);const attr=m.runtime.world.addAttractor(p.x+7,-p.z,p.y+1,0,180,sequence),ped=m.peds.create(4,'MALE01',{x:p.x+3,y:-p.z,z:p.y});
  (window as any).__attractorQuery=(ped:number)=>sites.map((site:any)=>{const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(39*4,ped,true);slot.thread.locals.setInt32(289*4,0,true);slot.thread.locals.setInt32(53*4,ped,true);slot.thread.locals.setInt32(205*4,attr,true);slot.thread.run(g.gameTimeMs(),100,1);return slot.thread.condition;});return {ped,attr};
 });
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),made.ped,{timeout:60000});
 const query=(h=made.ped)=>page.evaluate(h=>(window as any).__attractorQuery(h),h);
 expect(await query()).toEqual([false,false]);
 const approach=await page.evaluate(({ped,attr})=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.taskUseAttractor(ped,attr);return (window as any).__attractorQuery(ped);},made);expect(approach).toEqual([false,false]);
 await expect.poll(()=>query(),{timeout:30000}).toEqual([true,true]);expect(await query(-1)).toEqual([true,true]);
 await expect.poll(()=>query(),{timeout:30000}).toEqual([false,false]);
 await page.evaluate(({ped,attr})=>(window as any).__game.missionForProfiling().runtime.world.taskUseAttractor(ped,attr),made);await expect.poll(()=>query(),{timeout:15000}).toEqual([true,true]);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.clearPedTasks(h),made.ped);expect(await query()).toEqual([false,false]);
 const created=await page.evaluate(attr=>(window as any).__game.missionForProfiling().runtime.world.createCharAtAttractor(4,'MALE01',attr,0x643),made.attr);
 await expect.poll(()=>query(created),{timeout:20000}).toEqual([true,true]);
 const result=await page.evaluate(({attr,ped})=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.clearAttractor(attr);return {answer:(window as any).__attractorQuery(ped),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},{attr:made.attr,ped:created});expect(result.answer).toEqual([false,false]);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
