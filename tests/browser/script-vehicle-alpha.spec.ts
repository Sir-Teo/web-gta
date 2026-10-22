import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('0594 fades each vehicle class with its own original materials and preserves the collision body',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handles=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1),handles=[411,425,461,446].map((model,k)=>m.vehicles.create(model,{x:p.x+20+k*10,y:p.y,z:p.z+80}));handles.push(m.runtime.world.createMissionTrain(10,2278.18,-1144.88,27.51,true));return handles as number[];});
 await page.waitForFunction(handles=>handles.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),handles,{timeout:90000});
 const first=await page.evaluate(async handles=>{
  const path='/src/assets/scm.ts',{readScmHeader,decodeScmInstructions}=await import(/* @vite-ignore */ path),script=new Uint8Array(await(await fetch('/play/world/files/scripts/main.scm')).arrayBuffer()),b=readScmHeader(script).missions[88],sites=decodeScmInstructions(script,b.start,b.end).filter((i:any)=>i.opcode===0x594),g=(window as any).__game,m=g.missionForProfiling();
  (window as any).__alphaMaterials=handles.map(h=>{const v=m.vehicles.entity(h),root=v.car?.root??v.root,materials=new Set<any>();root.traverse((o:any)=>{if(o.isMesh)for(const mat of [o.material].flat())materials.add(mat);});return [...materials].map(material=>({material,opacity:material.opacity,transparent:material.transparent}));});
  const result=[];for(let k=0;k<handles.length;k++){
   const h=handles[k],v=m.vehicles.entity(h),body=v.car?.body??v.body,pose={...body.translation()},id=body.handle,count=body.numColliders();
   const i=sites[k%sites.length],code=new Uint8Array(i.end-i.offset+2);code.set(script.subarray(i.offset,i.end));code.set([0x4e,0],i.end-i.offset);const slot=m.runtime.start(0,[],{space:code,mission:true});slot.thread.usesMissionCleanup=false;slot.thread.locals.setInt32(289*4,h,true);slot.thread.run(g.gameTimeMs(),100,1);
   result.push({model:v.modelId,alpha:v.alpha,hidden:(window as any).__alphaMaterials[k].every((b:any)=>b.material.opacity===0),materials:(window as any).__alphaMaterials[k].length,bodyPreserved:id===body.handle&&count===body.numColliders()&&JSON.stringify(pose)===JSON.stringify(body.translation())});
  }return result;
 },handles);
 expect(first.map(v=>v.model)).toEqual([411,425,461,446,537]);for(const v of first){expect(v.alpha).toBe(0);expect(v.hidden).toBe(true);expect(v.materials).toBeGreaterThan(0);expect(v.bodyPreserved).toBe(true);}
 // CTrain::ProcessControl does not call UpdateClumpAlpha: the train retains the scripted zero.
 await expect.poll(()=>page.evaluate(handles=>handles.map(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).alpha),handles),{timeout:15000}).toEqual([255,255,255,255,0]);
 const restored=await page.evaluate(handles=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.setVehicleToFadeIn(handles[4],255);return {materials:(window as any).__alphaMaterials.every((list:any[])=>list.every(b=>Math.abs(b.material.opacity-b.opacity)<1e-8&&b.material.transparent===b.transparent)),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},handles);expect(restored.materials).toBe(true);expect(restored.skipped).toEqual([]);expect(restored.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
