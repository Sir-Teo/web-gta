import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// GET_RANDOM_CAR_OF_TYPE_IN_AREA (iOS 0x1001d79b8) hands a script a street car in the area and makes it a mission car;
// the _NO_SAVE twin (0x1001e4f48) hands one over and leaves it the population's.
test('the script takes a street car in an area as its own, and the no-save form only borrows one',async({page})=>{
 test.setTimeout(240000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>((window as any).__game?.state().traffic?.cars??[]).length>=2,undefined,{timeout:120000});
 const result=await page.evaluate(()=>{
  const g=(window as any).__game,m=g.missionForProfiling(),a=m.adapterRef,p=g.sim.player.position,x=p.x,y=-p.z;
  const none=a.getRandomCarOfTypeInArea(x+5000,y+5000,x+5100,y+5100,-1);
  const wrongModel=a.getRandomCarOfTypeInArea(x-300,y-300,x+300,y+300,9999);
  const borrowed=a.getRandomCarOfTypeInAreaNoSave(x+300,y+300,x-300,y-300,-1);
  const borrowedCar=m.vehicles.entity(borrowed),borrowedMission=!!borrowedCar?.missionCar;
  // The newest street car is the one both searches find first; the borrowed one is still deletable, so it can be taken.
  const taken=a.getRandomCarOfTypeInArea(x-300,y-300,x+300,y+300,-1);
  const takenCar=m.vehicles.entity(taken);
  return {none,wrongModel,borrowed,borrowedMission,taken,takenMission:!!takenCar?.missionCar,
   takenAgain:a.getRandomCarOfTypeInArea(x-300,y-300,x+300,y+300,takenCar?.modelId??-1)===taken};
 });
 expect(result.none).toBe(-1);expect(result.wrongModel).toBe(-1);
 expect(result.borrowed).toBeGreaterThan(0);expect(result.borrowedMission).toBe(false);
 expect(result.taken).toBeGreaterThan(0);expect(result.takenMission).toBe(true);
 // A mission car cannot be deleted, so the same car is not handed over twice.
 expect(result.takenAgain).toBe(false);
 expect(errors).toEqual([]);
});
