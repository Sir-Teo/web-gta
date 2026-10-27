import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('script NPC offset matrices follow native seats while coordinate and heading commands select their vehicle',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const [index,model] of [492,482,461,471,586,417,473].entries()){
  const vehicle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+1},35);},model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  const riders=await page.evaluate(({vehicle,model})=>{const m=(window as any).__game.missionForProfiling(),v=m.vehicles.entity(vehicle);m.runtime.world.freezeVehiclePosition(vehicle,true);if(model===461)v.lean=.3;const seats=['driver',0,...([492,482].includes(model)?[1,2]:[])];return seats.map(seat=>({seat,handle:m.peds.createInCar(4,'MALE01',vehicle,seat),key:`script:${v.car.body.handle}:${seat==='driver'?'driver':typeof v.riderPose==='function'?'pillion':seat}`}));},{vehicle,model});
  try{await page.waitForFunction(riders=>{const g=(window as any).__game,m=g.missionForProfiling();return riders.every(r=>!!m.peds.entity(r.handle)&&!!g.occupants().headOf(r.key));},riders,{timeout:45000});}catch(error){const state=await page.evaluate(riders=>{const g=(window as any).__game,m=g.missionForProfiling();return {occupants:g.occupants().snapshot(),keys:[...g.occupants().views.keys()],riders:riders.map(r=>{const p=m.peds.entity(r.handle);return {...r,exists:!!p,model:p?.model,gone:p?.gone,health:p?.health,disposed:p?.car?.disposed};}),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},riders);writeFileSync('artifacts/script-rider-coordinates-loading.json',JSON.stringify({model,state,errors},null,2));throw error;}
  const states=await page.evaluate(async({model,riders,vehicle})=>{
   const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(vehicle),bodyForward=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(v.car.body.rotation())),native=(p:any)=>({x:p.x,y:-p.z,z:p.y});
   return riders.map(r=>{const root=g.occupants().views.get(r.key).view.root,p=root.getWorldPosition(new THREE.Vector3()),q=root.getWorldQuaternion(new THREE.Quaternion()),forward=new THREE.Vector3(0,0,-1).applyQuaternion(q);return{model,seat:r.seat,matrix:m.runtime.world.pedMatrix(r.handle),coordinates:m.runtime.world.pedPosition(r.handle),heading:m.runtime.world.pedHeading(r.handle),vehicle:m.runtime.world.vehiclePosition(vehicle),expected:{position:native(p),right:native(new THREE.Vector3(1,0,0).applyQuaternion(q)),forward:native(forward),up:native(new THREE.Vector3(0,1,0).applyQuaternion(q))},expectedHeading:(Math.atan2(-bodyForward.x,-bodyForward.z)*180/Math.PI+360)%360};});
  },{model,riders,vehicle});results.push(...states);
  await page.evaluate(({vehicle,riders})=>{const w=(window as any).__game.missionForProfiling().runtime.world;for(const r of riders)w.deletePed(r.handle);w.deleteVehicle(vehicle);},{vehicle,riders});
 }
 writeFileSync('artifacts/script-rider-matrices.json',JSON.stringify({results,errors},null,2));
 for(const r of results){for(const axis of ['x','y','z']){expect(r.coordinates[axis],`${r.model} ${r.seat} vehicle coordinate ${axis}`).toBeCloseTo(r.vehicle[axis],3);for(const part of ['position','right','forward','up'])expect(r.matrix[part][axis],`${r.model} ${r.seat} ${part}.${axis}`).toBeCloseTo(r.expected[part][axis],3);}expect(Math.abs(((r.heading-r.expectedHeading+540)%360)-180),`${r.model} ${r.seat} vehicle heading`).toBeLessThan(.01);}
 expect(errors).toEqual([]);
});
