import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('native police baton combo carries script friendship after player-group protection',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>!!(window as any).__game?.state().player.grounded,undefined,{timeout:60000});
 const handle=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;return m.peds.create(6,'LAPD1',{x:p.x,y:-p.z+1,z:p.y});});
 await page.waitForFunction(h=>{const p=(window as any).__game.missionForProfiling().peds.entity(h);return p?.view.hasHitSpheres&&!p.collisionWait;},handle,{timeout:45000});
 const rows=await page.evaluate(async handle=>{
  const dep='/src/simulation/Simulation.ts',{NATIVE_PLAYER_DAMAGE_MULT}=await import(/* @vite-ignore */ dep),g=(window as any).__game,m=g.missionForProfiling(),host=m.runtime.world,crowd=g.pedestrians(),p=m.peds.entity(handle),sim=g.sim,group=m.adapterRef.createGroup(0),rows:any[]=[],start=sim.damageEvents.length;
  host.freezePedPosition(handle,true);m.adapterRef.setGroupLeader(group,1);sim.playerCanBeDamaged=true;sim.playerProofs=undefined;
  try{for(const mode of ['hostile','respect','cleared','grouped']){
   if(mode==='cleared')host.clearPedRelationship(handle,0,0);else host.setPedRelationship(handle,mode==='hostile'?4:0,0);
   if(mode==='grouped')m.adapterRef.setGroupMember(group,handle);
   sim.player.health=5000;sim.player.armour=0;sim.knockdown=0;p.stagger=0;p.meleeCooldown=0;p.fight=undefined;
   const at=sim.player.position;p.actor.player.position={x:at.x,y:at.y,z:at.z-1};p.actor.player.heading=0;const before=sim.damageEvents.length;
   let completed=false;for(let i=0;i<180;i++){crowd.stepNightstick(p,true,1/30);if(p.fight?.stage===2&&p.fight.struck){completed=true;break;}}
   rows.push({mode,completed,friendly:crowd.friendlyWithPlayer(p),grouped:crowd.inPlayerGroup(p),health:sim.player.health,attack:p.attackMult,mult:NATIVE_PLAYER_DAMAGE_MULT,events:sim.damageEvents.slice(before).map((e:any)=>({weapon:e.weapon,health:e.health,armour:e.armour,fall:e.fall,fight:e.fight,died:e.died}))});
  }return rows;}
  finally{m.adapterRef.removeGroup(group);host.deletePed(handle);sim.damageEvents.splice(start);sim.player.health=100;sim.knockdown=0;}
 },handle);
 writeFileSync('artifacts/npc-nightstick-friendly.json',JSON.stringify({rows,errors},null,2));
 for(const r of rows){expect(r.completed).toBe(true);expect(r.friendly).toBe(r.mode==='respect'||r.mode==='grouped');expect(r.grouped).toBe(r.mode==='grouped');if(r.grouped){expect(r.health).toBe(5000);expect(r.events).toEqual([]);continue;}
  const damage=[18,18,25].map(base=>{const scaled=Math.fround(Math.fround(base*r.attack)*r.mult);return r.friendly?Math.min(Math.fround(scaled*Math.fround(.1)),12.5):scaled;});let health=5000;for(const d of damage)health=Math.fround(health-d);expect(r.health).toBe(health);expect(r.events).toEqual(damage.map((health,i)=>({weapon:3,health,armour:0,fall:i===2,fight:{move:i},died:false})));
 }expect(errors).toEqual([]);
});
