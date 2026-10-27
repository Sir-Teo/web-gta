import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test.afterEach(async({page})=>{if(!page.isClosed())writeFileSync('artifacts/ped-melee-float32-progress.json',JSON.stringify(await page.evaluate(()=>{const g=(window as any).__game,s=g?.__playerMeleeFloat,w=g?.weapons();return s?{setup:s.setup,health:s.p.health,armour:s.p.armour,down:s.p.down,follow:s.p.follow,position:s.p.actor.player.position,body:g.sim.world.getRigidBody(s.p.body.handle)?.translation(),player:g.sim.player.position,strike:w.strike,selected:w.inventory.selected,swings:s.swings,responses:s.responses,kills:s.kills.length}:null;}),null,2));});

test('real player ground kicks retain native one HP, armour, friendly scaling and response amounts',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return g?.state().player.grounded&&g.weapons().inventory.info(0);},undefined,{timeout:60000});
 await page.evaluate(()=>(window as any).__game.sim.playerCanBeDamaged=false);const rows:any[]=[];
 for(const mode of ['one','partial','armour','friendly','response','below']){
  await page.waitForFunction(()=>(window as any).__game.weapons().inventory.cooldown<=0,undefined,{timeout:15000});
  const handle=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position;return g.missionForProfiling().peds.create(8,'MALE01',{x:p.x,y:-p.z-1,z:p.y});});
  await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.view.hasHitSpheres&&!p.collisionWait;},handle,{timeout:45000});
  const setup=await page.evaluate(({handle,mode})=>{
   const g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,crowd=g.pedestrians(),p=m.peds.entity(handle),w=g.weapons();host.freezePedPosition(handle,true);p.decisionMaker=6;
   let joined:string|undefined;if(mode==='friendly'){const stats=m.runtime.game.stats,old=stats.get(64);stats.set(64,1000);try{joined=crowd.groupControl('forward',{handle:p.collider.handle,range:100});}finally{stats.set(64,old);}}
   const rawFactor=Math.fround(Math.fround(25*3)*Math.fround(p.defendMult)),factor=mode==='friendly'?Math.min(Math.fround(rawFactor*Math.fround(.1)),12.5):rawFactor,armour=mode==='partial'?80:mode==='armour'?100:0,health=mode==='one'||mode==='friendly'?Math.fround(factor+1):mode==='partial'?Math.fround(factor-armour+1):mode==='armour'?1000:mode==='response'?2**30:Math.fround(factor+.5);
   host.setPedHealth(handle,health);m.peds.setArmour(handle,armour);crowd.scriptFall(p,'ko_skid_front',5000);
   const s={p,oldReaction:crowd.damageReaction,oldKill:crowd.onKill,oldSwing:w.onMeleeSwing,responses:[] as any[],kills:[] as any[],swings:[] as any[]};g.__playerMeleeFloat=s;
   crowd.damageReaction=function(...args:any[]){if(args[0]===p)s.responses.push({health:args[2],armour:args[9],move:args[6]?.move,storedHealth:p.health,storedArmour:p.armour,follow:p.follow});return s.oldReaction.apply(this,args);};crowd.onKill=(v:any)=>{if(v.id===p.id)s.kills.push(v);s.oldKill?.(v);};w.onMeleeSwing=(...args:any[])=>{s.swings.push(args[1]);s.oldSwing?.(...args);};
   w.inventory.give(0,1);w.inventory.select(0);
   const setup={mode,joined,fired:false,health,armour,factor};Object.assign(s,{setup});return setup;
  },{handle,mode});
  // Let the native fall update the body centre before the weapon's ground-target height/range test.
  await page.waitForFunction(()=>{const g=(window as any).__game,s=g.__playerMeleeFloat,p=g.sim.player.position,t=g.pedestrians().targets().find((t:any)=>t.handle===s.p.collider.handle);return t?.down&&Math.abs(t.position.y-p.y)<1.5&&Math.hypot(t.position.x-p.x,t.position.z-p.z)<2.2;},undefined,{timeout:15000});
  setup.fired=await page.evaluate(()=>{const g=(window as any).__game,p=g.sim.player.position,s=g.__playerMeleeFloat;g.sim.player.heading=Math.atan2(s.p.actor.player.position.x-p.x,s.p.actor.player.position.z-p.z);return s.setup.fired=g.weapons().fire({origin:{...p,y:p.y+1.3},direction:{x:Math.sin(g.sim.player.heading),y:0,z:Math.cos(g.sim.player.heading)}});});
  await page.waitForFunction(()=>(window as any).__game.__playerMeleeFloat.responses.length>0,undefined,{timeout:15000,polling:50});await page.waitForTimeout(100);
  rows.push(await page.evaluate(setup=>{const g=(window as any).__game,s=g.__playerMeleeFloat;return {...setup,after:s.p.health,armourAfter:s.p.armour,follow:s.p.follow,responses:[...s.responses],kills:s.kills.length,swings:[...s.swings]};},setup));
  await page.evaluate(handle=>{const g=(window as any).__game,crowd=g.pedestrians(),w=g.weapons(),s=g.__playerMeleeFloat;crowd.damageReaction=s.oldReaction;crowd.onKill=s.oldKill;w.onMeleeSwing=s.oldSwing;g.missionForProfiling().runtime.world.deletePed(handle);},handle);
 }
 await page.evaluate(()=>(window as any).__game.sim.playerCanBeDamaged=true);
 writeFileSync('artifacts/ped-melee-float32.json',JSON.stringify({rows,errors},null,2));
 for(const r of rows){const absorbed=Math.min(r.factor,r.armour),damage=Math.fround(r.factor-absorbed),remaining=Math.fround(r.health-damage),health=remaining<1?0:remaining,armour=Math.fround(r.armour-absorbed);expect(r.fired).toBe(true);expect(r.swings).toEqual([{kind:'ground'}]);expect(r.after).toBe(health);expect(r.armourAfter).toBe(armour);expect(r.responses).toEqual([{health:health?damage:r.health,armour:absorbed,move:3,storedHealth:health,storedArmour:armour,follow:false}]);expect(r.kills).toBe(r.mode==='below'?1:0);if(['one','partial','friendly'].includes(r.mode))expect(r.after).toBe(1);if(r.mode==='friendly'){expect(r.joined).toBe('joined');}}
 expect(errors).toEqual([]);
});
