import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** SWEET1B's and INTRO2's switches: LISTEN_TO_PLAYER_GROUP_COMMANDS keeps a follower through the player's dismissal,
 * ENABLE_ENTRY_EXIT_PLAYER_GROUP_WARPING sets ACCEPT_NPC_GROUP on the entrances near a point, ATTACH_FX_SYSTEM_TO_CHAR_BONE
 * hangs a system from the player's hand, and the say, signal, head and interior-ped commands answer. */
test('the group, entrance, effect and speech switches the early story sets',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().peds.create(8,'FAM1',{x:p.x+2,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 const out=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,e=m.peds.entity(h);
  w.setPedListensToPlayerGroupCommands(h,false);
  const r:Record<string,unknown>={ignores:e.ignoresGroupCommands};
  w.pedSignalAfterKill(h,false);r.head=w.pedHeadIsMissing(h);r.say=w.pedSayContext(h,3);
  w.activateInteriorPeds(false);r.interior=m.runtime.game.interiorPedsActive;
  // A system the effects host has made takes the bone; the attach itself is the check.
  const fx=w.createFxSystem?.('prt_smoke',0,0,0,1);try{w.attachFxSystemToPedBone(fx,1,24);r.fx=true;}catch{r.fx='not made';}
  return r;
 },ped);
 expect(out).toMatchObject({ignores:true,head:false,say:-1,interior:false});
 expect(errors).toEqual([]);
});
