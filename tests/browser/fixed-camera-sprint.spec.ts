import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {endStoryMission} from './freeRoam';

test('script fixed camera uses captured sprint playback while attached and restored cameras use ordinary playback',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));const snapshots:any[]=[];
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});await endStoryMission(page);
 await page.waitForFunction(()=>{const g=(window as any).__game;return !g.state().terrainHold&&g.sim.player.grounded&&!!g.render().nativeCharacter;},undefined,{timeout:60000});
 const read=()=>page.evaluate(()=>{const g=(window as any).__game,camera=g.missionForProfiling().runtime.game.camera;return {mode:camera.modeToGoTo,fixedRenderer:!!g.render().fixedCamera,activeNativeMode:g.render().fixedCamera?.nativeMode,buttonSpeed:g.sim.player.sprintButtonSpeed,energy:g.sim.player.stamina,association:g.render().nativeCharacter.snapshot().moves?.find((a:any)=>a.clip==='sprint')};});
 try{
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');
  await page.waitForFunction(()=>{const g=(window as any).__game,a=g.render().nativeCharacter.snapshot().moves?.find((a:any)=>a.clip==='sprint');return a?.blend===1&&a.speed===1&&g.sim.player.sprintButtonSpeed===1;},undefined,{timeout:45000});
  snapshots.push({stage:'ordinary follow camera',...await read()});
  const source=await page.evaluate(()=>{const g=(window as any).__game,camera=g.missionForProfiling().runtime.game.camera,p=g.sim.player.position,source={x:p.x+15,y:-p.z,z:p.y+8};camera.setCamPositionForFixedMode(source,{x:0,y:0,z:0});camera.takeControlNoEntity({x:p.x,y:-p.z,z:p.y},2,1);return {x:source.x,y:source.z,z:-source.y};});
  await page.waitForFunction(source=>{const r=(window as any).__game.render();return !!r.fixedCamera&&Math.hypot(r.camera.position.x-source.x,r.camera.position.y-source.y,r.camera.position.z-source.z)<.001;},source);
  await expect.poll(async()=>(await read()).association?.speed,{timeout:10000}).toBe(Math.fround(.7));
  const fixed=await read();snapshots.push({stage:'active MODE_FIXED',...fixed});expect(fixed.mode).toBe(15);expect(fixed.activeNativeMode).toBe(15);expect(fixed.fixedRenderer).toBe(true);expect(fixed.energy).toBeLessThan(snapshots[0].energy);
  await page.screenshot({path:'artifacts/fixed-camera-sprint.png'});
  await page.evaluate(()=>{const g=(window as any).__game;g.missionForProfiling().runtime.game.camera.takeControlAttachToEntity(undefined,{kind:'ped',handle:1},{x:0,y:-5,z:2},{x:0,y:2,z:0},0,2,1);});
  await expect.poll(async()=>(await read()).association?.speed,{timeout:10000}).toBe(1);
  const attached=await read();snapshots.push({stage:'active MODE_ATTACHCAM',...attached});expect(attached.mode).toBe(47);expect(attached.activeNativeMode).toBe(47);expect(attached.fixedRenderer).toBe(true);
  await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.game.camera.restoreWithJumpCut(m.runtime.world.playerCameraState());});
  await page.waitForFunction(()=>!(window as any).__game.render().fixedCamera);
  const restored=await read();snapshots.push({stage:'restored follow camera',...restored});expect(restored.association?.speed).toBe(1);expect(restored.mode).toBe(4);
 }finally{
  await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling();m.runtime.game.camera.restoreWithJumpCut(m.runtime.world.playerCameraState());});
  writeFileSync('artifacts/fixed-camera-sprint.json',JSON.stringify({snapshots,errors},null,2));
 }
 expect(errors).toEqual([]);
});
