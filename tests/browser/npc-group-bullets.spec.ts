import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real NPC groupmate muzzle hits are rejected on foot and in car/bike seats until membership is removed',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const results:any[]=[];
 for(const model of [0,492,461]){
  const car=model?await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(model,{x:p.x+9,y:-p.z,z:p.y+1},0);},model):null;
  if(car!==null){await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,true),car);}
  const victim=await page.evaluate(car=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return car===null?m.peds.create(5,'MALE01',{x:p.x+9,y:-p.z,z:p.y}):m.peds.createInCar(5,'MALE01',car,'driver');},car);
  await page.waitForFunction(({victim,model})=>{const g=(window as any).__game,m=g.missionForProfiling(),p=m.peds.entity(victim);return model?g.weapons().seatedPeds().some((t:any)=>t.rider===p&&!!t.head):p?.view.hasHitSpheres&&!p.collisionWait;},{victim,model},{timeout:45000});
  const source=await page.evaluate(({victim,model})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),w=g.weapons(),p=m.peds.entity(victim);m.runtime.world.setPedHealth(victim,10000);m.runtime.world.setPedSuffersCriticalHits(victim,false);if(!model)m.runtime.world.freezePedPosition(victim,true);
   const target=model?w.seatedPeds().find((t:any)=>t.rider===p):undefined,center=model===0?p.view.hitSpheres().find((s:any)=>s.piece===9).center:model===461?target.hitSpheres().find((s:any)=>s.piece===9).center:{...target.head,y:target.head.y+.1};
   const ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:center.x-direction.x*6,y:center.y,z:center.z-direction.z*6}})).find(r=>{const hit=w.npcBulletLine(r.source,r.direction,20,g.sim.playerBody);if(!model)return hit?.collider.handle===p.collider.handle&&hit.pedPiece===9;return g.pedestrians().seatedShot(r.source,r.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false})?.victim===p;});
   if(!ray)throw Error('No group target muzzle line');return m.peds.create(4,'MALE01',{x:ray.source.x,y:-ray.source.z,z:ray.source.y-1.6});
  },{victim,model});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),source,{timeout:45000});await page.evaluate(h=>{const g=(window as any).__game,p=g.missionForProfiling().peds.entity(h);g.missionForProfiling().runtime.world.freezePedPosition(h,true);g.pedestrians().giveWeapon(p,22,100);},source);await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h)?.weapon,source,{timeout:30000});
  results.push(await page.evaluate(async({source,victim,model})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),a=m.adapterRef,crowd=g.pedestrians(),w=g.weapons(),shooter=m.peds.entity(source),target=m.peds.entity(victim),group=a.createGroup(0);a.setGroupLeader(group,source);a.setGroupMember(group,victim);shooter.gunAccuracy=100;
   const fx=w.fx.effects,oldBlood=fx.blood,oldPed=w.onPedBulletHit,oldPhysical=w.onBulletHit,oldShot=crowd.onShot,events:any[]=[];let shots=0;
   fx.blood=function(...args:any[]){events.push({kind:'blood',count:args[2],health:target.health});return oldBlood.apply(this,args);};w.onPedBulletHit=(...args:any[])=>{if(model)events.push({kind:'audio',health:target.health});oldPed?.(...args);};w.onBulletHit=(...args:any[])=>{if(!model&&args[0].collider.handle===target.collider.handle)events.push({kind:'audio',health:target.health});oldPhysical?.(...args);};crowd.onShot=(...args:any[])=>{if(args[4]?.id===`ped:${shooter.id}`)shots++;oldShot?.(...args);};
   try{
    const fire=()=>{const t=model?w.seatedPeds().find((t:any)=>t.rider===target):undefined,aim=model===0?target.view.hitSpheres().find((s:any)=>s.piece===9).center:model===461?t.hitSpheres().find((s:any)=>s.piece===9).center:{...t.head,y:t.head.y+.1},eye={...shooter.actor.player.position,y:shooter.actor.player.position.y+1.6},offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),before=shots;for(let i=0;i<180&&shots===before;i++)crowd.stepPedGun(shooter,shooter.weapon,eye,aim,offset,model===492?[t.car]:[],1/30,true);return shots-before;};
    const grouped=crowd.sameScriptGroup(shooter,target),firstShots=fire(),blocked={health:target.health,events:[...events]};a.removePedFromGroup(victim);events.length=0;const separated=!crowd.sameScriptGroup(shooter,target),secondShots=fire();return {model,grouped,separated,firstShots,secondShots,blocked,after:target.health,events:[...events]};
   }finally{fx.blood=oldBlood;w.onPedBulletHit=oldPed;w.onBulletHit=oldPhysical;crowd.onShot=oldShot;a.removeGroup(group);}
  },{source,victim,model}));
  await page.evaluate(({source,victim,car})=>{const host=(window as any).__game.missionForProfiling().runtime.world;host.deletePed(source);host.deletePed(victim);if(car!==null)host.deleteVehicle(car);},{source,victim,car});
 }
 writeFileSync('artifacts/npc-group-bullets.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.grouped&&r.separated).toBe(true);expect(r.firstShots).toBe(1);expect(r.secondShots).toBe(1);expect(r.blocked.health).toBe(10000);expect(r.blocked.events.map((e:any)=>e.kind)).toEqual(['audio']);expect(r.after).toBeLessThan(10000);expect(r.events.map((e:any)=>e.kind)).toEqual(['audio','blood']);expect([8,16]).toContain(r.events[1].count);expect(r.events[1].health).toBe(r.after);}
 expect(errors).toEqual([]);
});
