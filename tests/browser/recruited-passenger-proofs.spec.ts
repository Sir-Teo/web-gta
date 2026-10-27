import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('a follower retains bullet protection through boarding, seated wounds and exit',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const made=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return {car:m.vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0),ped:m.peds.create(8,'FAM1',{x:p.x+5,y:-p.z,z:p.y})};});
 await page.waitForFunction(({car,ped})=>{const m=(window as any).__game.missionForProfiling();return !!m.vehicles.entity(car)&&!!m.peds.entity(ped);},made,{timeout:45000});
 const boarded=await page.evaluate(({car,ped})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(car),p=m.peds.entity(ped),entry=g.carEntry();m.runtime.world.freezeVehiclePosition(car,true);m.runtime.world.warpPedIntoCar(1,car);
  p.follow=true;p.followSlot=0;p.health=1000;p.noCriticalHits=true;p.onlyDamagedByPlayer=true;p.bulletProofVest=true;p.proofs={bullet:true,fire:false,explosion:true,collision:false,melee:false};
  const taken=g.pedestrians().boardPassenger(p.id);if(!taken)throw Error('Follower did not board');entry.passengers.push({...taken,seat:1});
  return {id:p.id,proofs:taken.keep.proofs,onlyPlayer:taken.keep.onlyDamagedByPlayer,vest:taken.keep.bulletProofVest};
 },made);
 expect(boarded).toMatchObject({proofs:{bullet:true,explosion:true},onlyPlayer:true,vest:true});
 await page.waitForFunction(car=>{const g=(window as any).__game,v=g.missionForProfiling().vehicles.entity(car);return !!g.occupants().headOf(`passenger:${v.car.body.handle}:1`);},made.car,{timeout:30000});
 const wounds=await page.evaluate(async car=>{
  const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,w=g.weapons(),v=g.missionForProfiling().vehicles.entity(car),target=w.seatedPeds().find((t:any)=>t.car===v&&t.kind==='passenger'&&t.seat===1),rider=target.rider,head=target.head;
  const axes=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}],ray=axes.map(direction=>({direction,source:{x:head.x-direction.x*6,y:head.y+.1,z:head.z-direction.z*6}})).find(r=>{const hit=w.npcBulletLine(r.source,r.direction,20,g.sim.playerBody);return g.pedestrians().seatedShot(r.source,r.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false})?.victim===rider;});
  if(!ray)throw Error('No exposed recruit head');const fx=w.fx.effects,old=fx.blood;let blood:any[]=[];fx.blood=function(...args:any[]){blood.push({count:args[2],health:rider.keep.health});return old.apply(this,args);};
  const rows:any[]=[];
  try{
   for(const c of [{name:'physical NPC',proof:true,only:true,byPlayer:false,playerDriver:false,accepted:false},{name:'physical remote',proof:true,only:true,byPlayer:true,playerDriver:false,accepted:false},{name:'only-player NPC',proof:false,only:true,byPlayer:false,playerDriver:false,accepted:false},{name:'only-player remote',proof:false,only:true,byPlayer:true,playerDriver:false,accepted:false},{name:'only-player driven vehicle',proof:false,only:true,byPlayer:true,playerDriver:true,accepted:true},{name:'exposed vested head',proof:false,only:false,byPlayer:false,playerDriver:false,accepted:true}]){
    rider.keep.proofs.bullet=c.proof;rider.keep.onlyDamagedByPlayer=c.only;const before=rider.keep.health,carBefore=v.health;blood=[];
    rows.push({...c,before,fired:fireMountedAt(g,ray.source,ray.direction,RAPIER,c.byPlayer,c.playerDriver),after:rider.keep.health,carDamage:carBefore-v.health,blood:[...blood]});
   }
   rider.keep.proofs.bullet=true;rider.keep.onlyDamagedByPlayer=true;return {rows,health:rider.keep.health};
  }finally{fx.blood=old;}
 },made.car);
 for(const r of wounds.rows){expect(r.fired).toBe(true);expect(r.carDamage).toBe(0);expect(r.blood.map((b:any)=>b.count)).toEqual(r.accepted?[16]:[]);if(r.accepted){expect(r.after).toBeLessThan(r.before);expect(r.blood[0].health).toBe(r.after);}else expect(r.after).toBe(r.before);}
 await page.waitForFunction(()=>(window as any).__game.state().terrainHold===false,undefined,{timeout:90000});await page.evaluate(()=>(window as any).__game.carEntry().abandon());
 await page.waitForFunction(id=>{const g=(window as any).__game,p=g.pedestrians().people.find((p:any)=>p.id===id);return !!p?.view.hasHitSpheres;},boarded.id,{timeout:30000});
 const exited=await page.evaluate(id=>{const p=(window as any).__game.pedestrians().people.find((p:any)=>p.id===id);return {health:p.health,proofs:p.proofs,onlyPlayer:p.onlyDamagedByPlayer,vest:p.bulletProofVest};},boarded.id);
 expect(exited).toMatchObject({health:wounds.health,proofs:{bullet:true,explosion:true},onlyPlayer:true,vest:true});
 writeFileSync('artifacts/recruited-passenger-proofs.json',JSON.stringify({boarded,wounds,exited,errors},null,2));expect(errors).toEqual([]);
});
