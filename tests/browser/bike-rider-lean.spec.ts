import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('loaded motorcycle and quad riders sample native lean phase, preserve residual direction and hold on freeze',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary},{NativeBikeRiderLean},{openWorldPedestrians},{NativeCharacter}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts','/src/simulation/nativeBikeRiderLean.ts','/src/assets/worldPedestrians.ts','/src/render/NativeCharacter.ts'].map(path=>import(path)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),clips=new VehicleAnimationLibrary(base),pedestrians=await openWorldPedestrians(base),view=new NativeCharacter(pedestrians.models[1]),out:any[]=[],rows:any[]=[],original=NativeBikeRiderLean.prototype.step;
  WorldBike.riderClipSeconds=(block:string,clip:string)=>clips.peek(block,clip)?.duration;
  NativeBikeRiderLean.prototype.step=function(this:any,dt:number,lean:number,full:number,player:boolean,available:number,reverse:boolean){
   const previous=this.filtered;original.call(this,dt,lean,full,player,available,reverse);
   rows.push({filter:{lean:Math.fround(lean),fullAnimLean:Math.fround(full),previous,timeStep:Math.fround(dt*50),reverse},filtered:this.filtered,pose:{lean:this.filtered,forward:0,available,player,durations:Object.fromEntries(this.associations.map((a:any)=>[a.identifier,a.duration]))},active:this.associations.filter((a:any)=>a.amount>0).map(({identifier,amount,time,flags}:any)=>({identifier,amount,time,flags}))});
  };
  try{
   for(const id of [448,461,462,463,468,471,521,522,523,581,586]){
    const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
    const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
    try{
     const block=await clips.block(assets.vehicle.animation);view.installVehicleClips(Object.fromEntries(block));
     const tick=(throttle=0,steer=0)=>{bike.beforeStep(1/60,{throttle,steer,brake:false});sim.world.step();bike.afterStep();bike.update(1);};
     const pose=()=>{const p=bike.riderPose();view.updateVehicle({vehicle:bike.root,local:p.seat!},{clip:p.idle,seconds:p.time,partials:p.partials});return p;};
     for(let i=0;i<40;i++)tick();bike.finishEnter();for(let i=0;i<90;i++)tick(1);
     for(let i=0;i<35;i++)tick(.7,.5);const right=pose(),owner=(bike as any).riderLeanAnimation;
     if(!owner)throw Error(`Missing loaded rider owner ${id}`);
     const filtered=owner.filtered,count=rows.length;
     // Changing steering does not instantly change the residual filtered lean's side.
     for(let i=0;i<6;i++)tick(.7,-.5);const reversed=pose(),reversedFiltered=owner.filtered,reversedSteer=bike.steer;
     const matrices=()=>[...(view as any).vehicleBindings.get(right.partials![0].clip).poseTargets].map((target:any)=>[...target.matrix.elements]);
     const beforeFreeze=matrices();bike.frozen=true;tick(1,1);const frozen=pose(),frozenMatrices=matrices(),frozenFiltered=owner.filtered,frozenRows=rows.length;bike.frozen=false;
     bike.afterStep();pose();const repeated=matrices();
     bike.occupied=false;tick();const cleared=!(bike as any).riderLeanAnimation;
     WorldBike.hasDriverPed=(b:any)=>b===bike;for(let i=0;i<60;i++)tick(1,.25);const scripted=pose();WorldBike.hasDriverPed=undefined;
     bike.occupied=true;const newOwner=(bike as any).riderLeanAnimation,reverseStart=newOwner.filtered,forward=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(bike.body.rotation())),reverseSpeed=(Math.fround(assets.handling.maxReverseVelocity)*1.5-.02)*50;
     bike.body.setLinvel({x:forward.x*reverseSpeed,y:forward.y*reverseSpeed,z:forward.z*reverseSpeed},true);tick();pose();const reverseEnd=newOwner.filtered,reverseActive=rows.at(-1).filter.reverse;

     out.push({id,right,filtered,reversed,reversedFiltered,reversedSteer,count,frozen,frozenFiltered,frozenRows,beforeFreeze,frozenMatrices,repeated,cleared,scripted,reverseStart,reverseEnd,reverseActive,visible:view.root.visible,durations:Object.fromEntries([...block].map(([name,clip]:any)=>[name,clip.duration]))});
    }finally{bike.dispose();sim.dispose();}
   }
  }finally{view.dispose();WorldBike.riderClipSeconds=undefined;WorldBike.hasDriverPed=undefined;NativeBikeRiderLean.prototype.step=original;}
  return {models:out,rows};
 });
 writeFileSync('artifacts/bike-rider-lean-live.json',JSON.stringify({result,errors},null,2));
 for(const r of result.models){
  expect(r.visible).toBe(true);expect(r.filtered).toBeGreaterThan(0);expect(r.reversedFiltered).toBeGreaterThan(0);expect(r.reversedSteer).toBeLessThan(0);
  expect(r.right.partials?.[0].clip).toMatch(/_right$/);expect(r.reversed.partials?.[0].clip).toMatch(/_right$/);
  for(const layer of r.right.partials??[]){expect(layer.amount).toBe(1);expect(layer.seconds).toBeGreaterThan(0);expect(layer.seconds).toBeLessThan(r.durations[layer.clip]);}
  expect(r.frozenFiltered).toBe(r.reversedFiltered);expect(r.frozenRows).toBe(r.count+6);expect(r.frozen.partials).toEqual(r.reversed.partials);expect(r.frozenMatrices).toEqual(r.beforeFreeze);expect(r.repeated).toEqual(r.frozenMatrices);expect(r.cleared).toBe(true);expect(r.scripted.partials?.length).toBeGreaterThan(0);expect(r.reverseActive).toBe(true);expect(r.reverseStart).toBeGreaterThan(0);expect(r.reverseEnd).toBeGreaterThan(0);expect(r.reverseEnd).toBeLessThan(r.reverseStart);
  for(const matrix of r.frozenMatrices)expect(matrix.every(Number.isFinite)).toBe(true);
 }
 expect(errors).toEqual([]);
});
