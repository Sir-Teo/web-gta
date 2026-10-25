import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import {CRIME} from '../../src/simulation/nativeWanted';

test('native victim types control kill counters, cop threat reporting and cash drops across damage paths',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const cases=[{type:6,model:'MALE01',name:'COP',cause:'bullet',byPlayer:true,cash:0},{type:4,model:'LAPD1',name:'CIVMALE',cause:'fire',byPlayer:true,cash:100},{type:7,model:'MALE01',name:'GANG1',gang:0,cause:'npc',byPlayer:false,cash:100},{type:8,model:'MALE01',name:'GANG2',gang:1,cause:'npc',byPlayer:false,cash:100},{type:18,model:'MALE01',name:'MEDIC',cause:'bullet',byPlayer:true,cash:0},{type:19,model:'MALE01',name:'FIREMAN',cause:'fire',byPlayer:false,cash:0},{type:17,model:'MALE01',name:'DEALER',cause:'bullet',byPlayer:true,cash:100},{type:20,model:'MALE01',name:'CRIMINAL',cause:'bullet',byPlayer:true,cash:100}],results:any[]=[];
 for(const c of cases){
  const handle=await page.evaluate(c=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(c.type,c.model,{x:p.x+8,y:-p.z,z:p.y});},c);
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),handle,{timeout:45000});
  const result=await page.evaluate(async({handle,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,crowd=g.pedestrians(),p=m.peds.entity(handle),position={...p.actor.player.position},stats=m.runtime.game.stats;
   w.freezePedPosition(handle,true);w.setPedSuffersCriticalHits(handle,false);w.setPedMoney(handle,100);w.setPedHealth(handle,1);
   const probe=(window as any).__pedTypeVictim={id:p.id,kills:[]as any[],drops:[]as number[]};
   const oldKill=crowd.onKill,oldDrop=crowd.onDropMoney;crowd.onKill=(event:any)=>{if(event.id===p.id)probe.kills.push(event);oldKill?.(event);};crowd.onDropMoney=(at:any,amount:number)=>{if(Math.hypot(at.x-position.x,at.z-position.z)<1)probe.drops.push(amount);oldDrop?.(at,amount);};
   (window as any).__pedTypeVictimRestore=()=>{crowd.onKill=oldKill;crowd.onDropMoney=oldDrop;};
   let aimed:any[]=[];
   if(c.type===6||c.type===4){const law=crowd.law,old=law.crime,heading=p.actor.player.heading;law.crime=function(...args:any[]){aimed.push(args);return old.apply(this,args);};try{crowd.gunAimedAt(p.collider.handle,{x:position.x+Math.sin(heading)*5,y:position.y,z:position.z+Math.cos(heading)*5});}finally{law.crime=old;}}
   const counters=()=>({friendly:stats.get(240),enemy:stats.get(239),others:stats.get(120),player:stats.get(121)}),before=counters();
   if(c.cause==='npc')crowd.bulletHit(p.collider.handle,10,22,{x:0,z:1},new THREE.Vector3(position.x,position.y+1,position.z));
   else crowd.damageCollider(p.collider.handle,1000,{x:0,z:1},c.cause==='fire'?'fire':'bullet',{weapon:c.cause==='fire'?37:22,point:{x:position.x,y:position.y+1,z:position.z},byPlayer:c.byPlayer});
   const after=counters();return {...c,id:p.id,dead:p.health===0,kills:probe.kills,aimed,delta:Object.fromEntries(Object.keys(before).map(k=>[k,after[k as keyof typeof after]-before[k as keyof typeof before]]))};
  },{handle,c});
  await page.waitForFunction(h=>(window as any).__game.missionForProfiling().peds.entity(h)?.dropped===true,handle,{timeout:30000});
  const drops=await page.evaluate(()=>{const p=(window as any).__pedTypeVictim;(window as any).__pedTypeVictimRestore();return p.drops;});results.push({...result,drops});
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),handle);
 }
 writeFileSync('artifacts/ped-type-victim.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.dead).toBe(true);expect(r.kills).toHaveLength(1);expect(r.kills[0]).toMatchObject({id:r.id,pedType:r.name,officer:r.name==='COP',byPlayer:r.byPlayer});expect(r.kills[0].gang).toBe(r.gang);expect(r.drops).toEqual(r.cash?[r.cash]:[]);expect(r.delta.player).toBe(r.byPlayer?1:0);expect(r.delta.others).toBe(r.byPlayer?0:1);expect(r.delta.friendly).toBe(r.gang===1?1:0);expect(r.delta.enemy).toBe(r.gang!==undefined&&r.gang!==1?1:0);if(r.type===6)expect(r.aimed.some((a:any[])=>a[0]===CRIME.aimGun)).toBe(true);if(r.type===4)expect(r.aimed.some((a:any[])=>a[0]===CRIME.aimGun)).toBe(false);}
 expect(errors).toEqual([]);
});
