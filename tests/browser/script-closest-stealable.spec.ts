import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('BURGJB’s original loot queries find a live stealable object and update after movement, flag changes and deletion',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const made=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,at={x:p.x+6,y:-p.z,z:p.y+1},objects=m.runtime.game.objects,options={external:false,missionCleanup:false};
  const junk=objects.create('dyn_wine_big',at,options),loot=objects.create('dyn_wine_big',{...at,x:at.x+2},options);m.runtime.world.setObjectAsStealable(loot.handle,true);return {junk:junk.handle,loot:loot.handle,at};
 });
 const result=await page.evaluate(async({junk,loot,at})=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),objects=m.runtime.game.objects,bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[125],sites=decodeScmInstructions(bytes,block.start,block.end).filter((i:any)=>i.opcode===0x866);
  const runs=sites.map((site:any)=>{
   const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
   const query=()=>{const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;[at.x,at.y,at.z].forEach((v,k)=>slot.thread.locals.setFloat32((63+k)*4,v,true));slot.thread.run(g.gameTimeMs(),100,1);return slot.thread.locals.getInt32(49*4,true);};
   const o=objects.at(loot);o.position={...at,x:at.x+2};m.runtime.world.setObjectAsStealable(loot,true);const initial=query();o.position.x=at.x+6;const moved=query();o.position.x=at.x+2;m.runtime.world.setObjectAsStealable(loot,false);const disabled=query();m.runtime.world.setObjectAsStealable(junk,true);const other=query();m.runtime.world.setObjectAsStealable(junk,false);return {initial,moved,disabled,other};
  });
  objects.remove(loot);return {runs,deleted:m.runtime.world.getClosestStealableObject(at.x,at.y,at.z,5),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },made);
 expect(result.runs).toEqual(Array.from({length:2},()=>({initial:made.loot,moved:-1,disabled:-1,other:made.junk})));expect(result.deleted).toBe(-1);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
