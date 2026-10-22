import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('ZERO2 original RC gun combat reaches its reward and delayed cleanup',async({page})=>{
 test.setTimeout(480000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();m.runtime.loadAndLaunchMission(73);(window as any).__zeroSkip=setInterval(()=>{if(m.runtime.game.cutscene.running)g.skipCutscene?.();},250);});
 await page.waitForFunction(()=>{const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((s:any)=>s.thread.name==='ZERO2')?.thread;return t?.locals.getInt32(119*4,true)>=1&&m.playerControl&&m.remote.inRemoteMode&&m.vehicles.entity(m.remote.vehicle)?.remoteControlled&&m.snapshot().fade.alpha===0;},undefined,{timeout:150000});

 await expect(page.locator('.timer-label').filter({hasText:'FUEL'})).toHaveText('FUEL');
 const before=await page.evaluate(()=>{clearInterval((window as any).__zeroSkip);const g=(window as any).__game,m=g.missionForProfiling();m.runtime.world.freezeVehiclePosition(m.remote.vehicle,true);return{h:m.remote.vehicle,money:g.sim.money,cj:m.runtime.world.pedPosition(1),ride:m.runtime.world.pedVehicle(1)};});
 // Controlled checkpoints move the player-operated aircraft; its health is maintained. NPCs and mission state follow normal gameplay.
 const all:any[]=[];
 for(let index=0;index<5;index++){
  const initial=await page.evaluate(index=>{const g=(window as any).__game,m=g.missionForProfiling(),t=m.runtime.active.find((s:any)=>s.thread.name==='ZERO2').thread,target=t.locals.getInt32((46+index)*4,true),driver=t.locals.getInt32((36+index)*4,true),p=m.vehicles.positionOf(target);m.runtime.world.setVehicleCoordinates(m.remote.vehicle,p.x,p.y-22,p.z+4);return{target,driver,model:m.vehicles.entity(target)?.modelId,health:m.runtime.world.vehicleHealth(target),count:t.locals.getInt32(121*4,true)};},index);
  await page.waitForFunction(()=>!(window as any).__game.state().terrainHold,undefined,{timeout:60000});await page.waitForTimeout(1200);
  const timeline:any[]=[];await page.keyboard.down('ControlLeft');
  for(let tick=0;tick<400;tick++){
   const state=await page.evaluate(({initial,index})=>{const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,t=m.runtime.active.find((s:any)=>s.thread.name==='ZERO2')?.thread,a=m.vehicles.entity(m.remote.vehicle),v=m.vehicles.entity(initial.target),ped=m.peds.entity(initial.driver);if(!t||!a)return{ended:true,passed:m.runtime.game.missionPassedKey,money:g.sim.money,ownHealth:a?.health,ownWrecked:a?.wrecked,remote:{vehicle:m.remote.vehicle,after:m.remote.afterExplosion}};if(m.peds.isDead(initial.driver))return{dead:true,count:t.locals.getInt32(121*4,true)};
    const ride=m.peds.rideOf(initial.driver),p=!ride&&ped?ped.collider?.translation():v?.car.body.collider(0).translation();if(!p)return{missing:true};
    let from={x:p.x,y:p.y+3,z:p.z+22},clear=false,hitBody:any,hitCollider:any;
    for(const height of[3,8,15]){for(let side=0;side<8;side++){const angle=side*Math.PI/4,candidate={x:p.x+22*Math.sin(angle),y:p.y+height,z:p.z+22*Math.cos(angle)},length=Math.hypot(p.x-candidate.x,p.y-candidate.y,p.z-candidate.z),direction={x:(p.x-candidate.x)/length,y:(p.y-candidate.y)/length,z:(p.z-candidate.z)/length},hit=g.weapons().ray(candidate,direction,length+1,a.body,undefined,true);hitBody=hit?.collider.parent()?.handle;hitCollider=hit?.collider.handle;if((!ride&&ped?.collider&&hitCollider===ped.collider.handle)||(ride&&hitBody===v?.car.body.handle)){from=candidate;clear=true;break;}}if(clear)break;}
    const dx=p.x-from.x,dy=p.y-from.y,dz=p.z-from.z,l=Math.hypot(dx,dy,dz),qx=dy/l,qy=-dx/l,qw=1-dz/l,qn=Math.hypot(qx,qy,qw),q={x:qx/qn,y:qy/qn,z:0,w:qw/qn};a.body.setTranslation(from,true);a.body.setNextKinematicTranslation(from);a.body.setRotation(q,true);a.body.setNextKinematicRotation(q);w.setVehicleHealth(m.remote.vehicle,1100);
    return{aimPoint:{...p},from,clear,hitBody,hitCollider,actor:ped?.actor?.player.position,ownHealth:a.health,ownWrecked:a.wrecked,health:v?.health,wrecked:v?.wrecked,weapon:v?.lastWeaponDamage,byPlayer:w.vehicleWasDamagedByPed(initial.target,1),shots:g.weapons().aircraftShots,driver:m.peds.healthOf(initial.driver),ride,order:ped?.order?.kind,targetEnabled:v?.car.body.isEnabled(),pedEnabled:ped?.collider?.isEnabled(),reaction:t.locals.getInt32((103+index)*4,true),count:t.locals.getInt32(121*4,true)};
   },{initial,index});timeline.push({tick,...state});if(state.dead||state.ended)break;await page.waitForTimeout(100);
  }
  await page.keyboard.up('ControlLeft');all.push({index,initial,timeline});writeFileSync('artifacts/zero2-combat.json',JSON.stringify({before,all,errors},null,2));expect(timeline.some(s=>s.dead),`courier ${index} dies through normal gunfire`).toBe(true);expect(timeline.some(s=>s.weapon===31&&s.byPlayer&&s.targetEnabled)).toBe(true);
  await expect.poll(()=>page.evaluate(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((s:any)=>s.thread.name==='ZERO2')?.thread;return t?.locals.getInt32(121*4,true);}),{timeout:30000}).toBe(index+1);
 }
 const heldCJ=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();return{cj:m.runtime.world.pedPosition(1),ride:m.runtime.world.pedVehicle(1)};});expect(heldCJ.cj).toEqual(before.cj);expect(heldCJ.ride).toBe(before.ride);
 await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.world.setVehicleCoordinates(m.remote.vehicle,-2237.310,140.080,57.230);});
 await page.waitForFunction(money=>(window as any).__game.sim.money===money,before.money+5000,{timeout:120000});await page.screenshot({path:'artifacts/zero2-combat-passed.png'});
 await page.waitForFunction(()=>(window as any).__game.missionForProfiling().runtime.game.missionPassedKey==='ZERO_2',undefined,{timeout:120000});
 await page.waitForFunction(()=>!(window as any).__game.missionForProfiling().runtime.active.some((s:any)=>s.thread.name==='ZERO2'),undefined,{timeout:30000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling().remote.inRemoteMode),{timeout:15000}).toBe(false);
 await page.waitForFunction(()=>{const s=(window as any).__game.state();return !s.terrainHold&&s.fadeAlpha===0;},undefined,{timeout:60000});
 const final=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();return{passed:m.runtime.game.missionPassedKey,money:g.sim.money,remote:m.remote.inRemoteMode,control:m.playerControl,frozen:g.sim.playerFrozen,cj:m.runtime.world.pedPosition(1),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});writeFileSync('artifacts/zero2-combat.json',JSON.stringify({before,all,final,errors},null,2));await page.screenshot({path:'artifacts/zero2-combat-result.png'});expect(final.money).toBe(before.money+5000);expect(final.control).toBe(true);expect(final.remote).toBe(false);expect(final.frozen).toBe(false);expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
