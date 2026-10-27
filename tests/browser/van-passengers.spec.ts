import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('a native van turns script, player and street rear passengers inward at the PC seat positions',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(482,{x:p.x+8,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
 const riders=await page.evaluate(car=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.freezeVehiclePosition(car,true);return ['driver',0,1,2].map(seat=>m.peds.createInCar(4,'MALE01',car,seat));},car);
 await page.waitForFunction(({car,riders})=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);return riders.every((h,i)=>!!m.peds.entity(h)&&!!g.occupants().headOf(`script:${v.car.body.handle}:${i===0?'driver':i-1}`));},{car,riders},{timeout:30000});
 const scripted=await page.evaluate(async({car,riders})=>{
  const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car);
  const frame=(root:any)=>{
   const local=v.car.root.worldToLocal(root.getWorldPosition(new THREE.Vector3())),q=v.car.root.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(root.getWorldQuaternion(new THREE.Quaternion())),forward=new THREE.Vector3(0,0,-1).applyQuaternion(q);
   return {local:{x:local.x,y:local.y,z:local.z},forward:{x:forward.x,y:forward.y,z:forward.z}};
  };
  (window as any).__vanPassengerFrame=(key:string)=>frame(g.occupants().views.get(key).view.root);
  (window as any).__vanPlayerFrame=()=>frame(g.render().nativeCharacter.root);
  return {body:v.car.body.handle,group:v.animGroup.id,front:v.car.nativeFramePosition('ped_frontseat'),back:v.car.nativeFramePosition('ped_backseat'),
   seats:riders.map(h=>{const t=g.weapons().seatedPeds().find((t:any)=>t.rider===m.peds.entity(h));return {local:t.local,headingOffset:t.headingOffset};}),
   frames:riders.map((_,i)=>(window as any).__vanPassengerFrame(`script:${v.car.body.handle}:${i===0?'driver':i-1}`))};
 },{car,riders});
 expect(scripted.group).toBe(13);
 const positions=[{...scripted.front,x:-scripted.front.x},scripted.front,{...scripted.back,x:-scripted.back.x,y:scripted.back.y+.6},scripted.back],angles=[0,0,-Math.PI/2,Math.PI/2];
 const check=(frame:any,local:any,angle:number)=>{
  expect(frame.local.x).toBeCloseTo(local.x,5);expect(frame.local.y).toBeCloseTo(local.z,5);expect(frame.local.z).toBeCloseTo(-local.y,5);
  expect(frame.forward.x).toBeCloseTo(-Math.sin(angle),5);expect(frame.forward.y).toBeCloseTo(0,5);expect(frame.forward.z).toBeCloseTo(-Math.cos(angle),5);
 };
 scripted.frames.forEach((frame:any,i:number)=>check(frame,positions[i],angles[i]));
 expect(scripted.seats).toEqual(positions.map((local,i)=>({local,headingOffset:angles[i]})));
 // CJ takes the left rear seat vacated by its script rider.
 await page.evaluate(({car,rider})=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.deletePed(rider);w.warpPedIntoCarAsPassenger(1,car,1);},{car,rider:riders[2]});
 await page.waitForFunction(()=>Math.abs(((window as any).__game.render().vehiclePose?.frame.headingOffset??0)+Math.PI/2)<.00001);
 await expect.poll(()=>page.evaluate(()=>(window as any).__vanPlayerFrame().forward.x)).toBeCloseTo(1,5);
 check(await page.evaluate(()=>(window as any).__vanPlayerFrame()),positions[2],angles[2]);
 // Recruits off the street use the same frame after CJ takes the wheel.
 await page.evaluate(({car,riders})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,p=w.vehiclePosition(car);w.warpPedFromCarToCoord(1,p.x+5,p.y,p.z);w.deletePed(riders[0]);w.deletePed(riders[3]);w.warpPedIntoCar(1,car);
  g.carEntry().passengers.push({modelRef:'FAM1',seat:2,follow:true,keep:{health:100}},{modelRef:'FAM2',seat:3,follow:true,keep:{health:100}});
 },{car,riders});
 await page.waitForFunction(body=>[2,3].every(s=>!!(window as any).__game.occupants().headOf(`passenger:${body}:${s}`)),scripted.body,{timeout:30000});
 const street=await page.evaluate(body=>[2,3].map(s=>(window as any).__vanPassengerFrame(`passenger:${body}:${s}`)),scripted.body);
 street.forEach((frame:any,i:number)=>check(frame,positions[i+2],angles[i+2]));
 await page.screenshot({path:'artifacts/van-passengers.png'});
 const cleanup=await page.evaluate(({car,riders})=>{const g=(window as any).__game,m=g.missionForProfiling();g.carEntry().abandon();for(const h of riders)if(m.peds.exists(h))m.runtime.world.deletePed(h);m.runtime.world.deleteVehicle(car);return {skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},{car,riders});
 expect(cleanup).toEqual({skipped:[],gaveUp:[]});expect(errors).toEqual([]);
});
