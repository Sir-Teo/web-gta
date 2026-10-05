import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
// CAEVehicleAudioEntity's AE_TRAIN case: the front carriage's engine loop and every carriage's track sound, from
// TRAIN_D (131, rebuilt from the iOS bundle). Before, trains ran silent.
test('a moving train sounds its engine at the front and its wheels on every carriage',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 // RYDER3's freight engine and flat car (type 10) by the tracks east of Grove Street, drawn up to speed.
 const train=await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.createMissionTrain(10,2278.18,-1144.88,27.51,true));
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),train,{timeout:60000});
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setTrainSpeed(h,10);w.setTrainCruiseSpeed(h,20);},train);
 const audio=()=>page.evaluate(()=>{const a=(window as any).__game.state().audio.native;return {engine:a.vehicles.find((v:any)=>v.model===537),flat:a.vehicles.find((v:any)=>v.model===569),banks:a.banks.slots};});
 await expect.poll(async()=>{const a=await audio();return !!a.engine&&a.banks.some(([slot,bank]:number[])=>slot===a.engine.dummySlot&&bank===131);},{timeout:60000}).toBe(true);
 // The engine (sound type 1) and the track (2) at the front; the flat car has the track alone.
 await expect.poll(async()=>(await audio()).engine?.sounds,{timeout:30000}).toEqual([1,2]);
 await expect.poll(async()=>(await audio()).flat?.sounds,{timeout:30000}).toEqual([2]);
 await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.deleteMissionTrain(h),train);
 expect(errors).toEqual([]);
});
