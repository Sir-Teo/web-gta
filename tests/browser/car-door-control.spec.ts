import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

// CONTROL_CAR_DOOR (AUTHORED): DRIV6 takes a door from whole through crumpled and swinging to gone; MUSIC1 sets the
// rear doors open. GET_CAR_COLOURS reads back what CHANGE_CAR_COLOUR set, and SET_CAR_AS_MISSION_CAR claims a car.
test('a script crumples, opens and drops a car door, and reads its colours',async({page})=>{
 test.setTimeout(300000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:90000});
 await endStoryMission(page);
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:60000});
 const car=await page.evaluate(()=>{const g=(window as any).__game,m=g.missionForProfiling(),p=g.state().player.position;return m.vehicles.create(400,{x:p.x+5,y:-p.z+3,z:p.y+1},0);});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),car,{timeout:60000});
 const door=(status:number,angle:number)=>page.evaluate(([h,s,a])=>{const m=(window as any).__game.missionForProfiling();m.adapterRef.controlVehicleDoor(h,2,s,a);
  const c=m.vehicles.entity(h);return {status:c.damageState.doors[2],angle:c.doors[2].angle};},[car,status,angle]);
 expect((await door(0,0)).status).toBe(0);
 expect((await door(2,0)).status).toBe(2);
 const swinging=await door(3,-1);expect(swinging.status).toBe(3);
 expect((await door(4,-1)).status).toBe(4);
 // A rear door set open to its full ratio.
 const rear=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();m.adapterRef.controlVehicleDoor(h,4,1,1);return m.vehicles.entity(h).damageState.doors[4];},car);
 expect(rear).toBe(1);
 const colours=await page.evaluate(h=>{const m=(window as any).__game.missionForProfiling();m.adapterRef.changeVehicleColour(h,3,1);return m.adapterRef.vehicleColours(h);},car);
 expect([colours.primary,colours.secondary]).toEqual([3,1]);
 expect(errors).toEqual([]);
});
