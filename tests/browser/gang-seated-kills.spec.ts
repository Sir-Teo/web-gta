import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('gang drivers and gunners count their gang and creator once, including high-health heads and delayed corpses',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>(window as any).__game.driveby()?.snapshot().ready,undefined,{timeout:45000});await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});await page.evaluate(()=>(window as any).__game.sim.playerCanBeDamaged=false);
 const results:any[]=[];
 for(const gang of [0,1])for(const creator of ['ped','vehicle','remote']){
  const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+9,y:-p.z,z:p.y+1},0);});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
  await page.evaluate(({car,gang})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);m.runtime.world.freezeVehiclePosition(car,true);if(!g.driveby().adoptAttackCar(v,gang))throw Error('No native gang attack crew');g.__gangKillUnit=g.driveby().units.find((u:any)=>u.car===v);},{car,gang});
  await page.waitForFunction(()=>{const g=(window as any).__game,u=g.__gangKillUnit;return g.weapons().seatedPeds().filter((t:any)=>t.car===u.car&&t.kind==='driveby'&&!!t.head).length===2;},undefined,{timeout:45000});
  const result=await page.evaluate(({gang,creator})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),d=g.driveby(),u=g.__gangKillUnit,w=g.weapons(),stats=m.runtime.game.stats,snapshot=()=>Object.fromEntries([120,121,176,239,240,163,68].map(id=>[id,stats.get(id)]));u.driverHealth=u.shooterHealth=5000;stats.set(68,50);
   g.__gangBodyCalls=[];g.__oldGangBody=d.onCrewDiesOut;d.onCrewDiesOut=(car:any,model:string,corpse:any)=>{if(car===u.car)g.__gangBodyCalls.push({corpse,stats:snapshot()});return g.__oldGangBody?.(car,model,corpse);};
   const before=snapshot(),targets=w.seatedPeds().filter((t:any)=>t.car===u.car),rows:any[]=[];
   for(const target of targets){
    let result:any,blood:any[]=[];
    if(gang===0&&creator==='ped'&&target.seat===0){
     const head={...target.head,y:target.head.y+.1},ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:head.x-direction.x*6,y:head.y,z:head.z-direction.z*6}})).find(line=>{const hit=w.ray(line.source,line.direction,20,g.sim.playerBody);const recipient=w.seatedHit(line.source,line.direction,20,hit?.collider.parent(),g.sim.playerBody);return recipient?.target.car===u.car&&recipient.target.seat===0;});if(!ray)throw Error('No native gang driver head line');
     const start={...g.sim.player.position},oldMuzzle=w.muzzle,oldSpread=w.aimSpread,fx=w.fx.effects,oldBlood=fx.blood;fx.blood=function(...args:any[]){blood.push({count:args[2],health:u.driverHealth});return oldBlood.apply(this,args);};
     try{g.placePlayer(ray.source.x,ray.source.y-1.3,ray.source.z);w.inventory.give(22,100);w.inventory.select(22);w.firstPerson=undefined;w.aiming=true;w.muzzle=()=>ray.source;w.aimSpread=(direction:any)=>direction;result=w.fire({origin:ray.source,direction:ray.direction});}
     finally{w.muzzle=oldMuzzle;w.aimSpread=oldSpread;fx.blood=oldBlood;g.placePlayer(start.x,start.y,start.z);}
    }else result=w.damageSeated(target,25,22,false,9,creator);
    rows.push({seat:target.seat,result,health:target.seat?u.shooterHealth:u.driverHealth,accounted:u.deathAccounted[target.seat],blood});
   }
   const after=snapshot();for(const target of targets){w.onSeatedShot(target,1000,22,9,creator,25);w.onSeatedShot(target,1000,22,9,creator,25);}g.police().law.setLevel(0);return {gang,creator,before,after,repeated:snapshot(),rows,deathAt:u.driverDying.at,gunActive:u.shooter.gunState.active};
  },{gang,creator});
  writeFileSync('artifacts/gang-seated-kills-progress.json',JSON.stringify({completed:results,current:result},null,2));
  await page.waitForFunction(at=>{const g=(window as any).__game,u=g.__gangKillUnit;return u.seconds>at+2&&g.__gangBodyCalls.length===1&&g.pedestrians().people.some((p:any)=>p.modelRef.toLowerCase()===u.driver.toLowerCase()&&p.health===0&&p.gang===u.gang&&Math.hypot(p.actor.player.position.x-u.car.car.body.translation().x,p.actor.player.position.z-u.car.car.body.translation().z)<10);},result.deathAt,{timeout:45000}).catch(async error=>{writeFileSync('artifacts/gang-seated-kills-failure.json',JSON.stringify(await page.evaluate(()=>{const g=(window as any).__game,u=g.__gangKillUnit;return {terrainHold:g.state().terrainHold,unit:{seconds:u.seconds,driver:u.driver,gang:u.gang,driverHealth:u.driverHealth,driverDying:u.driverDying,driverDead:u.driverDead,driverOut:u.car.driverOut,disposed:u.car.disposed,velocity:u.car.disposed?null:u.car.car.body.linvel()},calls:g.__gangBodyCalls,bodies:g.pedestrians().people.filter((p:any)=>p.health<=0).map((p:any)=>({model:p.modelRef,gang:p.gang,health:p.health,position:p.actor.player.position}))};}),null,2));throw error;});
  const body=await page.evaluate(()=>{const g=(window as any).__game,stats=g.missionForProfiling().runtime.game.stats;g.driveby().onCrewDiesOut=g.__oldGangBody;return {calls:g.__gangBodyCalls,stats:Object.fromEntries([120,121,176,239,240,163,68].map(id=>[id,stats.get(id)]))};});results.push({...result,body});
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deleteVehicle(h),car);
 }
 writeFileSync('artifacts/gang-seated-kills.json',JSON.stringify({results,errors},null,2));
 for(const r of results){const player=r.creator==='ped',vehicle=r.creator==='vehicle',diff=(id:number)=>r.after[id]-r.before[id];expect(r.rows).toHaveLength(2);expect(r.rows.every((s:any)=>s.health===0&&s.accounted)).toBe(true);expect(r.gunActive).toBe(false);expect(r.repeated).toEqual(r.after);expect(diff(120)).toBe(!player&&!vehicle?2:0);expect(diff(121)).toBe(player||vehicle?2:0);expect(diff(176)).toBe(player?2:0);expect(diff(239)).toBe(!vehicle&&r.gang!==1?2:0);expect(diff(240)).toBe(!vehicle&&r.gang===1?2:0);expect(diff(163)).toBe(0);expect(diff(68)).toBe(player?r.gang===1?-10:1.5:0);expect(r.body.stats).toEqual(r.after);expect(r.body.calls).toEqual([{corpse:{armour:0,accounted:true},stats:r.after}]);if(r.gang===0&&player)expect(r.rows.find((s:any)=>s.seat===0)).toMatchObject({result:true,blood:[{count:32,health:0}]});}
 expect(errors).toEqual([]);
});
