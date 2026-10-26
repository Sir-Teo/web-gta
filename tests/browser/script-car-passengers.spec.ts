import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('scripted rear passengers render, follow the car and receive seat-specific bullet hits',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 const riders=await page.evaluate(car=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.freezeVehiclePosition(car,true);return ['driver',0,1,2].map(seat=>m.peds.createInCar(4,'MALE01',car,seat));},car);
 await page.waitForFunction(({car,riders})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);return riders.every((h,i)=>!!m.peds.entity(h)&&!!g.occupants().headOf(`script:${v.car.body.handle}:${i===0?'driver':i-1}`));},{car,riders},{timeout:45000});
 const result=await page.evaluate(({car,riders})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car),w=g.weapons(),front=v.car.nativeFramePosition('ped_frontseat'),back=v.car.nativeFramePosition('ped_backseat');
  const targets=()=>riders.map(h=>w.seatedPeds().find((t:any)=>t.rider===m.peds.entity(h)));
  const key=(i:number)=>`script:${v.car.body.handle}:${i===0?'driver':i-1}`;
  const heads=riders.map((_,i)=>({...g.occupants().headOf(key(i))})),seats=targets().map((t:any)=>({seat:t.seat,local:t.local}));
  const hits=targets().map((t:any)=>{
   const side=t.local.x<0?-1:1,source={x:t.head.x+6*side,y:t.head.y+.1,z:t.head.z},direction={x:-side,y:0,z:0};
   const shot=w.seatedHit(source,direction,20,v.car.body);
   return {seat:t.seat,hit:shot?.target.rider===t.rider,ownExcluded:!w.seatedHit(source,direction,20,v.car.body,v)};
  });
  const rear=targets()[2],source={x:rear.head.x-6,y:rear.head.y+.1,z:rear.head.z},direction={x:1,y:0,z:0};
  m.runtime.world.setPedCanBeShotInVehicle(riders[2],false);
  const proof=w.seatedHit(source,direction,20,v.car.body)?.target.rider!==rear.rider;
  m.runtime.world.setPedCanBeShotInVehicle(riders[2],true);
  const before=rear.rider.health,damage=w.onSeatedShot(rear,25,22),after=rear.rider.health;
  const old=v.car.body.translation();v.car.body.setTranslation({x:old.x+3,y:old.y,z:old.z},true);
  return {front,back,seats,heads,hits,proof,before,after,damage};
 },{car,riders});
 expect(result.seats).toEqual([
  {seat:0,local:{...result.front,x:-result.front.x}},
  {seat:1,local:result.front},
  {seat:2,local:{...result.back,x:-result.back.x}},
  {seat:3,local:result.back},
 ]);
 expect(result.hits).toEqual([0,1,2,3].map(seat=>({seat,hit:true,ownExcluded:true})));
 expect(result.proof).toBe(true);expect(result.damage).toBe('hit');expect(result.after).toBe(result.before-25*1.1);
 await expect.poll(()=>page.evaluate(({car,riders,heads})=>{
  const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(car);
  return riders.every((_,i)=>{const p=g.occupants().headOf(`script:${v.car.body.handle}:${i===0?'driver':i-1}`);return p&&Math.abs(p.x-heads[i].x-3)<.01;});
 },{car,riders,heads:result.heads})).toBe(true);
 const death=await page.evaluate(({car,riders})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),r=m.peds.entity(riders[3]),t=w.seatedPeds().find((t:any)=>t.rider===r);
  const result=w.onSeatedShot(t,1000,22);return {result,health:r.health,dead:r.diedInSeat,stillAllocated:m.peds.entity(riders[3])===r,targeted:w.seatedPeds().some((t:any)=>t.rider===r)};
 },{car,riders});
 expect(death).toEqual({result:'killed',health:0,dead:true,stillAllocated:true,targeted:false});
 await expect.poll(()=>page.evaluate(({car,headY})=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(car),head=g.occupants().headOf(`script:${v.car.body.handle}:2`);return !!head&&head.y<headY-.1;},{car,headY:result.heads[3].y})).toBe(true);
 await page.screenshot({path:'artifacts/script-car-passengers.png'});
 const cleanup=await page.evaluate(({car,riders})=>{const g=(window as any).__game,m=g.missionForProfiling(),body=m.vehicles.entity(car).car.body.handle;riders.forEach(h=>m.runtime.world.deletePed(h));m.runtime.world.deleteVehicle(car);return {body,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},{car,riders});
 await expect.poll(()=>page.evaluate(body=>{const g=(window as any).__game;return ['driver',0,1,2].every(seat=>!g.occupants().headOf(`script:${body}:${seat}`));},cleanup.body)).toBe(true);
 expect(cleanup.skipped).toEqual([]);expect(cleanup.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
