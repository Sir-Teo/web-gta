import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('seated FBI deaths count their creators immediately and body reconstruction does not count a remote kill again',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.police(),undefined,{timeout:45000});
 await page.evaluate(()=>{const g=(window as any).__game;g.sim.playerCanBeDamaged=false;g.missionForProfiling().runtime.game.setMaximumWantedLevel(6);g.police().law.setLevel(5);});
 await page.waitForFunction(()=>{const g=(window as any).__game,w=g.weapons(),u=g.police().units.find((u:any)=>u.member.model==='fbi'&&u.seats.filter(Boolean).length===4&&!u.leaving.length);if(!u||w.seatedPeds().filter((t:any)=>t.car===u.car&&!!t.head).length<4)return false;g.__policeKillUnit=u;return true;},undefined,{timeout:45000});
 const result=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),police=g.police(),u=g.__policeKillUnit,w=g.weapons(),stats=m.runtime.game.stats,snapshot=()=>Object.fromEntries([120,121,176,68].map(id=>[id,stats.get(id)]));
  const handle=m.vehicles.handleFor(u.car,u.car.modelId);m.runtime.world.freezeVehiclePosition(handle,true);g.__policeKillHandle=handle;g.__policeBodyCalls=[];g.__oldPoliceBody=police.onCrewDiesOut;
  police.onCrewDiesOut=(car:any,model:string,corpse:any)=>{if(car===u.car)g.__policeBodyCalls.push({model,corpse,stats:snapshot()});return g.__oldPoliceBody?.(car,model,corpse);};
  const rows:any[]=[];stats.set(68,50);
  for(const [seat,creator] of [[1,'ped'],[2,'vehicle'],[0,'remote']] as const){
   const target=w.seatedPeds().find((t:any)=>t.car===u.car&&t.seat===seat);if(!target)throw Error(`Missing FBI seat ${seat}`);
   const before=snapshot(),result=w.damageSeated(target,25,22,false,9,creator),after=snapshot();w.onSeatedShot(target,1000,22,9,creator,25);w.onSeatedShot(target,1000,22,9,creator,25);
   rows.push({seat,creator,result,before,after,repeated:snapshot(),health:u.seatHealth[seat],armour:u.seatArmour[seat],accounted:u.deathAccounted[seat]});
  }
  police.law.setLevel(0);return {rows,after:snapshot(),deathAt:u.driverDying.at};
 });
 await page.waitForFunction(at=>{const g=(window as any).__game,u=g.__policeKillUnit;return u.seconds>at+2&&g.__policeBodyCalls.length===1&&g.pedestrians().people.some((p:any)=>p.modelRef.toLowerCase()==='fbi'&&p.health===0&&p.armour===75&&Math.hypot(p.actor.player.position.x-u.car.car.body.translation().x,p.actor.player.position.z-u.car.car.body.translation().z)<10);},result.deathAt,{timeout:45000});
 const body=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),stats=m.runtime.game.stats;g.police().onCrewDiesOut=g.__oldPoliceBody;return {calls:g.__policeBodyCalls,stats:Object.fromEntries([120,121,176,68].map(id=>[id,stats.get(id)]))};});
 writeFileSync('artifacts/police-seated-kills.json',JSON.stringify({result,body,errors},null,2));
 for(const r of result.rows){const player=r.creator==='ped',vehicle=r.creator==='vehicle',diff=(id:number)=>r.after[id]-r.before[id];expect(r.result).toBe('killed');expect(r.health).toBe(0);expect(r.armour).toBe(75);expect(r.accounted).toBe(true);expect(r.repeated).toEqual(r.after);expect(diff(120)).toBe(!player&&!vehicle?1:0);expect(diff(121)).toBe(player||vehicle?1:0);expect(diff(176)).toBe(player?1:0);expect(diff(68)).toBe(player?1.5:0);}
 expect(body.stats).toEqual(result.after);expect(body.calls).toEqual([{model:'fbi',corpse:{armour:75,accounted:true},stats:result.after}]);expect(errors).toEqual([]);
});
