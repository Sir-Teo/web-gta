import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('incoming shots use CJ’s animated bike body pieces instead of a standing capsule',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const c of [{model:481,seat:'driver'},{model:461,seat:'driver'},{model:461,seat:0}]){
  const vehicle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+3},35);},c.model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  await page.evaluate(({vehicle,c})=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,v=m.vehicles.entity(vehicle);w.freezeVehiclePosition(vehicle,true);if(c.seat==='driver')w.warpPedIntoCar(1,vehicle);else w.warpPedIntoCarAsPassenger(1,vehicle,c.seat);v.lean=.3;w.setPedCanBeShotInVehicle(1,true);g.sim.playerCanBeDamaged=true;g.sim.playerProofs=undefined;},{vehicle,c});
  await page.waitForFunction(h=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h);return g.render().vehiclePose?.frame.vehicle===v.car.root;},vehicle,{timeout:30000});
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  results.push(await page.evaluate(async({vehicle,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE,RAPIER}=await import(/* @vite-ignore */ dep),geometry='/src/combat/nativePedHitSpheres.ts',{pedSphereHit}=await import(/* @vite-ignore */ geometry),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(vehicle),crowd=g.pedestrians(),sim=g.sim,w=g.weapons(),spheres=g.render().nativeCharacter.hitSpheres(),body=spheres.find((s:any)=>s.piece===3);
   const directions=[{x:-1,y:0,z:0},{x:1,y:0,z:0},{x:0,y:0,z:-1},{x:0,y:0,z:1}];
   const trace=(source:any,direction:any,own:any={handle:-9999})=>{const physical=w.ray(source,direction,20,sim.playerBody);return crowd.seatedShot(source,direction,20,own,physical?.collider.parent(),{distance:physical?.timeOfImpact??20,tyre:false});};
   const q=directions.map(direction=>({direction,source:{x:body.center.x-direction.x*8,y:body.center.y,z:body.center.z-direction.z*8}})).find(q=>{const hit=trace(q.source,q.direction);return hit?.victim===sim.player&&hit.direct;});
   if(!q)throw Error(`No exposed CJ body line for ${c.model}:${c.seat}`);
   sim.player.health=100;sim.player.armour=50;trace(q.source,q.direction)!.hit(25,22);const armour=sim.player.armour,piece=sim.damageEvents.at(-1)?.piece,ownExcluded=trace(q.source,q.direction,v)?.victim!==sim.player;
   m.runtime.world.setPedCanBeShotInVehicle(1,false);const proof=trace(q.source,q.direction)?.victim!==sim.player;m.runtime.world.setPedCanBeShotInVehicle(1,true);
   const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.5,.3).setTranslation(q.source.x+q.direction.x*4,q.source.y,q.source.z+q.direction.z*4));sim.world.step();const blocked=trace(q.source,q.direction)?.victim!==sim.player;sim.world.removeCollider(wall,true);sim.world.step();
   const mountedProbe='/tests/fixtures/fireNpcMountedAt.ts',{fireNpcMountedAt}=await import(/* @vite-ignore */ mountedProbe);
   sim.player.health=100;sim.player.armour=1000;const mounted=fireNpcMountedAt(g,q.source,q.direction,RAPIER),mountedLoss=1000-sim.player.armour,mountedPiece=sim.damageEvents.at(-1)?.piece,mountedExpected=(w.inventory.info(38)?.damage??35)*Math.fround(.33);
   // Find a shot accepted by the removed standing capsule but passing through a gap in the actual rider model.
   const old=new RAPIER.Capsule(.6,.3),center=sim.playerBody.translation(),direction={x:-1,y:0,z:0};let gap=false;
   for(const dy of [-.7,-.4,0,.4,.7])for(const dz of [-.2,0,.2]){const source={x:center.x+8,y:center.y+dy,z:center.z+dz};if(old.castRay(new RAPIER.Ray(source,direction),center,{x:0,y:0,z:0,w:1},20,true)>=0&&!pedSphereHit(source,direction,20,spheres)&&crowd.seatedShot(source,direction,20,{handle:-9999},undefined,{distance:20,tyre:false})?.victim!==sim.player)gap=true;}
   let copHit=true,copPiece:number|undefined,shotgun:any;
   if(c.model===481){
    const fireCop=async(type:number)=>{const id=await crowd.spawnOfficer('lapd1',type,{x:q.source.x,y:q.source.y-1.6,z:q.source.z},0),cop=crowd.people.find((p:any)=>p.id===id);if(!cop?.weapon)throw Error('Missing cop muzzle fixture');cop.mission=true;cop.gunAccuracy=100;const eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},aim={...body.center},offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z);sim.player.health=100;sim.player.armour=1000;let steps=0;for(;steps<180&&sim.player.armour===1000;steps++)crowd.stepPedGun(cop,cop.weapon,eye,aim,offset,[],1/30,true);const event=sim.damageEvents.at(-1),result={steps,armour:1000-sim.player.armour,piece:event?.piece,base:cop.weapon.info.damage*Math.fround(.33)};crowd.removeScripted(cop);return result;};
    const pistol=await fireCop(22);copHit=pistol.steps<180;copPiece=pistol.piece;shotgun=await fireCop(25);
   }
   return {...c,spheres:spheres.length,armour,piece,ownExcluded,proof,blocked,gap,copHit,copPiece,shotgun,collider:sim.playerCollider.isEnabled(),mounted,mountedLoss,mountedPiece,mountedExpected};
  },{vehicle,c}));
  await page.evaluate(vehicle=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,2495,-1687,13.3);w.deleteVehicle(vehicle);},vehicle);
 }
 writeFileSync('artifacts/player-bike-shot.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.spheres).toBe(12);expect(r.collider).toBe(false);expect(r.armour).toBeCloseTo(50-25*Math.fround(.33),5);expect(r.piece).not.toBe(9);expect(r.ownExcluded&&r.proof&&r.blocked&&r.gap&&r.copHit).toBe(true);if(r.model===481){expect(r.copPiece).not.toBe(9);expect(r.shotgun.steps).toBeLessThan(180);expect(r.shotgun.armour).toBeGreaterThan(r.shotgun.base);expect(r.shotgun.armour).toBeLessThanOrEqual(r.shotgun.base*15+.001);}}
 for(const r of results){expect(r.mounted).toBe(true);expect(r.mountedLoss).toBeCloseTo(r.mountedExpected,4);expect(r.mountedPiece).not.toBe(9);}
 expect(errors).toEqual([]);
});
