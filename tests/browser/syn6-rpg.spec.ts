import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';
import {missionBotTick} from './missionBot';

test('SYN6 original RPG combat reaches mission passed, rewards and cleanup',async({page})=>{
 test.setTimeout(300000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const before=await page.evaluate(()=>{const g=(window as any).__game,r=g.missionForProfiling().runtime,before={money:g.sim.money,respect:r.game.missionRespect};r.loadAndLaunchMission(62);return before;});
 await page.waitForFunction(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((s:any)=>s.thread.name==='SYN6')?.thread;return t?.locals.getInt32(84*4,true)===-13;},undefined,{timeout:120000});
 // Only CJ moves: the original debug approach and stair trigger preserve creation/pickup/blip order.
 await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.loadScene(-1704.324,637.513,23.896);w.setPedCoordinates(1,-1704.324,637.513,23.896);});
 await page.waitForFunction(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((s:any)=>s.thread.name==='SYN6')?.thread;return t?.locals.getInt32(60*4,true)===0;},undefined,{timeout:30000});
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-1683.820,686.513,23.969));
 await page.waitForFunction(()=>{const g=(window as any).__game,r=g.missionForProfiling().runtime,t=r.active.find((s:any)=>s.thread.name==='SYN6')?.thread;r.world.setPedHealth(1,100);if(r.game.cutscene.running)g.skipCutscene?.();return t?.locals.getInt32(60*4,true)===8;},undefined,{timeout:60000});
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCoordinates(1,-1688.860,695.308,29.345));
 await page.waitForFunction(()=>{const t=(window as any).__game.missionForProfiling().runtime.active.find((s:any)=>s.thread.name==='SYN6')?.thread;return t?.locals.getInt32(65*4,true)===2;},undefined,{timeout:15000});
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPedCurrentWeapon(1,35));
 await page.locator('canvas').first().hover();await page.mouse.down({button:'right'});
 await page.waitForFunction(()=>{const w=(window as any).__game.weapons();return w.firstPerson==='rocket'&&w.ready;},undefined,{timeout:15000});
 // A controlled grounded firing checkpoint ahead of the live aircraft; NPCs and playback are untouched.
 const setup=await page.evaluate(()=>{
  const g=(window as any).__game,r=g.missionForProfiling().runtime,t=r.active.find((s:any)=>s.thread.name==='SYN6').thread,h=t.locals.getInt32(149*4,true),p=r.world.vehiclePosition(h),v=r.world.getCarSpeedVector(h),heading=Math.atan2(v.y,v.x),R=g.RAPIER;
  for(const radius of[35,45,25])for(let i=0;i<16;i++){
   const a=heading+i/16*Math.PI*2,x=p.x+Math.cos(a)*radius,y=p.y+Math.sin(a)*radius,z=r.world.groundZFor3DCoord(x,y,p.z+10);if(!Number.isFinite(z)||Math.abs(z-p.z)>25)continue;
   const from={x,y:z+1.3,z:-y},dx=p.x-x,dy=p.z+.6-from.y,dz=-p.y-from.z,l=Math.hypot(dx,dy,dz);
   if(g.sim.world.castRay(new R.Ray(from,{x:dx/l,y:dy/l,z:dz/l}),l,true,R.QueryFilterFlags.ONLY_FIXED))continue;
   r.world.setPedCoordinatesDontWarpGang(1,x,y,z);return{handle:h,health:r.world.vehicleHealth(h),appearance:r.world.vehicleAppearance(h),ammo:r.world.pedWeaponAmmo(1,35),player:{x,y,z}};
  }throw new Error('No grounded clear firing checkpoint');
 });
 expect(setup.appearance).toBe(3);expect(setup.health).toBe(1500);expect(setup.ammo).toBeGreaterThan(0);
 await page.waitForFunction(()=>{const g=(window as any).__game;return g.state().player.grounded&&g.weapons().firstPerson==='rocket'&&g.weapons().ready;},undefined,{timeout:10000});
 await page.evaluate(`window.__missionBotTick=${missionBotTick.toString()}`);
 const timeline:any[]=[];let hit:any,aimHeld=true,launched=false;
 for(let tick=0;tick<600;tick++){
  await page.waitForTimeout(100);
  const state=await page.evaluate(h=>{
   const g=(window as any).__game,m=g.missionForProfiling(),r=m.runtime;r.world.setPedHealth(1,100);g.setWantedLevel(0);
   const action=(window as any).__missionBotTick(.1);
   return{action,health:r.world.vehicleHealth(h),weapon:r.world.vehicleLastWeaponDamage(h),player:r.world.vehicleWasDamagedByPed(h,1),ammo:r.world.pedWeaponAmmo(1,35),launched:g.weapons().projectiles.some((p:any)=>p.weapon===35&&p.byPlayer),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
  },setup.handle);
  timeline.push({tick,...state});launched||=state.launched;
  const aim=!!state.action?.aimRpg;if(aim!==aimHeld){if(aim)await page.mouse.down({button:'right'});else await page.mouse.up({button:'right'});aimHeld=aim;}
  if(state.health<=700&&state.player&&state.weapon===51){hit=state;break;}
 }
 await page.mouse.up({button:'right'});await page.screenshot({path:'artifacts/syn6-rpg-hit.png'});
 expect(launched).toBe(true);expect(hit,'the original helicopter receives a player-attributed RPG blast').toBeDefined();expect(hit.ammo).toBeLessThan(setup.ammo);expect(hit.skipped).toEqual([]);expect(hit.gaveUp).toEqual([]);
 // Finish the damaged aircraft through real rifle fire, then let the script own its crash/result/cleanup.
 const finish:any[]=[];let final:any;
 await page.evaluate(()=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.givePedWeapon(1,31,500);w.setPedCurrentWeapon(1,31);});
 for(let tick=0;tick<400;tick++){
  await page.waitForTimeout(100);
  const state=await page.evaluate(h=>{
   const g=(window as any).__game,m=g.missionForProfiling(),r=m.runtime,t=r.active.find((s:any)=>s.thread.name==='SYN6')?.thread;
   if(!t)return{ended:true,passed:r.game.missionPassedKey,money:g.sim.money,respect:r.game.missionRespect,rocketAmmo:r.world.pedWeaponAmmo(1,35),control:m.playerControl,frozen:g.sim.playerFrozen,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
   r.world.setPedHealth(1,100);g.setWantedLevel(0);const health=r.world.vehicleHealth(h);let fired=false;
   if(health>0){const p=m.vehicles.entity(h).car.body.collider(0).translation();fired=g.fireAt(p.x,p.y,p.z);}
   return{ended:false,stage:t.locals.getInt32(60*4,true),health:r.world.vehicleHealth(h),fired};
  },setup.handle);
  finish.push({tick,...state});if(state.ended){final=state;break;}
 }
 writeFileSync('artifacts/syn6-rpg.json',JSON.stringify({before,setup,timeline,finish,final},null,2));await page.screenshot({path:'artifacts/syn6-rpg-result.png'});
 expect(finish.some(s=>s.stage===99)).toBe(true);expect(finish.some(s=>s.health===0)).toBe(true);expect(final,'the original mission reaches its result').toBeDefined();expect(final.passed).toBe('SYND_6');expect(final.money).toBe(before.money+18000);expect(final.respect).toBe(before.respect+50);expect(final.rocketAmmo).toBe(0);expect(final.control).toBe(true);expect(final.frozen).toBe(false);expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
