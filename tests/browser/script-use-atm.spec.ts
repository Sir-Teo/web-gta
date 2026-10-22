import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('HEIST2’s original ATM instruction plays once in player and NPC sequences without paying money',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+5,y:-p.z,z:p.y});});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 const before=await page.evaluate(async ped=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[98],site=decodeScmInstructions(bytes,block.start,block.end).find((i:any)=>i.opcode===0x5c7),code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
  const sequences=m.runtime.game.sequences,handle=sequences.open();m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),100,1);sequences.close(handle);const sequence=sequences.sequenceFor(handle).sequence;
  m.runtime.world.givePedSequence(1,sequence.tasks,false,0x618,undefined);m.runtime.world.givePedSequence(ped,sequence.tasks,false,0x618,undefined);
  return {recorded:sequence.tasks,player:g.sim.money,ped:m.peds.entity(ped).money};
 },ped);
 expect(before.recorded).toEqual([{kind:'useAtm'}]);
 await expect.poll(()=>page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling();return [g.render().nativeCharacter.reactionName,m.peds.entity(h).view.reactionName];},ped),{timeout:15000}).toEqual(['atm','atm']);
 const active=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();return [m.runtime.world.scriptTaskStatus(1,0x618),m.runtime.world.scriptTaskStatus(h,0x618)];},ped);expect(active.every(n=>n!==7)).toBe(true);
 await expect.poll(()=>page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();return [m.runtime.world.scriptTaskStatus(1,0x618),m.runtime.world.scriptTaskStatus(h,0x618)];},ped),{timeout:30000}).toEqual([7,7]);
 const after=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling();return {player:g.sim.money,ped:m.peds.entity(h).money,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},ped);
 expect(after.player).toBe(before.player);expect(after.ped).toBe(before.ped);expect(after.skipped).toEqual([]);expect(after.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
