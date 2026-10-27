import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('all three bicycles blend native rider fallback and pedal poses, hold coast/freeze and renew player/script ownership',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary},{NativeBicycleRider},{openWorldPedestrians},{NativeCharacter},{captureVehicleRootPose}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts','/src/simulation/nativeBicycleRider.ts','/src/assets/worldPedestrians.ts','/src/render/NativeCharacter.ts','/tests/fixtures/capture-vehicle-root.ts'].map(path=>import(path)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),clips=new VehicleAnimationLibrary(new URL('/play/world/',location.href).href),out:any[]=[],rows:any[]=[],rootCaptures:any[]=[],pedestrians=await openWorldPedestrians(new URL('/play/world/',location.href).href),view=new NativeCharacter(pedestrians.models[1]),original=NativeBicycleRider.prototype.step;
  NativeBicycleRider.prototype.step=function(this:any,dt:number,input:any,hop:boolean,crank:number){
   const before=this.time,associations=structuredClone(this.associations),previous={...this.state},durations=Object.fromEntries([194,195,196,197,198,199,200,206,207,208].map(id=>[id,this.duration(id)])),output=original.call(this,dt,input,hop,crank);
   const {driveBy,...nativeFields}=input,timeStep=Math.fround(dt*50),nativeInput={...nativeFields,dt,timeStep,unclippedTimeStep:timeStep,crank,previousLean:previous.lean,previousForward:previous.forward,durations,associations:associations.map(({group,...a}:any)=>a)};
   if(!hop)rows.push({nativeInput,state:{...this.state},dt,before,after:this.time,associations,afterAssociations:structuredClone(this.associations),crank:this.crank,input:{...input,speed:Math.fround(input.speed),coefficient:Math.fround(input.coefficient),maxFlatVelocity:Math.fround(input.maxFlatVelocity),lean:Math.fround(input.lean),leanFwd:Math.fround(input.leanFwd),gas:Math.fround(input.gas)},output});return output;
  };
  WorldBike.riderClipSeconds=(block:string,clip:string)=>clips.peek(block,clip)?.duration;
  try{
   for(const id of [481,509,510]){
    const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
    const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
    try{
     const block=await clips.block(assets.vehicle.animation);view.installVehicleClips(Object.fromEntries(block));const index=assets.model.frames.findIndex((f:any)=>f.name==='chainset');let crank:any;bike.root.traverse((o:any)=>{if(o.userData.nativeFrame===index)crank=o;});if(!crank)throw Error(`Missing crank ${id}`);
     const tick=(throttle=0,steer=0)=>{bike.beforeStep(1/60,{throttle,steer,brake:false});sim.world.step();bike.afterStep();bike.update(1);};
     const pose=()=>{const p=bike.riderPose();view.updateVehicle({vehicle:bike.root,local:p.seat!},{clip:p.idle,seconds:p.baseTime??p.time,partials:p.partials});const root=captureVehicleRootPose(view,{clip:p.idle,seconds:p.baseTime??p.time,partials:p.partials});if(root)rootCaptures.push({model:id,...root});return p;};
     for(let i=0;i<40;i++)tick();bike.finishEnter();for(let i=0;i<35;i++)tick();const stationary=pose(),rideDuration=clips.peek(assets.vehicle.animation,`${assets.vehicle.animation}_ride`)!.duration;
     const start=rows.length;for(let i=0;i<120;i++)tick(1);
     const moving=pose(),angle=rows.at(-1).crank,crankBasis=[...crank.matrix.elements];
     const movingRows=rows.slice(start);tick();const coastStart=bike.rideTime;
     for(let i=0;i<14;i++)tick();const coastEnd=bike.rideTime,coastCrank=[...crank.matrix.elements],coastAngle=rows.at(-1).crank;
     pose();const matrices=()=>[...(view as any).vehicleBindings.get(moving.idle).poseTargets].map((target:any)=>[...target.matrix.elements]),beforeFreeze=matrices();
     const frozenCount=rows.length;bike.frozen=true;tick(1);const frozenTime=bike.rideTime,frozenCrank=[...crank.matrix.elements];pose();const frozenMatrices=matrices();bike.afterStep();pose();const repeatedMatrices=matrices();bike.frozen=false;
     const abandonedCount=rows.length;bike.occupied=false;tick();const abandonedTime=bike.rideTime,abandonedRows=rows.length;bike.finishEnter();const remountStart=rows.length;tick(1);
     // Reverse motion takes the native rider fallback; a fully faded pedal must not return as a full-body base.
     for(let i=0;i<20;i++){bike.beforeStep(1/60,{throttle:0,steer:0,brake:false});bike.body.setLinvel({x:0,y:0,z:4},true);sim.world.step();bike.afterStep();bike.update(1);}
     const fallback=pose();
     // Strong physical lean selects the ordinary fallback; returning to a moderate
     // lean exercises native phase seeding when pedal/sprint is requested again.
     const forward=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(bike.body.rotation()));
     for(let i=0;i<35;i++){bike.beforeStep(1/60,{throttle:1,steer:.7,brake:false});bike.lean=.75;bike.body.setLinvel({x:forward.x*4,y:forward.y*4,z:forward.z*4},true);sim.world.step();bike.afterStep();bike.update(1);}
     const leaning=pose(),filtered=(bike as any).bicycleRider.state.lean;
     for(let i=0;i<8;i++){bike.beforeStep(1/60,{throttle:1,steer:0,brake:false});bike.lean=0;bike.body.setLinvel({x:forward.x*4,y:forward.y*4,z:forward.z*4},true);sim.world.step();bike.afterStep();bike.update(1);pose();}
     const resumed=pose(),visible=view.root.visible;
     bike.occupied=false;tick();WorldBike.hasDriverPed=(b:any)=>b===bike;for(let i=0;i<45;i++)tick(1,.25);const scripted=pose(),scriptPlayer=rows.at(-1).nativeInput.player;WorldBike.hasDriverPed=undefined;
     out.push({id,beforeFreeze,frozenMatrices,repeatedMatrices,rideDuration,scripted,scriptPlayer,stationary,leaning,filtered,resumed,visible,fallback,movingRows,movingTime:moving.time,angle,crankBasis,coastStart,coastEnd,coastCrank,coastAngle,frozenCount,frozenRows:abandonedCount,frozenTime,frozenCrank,abandonedCount,abandonedRows,abandonedTime,remount:rows.slice(remountStart)});
    }finally{bike.dispose();sim.dispose();}
   }
  }finally{view.dispose();WorldBike.hasDriverPed=undefined;NativeBicycleRider.prototype.step=original;WorldBike.riderClipSeconds=undefined;}
  return {models:out,rows,rootCaptures};
 });
 writeFileSync('artifacts/bicycle-rider-cadence-live.json',JSON.stringify({result,errors},null,2));
 for(const r of result.models){
  expect(r.stationary.baseTime).toBe(r.rideDuration);expect(r.scriptPlayer).toBe(false);expect(r.scripted.partials?.length).toBeGreaterThan(0);expect(r.frozenMatrices).toEqual(r.beforeFreeze);expect(r.repeatedMatrices).toEqual(r.frozenMatrices);expect(r.visible).toBe(true);expect(r.stationary.partials?.some((p:any)=>/_still$/.test(p.clip)&&p.amount===1)).toBe(true);expect(r.filtered).toBeGreaterThan(.5);expect(r.leaning.partials?.some((p:any)=>/_right$/.test(p.clip))).toBe(true);expect(r.leaning.overlay).toBeUndefined();expect(r.resumed.partials?.some((p:any)=>/_(pedal|sprint)$/.test(p.clip))).toBe(true);
  const playing=r.movingRows.filter((row:any)=>row.output?.playing);expect(playing.length).toBeGreaterThan(50);expect(r.movingTime).toBeGreaterThan(0);expect(Math.abs(r.movingTime-2)).toBeGreaterThan(.05);
  expect(Math.max(...playing.map((row:any)=>row.output.cadence))-Math.min(...playing.map((row:any)=>row.output.cadence))).toBeGreaterThan(.05);
  expect(r.crankBasis[5]).toBeCloseTo(Math.cos(r.angle),5);expect(r.crankBasis[6]).toBeCloseTo(Math.sin(r.angle),5);
  expect(r.coastEnd).toBe(r.coastStart);expect(r.coastCrank[5]).toBeCloseTo(Math.cos(r.coastAngle),5);expect(r.coastCrank[6]).toBeCloseTo(Math.sin(r.coastAngle),5);expect(r.frozenRows).toBe(r.frozenCount);expect(r.frozenTime).toBe(r.coastEnd);expect(r.frozenCrank).toEqual(r.coastCrank);
  expect(r.fallback.idle).toMatch(/_ride$/);expect(r.fallback.overlay).toBeUndefined();expect(r.fallback.partials?.some((p:any)=>/_back$/.test(p.clip))).toBe(true);expect(r.fallback.partials?.some((p:any)=>/_(pedal|sprint)$/.test(p.clip))).toBe(false);
  expect(r.abandonedRows).toBe(r.abandonedCount);expect(r.abandonedTime).toBe(0);expect(r.remount[0].before).toBe(0);
 }
 for(const row of result.rows)for(const a of row.afterAssociations){expect(a.time).toBeGreaterThanOrEqual(0);expect(a.time).toBeLessThanOrEqual(a.duration);expect(a.amount).toBeGreaterThanOrEqual(0);expect(a.amount).toBeLessThanOrEqual(1);}
 expect(result.rootCaptures.length).toBeGreaterThanOrEqual(30);expect(errors).toEqual([]);
});
