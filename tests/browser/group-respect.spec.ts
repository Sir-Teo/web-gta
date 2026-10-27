import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('script queries and actual recruitment share native total-respect thresholds and script limits',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const handles=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return Array.from({length:8},(_,i)=>m.peds.create(8,'MALE01',{x:p.x+8+i*2,y:-p.z,z:p.y}));});
 await page.waitForFunction(hs=>hs.every(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)),handles,{timeout:45000});
 const result=await page.evaluate(handles=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,stats=m.runtime.game.stats,crowd=g.pedestrians(),peds=handles.map(h=>m.peds.entity(h));
  const old={total:stats.get(64),raw:stats.get(68),city:stats.get(181),limit:crowd.scriptGangLimit},rows:any[]=[];
  // Stand in for street candidates while retaining real loaded actors and recruitment/group callbacks.
  for(const p of peds){p.mission=false;p.health=10000;w.freezePedPosition(m.peds.handleOf(p),true);}
  const reset=()=>{for(const h of handles)w.removePedFromGroup(h);crowd.disbandGroup();};
  const check=(total:number,limit=99,city=0)=>{reset();stats.set(64,total);stats.set(68,1000);stats.set(181,city);w.setScriptLimitToGangSize(limit);const queried=w.maxGroupMembers(),joins=peds.map(p=>crowd.groupControl('forward',{handle:p.collider.handle,range:100})),offer=crowd.groupOffer({handle:peds[7].collider.handle,range:100});return {total,limit,city,queried,joins,offer};};
  try{
   for(const r of [0,9.9,10,59,60,159,160,329,330,539,540,799,800,1000])rows.push(check(r));
   const limited=check(800,2),away=check(800,99,2),lowered=check(10);
   return {rows,limited,away,lowered};
  }finally{reset();stats.set(64,old.total);stats.set(68,old.raw);stats.set(181,old.city);w.setScriptLimitToGangSize(old.limit);for(const h of handles)w.deletePed(h);}
 },handles);
 writeFileSync('artifacts/group-respect.json',JSON.stringify({result,errors},null,2));
 const capacities=[0,0,2,2,3,3,4,4,5,5,6,6,7,7];
 for(const [i,row] of result.rows.entries()){expect(row.queried).toBe(capacities[i]);expect(row.joins).toEqual(Array.from({length:8},(_,j)=>j<capacities[i]?'joined':'full'));expect(row.offer.recruit).toBe(false);}
 expect(result.limited.queried).toBe(7);expect(result.limited.joins.filter((s:string)=>s==='joined')).toHaveLength(2);
 expect(result.away.queried).toBe(7);expect(result.away.joins).toEqual(Array(8).fill('full'));
 expect(result.lowered.queried).toBe(2);expect(result.lowered.joins.filter((s:string)=>s==='joined')).toHaveLength(2);expect(errors).toEqual([]);
});
