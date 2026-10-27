import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('a script transfer into deep water installs the terrain without ground-support retries and starts swimming',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[],warnings:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning'&&/Terrain window/.test(m.text()))warnings.push(m.text());});
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game,s=g.state();return !s.terrainHold&&s.following.pending===null&&g.sim.player.grounded;},undefined,{timeout:60000});
 warnings.length=0;
 const before=await page.evaluate(()=>{const g=(window as any).__game,s=g.state();return {overrides:s.following.supportOverrides,failures:s.following.failures,holds:s.following.holds};});
 const start=Date.now();
 const transferred=await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.world.setPedCoordinatesNoOffset(1,2600,-2600,-4);return {swimming:g.sim.player.swimming,hold:g.state().terrainHold};});
 expect(transferred).toEqual({swimming:false,hold:true});
 await page.waitForFunction(()=>{const g=(window as any).__game,s=g.state();return !s.terrainHold&&s.following.pending===null&&g.sim.player.swimming&&g.sim.player.swimState===4;},undefined,{timeout:90000});
 const after=await page.evaluate(()=>{const g=(window as any).__game,s=g.state();return {overrides:s.following.supportOverrides,failures:s.following.failures,holds:s.following.holds,position:{...g.sim.player.position},swimming:g.sim.player.swimming,swimState:g.sim.player.swimState};});
 writeFileSync('artifacts/swim-terrain-transfer.json',JSON.stringify({before,transferred,after,wallMs:Date.now()-start,warnings,errors},null,2));
 expect(after.overrides).toBe(before.overrides);expect(after.failures).toBe(before.failures);expect(warnings).toEqual([]);expect(errors).toEqual([]);
});
