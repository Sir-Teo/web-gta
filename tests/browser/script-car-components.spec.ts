import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';
/** The CAutomobile component commands on a script car: PopDoor, PopPanel, PopBoot, FixDoor, FixPanel, FixTyre, the
 * damage and state questions, the turn speed and the petrol tank flag. */
test('the script pops, damages and fixes a car’s doors, panels and tyres',async({page})=>{
 test.setTimeout(240000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});
 await expect.poll(()=>page.evaluate(()=>(window as any).__game.missionForProfiling()?.snapshot()?.started??false),{timeout:60000}).toBe(true);
 await endStoryMission(page);
 const car=await page.evaluate(()=>{const g=(window as any).__game,p=g.state().player.position;return g.missionForProfiling().vehicles.create(596,{x:p.x+6,y:-p.z+7,z:-100},0);});
 await page.waitForFunction(c=>!!(window as any).__game.missionForProfiling().vehicles.entity(c),car,{timeout:60000});
 const out=await page.evaluate(c=>{
  const m=(window as any).__game.missionForProfiling(),w=m.runtime.world,entity=m.vehicles.entity(c),d=entity.damageState;
  const r:Record<string,unknown>={};
  w.popVehicleDoor(c,2,true);r.popped=d.doors[2];
  w.damageVehicleDoor(c,3);r.damaged=d.doors[3];r.askDamaged=w.isCarDoorDamaged(c,3);r.askOk=w.isCarDoorDamaged(c,4);
  w.fixVehicleDoor(c,3);r.fixed=d.doors[3];
  w.popVehiclePanel(c,5,false);r.panel=d.panels[5];w.fixCarPanel(c,5);r.panelFixed=d.panels[5];
  w.damageVehiclePanel(c,0);r.wing=d.panels[0];
  w.burstVehicleTyre(c,1);r.burst=[w.vehicleTyreIsBurst(c,1),w.vehicleTyreIsBurst(c,0),w.vehicleTyreIsBurst(c,4)];
  w.fixCarTyre(c,1);r.fixedTyre=w.vehicleTyreIsBurst(c,4);
  w.setVehiclePetrolTankWeakpoint(c,false);r.weak=entity.petrolTankIsWeakPoint;
  w.popVehicleBoot(c);r.bootOpen=w.isCarDoorFullyOpen(c,1);
  w.setVehicleRotationVelocity(c,0,0,2);const a=entity.car.body.angvel();r.spin=[a.x,a.y,a.z];
  w.addExplosionNoSound(0,0,-50,0);
  return r;
 },car);
 expect(out).toMatchObject({popped:4,damaged:2,askDamaged:true,askOk:false,fixed:0,panel:3,panelFixed:0,wing:2,burst:[true,false,true],fixedTyre:false,weak:false,bootOpen:true});
 // Two radians a second about native z is the renderer's y.
 expect((out.spin as number[])[1]).toBeCloseTo(2,3);
 expect(errors).toEqual([]);
});
