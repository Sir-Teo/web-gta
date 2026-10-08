import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

/** ADD_SPARKS (DRUGS1, seventeen times): Fx_c::AddSparks as the iOS handler (0x100200738) calls it. It had no world
 * hook. */
test('a script\'s ADD_SPARKS throws that many prt_spark_2 sparks',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 await page.waitForFunction(()=>!(window as any).__game.state().fx?.loading,undefined,{timeout:60000});
 const particles=()=>page.evaluate(()=>(window as any).__game.state().fx.particles as number);
 const before=await particles();
 await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world,p=w.pedPosition(1);w.addSparks({x:p.x+2,y:p.y+3,z:p.z},{x:0,y:0,z:2},20);});
 expect(await particles()-before).toBeGreaterThanOrEqual(20);
 expect(errors).toEqual([]);
});
