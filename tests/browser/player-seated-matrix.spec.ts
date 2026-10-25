import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('player seated offset matrices follow the rendered seat while coordinate and heading commands use the vehicle',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const cases:{model:number;seat:number|'driver';lean?:number;tilt?:number}[]=[{model:492,seat:0},{model:492,seat:2},{model:482,seat:1},{model:482,seat:2},{model:461,seat:0,lean:.3},{model:461,seat:0,lean:.3,tilt:.3},{model:471,seat:0},{model:586,seat:0},{model:417,seat:0},...[492,461,471,586,417,473].map(model=>({model,seat:'driver' as const}))],results:any[]=[];
 for(const c of cases){
  const vehicle=await page.evaluate(model=>(window as any).__game.missionForProfiling().vehicles.create(model,{x:2483,y:-1682,z:16},35),c.model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  const immediate=await page.evaluate(async({vehicle,c})=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,v=m.vehicles.entity(vehicle);w.freezeVehiclePosition(vehicle,true);if(c.seat==='driver')w.warpPedIntoCar(1,vehicle);else w.warpPedIntoCarAsPassenger(1,vehicle,c.seat);if(c.lean)v.lean=c.lean;if(c.tilt){const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path);v.car.body.setRotation(new THREE.Quaternion().copy(v.car.body.rotation()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),c.tilt)),true);}return w.pedMatrix(1);},{vehicle,c});
  await page.waitForFunction(h=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h);return g.render().vehiclePose?.frame.vehicle===v.car.root;},vehicle,{timeout:45000});
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const state=await page.evaluate(async({vehicle,c,immediate})=>{
   const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,v=m.vehicles.entity(vehicle),root=g.render().nativeCharacter.root,p=root.getWorldPosition(new THREE.Vector3()),q=root.getWorldQuaternion(new THREE.Quaternion()),native=(p:any)=>({x:p.x,y:-p.z,z:p.y}),forward=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(v.car.body.rotation()));
   return {...c,immediate,matrix:w.pedMatrix(1),coordinates:w.pedPosition(1),heading:w.pedHeading(1),vehicle:w.vehiclePosition(vehicle),expectedHeading:(Math.atan2(-forward.x,-forward.z)*180/Math.PI+360)%360,expected:{position:native(p),right:native(new THREE.Vector3(1,0,0).applyQuaternion(q)),forward:native(new THREE.Vector3(0,0,-1).applyQuaternion(q)),up:native(new THREE.Vector3(0,1,0).applyQuaternion(q))},driver:v.occupied,collider:g.sim.playerCollider.isEnabled(),clip:g.render().vehiclePose.pose.clip};
  },{vehicle,c,immediate});results.push(state);
  await page.evaluate(vehicle=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,2495,-1687,13.3);w.deleteVehicle(vehicle);},vehicle);
 }
 writeFileSync('artifacts/player-seated-matrix.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.driver).toBe(r.seat==='driver');expect(r.collider).toBe(false);for(const axis of ['x','y','z']){expect(r.coordinates[axis],`${r.model} ${r.seat} coordinates`).toBeCloseTo(r.vehicle[axis],3);for(const part of ['position','right','forward','up']){expect(r.matrix[part][axis],`${r.model} ${r.seat} ${part}.${axis}`).toBeCloseTo(r.expected[part][axis],3);expect(r.immediate[part][axis],`${r.model} ${r.seat} immediate ${part}.${axis}`).toBeCloseTo(r.expected[part][axis],3);}}expect(Math.abs(((r.heading-r.expectedHeading+540)%360)-180),`${r.model} ${r.seat} vehicle heading`).toBeLessThan(.01);if(r.model===471&&r.seat==='driver')expect(r.clip).toBe('quad_ride');}
 expect(errors).toEqual([]);
});
