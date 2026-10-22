import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('corpse hits follow the death clip’s clock and still restart after a medic refreshes removal time',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:60000});
 await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();m.peds.setHealth(h,0);m.runtime.world.setPedAnimPlayingFlag(h,'KO_SHOT_FRONT',false);},ped);await page.waitForTimeout(300);
 const result=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=m.peds.entity(h),population=g.pedestrians(),w=m.runtime.world,health=p.health,money=g.sim.money,progress=p.view.reactionProgress,age=p.deadTime;
  if(!p.view.hasReaction('floor_hit_f'))throw new Error('The installed damage pack lacks FLOOR_HIT_F');
  // Removal age is deliberately beyond the clip, while the real animation association is paused at its start.
  p.deadTime=p.view.reactionDuration('ko_shot_front')+1;const premature=population.damageCollider(p.collider.handle,100,{x:0,z:1},'bullet',{weapon:22});population.holdDead(p.id);
  w.setPedAnimProgress(h,'KO_SHOT_FRONT',1);const completed=p.view.reactionPlayedOut,refreshed=p.deadTime;
  const first=population.damageCollider(p.collider.handle,100,{x:0,z:1},'bullet',{weapon:22}),clip=p.view.reactionName;
  w.setPedAnimProgress(h,'FLOOR_HIT_F',.5);const repeated=population.damageCollider(p.collider.handle,100,{x:0,z:1},'bullet',{weapon:22});
  return {progress,age,premature,completed,refreshed,first,repeated,clip,afterProgress:p.view.reactionProgress,health,afterHealth:p.health,money,afterMoney:g.sim.money,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },ped);
 expect(result.progress).toBe(0);expect(result.age).toBeGreaterThan(0);expect(result.premature).toBe(false);expect(result.completed).toBe(true);expect(result.refreshed).toBe(0);expect(result.first).toBe(true);expect(result.repeated).toBe(true);expect(result.clip).toBe('floor_hit_f');expect(result.afterProgress).toBe(0);expect(result.health).toBe(0);expect(result.afterHealth).toBe(0);expect(result.afterMoney).toBe(result.money);expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
