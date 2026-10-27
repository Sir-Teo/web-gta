import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('mission rider bullets report one native-type kill with creator and player-group accounting',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().vehicles.create(492,{x:p.x+8,y:-p.z,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:45000});await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.freezeVehiclePosition(h,true),car);
 const cases=[{type:4,creator:'npc',crew:false},{type:8,creator:'npc',crew:true},{type:6,creator:'ped',crew:false},{type:8,creator:'ped',crew:true},{type:7,creator:'ped',crew:false},{type:4,creator:'vehicle',crew:false},{type:4,creator:'remote',crew:false}],results:any[]=[];
 for(const c of cases){
  const ped=await page.evaluate(({car,c})=>(window as any).__game.missionForProfiling().peds.createInCar(c.type,'MALE01',car,'driver'),{car,c});
  await page.waitForFunction(h=>{const g=(window as any).__game,m=g.missionForProfiling();return g.weapons().seatedPeds().some((t:any)=>t.rider===m.peds.entity(h)&&!!t.head);},ped,{timeout:45000});
  results.push(await page.evaluate(async({ped,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),stats=m.runtime.game.stats;
   stats.set(64,1000);if(c.crew)m.adapterRef.setGroupMember(m.adapterRef.getPlayerGroup(0),ped);
   host.setPedHealth(ped,1);host.setPedSuffersCriticalHits(ped,false);const rider=m.peds.entity(ped),target=w.seatedPeds().find((t:any)=>t.rider===rider),head=target.head;
   const axes=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}],ray=axes.map(direction=>({direction,source:{x:head.x-direction.x*6,y:head.y+.1,z:head.z-direction.z*6}})).find(r=>{const hit=w.npcBulletLine(r.source,r.direction,20,g.sim.playerBody);return g.pedestrians().seatedShot(r.source,r.direction,20,{handle:-9999},hit?.collider.parent(),{distance:hit?.timeOfImpact??20,tyre:false})?.victim===rider;});
   if(!ray)throw Error('No mission head line');const snapshot=()=>Object.fromEntries([120,121,176,163,239,240,68].map(id=>[id,stats.get(id)])),fire=()=>c.creator==='ped'?w.damageSeated(target,25,22,false,9,'ped'):fireMountedAt(g,ray.source,ray.direction,RAPIER,c.creator!=='npc',c.creator==='vehicle');
   const fx=w.fx.effects,old=fx.blood,blood:any[]=[];fx.blood=function(...args:any[]){blood.push({count:args[2],health:rider.health});return old.apply(this,args);};
   try{
    stats.set(68,50);const before=snapshot();host.setPedProofs(ped,{bullet:true,fire:false,explosion:false,collision:false,melee:false});fire();const protectedHealth=rider.health,protectedStats=snapshot();
    host.setPedProofs(ped,{bullet:false,fire:false,explosion:false,collision:false,melee:false});const fired=fire(),after=snapshot(),dead=host.pedIsDeadForScript(ped);
    // A stale accepted contact may reach the old record again; only the live-to-dead transition reports a kill.
    w.onSeatedShot(target,25,22,9,c.creator==='npc'?'remote':c.creator);w.onSeatedShot(target,25,22,9,c.creator==='npc'?'remote':c.creator);
    return {...c,ped,pedType:target.pedType,member:!!target.crew,protectedHealth,protectedStats,before,after,repeated:snapshot(),fired:fired??null,dead,health:rider.health,blood};
   }finally{fx.blood=old;}
  },{ped,c}));
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),ped);
 }
 writeFileSync('artifacts/script-rider-kill-accounting.json',JSON.stringify({results,errors},null,2));
 for(const r of results){
  expect(r.member).toBe(r.crew);expect(r.protectedHealth).toBe(1);expect(r.protectedStats).toEqual(r.before);expect(r.dead).toBe(true);expect(r.health).toBe(0);expect(r.repeated).toEqual(r.after);
  const player=r.creator==='ped',vehicle=r.creator==='vehicle',diff=(id:number)=>r.after[id]-r.before[id];expect(diff(120)).toBe(!player&&!vehicle?1:0);expect(diff(121)).toBe(player||vehicle?1:0);expect(diff(176)).toBe(player?1:0);expect(diff(163)).toBe(r.crew?1:0);
  expect(diff(240)).toBe(r.type===8?1:0);expect(diff(239)).toBe(r.type===7?1:0);expect(diff(68)).toBe(player?r.type===6?1.5:r.type===8?-5:r.type===7?.75:0:r.crew?-2:0);
  expect(r.blood.map((b:any)=>b.count)).toEqual(player?[]:[32]);
 }
 expect(errors).toEqual([]);
});
