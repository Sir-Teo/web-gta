import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {endStoryMission} from './freeRoam';

test('a script dogfight plane fires guns and enemy heat-seekers at the player aircraft',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const w=(fn:string,...args:unknown[])=>page.evaluate(({fn,args})=>(window as any).__game.missionForProfiling().runtime.world[fn](...args),{fn,args});
 await w('setPedCoordinates',1,370,-1880,6);
 await page.waitForFunction(()=>{
  const g=(window as any).__game,s=g.sceneForProfiling(),f=g.state().following?.region;
  return g.state().player.grounded&&f&&Math.hypot(f.x-370,f.y+1880)<f.radius*.7
   &&!s.terrainPause&&!s.pendingFollowing&&!s.pendingPrebuild&&!s.installingScene;
 },undefined,{timeout:90000});
 const target=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(520,{x:370,y:-2300,z:120},0) as number);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),target,{timeout:60000});
 await w('freezeVehiclePosition',target,true);await w('warpPedIntoCar',1,target);
 await page.waitForFunction(()=>{
  const g=(window as any).__game,s=g.sceneForProfiling(),f=g.state().following?.region;
  return f&&Math.hypot(f.x-370,f.y+2300)<f.radius*.7&&!s.terrainPause&&!s.pendingFollowing&&!s.pendingPrebuild&&!s.installingScene;
 },undefined,{timeout:90000});
 const enemy=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(520,{x:370,y:-2440,z:120},0) as number);
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),enemy,{timeout:60000});
 await page.evaluate(({target,enemy,fixed})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(enemy),t=m.vehicles.entity(target);
  // Keep the target alive while verifying a real flight's guns and missiles. No steering or weapon calls by the spec.
  t.health=100000;t.body.setBodyType(fixed,true);t.frozen=false;v.random=()=>0;
  const probe=(window as any).__planeWeaponProbe={guns:0,missiles:0,enemyDamage:0};
  const sound=g.weapons().onSound;
  g.weapons().onSound=(event:any,weapon:number,...args:any[])=>{
   if(event==='fire'&&args[1]==='aircraft'){if(weapon===36)probe.missiles++;else if(weapon===38)probe.guns++;}
   sound?.(event,weapon,...args);
  };
  const damage=t.damage.bind(t);t.damage=(amount:number,weapon:number,byPlayer:boolean)=>{
   if(byPlayer===false)probe.enemyDamage++;return damage(amount,weapon,byPlayer);
  };
  m.runtime.world.planeStartsInAir(enemy);m.runtime.world.setVehicleForwardSpeed(enemy,20);
  m.runtime.world.planeAttackPlayerUsingDogFight(enemy,0,30);
 },{target,enemy,fixed:RAPIER.RigidBodyType.Fixed});
 const state=()=>page.evaluate(({target,enemy})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),record=(h:number)=>{const p=m.vehicles.entity(h);return{position:m.runtime.world.vehiclePosition(h),health:p.health,frozen:p.frozen,enabled:p.body.isEnabled(),type:p.body.bodyType(),velocity:p.body.linvel(),ai:p.planePilot,snapshot:p.snapshot()};};
  return{probe:(window as any).__planeWeaponProbe,target:record(target),enemy:record(enemy),scene:g.sceneForProfiling(),following:g.state().following,playerInfo:{damage:m.runtime.game.playerInfo.canBeDamaged,safe:m.runtime.game.pads.playerSafe[0]},weapons:g.weapons().snapshot(),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },{target,enemy});
 try{
 await expect.poll(()=>page.evaluate(()=>(window as any).__planeWeaponProbe.guns),{timeout:20000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__planeWeaponProbe.missiles),{timeout:20000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__planeWeaponProbe.enemyDamage),{timeout:20000}).toBeGreaterThan(0);
 }catch(error){const final=await state();writeFileSync('artifacts/script-plane-weapons.json',JSON.stringify({final,errors},null,2));await page.screenshot({path:'artifacts/script-plane-weapons-failure.png'});throw error;}
 const final=await state();writeFileSync('artifacts/script-plane-weapons.json',JSON.stringify({final,errors},null,2));await page.screenshot({path:'artifacts/script-plane-weapons.png'});expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);
 expect(errors).toEqual([]);
});
