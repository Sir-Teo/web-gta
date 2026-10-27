import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('all three bicycles apply native rider cadence to the loaded pedal clip and crank, holding coast/freeze and renewing rider ownership',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary},{NativeBicycleRider}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts','/src/simulation/nativeBicycleRider.ts'].map(path=>import(path)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),clips=new VehicleAnimationLibrary(new URL('/play/world/',location.href).href),out:any[]=[],rows:any[]=[],original=NativeBicycleRider.prototype.step;
  NativeBicycleRider.prototype.step=function(this:any,dt:number,input:any,hop:boolean){
   const before=this.time,associations=structuredClone(this.associations),output=original.call(this,dt,input,hop);
   if(!hop)rows.push({dt,before,after:this.time,associations,afterAssociations:structuredClone(this.associations),crank:this.crank,input:{...input,speed:Math.fround(input.speed),coefficient:Math.fround(input.coefficient),maxFlatVelocity:Math.fround(input.maxFlatVelocity),lean:Math.fround(input.lean),leanFwd:Math.fround(input.leanFwd),gas:Math.fround(input.gas)},output});return output;
  };
  WorldBike.riderClipSeconds=(block:string,clip:string)=>clips.peek(block,clip)?.duration;
  try{
   for(const id of [481,509,510]){
    const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
    const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
    try{
     await clips.block(assets.vehicle.animation);const index=assets.model.frames.findIndex((f:any)=>f.name==='chainset');let crank:any;bike.root.traverse((o:any)=>{if(o.userData.nativeFrame===index)crank=o;});if(!crank)throw Error(`Missing crank ${id}`);
     const tick=(throttle=0)=>{bike.beforeStep(1/60,{throttle,steer:0,brake:false});sim.world.step();bike.afterStep();bike.update(1);};
     for(let i=0;i<40;i++)tick();bike.finishEnter();
     const start=rows.length;for(let i=0;i<120;i++)tick(1);
     const moving=bike.riderPose(),angle=rows.at(-1).crank,crankBasis=[...crank.matrix.elements];
     const movingRows=rows.slice(start);tick();const coastStart=bike.rideTime;
     for(let i=0;i<14;i++)tick();const coastEnd=bike.rideTime,coastCrank=[...crank.matrix.elements],coastAngle=rows.at(-1).crank;
     const frozenCount=rows.length;bike.frozen=true;tick(1);const frozenTime=bike.rideTime,frozenCrank=[...crank.matrix.elements];bike.frozen=false;
     const abandonedCount=rows.length;bike.occupied=false;tick();const abandonedTime=bike.rideTime,abandonedRows=rows.length;bike.finishEnter();const remountStart=rows.length;tick(1);
     // Reverse motion takes the native rider fallback; a fully faded pedal must not return as a full-body base.
     for(let i=0;i<20;i++){bike.beforeStep(1/60,{throttle:0,steer:0,brake:false});bike.body.setLinvel({x:0,y:0,z:4},true);sim.world.step();bike.afterStep();bike.update(1);}
     const fallback=bike.riderPose();
     out.push({id,fallback,movingRows,movingTime:moving.time,angle,crankBasis,coastStart,coastEnd,coastCrank,coastAngle,frozenCount,frozenRows:abandonedCount,frozenTime,frozenCrank,abandonedCount,abandonedRows,abandonedTime,remount:rows.slice(remountStart)});
    }finally{bike.dispose();sim.dispose();}
   }
  }finally{NativeBicycleRider.prototype.step=original;WorldBike.riderClipSeconds=undefined;}
  return {models:out,rows};
 });
 writeFileSync('artifacts/bicycle-rider-cadence-live.json',JSON.stringify({result,errors},null,2));
 for(const r of result.models){
  const playing=r.movingRows.filter((row:any)=>row.output?.playing);expect(playing.length).toBeGreaterThan(50);expect(r.movingTime).toBeGreaterThan(0);expect(Math.abs(r.movingTime-2)).toBeGreaterThan(.05);
  expect(Math.max(...playing.map((row:any)=>row.output.cadence))-Math.min(...playing.map((row:any)=>row.output.cadence))).toBeGreaterThan(.05);
  expect(r.crankBasis[5]).toBeCloseTo(Math.cos(r.angle),5);expect(r.crankBasis[6]).toBeCloseTo(Math.sin(r.angle),5);
  expect(r.coastEnd).toBe(r.coastStart);expect(r.coastCrank[5]).toBeCloseTo(Math.cos(r.coastAngle),5);expect(r.coastCrank[6]).toBeCloseTo(Math.sin(r.coastAngle),5);expect(r.frozenRows).toBe(r.frozenCount);expect(r.frozenTime).toBe(r.coastEnd);expect(r.frozenCrank).toEqual(r.coastCrank);
  expect(r.fallback.idle).toMatch(/_ride$/);expect(r.fallback.partials).toEqual([]);
  expect(r.abandonedRows).toBe(r.abandonedCount);expect(r.abandonedTime).toBe(0);expect(r.remount[0].before).toBe(0);
 }
 for(const row of result.rows)for(const a of row.afterAssociations){expect(a.time).toBeGreaterThanOrEqual(0);expect(a.time).toBeLessThan(a.duration);expect(a.amount).toBeGreaterThanOrEqual(0);expect(a.amount).toBeLessThanOrEqual(1);}
 expect(errors).toEqual([]);
});
