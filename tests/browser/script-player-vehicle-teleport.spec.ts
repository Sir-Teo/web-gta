import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('teleporting CJ on a frozen BMX then deleting it in the same script step keeps the destination',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await endStoryMission(page);
 const h=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),p=g.sim.player.position;
  m.runtime.world.setPlayerControl(0,false);
  return m.vehicles.create(481,{x:p.x+5,y:-p.z,z:p.y+1},0);
 });
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.freezeVehiclePosition(h,true);w.warpPedIntoCar(1,h);},h);
 await page.waitForFunction(h=>(window as any).__game.missionForProfiling().runtime.world.pedVehicle(1)===h,h);
 // ZERO4's return teleports its still-frozen bicycle and deletes it before another physics step.
 const destination={x:-2244.669,y:132.167,z:34.320};
 const immediate=await page.evaluate(({h,destination})=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world;
  const before=w.pedPosition(1);w.setPedCoordinates(1,destination.x,destination.y,destination.z);
  const body={...m.vehicles.entity(h).body.translation()},seated=w.pedPosition(1);
  w.deleteVehicle(h);
  return{before,body,seated,after:w.pedPosition(1),ride:w.pedVehicle(1)};
 },{h,destination});
 writeFileSync('artifacts/script-player-vehicle-teleport.json',JSON.stringify({destination,immediate,errors},null,2));
 expect(immediate.seated.x).toBeCloseTo(destination.x,3);
 expect(immediate.seated.y).toBeCloseTo(destination.y,3);
 expect(immediate.after.x).toBeCloseTo(destination.x,3);
 expect(immediate.after.y).toBeCloseTo(destination.y,3);
 await page.waitForFunction(destination=>{
  const g=(window as any).__game,m=g.missionForProfiling(),s=g.sceneForProfiling();
  return s.area===0&&!s.terrainPause&&!s.scriptAreaHold&&!s.savedTransferInstalling&&!s.installingScene&&!s.pendingPrebuild
   &&g.state().player.grounded&&g.state().following?.enabled
   &&m.runtime.world.groundZFor3DCoord(destination.x,destination.y,50)>30;
 },destination,{timeout:120000});
 const final=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling();return{player:g.state().player,scene:g.sceneForProfiling(),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};});
 writeFileSync('artifacts/script-player-vehicle-teleport.json',JSON.stringify({destination,immediate,final,errors},null,2));
 expect(Math.hypot(final.player.position.x-destination.x,final.player.position.z+destination.y)).toBeLessThan(1.5);
 expect(final.player.position.y).toBeGreaterThan(30);expect(final.player.position.y).toBeLessThan(38);
 expect(final.skipped).toEqual([]);expect(final.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
