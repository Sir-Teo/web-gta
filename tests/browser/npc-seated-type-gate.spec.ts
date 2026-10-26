import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real officer muzzles retain actual ped types through seated hits, while vehicle creators bypass the ped-type gate',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,true),car);
 const results:any[]=[];
 for(const c of [{type:6,model:'MALE01',blocked:true},{type:4,model:'LAPD1',blocked:false},{type:4,model:'MALE01',blocked:false}]){
  const ped=await page.evaluate(({car,c})=>(window as any).__game.missionForProfiling().peds.createInCar(c.type,c.model,car,'driver'),{car,c});
  await page.waitForFunction(h=>{const g=(window as any).__game,m=g.missionForProfiling();return g.weapons().seatedPeds().some((t:any)=>t.rider===m.peds.entity(h)&&!!t.head);},ped,{timeout:45000});
  results.push(await page.evaluate(async({ped,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE,RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireNpcMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),crowd=g.pedestrians(),rider=m.peds.entity(ped);
   host.setPedHealth(ped,10000);host.setPedSuffersCriticalHits(ped,false);const target=w.seatedPeds().find((t:any)=>t.rider===rider),head=target.head,car=target.car;
   const axes=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}],ray=axes.map(direction=>({direction,source:{x:head.x-direction.x*6,y:head.y+.1,z:head.z-direction.z*6}})).find(r=>{const hit=w.npcBulletLine(r.source,r.direction,20,g.sim.playerBody);return crowd.seatedShot(r.source,r.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false})?.victim===rider;});
   if(!ray)throw Error('No exposed seated head line');const id=await crowd.spawnOfficer('lapd1',22,{x:ray.source.x,y:ray.source.y-1.6,z:ray.source.z},0),cop=crowd.people.find((p:any)=>p.id===id);if(!cop?.weapon)throw Error('No officer gun');cop.mission=true;cop.gunAccuracy=100;
   const fx=w.fx.effects,oldBlood=fx.blood,oldAudio=w.onPedBulletHit,oldShot=crowd.onShot,oldSeat=crowd.seatedShot,blood:any[]=[],contacts:any[]=[],audio:any[]=[];let shots=0,removed=false;
   fx.blood=function(...args:any[]){blood.push({count:args[2],health:rider.health});return oldBlood.apply(this,args);};w.onPedBulletHit=(...args:any[])=>{audio.push(args);oldAudio?.(...args);};crowd.onShot=(...args:any[])=>{if(args[4]?.id===`ped:${cop.id}`)shots++;oldShot?.(...args);};crowd.seatedShot=(...args:any[])=>{const hit=oldSeat?.(...args);if(hit?.victim===rider)contacts.push({id:args[5]?.shooter?.id,type:args[5]?.shooter?.pedType});return hit;};
   try{
    const aim={...w.seatedPeds().find((t:any)=>t.rider===rider).head};aim.y+=.1;const eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),carBefore=car.health;
    for(let i=0;i<180&&shots===0;i++)crowd.stepPedGun(cop,cop.weapon,eye,aim,offset,[car],1/30,true);
    const row:any={...c,shots,contacts:[...contacts],blood:[...blood],audio:audio.length,health:rider.health,carDamage:carBefore-car.health,sourceId:cop.id,pedType:target.pedType};
    crowd.removeScripted(cop);removed=true;
    if(c.blocked){blood.length=0;audio.length=0;const before=rider.health;row.mounted={fired:fireNpcMountedAt(g,ray.source,ray.direction,RAPIER),before,after:rider.health,blood:[...blood],audio:audio.length,carDamage:carBefore-car.health};}
    return row;
   }finally{fx.blood=oldBlood;w.onPedBulletHit=oldAudio;crowd.onShot=oldShot;crowd.seatedShot=oldSeat;if(!removed)crowd.removeScripted(cop);}
  },{ped,c}));await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),ped);
 }
 writeFileSync('artifacts/npc-seated-type-gate.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.shots).toBe(1);expect(r.contacts).toContainEqual({id:r.sourceId,type:'COP'});expect(r.carDamage).toBe(0);expect(r.blood.map((b:any)=>b.count)).toEqual(r.blocked?[]:[16]);expect(r.audio).toBe(r.blocked?0:1);if(r.blocked){expect(r.health).toBe(10000);expect(r.mounted.fired).toBe(true);expect(r.mounted.after).toBeLessThan(r.mounted.before);expect(r.mounted.blood.map((b:any)=>b.count)).toEqual([16]);expect(r.mounted.audio).toBe(1);expect(r.mounted.carDamage).toBe(0);}else expect(r.health).toBeLessThan(10000);}
 expect(errors).toEqual([]);
});
