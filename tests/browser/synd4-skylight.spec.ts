import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('SYND4 enters the club through its real PDOMES skylight and keeps its interior floor after the cutscene',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.loadAndLaunchMission(61);(window as any).__synd4Skip=setInterval(()=>{if(m.runtime.game.cutscene.running)g.skipCutscene?.();},250);});
 const probe=()=>page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),slot=m.runtime.active.find((s:any)=>s.thread.name==='SYND4');return {offset:slot?slot.thread.ip-slot.thread.base:-1,balconyVisited:slot?.thread.locals.getInt32(48*4,true),control:m.playerControl,area:m.runtime.game.currentArea,scene:g.state().lighting.area,entry:g.state().entryExits,player:g.state().player,terrainHold:g.state().terrainHold,text:m.runtime.game.messages.briefs?.[0]?.key,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 await expect.poll(async()=>{const p=await probe();return p.control&&p.offset>2000&&p.offset<3500;},{timeout:90000,intervals:[500]}).toBe(true).catch(async error=>{console.log('SYND4 opening',JSON.stringify(await probe()));throw error;});
 await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.setPedCoordinates(1,-2660.145,1419.2113,22.8906);g.sim.player.health=10000;});
 await expect.poll(async()=>{const p=await probe();return p.offset>=4600&&p.offset<5243;},{timeout:60000,intervals:[250]}).toBe(true).catch(async error=>{console.log('SYND4 rooftop',JSON.stringify(await probe()));throw error;});
 // Move CJ to the outside trigger, rather than teleporting to an interior locate test at z=921.
 const entrance=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),manager=g.entryExits(),index=manager.pool.findIndex((e:any)=>e.name==='PDOMES'&&e.area===0),e=manager.pool[index],p=g.entryExitEntrance(index);if(!e||!p)throw new Error('PDOMES exterior entry is absent');m.runtime.world.setPedCoordinates(1,p.x,p.y,p.z);g.sim.player.health=10000;return {flags:e.flags,linkArea:e.link?.area,position:p};});
 expect(entrance.linkArea).toBe(3);
 await expect.poll(async()=>(await probe()).scene,{timeout:90000,intervals:[500]}).toBe(3).catch(async error=>{console.log('PDOMES entry',JSON.stringify({entrance,state:await probe()}));throw error;});
 await expect.poll(async()=>{const p=await probe();return p.entry?.loading===false&&p.player.grounded;},{timeout:30000,intervals:[500]}).toBe(true).catch(async error=>{console.log('PDOMES support',JSON.stringify(await probe()));throw error;});
 const inside=await probe();expect(inside.area).toBe(3);expect(inside.entry.stack).toContain('PDOMES');expect(inside.player.position.y).toBeGreaterThan(900);
 await expect.poll(async()=>(await probe()).balconyVisited,{timeout:30000}).toBe(1);
 // The next objective is on the lower club floor. Keep area 3 from the real transition while placing CJ there.
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-2668.7161,1421.8464,905.277));
 // Let the actual mission proceed through the club cutscene; only the skip button is supplied.
 await expect.poll(async()=>(await probe()).text,{timeout:60000,intervals:[500]}).toBe('SYN4_05').catch(async error=>{console.log('SYND4 club',JSON.stringify(await probe()));throw error;});
 await page.evaluate(()=>clearInterval((window as any).__synd4Skip));await page.waitForTimeout(1500);
 const end=await probe();console.log('SYND4 club floor',JSON.stringify({offset:end.offset,area:end.area,scene:end.scene,height:end.player.position.y,grounded:end.player.grounded,text:end.text}));expect(end.scene).toBe(3);expect(end.player.position.y).toBeGreaterThan(900);expect(end.player.grounded).toBe(true);expect(end.offset).toBeGreaterThan(0);expect(end.skipped).toEqual([]);expect(end.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
