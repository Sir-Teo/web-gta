import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CPlayerInfo::MakePlayerSafe sets or clears every proof SET_CHAR_PROOFS writes (bullet, fire, explosion, collision,
 * melee): handing control back (SET_PLAYER_CONTROL on) ends a mission's proofs, and the resurrection's
 * MakePlayerSafe(false) ends them after a death. */
test('a mission\'s player proofs end with MakePlayerSafe(false) and with a respawn',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const world=(fn:string,...a:unknown[])=>page.evaluate(({fn,a})=>(window as any).__game.missionForProfiling().runtime.world[fn](...a),{fn,a});
 const bullets=()=>page.evaluate(()=>{const s=(window as any).__game.sim;const before=s.player.health;s.damagePlayer(10,true,{weapon:22});const after=s.player.health;s.player.health=before;return before-after;});
 await world('setPedProofs',1,{bullet:true,fire:true,explosion:true,collision:true,melee:true});
 expect(await bullets()).toBe(0);
 await world('makePlayerSafe',0,false,10);
 expect(await bullets()).toBeGreaterThan(0);
 await world('setPedProofs',1,{bullet:true,fire:false,explosion:false,collision:false,melee:false});
 expect(await bullets()).toBe(0);
 await page.evaluate(()=>(window as any).__game.sim.killPlayer());
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return s.player.health>0&&s.fadeAlpha<.05;},undefined,{timeout:120000});
 expect(await bullets()).toBeGreaterThan(0);
 expect(errors).toEqual([]);
});
