import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('vehicle death scorches living seated peds and resurrection restores CJ’s ordinary lighting',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const cars=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return [8,16].map(dx=>m.vehicles.create(400,{x:p.x+dx,y:-p.z,z:p.y},0));});
 await page.waitForFunction(hs=>hs.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),cars,{timeout:60000});
 const riders=await page.evaluate(car=>{const m=(window as any).__game.missionForProfiling();return {driver:m.peds.createInCar(4,'MALE01',car,'driver'),shot:m.peds.createInCar(4,'MALE01',car,0),attached:m.peds.createOnCar(4,'MALE01',car,{x:0,y:0,z:2})};},cars[0]);
 await page.waitForFunction(hs=>Object.values(hs).every(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)),riders,{timeout:60000});
 await page.evaluate(({car,riders})=>{const m=(window as any).__game.missionForProfiling(),shot=m.peds.entity(riders.shot);shot.health=0;shot.diedInSeat=true;m.vehicles.entity(car).blowUp();},{car:cars[0],riders});
 await expect.poll(()=>page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();return m.peds.healthOf(h);},riders.driver)).toBe(0);
 const npc=await page.evaluate(riders=>{const g=(window as any).__game,m=g.missionForProfiling(),driver=m.peds.entity(riders.driver),shot=m.peds.entity(riders.shot),attached=m.peds.entity(riders.attached);return {driver:!!driver.renderScorched,shot:!!shot.renderScorched,attached:!!attached.renderScorched,attachedHealth:attached.health};},riders);
 expect(npc).toEqual({driver:true,shot:false,attached:false,attachedHealth:100});
 await expect.poll(()=>page.evaluate(h=>{const g=(window as any).__game,r=g.missionForProfiling().peds.entity(h),view=g.occupants().views.get(`script:${r.car.car.body.handle}:driver`)?.view;return !!view&&view.owner.materialBindings.every((b:any)=>b.material.userData.nativeRenderScorched?.value===true);},riders.driver),{timeout:30000}).toBe(true);
 await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.warpPedIntoCar(1,car);g.sim.player.armour=100;m.vehicles.entity(car).blowUp();},cars[1]);
 const lighting=()=>page.evaluate(()=>{const g=(window as any).__game,materials:any[]=[];g.render().nativeCharacter.owner.root.traverse((o:any)=>{if(o.isMesh)materials.push(...[o.material].flat());});return {flag:g.sim.playerRenderScorched,count:materials.length,all:materials.every(m=>m.userData.nativeRenderScorched?.value===true),none:materials.every(m=>m.userData.nativeRenderScorched?.value===false)};});
 await expect.poll(async()=>{const r=await lighting();return r.flag&&r.count>0&&r.all;}).toBe(true);
 await page.evaluate(async()=>{const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[90],site=decodeScmInstructions(bytes,block.start,block.end).find((i:any)=>i.opcode===0x974),code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);m.runtime.start(0,[],{space:code}).thread.run(g.gameTimeMs(),100,1);});
 await expect.poll(async()=>{const r=await lighting();return !r.flag&&r.count>0&&r.none;}).toBe(true);expect(errors).toEqual([]);
});
