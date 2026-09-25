import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** Commands that name any ped, given the player: they act on him rather than retiring the script (SWEET4's
 * SET_CHAR_CANT_BE_DRAGGED_OUT, HOODS5's SET_CHAR_RELATIONSHIP and CLEAR_LOOK_AT scplayer, 65 times in the script). */
test('the player answers the char commands the script gives him',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const out=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,p=g.pedestrians();
  const health=g.state().player.health;
  w.clearPedLookAt(1);w.setPedCantBeDraggedOut(1,true);
  // ACQUAINTANCE_TYPE_PED_HATE (4) toward PEDTYPE_GANG2 (8).
  w.setPedRelationship(1,4,8);const hates=(p.playerAcquaintance.idFor(8));
  w.clearPedRelationship(1,4,8);const after=p.playerAcquaintance.idFor(8);
  w.damagePed(1,10,false);
  w.setPedVisible(1,false);const hidden=g.render().scriptPlayerHidden;
  return {hates,after,hidden,dragged:m.playerCantBeDraggedOut,waiting:w.pedIsWaitingForCollision(1),health,healthAfter:g.state().player.health};
 });
 expect(out.hates).toBe(4);expect(out.after).not.toBe(4);expect(out.hidden).toBe(true);expect(out.dragged).toBe(true);
 expect(out.waiting).toBe(false);// Through the player's damage path, whose defence scaling lessens it.
 expect(out.healthAfter).toBeLessThan(out.health);
 await page.waitForTimeout(500);
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedVisible(1,true));
 expect(await page.evaluate(()=>(window as any).__game.render().scriptPlayerHidden)).toBe(false);
 expect(await page.evaluate(()=>(window as any).__game.missionForProfiling().snapshot().gaveUp.map((g:any)=>g.command))).not.toContain('CLEAR_LOOK_AT');
 expect(errors).toEqual([]);
});
