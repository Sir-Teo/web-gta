import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('native NPC kickboxing preserves one HP, spends armour and rejects script groupmates',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game?.state().player.grounded,undefined,{timeout:60000});
 const handles=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return {source:m.peds.create(4,'MALE01',{x:p.x+12,y:-p.z+1,z:p.y}),victim:m.peds.create(5,'MALE01',{x:p.x+12,y:-p.z,z:p.y})};});
 await page.waitForFunction(h=>{const m=(window as any).__game.missionForProfiling();return [h.source,h.victim].every(id=>{const p=m.peds.entity(id);return p?.view.hasHitSpheres&&!p.collisionWait;});},handles,{timeout:45000});
 await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling(),host=m.runtime.world;host.freezePedPosition(h.source,true);host.freezePedPosition(h.victim,true);host.givePedMeleeAttack(h.source,7,1);},handles);
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return ['fightd_1','fightd_2','fightd_3'].every(c=>p.view.hasReaction(c));},handles.source,{timeout:45000});
 const rows:any[]=[];
 for(const mode of ['one','partial','armour','grouped','below']){
  const row:any=await page.evaluate(({handles,mode})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,crowd=g.pedestrians(),p=m.peds.entity(handles.source),victim=m.peds.entity(handles.victim),factor=[12,15,200].map(base=>Math.fround(Math.fround(Math.fround(base)*Math.fround(p.attackMult))*Math.fround(victim.defendMult))),armour=mode==='partial'?10:mode==='armour'||mode==='grouped'?400:0;
   let remainingArmour=armour;const healthFactors=factor.map(d=>{const absorbed=Math.min(d,remainingArmour);remainingArmour=Math.fround(remainingArmour-absorbed);return Math.fround(d-absorbed);});
   let initial=mode==='below'?.5:1;for(const d of [...healthFactors].reverse())initial=Math.fround(initial+d);if(mode==='armour'||mode==='grouped')initial=1000;
   host.setPedHealth(handles.victim,initial);m.peds.setArmour(handles.victim,armour);victim.down=0;victim.stagger=0;p.stagger=0;p.meleeCooldown=0;p.fight=undefined;p.retaliate=0;p.foe=undefined;
   const at=victim.actor.player.position;p.actor.player.position={x:at.x,y:at.y,z:at.z-1};p.actor.player.heading=0;
   let group:number|undefined;if(mode==='grouped'){group=m.adapterRef.createGroup(0);m.adapterRef.setGroupLeader(group,handles.source);m.adapterRef.setGroupMember(group,handles.victim);}
   const oldKill=crowd.onKill,oldReaction=crowd.damageReaction,oldMelee=crowd.onMeleeHit,kills:any[]=[],responses:any[]=[],blows:any[]=[];
   crowd.onKill=(v:any)=>{if(v.id===victim.id)kills.push(v);oldKill?.(v);};crowd.damageReaction=function(...args:any[]){if(args[0]===victim)responses.push({health:args[2],armour:args[9],move:args[6]?.move,storedHealth:victim.health,storedArmour:victim.armour});return oldReaction.apply(this,args);};crowd.onMeleeHit=(...args:any[])=>{blows.push(args);oldMelee?.(...args);};
   try{for(let i=0;i<300&&blows.length<3;i++){crowd.stepBrawl(p,victim,1/30);if(mode==='grouped'&&p.fight?.stage===2&&p.fight.struck)break;}
    return {mode,initial,initialArmour:armour,factor,health:victim.health,armour:victim.armour,responses,kills:kills.length,blows:blows.length,lastWeapon:victim.lastWeaponDamage,grouped:mode==='grouped'};
   }finally{crowd.onKill=oldKill;crowd.damageReaction=oldReaction;crowd.onMeleeHit=oldMelee;if(group!==undefined)m.adapterRef.removeGroup(group);for(const q of [p,victim]){q.retaliate=0;q.foe=undefined;q.fight=undefined;}}
  },{handles,mode});
  await page.waitForTimeout(100);row.settled=await page.evaluate(h=>(window as any).__game.missionForProfiling().peds.entity(h)?.health,handles.victim);rows.push(row);
 }
 await page.evaluate(h=>{const host=(window as any).__game.missionForProfiling().runtime.world;host.deletePed(h.source);host.deletePed(h.victim);},handles);
 writeFileSync('artifacts/npc-melee-armour.json',JSON.stringify({rows,errors},null,2));
 for(const r of rows){let health=r.initial,armour=r.initialArmour;const responses:any[]=[];for(let i=0;i<3&&!r.grouped;i++){const absorbed=Math.min(r.factor[i],armour),remaining=Math.fround(r.factor[i]-absorbed),before=health;armour=Math.fround(armour-absorbed);health=Math.fround(health-remaining);if(health<1)health=0;responses.push({health:health?remaining:before,armour:absorbed,move:i,storedHealth:health,storedArmour:armour});}
  expect(r.health).toBe(health);expect(r.armour).toBe(armour);expect(r.settled).toBe(health);expect(r.responses).toEqual(responses);expect(r.blows).toBe(r.grouped?0:3);expect(r.kills).toBe(r.mode==='below'?1:0);if(r.mode==='one'||r.mode==='partial')expect(r.health).toBe(1);if(!r.grouped)expect(r.lastWeapon).toBe(0);
 }expect(errors).toEqual([]);
});
