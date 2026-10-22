import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('ZERO4 hands its interior RC helicopter to player controls without moving CJ',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling();m.runtime.loadAndLaunchMission(74);
  (window as any).__zero4Skip=setInterval(()=>{if(m.runtime.game.cutscene.running)g.skipCutscene?.();},250);
 });
 const probe=()=>page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),h=m.remote.vehicle??(window as any).__zero4LastHandle,v=h===undefined?undefined:m.vehicles.entity(h),slot=m.runtime.active.find((s:any)=>s.thread.thisMustBeTheOnlyMissionRunning);
  if(m.remote.vehicle!==undefined)(window as any).__zero4LastHandle=m.remote.vehicle;
  return {remote:m.remote.inRemoteMode,after:m.remote.afterExplosion,explode:m.remote.createExplosion,handle:h,controlled:v?.remoteControlled,model:v?.modelId,position:v?m.vehicles.positionOf(h):undefined,
   cj:m.runtime.world.pedPosition(1),playerState:m.world?.playerState?.(),playerHealth:g.sim.player.health,health:v?.health,velocity:v?.body.linvel(),control:m.playerControl,area:m.runtime.game.currentArea,rotor:v?.rotorSpeed,
   skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp,offset:slot?slot.thread.ip-slot.thread.base:undefined,command:slot?.thread.currentInstruction?.name,text:m.runtime.game.messages.briefs?.[0]?.key};
 });
 await expect.poll(async()=>{const p=await probe();return p.remote&&p.controlled&&p.control&&!p.after&&p.health>0;},{timeout:150000,intervals:[1000]}).toBe(true).catch(async error=>{console.log('ZERO4 waiting',JSON.stringify(await probe()));throw error;});
 await page.evaluate(()=>clearInterval((window as any).__zero4Skip));
 const start=await probe();console.log('ZERO4 handoff',JSON.stringify(start));
 expect([465,501]).toContain(start.model);expect(start.area).toBe(10);expect(start.gaveUp).toEqual([]);
 await page.keyboard.down('KeyW');
 await expect.poll(async()=>(await probe()).rotor,{timeout:15000}).toBeGreaterThan(.15);
 await expect.poll(async()=>{const p=await probe();return p.position?.z??-Infinity;},{timeout:15000,intervals:[1000]}).toBeGreaterThan(start.position!.z+2).catch(async error=>{console.log('ZERO4 flight stopped',JSON.stringify(await probe()));throw error;});
 await page.keyboard.up('KeyW');
 const end=await probe();expect(Math.hypot(end.cj.x-start.cj.x,end.cj.y-start.cj.y,end.cj.z-start.cj.z)).toBeLessThan(.1);
 expect(end.gaveUp).toEqual([]);expect(end.skipped).toEqual([]);expect(errors).toEqual([]);
});
