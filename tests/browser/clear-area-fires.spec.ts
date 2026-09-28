import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CWorld::ClearExcitingStuffFromArea (the script's CLEAR_AREA) calls CFireManager::ExtinguishPoint at the script's
 * point: a molotov's fire burning there goes out. */
test('clearing an area puts out the fires burning in it',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 // A world fire (native axes) ten units from CJ.
 const at=await page.evaluate(()=>{const g=(window as any).__game,w=g.weapons(),p=g.sim.player.position,n={x:p.x+10,y:-p.z,z:p.y};
  w.fires.startFire(n,60000,0,{nowMs:w.nowMs,random:Math.random});return n;});
 expect(await page.evaluate(()=>(window as any).__game.weapons().fires.active.length)).toBeGreaterThan(0);
 // The host's clear-area at that script point (native axes, as the script gives it).
 await page.evaluate(n=>(window as any).__game.missionForProfiling().world.clearArea(n,5),at);
 expect(await page.evaluate(n=>(window as any).__game.weapons().fires.active.filter((f:any)=>Math.hypot(f.position.x-n.x,f.position.y-n.y)<5).length,at)).toBe(0);
 expect(errors).toEqual([]);
});
