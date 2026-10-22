import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('RIOT2’s original hearing override changes live mission peds and leaves ambient hearing alone',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(8,'FAM1',{x:p.x-20,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),handle,{timeout:60000});
 await page.waitForFunction(()=>(window as any).__game.pedestrians().people.some((p:any)=>!p.mission&&!p.officer&&p.health>0&&p.down===0),undefined,{timeout:60000});
 const result=await page.evaluate(async h=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),world=g.pedestrians(),mission=m.peds.entity(h);
  const bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[109],sites=decodeScmInstructions(bytes,block.start,block.end).filter((i:any)=>i.opcode===0x98a);
  const p=g.state().player.position,id=g.placePed(p.x-22,p.y,p.z,[mission.id]),ambient=world.people.find((e:any)=>e.id===id);
  const rows=[undefined,...sites].map(site=>{
   if(site){const code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),100,1);}
   mission.highestEvent=undefined;ambient.highestEvent=undefined;world.gunShot({...p,y:p.y+1},false);
   return {range:m.runtime.game.gunshotSenseRangeForRiot2,mission:!!mission.highestEvent,ambient:!!ambient.highestEvent};
  });
  return {rows,createdByMission:!!mission.mission,createdByAmbient:!!ambient.mission,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },handle);
 expect(result.rows).toEqual([{range:-1,mission:true,ambient:true},{range:15,mission:false,ambient:true},{range:-1,mission:true,ambient:true},{range:-1,mission:true,ambient:true}]);
 expect(result.createdByMission).toBe(true);expect(result.createdByAmbient).toBe(false);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
