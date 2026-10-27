import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('actual motorcycle controls feed rider poses and a seated passenger suppresses automatic forward lean',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game.sim.player.grounded,undefined,{timeout:60000});
 const vehicle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(461,{x:p.x+6,y:-p.z,z:-100},90);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:60000});
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.warpPedIntoCar(1,h),vehicle);
 await page.waitForFunction(()=>(window as any).__game.fleet().occupiedBike?.riderAnimation&&!!(window as any).__game.render().vehiclePose?.pose.partials,undefined,{timeout:45000});
 await page.evaluate(async()=>{
  const path='/src/simulation/nativeBikeRiderController.ts',{NativeBikeRiderController}=await import(path);
  const t=(window as any).__ordinaryRider={original:NativeBikeRiderController.prototype.step,rows:[] as any[]};
  NativeBikeRiderController.prototype.step=function(this:any,dt:number,input:any){const output=t.original.call(this,dt,input);if(input.player)t.rows.push({input,output,state:{...this.state}});return output;};
 });
 let passenger:number|undefined,rows:any[]=[];
 try{
  await page.keyboard.down('KeyW');
  await page.waitForFunction(()=>(window as any).__ordinaryRider.rows.some((r:any)=>!r.input.passenger&&r.input.gas>.5&&r.output.forwardTarget<0),undefined,{timeout:15000});
  await page.waitForFunction(()=>(window as any).__ordinaryRider.rows.some((r:any)=>r.input.speed>.02),undefined,{timeout:15000});
  passenger=await page.evaluate(h=>(window as any).__game.missionForProfiling().peds.createInCar(4,'MALE01',h,0),vehicle);
  await page.waitForFunction(()=>(window as any).__ordinaryRider.rows.some((r:any)=>r.input.passenger&&r.input.gas>.5&&r.output.forwardTarget===0),undefined,{timeout:15000});
  const pose=await page.evaluate(()=>{const g=(window as any).__game,v=g.render().vehiclePose?.pose;return {clip:v?.clip,partials:v?.partials,visible:g.render().nativeCharacter.root.visible};});
  expect(pose.clip).toBe('bikes_ride');expect(pose.visible).toBe(true);expect(pose.partials?.length).toBeGreaterThan(0);
  await page.screenshot({path:'artifacts/bike-rider-controller-live-passenger.png'});
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),passenger);passenger=undefined;
  await page.keyboard.up('KeyW');await page.keyboard.down('KeyS');
  await page.waitForFunction(()=>(window as any).__ordinaryRider.rows.some((r:any)=>!r.input.passenger&&r.input.brake>.5&&r.output.forwardTarget>0),undefined,{timeout:15000});
  rows=await page.evaluate(()=>(window as any).__ordinaryRider.rows);
 }finally{
  await page.keyboard.up('KeyW');await page.keyboard.up('KeyS');
  if(passenger!==undefined)await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),passenger);
  rows=await page.evaluate(async()=>{const path='/src/simulation/nativeBikeRiderController.ts',{NativeBikeRiderController}=await import(path),t=(window as any).__ordinaryRider;NativeBikeRiderController.prototype.step=t.original;return t.rows;});
  writeFileSync('artifacts/bike-rider-controller-live-keys.json',JSON.stringify({rows,errors},null,2));
 }
 expect(errors).toEqual([]);
});
