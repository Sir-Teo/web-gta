import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('the original SCRASH3 query returns the real car in its driver’s traffic scan and clears after it moves away',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const made=await page.evaluate(async()=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position,script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(script).missions[51],site=decodeScmInstructions(script,block.start,block.end).find((i:any)=>i.opcode===0x987);
  const code=new Uint8Array(site.end-site.offset+2);code.set(script.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);(window as any).__blockingQueryCode=code;
  return {car:m.vehicles.create(400,{x:p.x-10,y:-p.z+10,z:p.y},0),blocker:m.vehicles.create(402,{x:p.x-10,y:-p.z+18,z:p.y},0),driver:m.peds.create(4,'MALE01',{x:p.x-12,y:-p.z+10,z:p.y})};
 });
 await page.waitForFunction(({car,blocker,driver})=>{const m=(window as any).__game.missionForProfiling();return !!(m.vehicles.entity(car)&&m.vehicles.entity(blocker)&&m.peds.entity(driver));},made,{timeout:45000});
 await page.evaluate(({car,driver})=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(driver,car),made);
 await page.waitForFunction(({driver})=>!!(window as any).__game.missionForProfiling().peds.entity(driver)?.rider,made,{timeout:30000});
 await page.evaluate(({car,driver})=>{const m=(window as any).__game.missionForProfiling(),p=m.vehicles.positionOf(car);m.runtime.world.givePedScriptedTask(driver,{kind:'carDriveToCoord',vehicle:car,x:p.x,y:p.y+50,z:p.z,speed:8,driveStyle:0,model:-1,drivingStyle:0},0x5d1);},made);
 const query=()=>page.evaluate(({car})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=new DataView(m.runtime.scriptSpace.buffer);v.setInt32(7468,car,true);const slot=m.runtime.start(0,[],{space:(window as any).__blockingQueryCode});slot.thread.run(g.gameTimeMs(),100,1);return v.getInt32(43004,true);},made);
 await expect.poll(query,{timeout:15000}).toBe(made.blocker);expect(await query()).toBe(made.blocker);
 await page.evaluate(({blocker})=>{const m=(window as any).__game.missionForProfiling(),p=m.vehicles.positionOf(blocker);m.runtime.world.setVehicleCoordinates(blocker,p.x+100,p.y,p.z);},made);
 await expect.poll(query,{timeout:15000}).toBe(-1);
 const result=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
