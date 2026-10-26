import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('the live seated damage adapter distinguishes player ped, driven vehicle and remote protection, wounds and kills',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 const result=await page.evaluate(car=>{
  const g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,v=m.vehicles.entity(car),entry=g.carEntry(),w=g.weapons(),stats=m.runtime.game.stats;host.freezeVehiclePosition(car,true);host.warpPedIntoCar(1,car);
  const snapshot=()=>Object.fromEntries([120,121,176,163,240,68].map(id=>[id,stats.get(id)])),rows:any[]=[];
  for(const [index,creator] of ['ped','vehicle','remote'].entries()){
   const rider={modelRef:'FAM1',seat:1,follow:true,gang:1,keep:{id:9100+index,health:1000,defendMult:2,noCriticalHits:true,onlyDamagedByPlayer:true,pedType:'GANG2',gang:1,gangClips:true,slot:0}};
   entry.passengers.push(rider);const target=w.seatedPeds().find((t:any)=>t.rider===rider);if(!target)throw Error('Missing retained source trial');
   const protectedResult=w.damageSeated(target,25,22,false,9,creator),protectedHealth=rider.keep.health;
   rider.keep.onlyDamagedByPlayer=false;rider.keep.health=1000;const ordinary=w.damageSeated(target,25,22,false,9,creator),ordinaryHealth=rider.keep.health;
   rider.keep.health=1;rider.keep.noCriticalHits=false;stats.set(68,50);const before=snapshot(),fatal=w.damageSeated(target,1000,22,false,9,creator),after=snapshot(),again=w.damageSeated(target,1000,22,false,9,creator),repeated=snapshot();
   rows.push({creator,protectedResult:protectedResult??null,protectedHealth,ordinary,ordinaryHealth,fatal,again:again??null,before,after,repeated});
  }
  return {rows,carHealth:v.health};
 },car);
 writeFileSync('artifacts/seated-creator-accounting.json',JSON.stringify({result,errors},null,2));expect(result.carHealth).toBe(1000);
 for(const r of result.rows){
  expect(r.protectedResult).toBe(r.creator==='remote'?null:'hit');expect(r.protectedHealth).toBeCloseTo(r.creator==='ped'?995:r.creator==='vehicle'?950:1000,4);
  expect(r.ordinary).toBe('hit');expect(r.ordinaryHealth).toBeCloseTo(r.creator==='ped'?995:950,4);expect(r.fatal).toBe('killed');expect(r.again).toBe(null);expect(r.repeated).toEqual(r.after);
  const diff=(id:number)=>r.after[id]-r.before[id];expect(diff(120)).toBe(r.creator==='remote'?1:0);expect(diff(121)).toBe(r.creator==='remote'?0:1);expect(diff(176)).toBe(r.creator==='ped'?1:0);
  expect(diff(163)).toBe(r.creator==='vehicle'?0:1);expect(diff(240)).toBe(r.creator==='vehicle'?0:1);expect(diff(68)).toBe(r.creator==='ped'?-5:r.creator==='remote'?-2:0);
 }
 expect(errors).toEqual([]);
});
