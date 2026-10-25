import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('player aircraft guns reach original seated and bike riders with vehicle-source crime rules',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const c of [{model:492,type:4,seat:'driver',remote:false},{model:492,type:6,seat:2,remote:false},{model:461,type:4,seat:'driver',remote:false},{model:461,type:4,seat:0,remote:true}]){
  const handles=await page.evaluate(c=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return {plane:m.vehicles.create(c.remote?464:425,{x:p.x+25,y:-p.z,z:p.y+8},0),vehicle:m.vehicles.create(c.model,{x:p.x+8,y:-p.z,z:p.y+3},35)};},c);
  await page.waitForFunction(h=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(h.plane)&&!!m.vehicles.entity(h.vehicle);},handles,{timeout:45000});
  const rider=await page.evaluate(({handles,c})=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;w.freezeVehiclePosition(handles.plane,true);w.freezeVehiclePosition(handles.vehicle,true);if(c.remote)m.vehicles.entity(handles.plane).remoteControlled=true;else w.warpPedIntoCar(1,handles.plane);return m.peds.createInCar(c.type,'MALE01',handles.vehicle,c.seat);},{handles,c});
  await page.waitForFunction(({rider,bike})=>{const g=(window as any).__game,m=g.missionForProfiling(),t=g.weapons().seatedPeds().find((t:any)=>t.rider===m.peds.entity(rider));return bike?t?.hitSpheres?.()?.length===12:!!t?.head;},{rider,bike:c.model===461},{timeout:30000});
  results.push(await page.evaluate(async({handles,rider,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),plane=m.vehicles.entity(handles.plane),v=m.vehicles.entity(handles.vehicle),r=m.peds.entity(rider),target=w.seatedPeds().find((t:any)=>t.rider===r),bike=c.model===461,head=target.head,body=bike?target.hitSpheres().find((s:any)=>s.piece===3).center:undefined;
   const candidates:any[]=[];for(const dy of bike?[0]:[.1,.05,0,-.05])for(const direction of [{x:-1,y:0,z:0},{x:1,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:1}]){const aim=bike?body:{x:head.x,y:head.y+dy,z:head.z},source={x:aim.x-direction.x*8,y:aim.y,z:aim.z-direction.z*8},physical=w.ray(source,direction,20,plane.body,undefined,true),hit=bike?w.bikerHit(source,direction,physical?.timeOfImpact??20,plane.body):w.seatedHit(source,direction,20,physical?.collider.parent(),plane.body);if(hit?.target.rider===r&&(!bike||hit.piece!==9))candidates.push({source,direction});}
   const q=candidates[0];if(!q)throw Error(`No mounted occupant line for ${c.model}:${c.seat}`);
   m.runtime.world.setPedHealth(rider,500);m.runtime.world.setPedSuffersCriticalHits(rider,false);const offset=plane.modelId===464 ? .45 : Math.min(6,plane.assets.collision.bounds.radius);plane.body.setRotation(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),new THREE.Vector3(q.direction.x,0,q.direction.z)),true);plane.body.setTranslation({x:q.source.x-q.direction.x*offset,y:q.source.y,z:q.source.z-q.direction.z*offset},true);plane.body.setLinvel({x:0,y:0,z:0},true);
   const originalCrime=w.onCrime,originalPractice=w.onHit,originalFx=w.fx.bulletHit.bind(w.fx),calls:any[]=[],practice:any[]=[],impacts:any[]=[];w.onCrime=(...args:any[])=>{calls.push(args);originalCrime?.(...args);};w.onHit=(...args:any[])=>{practice.push(args);originalPractice?.(...args);};w.fx.bulletHit=(...args:any[])=>{impacts.push(args[0]);originalFx(...args);};
   try{const fired=w.fireAircraft(plane),weapon=plane.modelId===464?31:38,base=w.inventory.info(weapon).damage;return {...c,rider,fired,base,health:r.health,carHealth:v.health,calls,practice,impacts,occupied:plane.occupied};}finally{w.onCrime=originalCrime;w.onHit=originalPractice;w.fx.bulletHit=originalFx;}
  },{handles,rider,c}));
  await page.evaluate(({handles,rider,c})=>{const m=(window as any).__game.missionForProfiling(),w=m.runtime.world;if(!c.remote)w.warpPedFromCarToCoord(1,2495,-1687,13.3);m.vehicles.entity(handles.plane).remoteControlled=false;w.deletePed(rider);w.deleteVehicle(handles.vehicle);w.deleteVehicle(handles.plane);},{handles,rider,c});
 }
 writeFileSync('artifacts/mounted-player-seat-shot.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.fired).toBe(true);expect(r.occupied).toBe(!r.remote);expect(r.health).toBe(500-r.base);expect(r.carHealth).toBe(1000);expect(r.practice).toEqual([]);const crimes=r.calls.filter((a:any[])=>a[1]===`script-ped:${r.rider}`);expect(crimes).toEqual(r.remote?[]:[[r.type===6?5:4,`script-ped:${r.rider}`,true,false]]);expect(r.impacts).toHaveLength(1);expect(r.impacts[0].ped).toEqual({head:r.model===492,dead:false});}
 expect(errors).toEqual([]);
});
