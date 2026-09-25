import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** CTaskComplexUseSequence: PERFORM_SEQUENCE_TASK with a ped of -1 records a sequence into the open one (SMOKE2, HEIST9,
 * RIOT2 and others). The outer sequence runs it as one step: GET_SEQUENCE_PROGRESS reads the outer step, and
 * GET_SEQUENCE_PROGRESS_RECURSIVE the outer step with the nested one's. */
test('a sequence runs the sequences recorded into it, and reports both steps',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const ped=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;
  return m.peds.create(4,'MALE01',{x:p.x+4,y:-p.z,z:p.y});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),ped,{timeout:45000});
 await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),s=m.runtime.game.sequences;
  const inner=s.open();s.addTaskToActiveSequence({kind:'standStill',time:1200});s.addTaskToActiveSequence({kind:'standStill',time:1200});s.close(inner);
  const outer=s.open();s.addTaskToActiveSequence({kind:'standStill',time:1200});s.addTaskToActiveSequence({kind:'useSequence',sequence:s.index(inner)});
  s.addTaskToActiveSequence({kind:'standStill',time:60000});s.close(outer);
  m.runtime.world.givePedSequence(h,s.sequenceFor(outer).sequence.tasks,false,0x618);},ped);
 const progress=()=>page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;const r=w.getSequenceProgressRecursive(h);return [w.pedSequenceProgress(h),r.p2,r.p3];},ped);
 const seen=new Set<string>();
 await expect.poll(async()=>{const v=await progress();seen.add(v.join(','));return v;},{timeout:60000,intervals:[100]}).toEqual([2,2,-1]);
 // The first step, then both steps of the nested sequence as step 1.
 expect(seen.has('0,0,-1')).toBe(true);expect(seen.has('1,1,0')||seen.has('1,1,1')).toBe(true);
 expect(errors).toEqual([]);
});
