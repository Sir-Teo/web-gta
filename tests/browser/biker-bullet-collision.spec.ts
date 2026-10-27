import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('exposed native bike drivers and pillions take direct body/head hits with cover and proof flags respected',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const c of [{model:481,seat:'driver'},{model:461,seat:'driver'},{model:461,seat:0}]){
  const vehicle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+3},35);},c.model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  const rider=await page.evaluate(({vehicle,c})=>{const m=(window as any).__game.missionForProfiling(),v=m.vehicles.entity(vehicle);m.runtime.world.freezeVehiclePosition(vehicle,true);v.lean=.3;return m.peds.createInCar(4,'MALE01',vehicle,c.seat);},{vehicle,c});
  await page.waitForFunction(rider=>{const g=(window as any).__game,m=g.missionForProfiling(),r=m.peds.entity(rider);return !!r&&g.weapons().seatedPeds().some((t:any)=>t.rider===r&&t.hitSpheres?.()?.length===12);},rider,{timeout:45000});
  const result=await page.evaluate(async({vehicle,rider,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE,RAPIER}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),v=m.vehicles.entity(vehicle),r=m.peds.entity(rider),target=w.seatedPeds().find((t:any)=>t.rider===r),spheres=target.hitSpheres();
   const body=spheres.find((s:any)=>s.piece===3),head=spheres.find((s:any)=>s.piece===9),direction={x:-1,y:0,z:0},source={x:body.center.x+8,y:body.center.y,z:body.center.z};
   const ray=w.ray(source,direction,20,g.sim.playerBody),direct=w.bikerHit(source,direction,ray?.timeOfImpact??20),ownExcluded=!w.bikerHit(source,direction,20,v);
   m.runtime.world.setPedHealth(rider,500);m.runtime.world.setPedSuffersCriticalHits(rider,true);
   m.runtime.world.setPedCanBeShotInVehicle(rider,false);const proof=!w.bikerHit(source,direction,20);m.runtime.world.setPedCanBeShotInVehicle(rider,true);
   const wall=g.sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.1,.6,.6).setTranslation(source.x-4,source.y,source.z));g.sim.world.step();
   const obstruction=w.ray(source,direction,20,g.sim.playerBody),blocked=!g.pedestrians().seatedShot(source,direction,20,g.sim.playerBody,obstruction?.collider.parent(),{distance:obstruction?.timeOfImpact??20,tyre:false});
   g.sim.world.removeCollider(wall,true);g.sim.world.step();
   w.inventory.select(34);w.inventory.cooldown=0;w.firstPerson='sniper';w.aiming=true;
   const fired=w.fire({origin:source,direction});for(let i=0;i<3;i++)w.tick(1/60);const sniperHealth=r.health;
   for(let i=0;i<3;i++)w.tick(1/60);const once=r.health===sniperHealth;
   const npc=g.pedestrians().seatedShot(source,direction,20,g.sim.playerBody,undefined,{distance:20,tyre:false});npc?.hit(25,22);const npcHealth=r.health;
   let copHit=true;
   if(c.model===481){
    const crowd=g.pedestrians(),id=await crowd.spawnOfficer('lapd1',22,{x:source.x,y:source.y-1.6,z:source.z},Math.PI/2),cop=crowd.people.find((p:any)=>p.id===id);
    if(!cop?.weapon)throw Error('Missing cop muzzle fixture');cop.mission=true;cop.gunAccuracy=100;
    const before=r.health,eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},aim={...body.center},offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z);
    for(let i=0;i<180&&r.health===before;i++)crowd.stepPedGun(cop,cop.weapon,eye,aim,offset,[],1/30,true);
    copHit=r.health<before;crowd.removeScripted(cop);
   }
   // The pillion's raised arms can shield a side-on head ray: choose an exposed surface of the actual head sphere.
   const headRay=[{x:0,y:-1,z:0},{x:-1,y:0,z:0},{x:1,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:1}].map(d=>({direction:d,source:{x:head.center.x-d.x*4,y:head.center.y-d.y*4,z:head.center.z-d.z*4}})).find(q=>w.bikerHit(q.source,q.direction,8,g.sim.playerBody)?.piece===9);
   const headLine=headRay&&g.pedestrians().seatedShot(headRay.source,headRay.direction,8,g.sim.playerBody,undefined,{distance:8,tyre:false});headLine?.hit(25,22);
   return {...c,spheres:spheres.length,directPiece:direct?.piece,firstBody:ray?.collider.parent()?.handle??null,vehicleBody:v.body.handle,ownExcluded,proof,blocked,fired,sniperHealth,once,npcHit:!!npc,npcHealth,copHit,headHit:!!headLine,headHealth:r.health};
  },{vehicle,rider,c});
  const key=await page.evaluate(({vehicle,c})=>`script:${(window as any).__game.missionForProfiling().vehicles.entity(vehicle).body.handle}:${c.seat==='driver'?'driver':'pillion'}`,{vehicle,c});
  await expect.poll(()=>page.evaluate(key=>(window as any).__game.occupants().views.get(key)?.view.vehicleClip,key),{timeout:5000}).toBe(c.seat==='driver'?'car_dead_lhs':'car_dead_rhs');
  results.push(result);
  await page.evaluate(({vehicle,rider})=>{const world=(window as any).__game.missionForProfiling().runtime.world;world.deletePed(rider);world.deleteVehicle(vehicle);},{vehicle,rider});
 }
 writeFileSync('artifacts/biker-bullet-collision.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.spheres).toBe(12);expect(r.directPiece).toBeDefined();expect(r.directPiece).not.toBe(9);expect(r.firstBody).not.toBe(r.vehicleBody);expect(r.ownExcluded&&r.proof&&r.blocked).toBe(true);expect(r.fired&&r.once&&r.npcHit&&r.headHit&&r.copHit).toBe(true);expect(r.sniperHealth).toBe(375);expect(r.npcHealth).toBe(350);expect(r.headHealth).toBe(0);}
 expect(errors).toEqual([]);
});
