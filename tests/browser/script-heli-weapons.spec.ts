import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import RAPIER from '@dimforge/rapier3d-compat';
import {endStoryMission} from './freeRoam';

test('a scripted attacking Hunter flies and fires enemy guns and unguided rockets at the player aircraft',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const target=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(520,{x:370,y:-2300,z:120},0));
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),target,{timeout:60000});
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.freezeVehiclePosition(h,true);w.warpPedIntoCar(1,h);},target);
 // The aircraft warp must finish streaming its destination before combat timing begins.
 await page.waitForFunction(()=>{
  const g=(window as any).__game,s=g.sceneForProfiling(),f=g.state().following?.region;
  return f&&Math.hypot(f.x-370,f.y+2300)<f.radius*.7&&!s.terrainPause&&!s.pendingFollowing&&!s.pendingPrebuild&&!s.installingScene;
 },undefined,{timeout:90000});
 const enemy=await page.evaluate(()=>(window as any).__game.missionForProfiling().vehicles.create(425,{x:370,y:-2360,z:120},0));
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),enemy,{timeout:60000});
 const before=await page.evaluate(({target,enemy,fixed})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),t=m.vehicles.entity(target),heli=m.vehicles.entity(enemy),weapons=g.weapons();
  // Hold only the player target and keep it alive while the enemy flies with its own scripted controls.
  t.health=100000;t.body.setBodyType(fixed,true);t.frozen=false;
  const probe=(window as any).__heliWeaponProbe={guns:0,rockets:0,enemyDamage:0,launches:[]as any[]};
  const sound=weapons.onSound;weapons.onSound=(event:any,weapon:number,...args:any[])=>{
   if(event==='fire'&&args[1]==='aircraft'){
    if(weapon===35){probe.rockets++;probe.launches.push({weapon,position:{...args[0]}});}else if(weapon===38)probe.guns++;
   }sound?.(event,weapon,...args);
  };
  const damage=t.damage.bind(t);t.damage=(amount:number,weapon:number,byPlayer:boolean,...args:any[])=>{if(byPlayer===false)probe.enemyDamage++;return damage(amount,weapon,byPlayer,...args);};
  m.runtime.world.setHeliBladesFullSpeed(enemy);m.runtime.world.heliAttackPlayer(enemy,0,10);
  return{target:m.runtime.world.vehiclePosition(target),enemy:m.runtime.world.vehiclePosition(enemy),ownHealth:t.health};
 },{target,enemy,fixed:RAPIER.RigidBodyType.Fixed});
 const state=()=>page.evaluate(({target,enemy})=>{const g=(window as any).__game,m=g.missionForProfiling(),h=m.vehicles.entity(enemy),t=m.vehicles.entity(target);return{probe:(window as any).__heliWeaponProbe,enemy:m.runtime.world.vehiclePosition(enemy),ownHealth:t.health,mission:h.heliPilot?.mission,shots:g.weapons().aircraftShots,skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};},{target,enemy});
 try{
 await expect.poll(()=>page.evaluate(()=>(window as any).__heliWeaponProbe.guns),{timeout:30000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__heliWeaponProbe.rockets),{timeout:30000}).toBeGreaterThan(0);
 await expect.poll(()=>page.evaluate(()=>(window as any).__heliWeaponProbe.enemyDamage),{timeout:30000}).toBeGreaterThan(0);
 }catch(error){
  const final=await state();writeFileSync('artifacts/script-heli-weapons.json',JSON.stringify({before,final,errors},null,2));await page.screenshot({path:'artifacts/script-heli-weapons-failure.png'});throw error;
 }
 const final=await state();
 writeFileSync('artifacts/script-heli-weapons.json',JSON.stringify({before,final,errors},null,2));await page.screenshot({path:'artifacts/script-heli-weapons.png'});
 expect(final.ownHealth).toBeLessThan(before.ownHealth);expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
