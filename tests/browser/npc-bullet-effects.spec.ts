import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('real NPC muzzles emit accepted blood with native pieces, proof/type gates and once-only death stats',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const cases=[{type:4,model:'MALE01',weapon:22,piece:3,health:10000,count:8},{type:4,model:'MALE01',weapon:22,piece:9,health:10000,count:16},{type:4,model:'MALE01',weapon:22,piece:9,health:1,count:32},{type:4,model:'MALE01',weapon:25,piece:3,health:10000,count:4},{type:4,model:'MALE01',weapon:22,piece:9,health:10000,block:'proof',count:0},{type:4,model:'MALE01',weapon:22,piece:3,health:10000,block:'vest',count:0},{type:4,model:'MALE01',weapon:22,piece:3,health:10000,block:'only player',count:0},{type:6,model:'MALE01',weapon:22,piece:3,health:10000,count:0},{type:4,model:'LAPD1',weapon:22,piece:3,health:10000,count:8}],results:any[]=[];
 for(const c of cases){
  const handle=await page.evaluate(c=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(c.type,c.model,{x:p.x+10,y:-p.z,z:p.y});},c);
  await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.view.hasHitSpheres&&!p.collisionWait;},handle,{timeout:45000});
  results.push(await page.evaluate(async({handle,c})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{THREE}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),crowd=g.pedestrians(),p=m.peds.entity(handle);
   host.freezePedPosition(handle,true);host.setPedSuffersCriticalHits(handle,false);host.setPedHealth(handle,c.health);p.bulletProofVest=c.block==='vest';p.onlyDamagedByPlayer=c.block==='only player';host.setPedProofs(handle,{bullet:c.block==='proof',fire:false,explosion:false,collision:false,melee:false});
   const axes=c.piece===9?[{x:0,y:-1,z:0},{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}]:[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}],sphere=p.view.hitSpheres().find((s:any)=>s.piece===c.piece),ray=axes.map(direction=>({direction,source:{x:sphere.center.x-direction.x*4,y:sphere.center.y-direction.y*4,z:sphere.center.z-direction.z*4}})).find(r=>{const hit=w.ray(r.source,r.direction,8,g.sim.playerBody);return hit?.collider.handle===p.collider.handle&&hit.pedPiece===c.piece;});
   if(!ray)throw Error(`No exposed NPC target ${c.model}:${c.piece}`);
   const id=await crowd.spawnOfficer('lapd1',c.weapon,{x:ray.source.x,y:ray.source.y-1.6,z:ray.source.z},0),cop=crowd.people.find((p:any)=>p.id===id);if(!cop?.weapon)throw Error('No actual cop gun');cop.mission=true;cop.gunAccuracy=100;
   const fx=w.fx.effects,oldBlood=fx.blood,oldKill=crowd.onKill,oldShot=crowd.onShot,oldPrepare=crowd.prepareBulletImpact,oldAudio=w.onBulletHit,audio:any[]=[],blood:any[]=[],kills:any[]=[],impacts:any[]=[],paths:any[]=[];let shots=0;
   w.onBulletHit=(...args:any[])=>{if(args[0].collider.handle===p.collider.handle)audio.push(p.health);oldAudio?.(...args);};fx.blood=function(...args:any[]){blood.push({count:args[2],health:p.health});return oldBlood.apply(this,args);};crowd.onKill=(event:any)=>{if(event.id===p.id)kills.push(event);oldKill?.(event);};crowd.onShot=(...args:any[])=>{if(args[4]?.id===`ped:${cop.id}`){shots++;paths.push({from:{...args[0]},to:{...args[1]},hit:args[3]});}oldShot?.(...args);};crowd.prepareBulletImpact=(...args:any[])=>{const finish=oldPrepare?.(...args);if(args[0].collider.handle!==p.collider.handle)return finish;return (accepted:boolean)=>{impacts.push({piece:args[0].pedPiece,accepted});finish?.(accepted);};};
   try{
    const before=m.runtime.game.stats.get(120),eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},aim={...p.view.hitSpheres().find((s:any)=>s.piece===c.piece).center},offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z);let steps=0;
    for(;steps<180&&shots===0;steps++)crowd.stepPedGun(cop,cop.weapon,eye,aim,offset,[],1/30,true);
    // Follow a real fatal muzzle hit with two more hits through the live corpse adapter: neither counts a new kill.
    if(c.health===1&&p.health===0)for(let i=0;i<2;i++)crowd.npcBulletHit(p.collider.handle,10,c.weapon,{x:ray.direction.x,z:ray.direction.z},new THREE.Vector3(aim.x,aim.y,aim.z),c.piece);
    return {...c,shots,steps,blood,audio,kills,impacts,paths,aim,position:{...p.actor.player.position},after:p.health,weakness:p.defendMult,others:m.runtime.game.stats.get(120)-before,base:cop.weapon.info.damage};
   }finally{fx.blood=oldBlood;crowd.onKill=oldKill;crowd.onShot=oldShot;crowd.prepareBulletImpact=oldPrepare;w.onBulletHit=oldAudio;crowd.removeScripted(cop);}
  },{handle,c}));
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),handle);
 }
 writeFileSync('artifacts/npc-bullet-effects.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.audio).toHaveLength(r.type===6?0:1);expect(r.shots).toBe(1);expect(r.steps).toBeLessThan(180);expect(r.impacts).toEqual([{piece:r.piece,accepted:!!r.count}]);expect(r.blood.map((b:any)=>b.count)).toEqual(r.count?[r.count]:[]);if(r.count){expect(r.after).toBeLessThan(r.health);expect(r.blood[0].health).toBe(r.after);}else expect(r.after).toBe(r.health);expect(r.kills).toHaveLength(r.health===1?1:0);expect(r.others).toBe(r.health===1?1:0);if(r.count&&r.health>1&&r.weapon===22)expect(r.after).toBeCloseTo(r.health-r.base*r.weakness,4);}
 expect(errors).toEqual([]);
});

test('incoming NPC mounted hits emit CJ’s head blood only after accepted damage',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);await page.waitForFunction(()=>!!(window as any).__game.weapons().fx?.effects,undefined,{timeout:45000});
 const result=await page.evaluate(async()=>{
  const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireNpcMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,sim=g.sim,w=g.weapons(),head=g.render().nativeCharacter.hitSpheres().find((s:any)=>s.piece===9),own=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const ray=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}].map(direction=>({direction,source:{x:head.center.x-direction.x*4,y:head.center.y,z:head.center.z-direction.z*4}})).find(r=>{const hit=w.npcBulletLine(r.source,r.direction,8,own);return hit?.collider.handle===sim.playerCollider.handle&&hit.pedPiece===9;});if(!ray)throw Error('No CJ head ray');
  const fx=w.fx.effects,old=fx.blood,rows:any[]=[];let blood:any[]=[];fx.blood=function(...args:any[]){blood.push({count:args[2],health:sim.player.health});return old.apply(this,args);};
  try{for(const c of [{health:100,proof:false,count:16},{health:100,proof:true,count:0},{health:1,proof:false,count:32}]){sim.playerCanBeDamaged=true;sim.player.health=c.health;sim.player.armour=0;sim.playerProofs={bullet:c.proof,fire:false,explosion:false,collision:false,melee:false};blood=[];const fired=fireNpcMountedAt(g,ray.source,ray.direction,RAPIER);rows.push({...c,fired,after:sim.player.health,blood});}return rows;}finally{fx.blood=old;sim.player.health=100;sim.deathRemaining=0;sim.playerProofs=undefined;sim.world.removeRigidBody(own);}
 });
 writeFileSync('artifacts/npc-cj-bullet-effects.json',JSON.stringify({result,errors},null,2));for(const r of result){expect(r.fired).toBe(true);expect(r.blood.map((b:any)=>b.count)).toEqual(r.count?[r.count]:[]);if(r.count)expect(r.blood[0].health).toBe(r.after);else expect(r.after).toBe(r.health);}expect(errors).toEqual([]);
});
