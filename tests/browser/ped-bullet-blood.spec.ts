import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('native blood particles use post-hit health, head/shotgun scaling and distinct sniper proof behavior',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const cases=[{weapon:22,head:false,health:10000,proof:false,count:8},{weapon:22,head:true,health:10000,proof:false,count:16},{weapon:22,head:true,health:1,proof:false,count:32},{weapon:25,head:false,health:10000,proof:false,count:4},{weapon:22,head:true,health:10000,proof:true,count:0},{weapon:34,head:true,health:10000,proof:false,count:8},{weapon:34,head:true,health:10000,proof:true,count:8}],results:any[]=[];
 for(const c of cases){
  const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+10,y:-p.z,z:p.y});});
  await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().peds.entity(h),handle,{timeout:45000});
  results.push(await page.evaluate(({handle,c})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),p=m.peds.entity(handle),q=p.actor.player.position;
   host.freezePedPosition(handle,true);host.setPedSuffersCriticalHits(handle,false);host.setPedHealth(handle,c.health);host.setPedProofs(handle,{bullet:c.proof,fire:false,explosion:false,collision:false,melee:false});
   const at={x:q.x,y:q.y+(c.head?1.6:1.1),z:q.z},ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:at.x-direction.x*6,y:at.y,z:at.z-direction.z*6}})).find(r=>w.ray(r.source,r.direction,12,g.sim.playerBody)?.collider.handle===p.collider.handle);
   if(!ray)throw Error('No clear pedestrian bullet line');
   const fx=w.fx,oldBlood=fx.effects.blood,oldMuzzle=w.muzzle,oldSpread=w.aimSpread,oldRandom=Math.random,blood:any[]=[];
   fx.effects.blood=function(...args:any[]){blood.push({count:args[2],health:p.health});return oldBlood.apply(this,args);};w.muzzle=()=>ray.source;w.aimSpread=(d:any)=>d;
   try{
    Math.random=()=>.5;w.inventory.give(c.weapon,100);w.inventory.select(c.weapon);w.inventory.cooldown=0;w.firstPerson=c.weapon===34?'sniper':undefined;w.aiming=true;
    const fired=w.fire({origin:ray.source,direction:ray.direction});if(c.weapon===34)w.tick(1/60);
    return {...c,fired,blood,after:p.health,weakness:p.defendMult};
   }finally{fx.effects.blood=oldBlood;w.muzzle=oldMuzzle;w.aimSpread=oldSpread;Math.random=oldRandom;w.firstPerson=undefined;}
  },{handle,c}));
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),handle);
 }
 writeFileSync('artifacts/ped-bullet-blood.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.fired).toBe(true);expect(r.blood.map((b:any)=>b.count)).toEqual(r.count?[r.count]:[]);if(r.proof)expect(r.after).toBe(r.health);else expect(r.after).toBeLessThan(r.health);if(r.blood.length)expect(r.blood[0].health).toBe(r.after);if(r.count===32)expect(r.after).toBe(0);}
 expect(errors).toEqual([]);
});
