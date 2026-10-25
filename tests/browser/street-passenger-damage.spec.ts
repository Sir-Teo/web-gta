import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('street recruits retain wound health on exit and NPC bullets kill seated recruits without reviving them',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.setPedCoordinates(1,2470,-1660,-100);return m.vehicles.create(492,{x:2470,y:-1664,z:-100},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 await page.evaluate(car=>{
  const g=(window as any).__game,m=g.missionForProfiling(),e=g.carEntry();m.runtime.world.freezeVehiclePosition(car,true);m.runtime.world.warpPedIntoCar(1,car);
  // The same retained records boardPassenger hands to the entry task; front right and rear left.
  e.passengers.push({modelRef:'FAM1',seat:1,follow:true,gang:1,keep:{id:9001,health:75,gang:1,gangClips:true,slot:0,noCriticalHits:true}},
   {modelRef:'FAM2',seat:2,follow:true,gang:1,keep:{id:9002,health:90,gang:1,gangClips:true,slot:1}});
 },car);
 await page.waitForFunction(car=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(car);return [1,2].every(s=>!!g.occupants().headOf(`passenger:${v.car.body.handle}:${s}`));},car,{timeout:30000});
 const wounded=await page.evaluate(car=>{
  const g=(window as any).__game,w=g.weapons(),v=g.missionForProfiling().vehicles.entity(car),t=w.seatedPeds().find((t:any)=>t.car===v&&t.kind==='passenger'&&t.seat===1),source={x:t.head.x+6,y:t.head.y+.1,z:t.head.z};
  const found=w.seatedHit(source,{x:-1,y:0,z:0},20,v.car.body);const result=found&&w.onSeatedShot(found.target,25,22);
  return {found:found?.target.rider===t.rider,result,id:t.rider.keep.id,health:g.carEntry().passengers.find((p:any)=>p.seat===1).keep.health,followers:g.carEntry().ridingFollowers()};
 },car);
 expect(wounded).toMatchObject({found:true,result:'hit',followers:2});expect(wounded.health).toBeCloseTo(72.5,5);
 const cop=await page.evaluate(async car=>{
  const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(car),t=g.weapons().seatedPeds().find((t:any)=>t.car===v&&t.kind==='passenger'&&t.seat===2);
  const crowd=g.pedestrians(),id=await crowd.spawnOfficer('lapd1',22,{x:t.head.x-6,y:v.car.body.translation().y-.5,z:t.head.z},Math.PI/2);
  const p=crowd.people.find((p:any)=>p.id===id);if(p)p.mission=true;return id;
 },car);
 expect(cop).not.toBe(false);
 await page.evaluate(car=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(car,false),car);
 await page.waitForFunction(car=>(window as any).__game.missionForProfiling().vehicles.entity(car).car.body.isDynamic(),car);
 const fatal=await page.evaluate(async({car,copId})=>{
  const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car),crowd=g.pedestrians(),cop=crowd.people.find((p:any)=>p.id===copId);
  if(!cop?.weapon)throw new Error('Missing native cop fixture');cop.gunAccuracy=100;
  const target=g.weapons().seatedPeds().find((t:any)=>t.car===v&&t.kind==='passenger'&&t.seat===2),rider=target.rider,aim={...target.head,y:target.head.y+.1},eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z);
  const before={health:v.health,kills:m.runtime.game.stats.get(120),recruits:m.runtime.game.stats.get(163)};
  let steps=0;
  for(;steps<180&&!rider.diedInSeat;steps++){
   // Hold the real muzzle-ray trial in motion so DieInCar keeps the passenger in his seat.
   v.car.body.setLinvel({x:5,y:0,z:0},true);if(v.canStepOut())throw new Error('Moving passenger fixture is still stopped');crowd.stepPedGun(cop,cop.weapon,eye,aim,offset,[v],1/30,true);
  }
  v.car.body.setLinvel({x:0,y:0,z:0},true);m.runtime.world.freezeVehiclePosition(car,true);
  // The measured muzzle trial is over; prevent later autonomous rounds from changing the surviving recruit's wound.
  crowd.removeScripted(cop);
  return {steps,before,health:v.health,riderHealth:rider.keep.health,dead:!!rider.diedInSeat,followers:g.carEntry().ridingFollowers(),targeted:g.weapons().seatedPeds().some((t:any)=>t.rider===rider),kills:m.runtime.game.stats.get(120),recruits:m.runtime.game.stats.get(163),body:v.car.body.handle};
 },{car,copId:cop});
 expect(fatal.steps).toBeLessThan(180);expect(fatal.riderHealth).toBe(0);expect(fatal.dead).toBe(true);expect(fatal.followers).toBe(1);expect(fatal.targeted).toBe(false);
 expect(fatal.health).toBe(fatal.before.health);expect(fatal.kills).toBe(fatal.before.kills+1);expect(fatal.recruits).toBe(fatal.before.recruits+1);
 // Passenger exit timers use game time, which is held while a terrain window is loading/retrying.
 await page.waitForFunction(()=>(window as any).__game.state().terrainHold===false,undefined,{timeout:90000});
 await page.evaluate(()=>(window as any).__game.carEntry().abandon());
 try{await expect.poll(()=>page.evaluate(({health,id})=>{const g=(window as any).__game;return g.pedestrians().snapshot().people.some((p:any)=>p.id===id&&p.model==='FAM1'&&p.follow&&Math.abs(p.health-health)<.00001);},{health:wounded.health,id:wounded.id}),{timeout:10000}).toBe(true);}
 catch(error){writeFileSync('artifacts/street-passenger-exit-debug.json',JSON.stringify(await page.evaluate(()=>{const g=(window as any).__game;return {terrainHold:g.state().terrainHold,crowd:g.pedestrians().snapshot(),entry:{phase:g.carEntry().phase,passengers:g.carEntry().passengers.length,leaving:g.carEntry().leaving?.length}};}),null,2));throw error;}
 const after=await page.evaluate(body=>{
  const g=(window as any).__game,m=g.missionForProfiling(),e=g.carEntry();return {corpse:!!g.occupants().headOf(`passenger:${body}:2`),pose:e.leavingPoses().find((p:any)=>p.key===`passenger:${body}:2`)?.clip,followers:e.ridingFollowers(),revived:g.pedestrians().snapshot().people.some((p:any)=>p.model==='FAM2'&&p.health>0),kills:m.runtime.game.stats.get(120),recruits:m.runtime.game.stats.get(163),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },fatal.body);
 expect(after).toEqual({corpse:true,pose:'car_dead_rhs',followers:0,revived:false,kills:fatal.kills,recruits:fatal.recruits,skipped:[],gaveUp:[]});
 expect(await page.evaluate(()=>(window as any).__game.pedestrians().people.find((p:any)=>p.modelRef==='FAM1'&&p.health>0)?.noCriticalHits)).toBe(true);
 // A stopped car takes the other native branch: the dead passenger leaves at his own door, already dead.
 const stationary=await page.evaluate(car=>{
  const g=(window as any).__game,m=g.missionForProfiling(),e=g.carEntry(),v=m.vehicles.entity(car);
  m.runtime.world.warpPedIntoCar(1,car);e.passengers.push({modelRef:'FAM3',seat:3,follow:true,gang:1,keep:{id:9003,health:100,gang:1,gangClips:true,slot:2}});
  if(!v.canStepOut())throw new Error('Stationary passenger fixture is moving');
  return {result:e.passengerShot(v,3,1000,false,true),kills:m.runtime.game.stats.get(120),recruits:m.runtime.game.stats.get(163)};
 },car);
 expect(stationary).toEqual({result:'killed',kills:fatal.kills+1,recruits:fatal.recruits+1});
 await expect.poll(()=>page.evaluate(()=>{const p=(window as any).__game.pedestrians().people.find((p:any)=>p.modelRef==='FAM3');return p&&{health:p.health,down:p.down===Infinity,money:p.money};})).toEqual({health:0,down:true,money:0});
 expect(await page.evaluate(()=>{const s=(window as any).__game.missionForProfiling().runtime.game.stats;return {kills:s.get(120),recruits:s.get(163)};})).toEqual({kills:stationary.kills,recruits:stationary.recruits});
 await page.screenshot({path:'artifacts/street-passenger-damage.png'});
 await page.evaluate(car=>(window as any).__game.missionForProfiling().runtime.world.deleteVehicle(car),car);
 await expect.poll(()=>page.evaluate(body=>!(window as any).__game.occupants().headOf(`passenger:${body}:2`),fatal.body)).toBe(true);
 expect(errors).toEqual([]);
});
