import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('SYN1’s original freeze holds cars, bikes, boats and aircraft with queryable collision, then releases their physics',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handles=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return [400,461,452,487].map((model,i)=>m.vehicles.create(model,{x:p.x+8+i*8,y:-p.z,z:p.y+5},0));});await page.waitForFunction(hs=>hs.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),handles,{timeout:90000});
 await page.evaluate(async handles=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),bytes=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),block=readScmHeader(bytes).missions[58],site=decodeScmInstructions(bytes,block.start,block.end).find((i:any)=>i.offset===1551265),code=new Uint8Array(site.end-site.offset+2);code.set(bytes.subarray(site.offset,site.end));code.set([0x4e,0],site.end-site.offset);
  for(const handle of handles){const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(386*4,handle,true);slot.thread.run(g.gameTimeMs(),100,1);}
 },handles);
 await page.waitForFunction(handles=>handles.every(h=>{const v=(window as any).__game.missionForProfiling().vehicles.entity(h),b=v.car?.body??v.body;return b.isEnabled();}),handles,{timeout:30000});
 const inspect=()=>page.evaluate(async handles=>{
  const path='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling();return handles.map(handle=>{const v=m.vehicles.entity(handle),body=v.car?.body??v.body,p=body.translation();let hit=false;
   for(let x=-2;x<=2&&!hit;x++)for(let z=-2;z<=2&&!hit;z++)hit=!!g.sim.world.castRay(new RAPIER.Ray({x:p.x+x,y:p.y+8,z:p.z+z},{x:0,y:-1,z:0}),16,true,undefined,undefined,undefined,undefined,(c:any)=>c.parent()?.handle===body.handle);
   return {model:v.modelId,anchored:v.anchored,frozen:v.frozen,enabled:body.isEnabled(),type:body.bodyType(),position:{...p},rotation:{...body.rotation()},velocity:{...body.linvel()},hit};});
 },handles);
 const held=await inspect();for(const v of held){expect(v.frozen).toBe(true);expect(v.enabled).toBe(true);expect(v.hit).toBe(true);expect(v.type).toBe(2);}
 await page.waitForTimeout(700);const later=await inspect();for(let i=0;i<held.length;i++){for(const key of ['x','y','z'] as const)expect(later[i].position[key]).toBeCloseTo(held[i].position[key],4);for(const key of ['x','y','z','w'] as const)expect(later[i].rotation[key]).toBeCloseTo(held[i].rotation[key],4);}
 await page.evaluate(handles=>{const m=(window as any).__game.missionForProfiling();for(const h of handles){if(m.vehicles.entity(h).modelId===452)m.runtime.world.anchorBoat(h,false);m.runtime.world.freezeVehiclePosition(h,false);m.runtime.world.setVehicleForwardSpeed(h,12);}},handles);await page.waitForTimeout(400);
 const released=await inspect();writeFileSync('artifacts/frozen-vehicle.json',JSON.stringify({held,later,released},null,2));for(let i=0;i<released.length;i++){expect(released[i].frozen).toBe(false);expect(released[i].type).toBe(0);expect(Math.hypot(released[i].position.x-held[i].position.x,released[i].position.y-held[i].position.y,released[i].position.z-held[i].position.z)).toBeGreaterThan(.02);}
 const state=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});expect(state).toEqual({skipped:[],gaveUp:[]});expect(errors).toEqual([]);
});
