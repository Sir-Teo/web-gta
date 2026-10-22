import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('scripted rider deaths remain allocated and dead through CASINO1 detachment and an exploded-vehicle transfer',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(400,{x:p.x-25,y:-p.z,z:p.y},0);});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 const riders=await page.evaluate(car=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.freezeVehiclePosition(car,true);return {attached:m.peds.createOnCar(4,'MALE01',car,{x:0,y:2,z:2}),driver:m.peds.createInCar(4,'MALE01',car,'driver'),passenger:m.peds.createInCar(4,'MALE01',car,0)};},car);
 await page.waitForFunction(hs=>Object.values(hs).every(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)),riders,{timeout:60000});
 const immediate=await page.evaluate(async h=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[84],ins=decodeScmInstructions(bytes,block.start,block.end),at=ins.findIndex((i:any)=>i.offset===2089642),pair=ins.slice(at,at+2),start=pair[0].offset,end=pair[1].end,code=new Uint8Array(end-start+2);code.set(bytes.subarray(start,end));code.set([0x4e,0],end-start);
  const origin=w.pedPosition(h),money=g.sim.money,slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(324*4,h,true);slot.thread.run(g.gameTimeMs(),100,1);
  return {names:pair.map((i:any)=>i.name),origin,money,health:m.peds.healthOf(h),exists:m.peds.exists(h),detached:!m.peds.rideOf(h)};
 },riders.attached);
 expect(immediate.names).toEqual(['TASK_DIE','DETACH_CHAR_FROM_CAR']);expect(immediate).toMatchObject({health:0,exists:true,detached:true});
 const corpse=(h:number)=>page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),p=m.peds.entity(h);return p&&!p.rider?{exists:m.peds.exists(h),health:p.health,down:p.down===Infinity,pose:p.view.reactionName,visible:p.view.root.visible,scorched:!!p.renderScorched,uniforms:p.view.owner.materialBindings.every((b:any)=>b.material.userData.nativeRenderScorched?.value===!!p.renderScorched),money:g.sim.money}:null;},h);
 await expect.poll(()=>corpse(riders.attached),{timeout:30000}).toMatchObject({exists:true,health:0,down:true,pose:'ko_shot_front',visible:true,scorched:false,uniforms:true,money:immediate.money});
 await page.evaluate(h=>(window as any).__game.missionForProfiling().peds.setHealth(h,0),riders.driver);
 const seated=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();return {exists:m.peds.exists(h),dead:m.peds.isDead(h),ride:!!m.peds.rideOf(h),gone:m.peds.entity(h).gone};},riders.driver);expect(seated).toEqual({exists:true,dead:true,ride:true,gone:false});
 await page.waitForFunction(({h,car})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);return g.occupants().views.get(`script:${v.car.body.handle}:driver`)?.view.vehicleClip==='car_dead_lhs';},{h:riders.driver,car},{timeout:30000});
 await page.evaluate(car=>(window as any).__game.missionForProfiling().vehicles.entity(car).blowUp(),car);
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.health===0&&p.renderScorched;},riders.passenger,{timeout:15000});
 await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,p=w.pedPosition(h);w.warpPedFromCarToCoord(h,p.x+4,p.y,p.z);},riders.passenger);
 await expect.poll(()=>corpse(riders.passenger),{timeout:30000}).toMatchObject({exists:true,health:0,down:true,pose:'ko_shot_front',visible:true,scorched:true,uniforms:true});
 const end=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});expect(end).toEqual({skipped:[],gaveUp:[]});expect(errors).toEqual([]);
});
