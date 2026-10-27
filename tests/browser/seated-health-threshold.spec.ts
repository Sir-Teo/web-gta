import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('ordinary seated wounds preserve exactly one HP and report death below one with resulting blood and counters',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const results:any[]=[];
 for(const recruit of [false,true])for(const remainder of [1,.5]){
  const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
  const ped=await page.evaluate(({car,recruit,remainder})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),base=g.weapons().inventory.info(38).damage;m.runtime.world.freezeVehiclePosition(car,true);
   if(!recruit)return m.peds.createInCar(4,'MALE01',car,'driver');m.runtime.world.warpPedIntoCar(1,car);g.carEntry().passengers.push({modelRef:'FAM1',seat:1,follow:true,gang:1,keep:{id:9200+(remainder<1?1:0),health:base+remainder,defendMult:1,noCriticalHits:true,pedType:'GANG2',gang:1,gangClips:true,slot:0}});return null;
  },{car,recruit,remainder});
  await page.waitForFunction(({car,ped,recruit})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);return g.weapons().seatedPeds().some((t:any)=>t.car===v&&!!t.head&&(recruit?t.kind==='passenger':t.rider===m.peds.entity(ped)));},{car,ped,recruit},{timeout:45000});
  results.push(await page.evaluate(async({car,ped,recruit,remainder})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireNpcMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),v=m.vehicles.entity(car),base=w.inventory.info(38).damage;
   if(!recruit){host.setPedHealth(ped,base*(m.peds.entity(ped).defendMult??1)+remainder);host.setPedSuffersCriticalHits(ped,false);}
   const target=w.seatedPeds().find((t:any)=>t.car===v&&(recruit?t.kind==='passenger':t.rider===m.peds.entity(ped))),rider=target.rider,health=()=>recruit?rider.keep.health:rider.health,head=target.head;
   const ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:head.x-direction.x*6,y:head.y+.1,z:head.z-direction.z*6}})).find(r=>{const hit=w.npcBulletLine(r.source,r.direction,20,g.sim.playerBody);return g.pedestrians().seatedShot(r.source,r.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false})?.victim===rider;});
   if(!ray)throw Error('No ordinary threshold head line');const fx=w.fx.effects,old=fx.blood,blood:any[]=[];fx.blood=function(...args:any[]){blood.push({count:args[2],health:health()});return old.apply(this,args);};
   try{
    // Keep the recruit's ordinary DieInCar result in the seat for observation rather than starting a door exit.
    if(recruit){host.freezeVehiclePosition(car,false);v.car.body.setLinvel({x:5,y:0,z:0},true);if(v.canStepOut())throw Error('Threshold ride is still stopped');}
    const before=m.runtime.game.stats.get(120),carBefore=v.health,fired=fireNpcMountedAt(g,ray.source,ray.direction,RAPIER),after=health(),dead=!!rider.diedInSeat,scriptDead=recruit?undefined:host.pedIsDeadForScript(ped),others=m.runtime.game.stats.get(120)-before;
    v.car.body.setLinvel({x:0,y:0,z:0},true);host.freezeVehiclePosition(car,true);return {recruit,remainder,fired,base,after,dead,scriptDead,others,blood,carBefore,carHealth:v.health,carDamage:carBefore-v.health};
   }finally{fx.blood=old;}
  },{car,ped,recruit,remainder}));
  await page.evaluate(({car,ped,recruit})=>{const host=(window as any).__game.missionForProfiling().runtime.world;if(recruit)host.warpPedFromCarToCoord(1,2495,-1687,13.3);else host.deletePed(ped);host.deleteVehicle(car);},{car,ped,recruit});
 }
 writeFileSync('artifacts/seated-health-threshold.json',JSON.stringify({results,errors},null,2));
 for(const r of results){const killed=r.remainder<1;expect(r.fired).toBe(true);expect(r.after).toBe(killed?0:1);expect(r.dead).toBe(killed);if(!r.recruit)expect(r.scriptDead).toBe(killed);expect(r.others).toBe(killed?1:0);expect(r.blood).toEqual([{count:killed?32:16,health:killed?0:1}]);expect(r.carDamage).toBe(0);}
 expect(errors).toEqual([]);
});
