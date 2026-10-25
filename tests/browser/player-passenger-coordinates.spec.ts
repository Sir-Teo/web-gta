import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('script player coordinates and facing follow the native passenger seat, including van facing and bike lean',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const [model,seat,lean,tilt] of [[492,0,0],[492,2,0],[482,1,0],[482,2,0],[461,0,.3],[461,0,.3,.3],[471,0,0],[417,0,0]]){
  const vehicle=await page.evaluate(model=>{const m=(window as any).__game.missionForProfiling();return m.vehicles.create(model,{x:2483,y:-1682,z:25},35);},model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  const immediate=await page.evaluate(async({vehicle,seat,lean,tilt})=>{const m=(window as any).__game.missionForProfiling(),v=m.vehicles.entity(vehicle);m.runtime.world.freezeVehiclePosition(vehicle,true);m.runtime.world.warpPedIntoCarAsPassenger(1,vehicle,seat);if(lean)v.lean=lean;if(tilt){const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path);v.car.body.setRotation(new THREE.Quaternion().copy(v.car.body.rotation()).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),tilt)),true);}return {position:m.runtime.world.pedPosition(1),heading:m.runtime.world.pedHeading(1)};},{vehicle,seat,lean,tilt});
  await page.waitForFunction(h=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h);return g.render().vehiclePose?.frame.vehicle===v.car.root;},vehicle,{timeout:30000});
  // Let the character consume the vehicle pose after the frame that first exposes it.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const state=await page.evaluate(async({model,vehicle,seat,lean,immediate})=>{
   const path='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ path),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(vehicle),pose=g.render().vehiclePose,root=g.render().nativeCharacter.root,p=root.getWorldPosition(new THREE.Vector3()),q=root.getWorldQuaternion(new THREE.Quaternion()),forward=new THREE.Vector3(0,0,-1).applyQuaternion(q),heading=((Math.atan2(forward.x,forward.z)-Math.PI)*180/Math.PI%360+360)%360;
   return {model,seat,lean,immediate,actual:m.runtime.world.pedPosition(1),expected:{x:p.x,y:-p.z,z:p.y},heading:m.runtime.world.pedHeading(1),expectedHeading:heading,driver:v.occupied,collider:g.sim.playerCollider.isEnabled(),local:pose.frame.local,headingOffset:pose.frame.headingOffset??0,body:{...v.car.body.translation()}};
  },{model,vehicle,seat,lean,immediate});results.push(state);
  await page.evaluate(vehicle=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,p=w.vehiclePosition(vehicle);w.warpPedFromCarToCoord(1,p.x+10,p.y,p.z);w.deleteVehicle(vehicle);},vehicle);
 }
 writeFileSync('artifacts/player-passenger-coordinates.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.driver).toBe(false);expect(r.collider).toBe(false);for(const axis of ['x','y','z'])expect(r.immediate.position[axis],`${r.model} immediate ${axis}`).toBeCloseTo(r.expected[axis],3);for(const axis of ['x','y','z'])expect(r.actual[axis],`${r.model} seat ${r.seat} coordinate ${axis}`).toBeCloseTo(r.expected[axis],3);expect(Math.abs(((r.heading-r.expectedHeading+540)%360)-180),`${r.model} seat ${r.seat} facing`).toBeLessThan(.01);}
 expect(errors).toEqual([]);
});
