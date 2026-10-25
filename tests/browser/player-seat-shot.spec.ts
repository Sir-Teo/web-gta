import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('NPC vehicle-head hits reach seated CJ, absorb armour and respect his script protection',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const c of [{model:492,seat:'driver'},{model:492,seat:2},{model:482,seat:1}]){
  const vehicle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+1},0);},c.model);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),vehicle,{timeout:45000});
  await page.evaluate(({vehicle,c})=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.freezeVehiclePosition(vehicle,true);if(c.seat==='driver')m.runtime.world.warpPedIntoCar(1,vehicle);else m.runtime.world.warpPedIntoCarAsPassenger(1,vehicle,c.seat);m.runtime.world.setPedCanBeShotInVehicle(1,true);g.sim.playerCanBeDamaged=true;g.sim.playerProofs=undefined;},{vehicle,c});
  await page.waitForFunction(h=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(h);return g.render().vehiclePose?.frame.vehicle===v.car.root;},vehicle,{timeout:30000});
  const result=await page.evaluate(async({vehicle,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE,RAPIER}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(vehicle),weapons=g.weapons(),crowd=g.pedestrians(),sim=g.sim,head=g.render().nativeCharacter.headPosition();
   const probes:any[]=[];
   for(const delta of [0,.1,-.05])for(const side of [{x:1,z:0},{x:-1,z:0},{x:0,z:1},{x:0,z:-1}]){
    const aim={x:head.x,y:head.y+delta,z:head.z},source={x:aim.x+side.x*8,y:aim.y,z:aim.z+side.z*8},direction={x:-side.x,y:0,z:-side.z},physical=weapons.ray(source,direction,20,sim.playerBody);
    const hit=crowd.seatedShot(source,direction,20,{handle:-9999},physical?.collider.parent(),{distance:physical?.timeOfImpact??20,tyre:false});
    if(hit?.victim===sim.player)probes.push({aim,source,direction,firstBody:physical?.collider.parent()?.handle,firstDistance:physical?.timeOfImpact});
   }
   if(!probes.length)throw Error(`No native vehicle/head handoff line for ${c.model}:${c.seat}`);
   const q=probes[0],trace=(own:any={handle:-9999},body:any=v.car.body)=>crowd.seatedShot(q.source,q.direction,20,own,body,{distance:q.firstDistance,tyre:false});
   sim.player.health=100;sim.player.armour=50;trace()!.hit(25,22);const armour=sim.player.armour,health=sim.player.health,piece=sim.damageEvents.at(-1)?.piece;
   const ownExcluded=trace(v)?.victim!==sim.player;m.runtime.world.setPedCanBeShotInVehicle(1,false);const proof=trace()?.victim!==sim.player;
   m.runtime.world.setPedCanBeShotInVehicle(1,true);
   const wall=sim.world.createCollider(RAPIER.ColliderDesc.cuboid(.3,.5,.3).setTranslation((q.source.x+q.aim.x)/2,q.aim.y,(q.source.z+q.aim.z)/2));sim.world.step();
   const obstruction=weapons.ray(q.source,q.direction,20,sim.playerBody),blocked=crowd.seatedShot(q.source,q.direction,20,{handle:-9999},obstruction?.collider.parent(),{distance:obstruction?.timeOfImpact??20,tyre:false})?.victim!==sim.player;
   sim.world.removeCollider(wall,true);sim.world.step();
   let realCop:any;
   if(c.model===492&&c.seat==='driver'){
    const id=await crowd.spawnOfficer('lapd1',22,{x:q.source.x,y:q.source.y-1.6,z:q.source.z},0),cop=crowd.people.find((p:any)=>p.id===id);if(!cop?.weapon)throw Error('Missing cop muzzle fixture');cop.mission=true;cop.gunAccuracy=100;
    const eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},offset=new THREE.Vector3(q.aim.x-eye.x,q.aim.y-eye.y,q.aim.z-eye.z);
    sim.player.health=100;sim.player.armour=50;
    let steps=0;for(;steps<180&&sim.player.armour===50;steps++)crowd.stepPedGun(cop,cop.weapon,eye,q.aim,offset,[v],1/30,true);
    const hitArmour=sim.player.armour,copPiece=sim.damageEvents.at(-1)?.piece;m.runtime.world.setPedCanBeShotInVehicle(1,false);sim.player.health=100;sim.player.armour=50;const carBefore=v.health;
    for(let i=0;i<60;i++)crowd.stepPedGun(cop,cop.weapon,eye,q.aim,offset,[v],1/30,true);
    realCop={steps,hitArmour,copPiece,protectedArmour:sim.player.armour,protectedHealth:sim.player.health,carBefore,carAfter:v.health};crowd.removeScripted(cop);
   }
   m.runtime.world.setPedCanBeShotInVehicle(1,true);
   return {...c,probes:probes.length,armour,health,piece,ownExcluded,proof,blocked,collider:sim.playerCollider.isEnabled(),realCop};
  },{vehicle,c});results.push(result);
  await page.evaluate(vehicle=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.warpPedFromCarToCoord(1,2495,-1687,13.3);w.deleteVehicle(vehicle);},vehicle);
 }
 writeFileSync('artifacts/player-seat-shot.json',JSON.stringify({results,errors},null,2));
 // AccountForPedDamageStats scales CJ's damage by the native float32 0.33 before armour absorbs it.
 for(const r of results){expect(r.probes).toBeGreaterThan(0);expect(r.collider).toBe(false);expect(r.armour).toBeCloseTo(50-25*Math.fround(.33),5);expect(r.health).toBe(100);expect(r.piece).toBe(9);expect(r.ownExcluded&&r.proof&&r.blocked).toBe(true);if(r.realCop){expect(r.realCop.steps).toBeLessThan(180);expect(r.realCop.hitArmour).toBeLessThan(50);expect(r.realCop.copPiece).toBe(9);expect(r.realCop.protectedArmour).toBe(50);expect(r.realCop.protectedHealth).toBe(100);expect(r.realCop.carAfter).toBeLessThan(r.realCop.carBefore);}}
 expect(errors).toEqual([]);
});
