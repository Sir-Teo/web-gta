import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('WUZI5’s actual smoke instruction emits the native large-smoke blueprint and particles expire after stopping',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.worldFx().ready,undefined,{timeout:30000});
 await page.evaluate(async()=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[57],site=decodeScmInstructions(script,block.start,block.end).find((i:any)=>i.opcode===0x95c),p=g.state().player.position;
  const length=site.end-site.offset,code=new Uint8Array(length+11);code.set(script.subarray(site.offset,site.end));code.set([1,0,4,0,2,0,1,0,0,0,0],length);
  const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.thisMustBeTheOnlyMissionRunning=false;slot.thread.name='SMKTEST';
  [p.x,-p.z+5,p.y+1,0,0,.5,0,0,0,.2,1,1].forEach((v,i)=>slot.thread.locals.setFloat32((144+i)*4,v,true));slot.thread.run(g.gameTimeMs(),100,1);g.turnPlayer(Math.PI);
 });
 const smoke=()=>page.evaluate(()=>{const g=(window as any).__game,fx=g.worldFx(),p=fx.manager.prims.find((p:any)=>p.system.name==='prt_smoke_huge');return {count:p.particles.length,quads:g.state().fx.quads,colors:p.particles.map((p:any)=>p.multColor),age:p.particles[0]?.currentLife,life:p.particles[0]?.totalLife,gameTime:g.gameTimeMs()};});
 await expect.poll(async()=>(await smoke()).count,{timeout:15000}).toBeGreaterThan(8);const drawn=await smoke();expect(drawn.colors.some((c:number[])=>c[0]===0&&c[1]===0&&c[2]===0&&c[3]===51)).toBe(true);expect(drawn.quads).toBeGreaterThan(0);
 await page.screenshot({path:'artifacts/script-smoke.png'});
 const result=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.terminateAllWithName('SMKTEST');return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 // The blueprint lasts about fifteen game seconds; a loaded headless world can run several times below real time.
 await expect.poll(async()=>(await smoke()).count,{timeout:120000,intervals:[500]}).toBe(0).catch(async error=>{console.log('remaining script smoke',JSON.stringify(await smoke()));throw error;});expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
