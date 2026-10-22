import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('SET_ALL_CARS_CAN_BE_DAMAGED updates every live vehicle class and extinguishes nearby attached fires',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const handles=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1),handles=[400,481,454,487,511].map((model,i)=>m.vehicles.create(model,{x:p.x+20+i*12,y:p.y,z:p.z+2},0));handles.push(m.runtime.world.createMissionTrain(10,2278.18,-1144.88,27.51,true));return handles;});
 await page.waitForFunction(handles=>handles.every(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h)),handles,{timeout:90000});
 const disabled=await page.evaluate(async handles=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,opcodePath='/src/engine/scmOpcodes.ts',{scmOpcode}=await import(/* @vite-ignore */ opcodePath),op=scmOpcode('SET_ALL_CARS_CAN_BE_DAMAGED');
  (window as any).__runDamageToggle=(enabled:boolean)=>{const code=new Uint8Array([op&255,op>>8,4,enabled?1:0,78,0]),slot=m.runtime.start(0,[],{space:code});slot.thread.usesMissionCleanup=false;slot.thread.run(g.gameTimeMs(),20,1);};
  (window as any).__toggleFires=handles.map(h=>{const v=m.vehicles.entity(h);w.setVehicleHealth(h,100);if('burnTimer'in v)v.burnTimer=2;const p=v.car.body.translation(),fire=g.weapons().fires.startFire({x:p.x,y:-p.z,z:p.y},60000,0,{nowMs:g.weapons().nowMs,random:()=>0});if(!fire)throw new Error('No fire slot');fire.target={kind:'vehicle',key:v};fire.script=true;return fire;});
  (window as any).__runDamageToggle(false);
  return handles.map(h=>{const v=m.vehicles.entity(h);return{model:v.modelId,canBeDamaged:v.canBeDamaged,health:v.health,burnTimer:v.burnTimer??null};});
 },handles);
 expect(disabled.map(v=>v.model)).toEqual([400,481,454,487,511,537]);expect(disabled.every(v=>v.canBeDamaged===false)).toBe(true);expect(disabled.every(v=>v.health===300)).toBe(true);expect(disabled.filter(v=>[400,487,511].includes(v.model)).every(v=>v.burnTimer===0)).toBe(true);
 expect(await page.evaluate(()=>(window as any).__toggleFires.every((f:any)=>!f.active&&!f.script))).toBe(true);
 const fresh=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(487,{x:p.x+100,y:p.y,z:p.z+3},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),fresh,{timeout:60000});
 expect(await page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).canBeDamaged,fresh)).toBe(true);
 const restored=await page.evaluate(handles=>{const m=(window as any).__game.missionForProfiling();(window as any).__runDamageToggle(true);return{flags:handles.map(h=>m.vehicles.entity(h).canBeDamaged),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},[...handles,fresh]);
 expect(restored.flags.every(Boolean)).toBe(true);expect(restored.skipped).toEqual([]);expect(restored.gaveUp).toEqual([]);
 const safety=await page.evaluate(handles=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;w.makePlayerSafe(0,true,4000);const protectedFlags=handles.map(h=>m.vehicles.entity(h).canBeDamaged);w.makePlayerSafe(0,false,4000);return{protectedFlags,restoredFlags:handles.map(h=>m.vehicles.entity(h).canBeDamaged),player:g.sim.playerCanBeDamaged};},[...handles,fresh]);
 expect(safety.protectedFlags.every(v=>v===false)).toBe(true);expect(safety.restoredFlags.every(Boolean)).toBe(true);expect(safety.player).toBe(true);expect(errors).toEqual([]);
});
