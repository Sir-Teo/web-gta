import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('FINALEC reads the fire ladder’s raw seventh-door angle and moving pitch reaches its original frame',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(544,{x:p.x+20,y:p.y,z:p.z+40});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const result=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),w=m.runtime.world,car=m.vehicles.entity(h),body=car.body,frame=car.car.root.getObjectByName('misc_b');
  if(!frame)throw new Error('Fire ladder frame is missing');
  body.setEnabled(true);body.setRotation({x:0,y:0,z:0,w:1},true);body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
  car.previousSwingMotion=undefined;car.swingingClock=0;car.swingingChassis.angle=0;car.swingingChassis.angVel=0;
  w.controlMovableVehiclePart(h,.7);const pitch=[...frame.matrix.elements];
  car.afterStep(1/30);body.setLinvel({x:5,y:0,z:0},true);car.afterStep(1/30);
  const code=new Uint8Array([0x5f,9,1,0,0,0,0,4,6,3,0,0,0x4e,0]);new DataView(code.buffer).setInt32(3,h,true);
  const slot=m.runtime.start(0,[],{space:code});slot.thread.run(g.gameTimeMs(),1000,0);
  car.openDoor(2,.5);
  return {raw:slot.thread.locals.getFloat32(0,true),angle:car.swingingChassis.angle,alias:w.getDoorAngleRatio(h,8),ratio:car.swingingChassis.ratio,
   door:w.getDoorAngleRatio(h,2),expectedDoor:Math.fround(car.doors[2].angle),pitch,drawn:[...frame.matrix.elements],partAngle:car.movingComponent.angle,
   skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },h);
 expect(result.raw).toBe(Math.fround(-.05));expect(result.raw).toBe(result.angle);expect(result.alias).toBe(result.raw);expect(result.ratio).not.toBeCloseTo(result.raw,3);
 expect(result.door).toBe(result.expectedDoor);expect(result.door).toBeLessThan(0);
 const pitch=result.partAngle*Math.fround(-.0001);expect(result.pitch[6]).toBeCloseTo(Math.sin(pitch),6);expect(result.pitch[9]).toBeCloseTo(-Math.sin(pitch),6);
 expect(result.drawn[0]).toBeCloseTo(Math.cos(result.raw),6);expect(result.drawn[1]).toBeCloseTo(Math.sin(result.raw)*Math.cos(pitch),6);
 expect(result.skipped).toEqual([]);expect(result.gaveUp).toEqual([]);expect(errors).toEqual([]);
});
