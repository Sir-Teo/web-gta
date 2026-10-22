import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('DECON quaternion dispatch preserves the raw same-frame matrix, position and velocity, then uses native reorthogonalization',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(413,{x:p.x+20,y:p.y,z:p.z+80});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const immediate=await page.evaluate(h=>{
  const g=(window as any).__game,m=g.missionForProfiling(),body=m.vehicles.entity(h).body,w=m.runtime.world;
  const q=[-.04479999840259552,.017799999564886093,1.003000020980835,-.06109999865293503];
  body.setLinvel({x:1,y:2,z:3},true);body.setAngvel({x:.04,y:.05,z:.06},true);const before={p:{...body.translation()},v:{...body.linvel()},a:{...body.angvel()}};
  const code=new Uint8Array(29),view=new DataView(code.buffer);code.set([0xc6,7,1]);view.setInt32(3,h,true);
  for(let i=0;i<4;i++){code[7+i*5]=6;view.setFloat32(8+i*5,q[i],true);}code[27]=0x4e;
  const slot=m.runtime.start(0,[],{space:code});slot.thread.run(g.gameTimeMs(),1000,0);
  const after={p:{...body.translation()},v:{...body.linvel()},a:{...body.angvel()}},raw=w.vehicleMatrix(h);
  body.setLinvel({x:0,y:0,z:0},true);body.setAngvel({x:0,y:0,z:0},true);
  return {before,after,raw,clock:g.gameTimeMs(),skipped:m.snapshot().skipped,gaveUp:m.snapshot().gaveUp};
 },h);
 expect(immediate.after).toEqual(immediate.before);expect(immediate.raw.right.x).toBeLessThan(-1);
 expect(Math.hypot(immediate.raw.right.x,immediate.raw.right.y,immediate.raw.right.z)).toBeGreaterThan(1.02);expect(immediate.skipped).toEqual([]);expect(immediate.gaveUp).toEqual([]);
 await page.waitForFunction(t=>(window as any).__game.gameTimeMs()>t,immediate.clock);
 const later=await page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.vehicleMatrix(h),h);
 for(const v of [later.right,later.forward,later.up])expect(Math.hypot(v.x,v.y,v.z)).toBeCloseTo(1,5);
 // The same-frame raw basis is replaced by the physical pose; it must not leak into a later heading assignment.
 const reset=await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.setVehicleQuaternion(h,0,0,1,1);const raw=w.vehicleMatrix(h);w.setVehicleHeading(h,0);return {raw,after:w.vehicleMatrix(h)};},h);
 expect(reset.raw.right).toEqual({x:-1,y:2,z:0});expect(reset.after.right.x).toBeCloseTo(1,6);expect(reset.after.forward.y).toBeCloseTo(1,6);
 // The player-vehicle alias reads the same raw matrix through playerVehiclePose.
 const player=await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.taskWarpCharIntoCarAsDriver(1,h);w.setVehicleQuaternion(1,0,0,1,1);return w.vehicleMatrix(1);},h);
 expect(player.right).toEqual({x:-1,y:2,z:0});expect(player.forward).toEqual({x:-2,y:-1,z:0});expect(errors).toEqual([]);
});
