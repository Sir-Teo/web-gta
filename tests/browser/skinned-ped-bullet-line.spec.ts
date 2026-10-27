import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('original on-foot models take native body-piece shots and capsule gaps stay clear in idle and raised-arm poses',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const results:any[]=[];
 for(const model of ['MALE01','LAPD1','FAM1'])for(const pose of ['idle','handsup']){
  const handle=await page.evaluate(model=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(4,model,{x:p.x+10,y:-p.z,z:p.y});},model);
  await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.view.hasHitSpheres&&!p.collisionWait&&p.collider.isEnabled()&&!p.collider.isSensor();},handle,{timeout:45000});
  results.push(await page.evaluate(async({handle,model,pose})=>{
   const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,w=g.weapons(),crowd=g.pedestrians(),p=m.peds.entity(handle),q=p.actor.player.position;
   host.freezePedPosition(handle,true);host.setPedSuffersCriticalHits(handle,true);
   const playerStart={...g.sim.player.position},oldMuzzle=w.muzzle,oldSpread=w.aimSpread,oldDamage=crowd.damageCollider,damages:any[]=[];w.aimSpread=(d:any)=>d;
   crowd.damageCollider=function(...args:any[]){if(args[0]===p.collider.handle)damages.push({piece:args[4]?.piece,amount:args[1]});return oldDamage.apply(this,args);};
   const sample=()=>{if(pose==='handsup'){if(!p.view.hasReaction('handsup'))throw Error('No handsup clip');p.view.playReaction('handsup',Infinity);}else p.view.clearReaction();p.view.step(.5,{x:0,y:0,cameraYaw:p.actor.player.heading,walk:true,sprint:false,jump:false},p.actor);};
   const axes=[{x:0,y:0,z:1},{x:0,y:0,z:-1},{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:-1,z:0},{x:0,y:1,z:0}];
   const find=(piece:number)=>{for(const s of p.view.hitSpheres().filter((s:any)=>s.piece===piece))for(const direction of axes)for(const dx of [0,-.6,.6])for(const dy of [0,-.6,.6]){const at={x:s.center.x+dx*s.radius,y:s.center.y+dy*s.radius,z:s.center.z},source={x:at.x-direction.x*4,y:at.y-direction.y*4,z:at.z-direction.z*4},hit=w.ray(source,direction,8,g.sim.playerBody);if(hit?.collider.handle===p.collider.handle&&hit.pedPiece===piece)return {source,direction,piece,hitY:source.y+direction.y*hit.timeOfImpact-q.y};}throw Error(`No exposed piece ${piece} on ${model}/${pose}`);};
   const fire=(ray:any,weapon=22)=>{g.placePlayer(ray.source.x,ray.source.y-1.3,ray.source.z);w.muzzle=()=>ray.source;w.inventory.give(weapon,100);w.inventory.select(weapon);w.inventory.cooldown=0;w.firstPerson=weapon===34?'sniper':undefined;w.aiming=true;const fired=w.fire({origin:ray.source,direction:ray.direction});if(weapon===34)for(let i=0;i<3;i++)w.tick(1/60);w.firstPerson=undefined;return fired;};
   try{
    sample();const sphereCount=p.view.hitSpheres().length,rows:any[]=[];
    for(const piece of [3,5,8]){host.setPedHealth(handle,1000);sample();const ray=find(piece),before=damages.length,fired=fire(ray);rows.push({...ray,fired,after:p.health,damage:damages.slice(before)});}
    host.setPedHealth(handle,1000);sample();const torso=find(3),wall=g.sim.world.createCollider(RAPIER.ColliderDesc.ball(.3).setTranslation(torso.source.x+torso.direction.x*2,torso.source.y+torso.direction.y*2,torso.source.z+torso.direction.z*2));g.sim.world.step();const covered=w.ray(torso.source,torso.direction,8,g.sim.playerBody)?.collider.handle===wall.handle;g.sim.world.removeCollider(wall,true);g.sim.world.step();
    let gap:any;
    for(let height=.1;height<1.9&&!gap;height+=.05)for(const across of [-.29,-.2,0,.2,.29])for(const direction of axes.filter(d=>d.y===0)){const source={x:q.x-direction.x*4+direction.z*across,y:q.y+height,z:q.z-direction.z*4-direction.x*across},raw=g.sim.world.castRay(new RAPIER.Ray(source,direction),8,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,g.sim.playerCollider,g.sim.playerBody),native=w.ray(source,direction,8,g.sim.playerBody);if(raw?.collider.handle===p.collider.handle&&native?.collider.handle!==p.collider.handle){gap={source,direction};break;}}
    if(!gap)throw Error(`No capsule gap on ${model}/${pose}: ${JSON.stringify({position:q,body:p.body.translation(),sensor:p.collider.isSensor(),shape:p.collider.shapeType(),spheres:p.view.hitSpheres()})}`);const beforeGap=p.health,gapFired=fire(gap),gapUnharmed=p.health===beforeGap;
    host.setPedHealth(handle,1000);sample();const sniperLine=find(3),beforeSniper=damages.length,sniperFired=fire(sniperLine,34),sniper={fired:sniperFired,after:p.health,damage:damages.slice(beforeSniper)};
    host.setPedHealth(handle,1000);sample();const head=find(9),headFired=fire(head),headHealth=p.health;
    return {model,pose,sphereCount,weakness:p.defendMult,rows,covered,gapFired,gapUnharmed,sniper,headFired,headHealth};
   }finally{w.muzzle=oldMuzzle;w.aimSpread=oldSpread;crowd.damageCollider=oldDamage;w.firstPerson=undefined;g.placePlayer(playerStart.x,playerStart.y,playerStart.z);}
  },{handle,model,pose}));
  await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deletePed(h),handle);
 }
 writeFileSync('artifacts/skinned-ped-bullet-line.json',JSON.stringify({results,errors},null,2));
 for(const r of results){expect(r.sphereCount).toBe(12);for(const row of r.rows){expect(row.fired).toBe(true);expect(row.after).toBeCloseTo(1000-25*r.weakness,4);expect(row.damage).toEqual([{piece:row.piece,amount:25}]);}expect(r.covered&&r.gapFired&&r.gapUnharmed).toBe(true);expect(r.sniper.fired).toBe(true);expect(r.sniper.after).toBeCloseTo(1000-125*r.weakness,4);expect(r.sniper.damage).toEqual([{piece:3,amount:125}]);expect(r.headFired).toBe(true);expect(r.headHealth).toBe(0);}
 expect(results.some(r=>r.pose==='handsup'&&r.rows.find((row:any)=>row.piece===5).hitY>=1.45)).toBe(true);expect(errors).toEqual([]);
});

test('incoming mounted and cop rounds hit CJ’s native on-foot pieces with cover, gaps and proof flags',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});await endStoryMission(page);
 const result=await page.evaluate(async()=>{
  const dep='/tests/fixtures/native-render-dependencies.ts',{RAPIER,THREE}=await import(/* @vite-ignore */ dep),probe='/tests/fixtures/fireNpcMountedAt.ts',{fireNpcMountedAt}=await import(/* @vite-ignore */ probe),g=(window as any).__game,sim=g.sim,w=g.weapons(),crowd=g.pedestrians(),view=g.render().nativeCharacter,spheres=view.hitSpheres(),own=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  const characterModule='/src/render/NativeCharacter.ts',{NativeCharacter}=await import(/* @vite-ignore */ characterModule),fresh=new NativeCharacter(view.source),beforePose=fresh.hasHitSpheres;
  fresh.update(sim,1);const readiness={before:beforePose,after:fresh.hasHitSpheres,spheres:fresh.hitSpheres().length};fresh.dispose();
  sim.playerCanBeDamaged=true;sim.playerProofs=undefined;const axes=[{x:1,y:0,z:0},{x:-1,y:0,z:0},{x:0,y:0,z:1},{x:0,y:0,z:-1}];
  const find=(piece:number)=>{for(const s of spheres.filter((s:any)=>s.piece===piece))for(const direction of axes){const source={x:s.center.x-direction.x*4,y:s.center.y,z:s.center.z-direction.z*4},hit=w.npcBulletLine(source,direction,8,own);if(hit?.collider.handle===sim.playerCollider.handle&&hit.pedPiece===piece)return {source,direction,piece};}throw Error(`No CJ piece ${piece}`);};
  const shot=(ray:any)=>{sim.player.health=100;sim.player.armour=1000;const before=sim.damageEvents.length,fired=fireNpcMountedAt(g,ray.source,ray.direction,RAPIER);return {fired,loss:1000-sim.player.armour,event:sim.damageEvents.slice(before).map((e:any)=>({piece:e.piece,weapon:e.weapon}))};};
  try{
   const rows=[3,5,7,9].map(piece=>({piece,...shot(find(piece))})),torso=find(3),wall=sim.world.createCollider(RAPIER.ColliderDesc.ball(.3).setTranslation(torso.source.x+torso.direction.x*2,torso.source.y,torso.source.z+torso.direction.z*2));sim.world.step();const cover=shot(torso);sim.world.removeCollider(wall,true);sim.world.step();
   sim.playerProofs={bullet:true,fire:false,explosion:false,collision:false,melee:false};const proof=shot(torso);sim.playerProofs=undefined;
   const q=sim.player.position;let gap:any;for(let height=.1;height<1.9&&!gap;height+=.05)for(const x of [-.29,-.2,0,.2,.29])for(const direction of axes){const source={x:q.x-direction.x*4+direction.z*x,y:q.y+height,z:q.z-direction.z*4-direction.x*x},raw=sim.world.castRay(new RAPIER.Ray(source,direction),8,true,RAPIER.QueryFilterFlags.EXCLUDE_SENSORS),native=w.npcBulletLine(source,direction,8,own);if(raw?.collider.handle===sim.playerCollider.handle&&native?.collider.handle!==sim.playerCollider.handle){gap={source,direction};break;}}
   if(!gap)throw Error('No CJ capsule gap');const gapShot=shot(gap);
   const id=await crowd.spawnOfficer('lapd1',22,{x:torso.source.x,y:torso.source.y-1.6,z:torso.source.z},0),cop=crowd.people.find((p:any)=>p.id===id);if(!cop?.weapon)throw Error('No cop weapon');cop.mission=true;cop.gunAccuracy=100;sim.player.health=100;sim.player.armour=1000;const eye={...cop.actor.player.position,y:cop.actor.player.position.y+1.6},aim=spheres.find((s:any)=>s.piece===3).center,offset=new THREE.Vector3(aim.x-eye.x,aim.y-eye.y,aim.z-eye.z),before=sim.damageEvents.length;
   let steps=0;for(;steps<180&&sim.player.armour===1000;steps++)crowd.stepPedGun(cop,cop.weapon,eye,aim,offset,[],1/30,true);const copHit={steps,loss:1000-sim.player.armour,events:sim.damageEvents.slice(before).map((e:any)=>({piece:e.piece,weapon:e.weapon}))};crowd.removeScripted(cop);
   return {readiness,spheres:spheres.length,rows,cover,proof,gapShot,copHit,base:(w.inventory.info(38)?.damage??35)*Math.fround(.33)};
  }finally{sim.world.removeRigidBody(own);}
 });
 writeFileSync('artifacts/skinned-cj-bullet-line.json',JSON.stringify({result,errors},null,2));expect(result.spheres).toBe(12);expect(result.readiness).toEqual({before:false,after:true,spheres:12});
 for(const row of result.rows){expect(row.fired).toBe(true);expect(row.loss).toBeCloseTo(result.base,4);expect(row.event).toEqual([{piece:row.piece,weapon:38}]);}
 for(const blocked of [result.cover,result.proof,result.gapShot]){expect(blocked.fired).toBe(true);expect(blocked.loss).toBe(0);expect(blocked.event).toEqual([]);}
 expect(result.copHit.steps).toBeLessThan(180);expect(result.copHit.loss).toBeGreaterThan(0);expect(result.copHit.events[0].piece).toBeDefined();expect(result.copHit.events[0].piece).not.toBe(9);expect(errors).toEqual([]);
});
