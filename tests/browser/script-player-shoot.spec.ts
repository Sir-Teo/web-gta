import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
for(const attached of[false,true])test(`the player's script fires a timed burst with controls off, attached=${attached}`,async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const setup=await page.evaluate(attached=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return{attached,weapon:attached?38:22,car:attached?m.vehicles.create(422,{x:p.x,y:-p.z,z:p.y},0):0};},attached);
 if(attached)await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),setup.car,{timeout:60000});
 const before=await page.evaluate(({attached,weapon,car})=>{const g=(window as any).__game,w=g.missionForProfiling().runtime.world;if(attached)w.attachPedToCar(1,car,{x:0,y:0,z:2},2,Math.PI*2,weapon);const inv=g.weapons().inventory;inv.give(weapon,100);inv.select(weapon);w.setPlayerControl(0,false);const p=w.pedPosition(1);w.givePedScriptedTask(1,{kind:'shootAtCoord',x:p.x+15,y:p.y,z:p.z+4,time:2000},0x668);return w.pedWeaponAmmo(1,weapon);},setup);
 await expect.poll(()=>page.evaluate(weapon=>{const g=(window as any).__game;return g.missionForProfiling().runtime.world.pedWeaponAmmo(1,weapon);},setup.weapon),{timeout:5000}).toBeLessThan(before);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.scriptTaskStatus(1,0x668)),{timeout:10000}).toBe(7);
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.render().targetHeld),{timeout:3000}).toBe(false);
 const after=await page.evaluate(weapon=>{const g=(window as any).__game,m=g.missionForProfiling();return{ammo:m.runtime.world.pedWeaponAmmo(1,weapon),aim:g.render().targetHeld,control:m.playerControl,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},setup.weapon);
 await page.waitForTimeout(1200);expect(await page.evaluate(weapon=>(window as any).__game.missionForProfiling().runtime.world.pedWeaponAmmo(1,weapon),setup.weapon)).toBe(after.ammo);
 expect(after.aim).toBe(false);expect(after.control).toBe(false);expect(after.skipped).toEqual([]);expect(after.gaveUp).toEqual([]);expect(errors).toEqual([]);
 writeFileSync(`artifacts/script-player-shoot-${attached}.json`,JSON.stringify({setup,before,after,errors},null,2));
});
