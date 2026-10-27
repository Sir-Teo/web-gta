import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('SCM die tasks bypass health/armour calculation without inventing damage or kill credit',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game?.state().player.grounded,undefined,{timeout:60000});const rows:any[]=[];
 for(const mode of ['ordinary','health','armour','named']){
  const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(4,'MALE01',{x:p.x+10,y:-p.z,z:p.y});});
  await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.view.hasHitSpheres&&p.view.hasReaction('ko_shot_front')&&!p.collisionWait;},handle,{timeout:45000});
  const row:any=await page.evaluate(async({handle,mode})=>{
   const dep='/src/engine/scmOpcodes.ts',{scmOpcode}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,crowd=g.pedestrians(),p=m.peds.entity(handle),stats=m.runtime.game.stats,armour=mode==='armour'||mode==='named'?20000:40,health=mode==='health'||mode==='named'?2**30:100;
   host.freezePedPosition(handle,true);host.setPedHealth(handle,health);m.peds.setArmour(handle,armour);host.setPedInvulnerable(handle,true);host.setPedProofs(handle,{bullet:true,fire:true,explosion:true,collision:true,melee:true});
   const source={player:true};p.lastDamagedBy=source;p.lastWeaponDamage=34;p.deadTime=70;p.corpseHitReady=true;
   const s={p,source,oldKill:crowd.onKill,oldDamage:crowd.damageCollider,oldNote:crowd.noteEvent,kills:[] as any[],damage:0,notes:0};g.__scriptDieDirect=s;
   crowd.onKill=(v:any)=>{if(v.id===p.id)s.kills.push(v);s.oldKill?.(v);};crowd.damageCollider=function(...args:any[]){if(args[0]===p.collider.handle)s.damage++;return s.oldDamage.apply(this,args);};crowd.noteEvent=function(...args:any[]){if(args[0]===p&&args[1]===9)s.notes++;return s.oldNote.apply(this,args);};
   const before={others:stats.get(120),vehicle:stats.get(121)},command=mode==='named'?'TASK_DIE_NAMED_ANIM':'TASK_DIE';host.givePedScriptedTask(handle,mode==='named'?{kind:'dieNamedAnim',animationName:'KO_SHOT_FRONT',animationFile:'PED',blendSpeed:4,time:-1}:{kind:'die'},scmOpcode(command));
   return {mode,health,armour,immediate:{health:m.peds.healthOf(handle),armour:p.armour,dead:m.peds.isDead(handle),weapon:p.lastWeaponDamage,source:p.lastDamagedBy===source,damage:s.damage,notes:s.notes,kills:s.kills.length,otherDelta:stats.get(120)-before.others,vehicleDelta:stats.get(121)-before.vehicle}};
  },{handle,mode});
  await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.health===0&&p.down===Infinity&&p.view.reactionName==='ko_shot_front';},handle,{timeout:15000});await page.waitForTimeout(100);
  row.settled=await page.evaluate(handle=>{const g=(window as any).__game,m=g.missionForProfiling(),s=g.__scriptDieDirect,p=s.p;return {exists:m.peds.exists(handle),health:m.peds.healthOf(handle),armour:p.armour,weapon:p.lastWeaponDamage,source:p.lastDamagedBy===s.source,pose:p.view.reactionName,down:p.down===Infinity,deadTime:p.deadTime,ready:!!p.corpseHitReady,damage:s.damage,notes:s.notes,kills:s.kills.length};},handle);rows.push(row);
  writeFileSync('artifacts/script-die-direct-progress.json',JSON.stringify({rows,errors},null,2));
  await page.evaluate(handle=>{const g=(window as any).__game,crowd=g.pedestrians(),s=g.__scriptDieDirect;crowd.onKill=s.oldKill;crowd.damageCollider=s.oldDamage;crowd.noteEvent=s.oldNote;g.missionForProfiling().runtime.world.deletePed(handle);},handle);
 }
 writeFileSync('artifacts/script-die-direct.json',JSON.stringify({rows,errors},null,2));
 for(const r of rows){expect(r.immediate).toEqual({health:0,armour:r.armour,dead:true,weapon:34,source:true,damage:0,notes:0,kills:0,otherDelta:0,vehicleDelta:0});expect(r.settled).toMatchObject({exists:true,health:0,armour:r.armour,weapon:34,source:true,pose:'ko_shot_front',down:true,ready:false,damage:0,notes:0,kills:0});expect(r.settled.deadTime).toBeLessThan(2);}
 expect(errors).toEqual([]);
});
