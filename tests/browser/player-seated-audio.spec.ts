import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('player pistol and flying sniper seated contacts keep native damage, blood and sound order',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const results:any[]=[];
 for(const model of [492,461])for(const weapon of [22,34])for(const proof of [false,true]){
  const car=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+8,y:-p.z,z:p.y+1},0);},model);await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});
  const ped=await page.evaluate(car=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.freezeVehiclePosition(car,true);return m.peds.createInCar(4,'MALE01',car,'driver');},car);
  await page.waitForFunction(h=>{const g=(window as any).__game,m=g.missionForProfiling();return g.weapons().seatedPeds().some((t:any)=>t.rider===m.peds.entity(h)&&!!t.head);},ped,{timeout:45000});
  const result=await page.evaluate(async({car,ped,model,weapon,proof})=>{
   const geometry='/src/combat/nativePedHitSpheres.ts',{pedSphereHit}=await import(/* @vite-ignore */ geometry),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),v=m.vehicles.entity(car),r=m.peds.entity(ped),target=w.seatedPeds().find((t:any)=>t.rider===r),piece=model===461?3:9,spheres=model===461?target.hitSpheres():undefined,center=spheres?spheres.find((s:any)=>s.piece===3).center:{...target.head,y:target.head.y+.1};
   host.setPedHealth(ped,10000);host.setPedSuffersCriticalHits(ped,false);host.setPedProofs(ped,{bullet:proof,fire:false,explosion:false,collision:false,melee:false});
   const axes=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}],ray=axes.map(direction=>({direction,source:{x:center.x-direction.x*6,y:center.y,z:center.z-direction.z*6}})).find(q=>{if(spheres&&pedSphereHit(q.source,q.direction,12,spheres)?.piece!==piece)return false;const hit=w.ray(q.source,q.direction,12,g.sim.playerBody),seat=spheres?w.bikerHit(q.source,q.direction,hit?.timeOfImpact??12,g.sim.playerBody):w.seatedHit(q.source,q.direction,12,hit?.collider.parent(),g.sim.playerBody);return seat?.target.rider===r;});
   if(!ray)throw Error('No player seat contact');const start={...g.sim.player.position},fx=w.fx.effects,oldBlood=fx.blood,oldAudio=w.onPedBulletHit,oldDamage=w.onSeatedShot,oldMuzzle=w.muzzle,oldSpread=w.aimSpread,events:any[]=[];
   fx.blood=function(...args:any[]){events.push({kind:'blood',count:args[2],health:r.health});return oldBlood.apply(this,args);};w.onPedBulletHit=(...args:any[])=>{events.push({kind:'audio',angle:args[1],health:r.health});oldAudio?.(...args);};w.onSeatedShot=(...args:any[])=>{if(args[0].rider===r)events.push({kind:'damage',health:r.health});return oldDamage?.(...args);};w.muzzle=()=>ray.source;w.aimSpread=(direction:any)=>direction;
   try{
    g.placePlayer(ray.source.x,ray.source.y-1.3,ray.source.z);w.inventory.give(weapon,100);w.inventory.select(weapon);w.inventory.cooldown=0;w.firstPerson=weapon===34?'sniper':undefined;w.aiming=true;
    const before=v.health,fired=w.fire({origin:ray.source,direction:ray.direction});if(weapon===34)w.tick(1/60);
    return {model,weapon,proof,piece,fired,after:r.health,carDamage:before-v.health,events,weaponClock:w.nowMs};
   }finally{fx.blood=oldBlood;w.onPedBulletHit=oldAudio;w.onSeatedShot=oldDamage;w.muzzle=oldMuzzle;w.aimSpread=oldSpread;w.firstPerson=undefined;g.placePlayer(start.x,start.y,start.z);}
  },{car,ped,model,weapon,proof});results.push(result);
  if(weapon===34)await page.waitForFunction(at=>(window as any).__game.weapons().nowMs>at+1100,result.weaponClock,{timeout:30000});
  await page.evaluate(({car,ped})=>{const host=(window as any).__game.missionForProfiling().runtime.world;host.deletePed(ped);host.deleteVehicle(car);},{car,ped});
 }
 writeFileSync('artifacts/player-seated-audio.json',JSON.stringify({results,errors},null,2));
 for(const r of results){
  expect(r.fired).toBe(true);expect(r.carDamage).toBe(0);expect(r.after).toBe(r.proof?10000:10000-(r.weapon===34?125:25)*1.1);
  expect(r.events.map((e:any)=>e.kind)).toEqual(r.weapon===34?['damage','blood','audio']:r.proof?['audio','damage']:['audio','damage','blood']);
  const audio=r.events.find((e:any)=>e.kind==='audio');expect(audio.angle).toBeCloseTo(90,3);expect(audio.health).toBe(r.weapon===34?r.after:10000);
  const blood=r.events.find((e:any)=>e.kind==='blood');if(blood){expect(blood.count).toBe(r.weapon===34||r.piece!==9?8:16);expect(blood.health).toBe(r.after);}
 }
 expect(errors).toEqual([]);
});
