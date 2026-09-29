import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CPlayerInfo::m_nPlayerState as the script reads it: KillPlayer makes it HAS_DIED, so IS_PLAYER_PLAYING is false,
// IS_PLAYER_DEAD true and DoDeathArrestCheck sees the restart (which fails a running mission); the resurrection puts
// it back to PLAYING.
test('the script sees the player dead and restarting while wasted, then playing again',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 const read=()=>page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world;return {playing:w.isPlayerPlaying(0),dead:w.isPlayerDead(0),restarting:w.isPlayerRestarting()};});
 await expect.poll(async()=>(await page.evaluate(()=>(window as any).__game.state().player.grounded)),{timeout:60000}).toBe(true);
 expect(await read()).toEqual({playing:true,dead:false,restarting:false});
 await page.evaluate(()=>{(window as any).__game.sim.damagePlayer(1000,true,{weapon:54});});
 await expect.poll(read,{timeout:60000}).toEqual({playing:false,dead:true,restarting:true});
 await expect.poll(read,{timeout:90000}).toEqual({playing:true,dead:false,restarting:false});
 expect(errors).toEqual([]);
});
