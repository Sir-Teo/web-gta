import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('loaded motorcycle and quad riders sample native lean phase, preserve residual direction and hold on freeze',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary},{NativeBikeRiderController},{openWorldPedestrians},{NativeCharacter}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts','/src/simulation/nativeBikeRiderController.ts','/src/assets/worldPedestrians.ts','/src/render/NativeCharacter.ts'].map(path=>import(path)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),clips=new VehicleAnimationLibrary(base),pedestrians=await openWorldPedestrians(base),view=new NativeCharacter(pedestrians.models[1]),out:any[]=[],rows:any[]=[],original=NativeBikeRiderController.prototype.step;
  WorldBike.riderClipSeconds=(block:string,clip:string)=>clips.peek(block,clip)?.duration;
  NativeBikeRiderController.prototype.step=function(this:any,dt:number,input:any){
   const previous={...this.state},associations=this.associations.map(({group,...a}:any)=>a),durations=Object.fromEntries([194,195,196,197,198,199,200].map(id=>[id,this.duration(id)]));
   const output=original.call(this,dt,input),timeStep=Math.fround(dt*50);
   const nativeInput={...input,dt,timeStep,unclippedTimeStep:timeStep,previousLean:previous.lean,previousForward:previous.forward,associations,durations};
   for(const key of ['speed','lean','leanFwd','fullAnimLean','maxFlatVelocity','maxReverseVelocity','gas','brake'])nativeInput[key]=Math.fround(nativeInput[key]);
   rows.push({nativeInput,state:{...this.state},output,reverse:output.reverse,frame:this.associations.map(({identifier,amount,delta,time,speed,timeStep,flags}:any)=>({identifier,amount,delta,time,speed,timeStep,flags}))});return output;
  };
  try{
   for(const id of [448,461,462,463,468,471,521,522,523,581,586]){
    const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
    const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
    try{
     const block=await clips.block(assets.vehicle.animation);view.installVehicleClips(Object.fromEntries(block));
     const tick=(throttle=0,steer=0)=>{bike.beforeStep(1/60,{throttle,steer,brake:false});sim.world.step();bike.afterStep();bike.update(1);};
     const pose=()=>{const p=bike.riderPose();view.updateVehicle({vehicle:bike.root,local:p.seat!},{clip:p.idle,seconds:p.baseTime??p.time,partials:p.partials});return p;};
     for(let i=0;i<40;i++)tick();bike.finishEnter();for(let i=0;i<40;i++)tick();const idle=pose(),heldBase=(bike as any).riderAnimation.time;
     for(let i=0;i<25;i++)tick(1);const accelerating=pose(),acceleratingForward=(bike as any).riderAnimation.state.forward;
     WorldBike.hasPassengerPed=(b:any)=>b===bike;for(let i=0;i<10;i++)tick(1);const passengerForward=(bike as any).riderAnimation.state.forward,passengerSeen=rows.at(-1).nativeInput.passenger;WorldBike.hasPassengerPed=undefined;
     for(let i=0;i<65;i++)tick(1);
     for(let i=0;i<35;i++)tick(.7,.5);const right=pose(),owner=(bike as any).riderAnimation;
     if(!owner)throw Error(`Missing loaded rider owner ${id}`);
     const filtered=owner.filtered,count=rows.length;
     // Changing steering does not instantly change the residual filtered lean's side.
     for(let i=0;i<6;i++)tick(.7,-.5);const reversed=pose(),reversedFiltered=owner.filtered,reversedSteer=bike.steer;
     const matrices=()=>[...(view as any).vehicleBindings.get(right.partials![0].clip).poseTargets].map((target:any)=>[...target.matrix.elements]);
     const beforeFreeze=matrices();bike.frozen=true;tick(1,1);const frozen=pose(),frozenMatrices=matrices(),frozenFiltered=owner.filtered,frozenRows=rows.length;bike.frozen=false;
     bike.afterStep();pose();const repeated=matrices();
     bike.occupied=false;tick();const cleared=!(bike as any).riderAnimation;
     WorldBike.hasDriverPed=(b:any)=>b===bike;for(let i=0;i<60;i++)tick(1,.25);const scripted=pose(),scriptGas=rows.at(-1).nativeInput.gas;WorldBike.hasDriverPed=undefined;
     bike.occupied=true;const newOwner=(bike as any).riderAnimation,reverseStart=newOwner.filtered,forward=new THREE.Vector3(0,0,-1).applyQuaternion(new THREE.Quaternion().copy(bike.body.rotation())),reverseSpeed=(Math.fround(assets.handling.maxReverseVelocity)*1.5-.02)*50;
     bike.body.setLinvel({x:forward.x*reverseSpeed,y:forward.y*reverseSpeed,z:forward.z*reverseSpeed},true);tick();pose();const reverseEnd=newOwner.filtered,reverseActive=rows.at(-1).reverse;
     const beforeBrake=newOwner.state.forward;bike.body.setLinvel({x:forward.x*5,y:forward.y*5,z:forward.z*5},true);tick(-1);pose();const afterBrake=newOwner.state.forward,brakePedal=rows.at(-1).nativeInput.brake,brakeTarget=rows.at(-1).output.forwardTarget;
     let quadReverse:any;
     if(id===471){
      bike.body.setLinvel({x:forward.x*-2.5,y:forward.y*-2.5,z:forward.z*-2.5},true);
      const reverseDuration=clips.peek(assets.vehicle.animation,'quad_reverse')!.duration;
      for(let i=0;i<Math.ceil(reverseDuration*60)+20;i++)tick(-1);
      const a=newOwner.associations.find((a:any)=>a.identifier===200);quadReverse=a?{...a,clip:pose().partials?.find((p:any)=>p.clip==='quad_reverse')?.clip}:undefined;
     }



     out.push({id,idle,heldBase,accelerating,acceleratingForward,passengerForward,passengerSeen,beforeBrake,afterBrake,brakePedal,brakeTarget,quadReverse,right,filtered,reversed,reversedFiltered,reversedSteer,count,frozen,frozenFiltered,frozenRows,beforeFreeze,frozenMatrices,repeated,cleared,scripted,scriptGas,reverseStart,reverseEnd,reverseActive,visible:view.root.visible,durations:Object.fromEntries([...block].map(([name,clip]:any)=>[name,clip.duration]))});
    }finally{bike.dispose();sim.dispose();}
   }
  }finally{view.dispose();WorldBike.riderClipSeconds=undefined;WorldBike.hasDriverPed=undefined;WorldBike.hasPassengerPed=undefined;NativeBikeRiderController.prototype.step=original;}
  return {models:out,rows};
 });
 writeFileSync('artifacts/bike-rider-lean-live.json',JSON.stringify({result,errors},null,2));
 for(const r of result.models){
  expect(r.visible).toBe(true);expect(r.idle.partials?.some((a:any)=>a.clip===(r.id===471?'quad_ride':r.idle.block==='wayfarer'?'wf_still':`${r.idle.block}_still`)&&a.amount===1)).toBe(true);expect(r.heldBase).toBe(r.durations[r.idle.idle]);expect(r.acceleratingForward).toBeLessThan(0);expect(r.passengerSeen).toBe(true);expect(Math.abs(r.passengerForward)).toBeLessThan(Math.abs(r.acceleratingForward));expect(r.brakePedal).toBeGreaterThan(.5);expect(r.brakeTarget).toBeGreaterThan(0);expect(r.afterBrake).toBeGreaterThan(r.beforeBrake);expect(r.filtered).toBeGreaterThan(0);expect(r.reversedFiltered).toBeGreaterThan(0);expect(r.reversedSteer).toBeLessThan(0);
  expect(r.right.partials?.[0].clip).toMatch(/_right$/);expect(r.reversed.partials?.[0].clip).toMatch(/_right$/);
  for(const layer of r.right.partials??[]){expect(layer.amount).toBeGreaterThan(0);expect(layer.amount).toBeLessThanOrEqual(1);expect(layer.seconds).toBeGreaterThan(0);expect(layer.seconds).toBeLessThan(r.durations[layer.clip]);}
  expect(r.frozenFiltered).toBe(r.reversedFiltered);expect(r.frozenRows).toBe(r.count+6);expect(r.frozen.partials).toEqual(r.reversed.partials);expect(r.frozenMatrices).toEqual(r.beforeFreeze);expect(r.repeated).toEqual(r.frozenMatrices);expect(r.cleared).toBe(true);expect(r.scripted.partials?.length).toBeGreaterThan(0);expect(r.scriptGas).toBe(1);expect(r.reverseActive).toBe(true);expect(r.reverseStart).toBeGreaterThan(0);expect(r.reverseEnd).toBeGreaterThan(0);expect(r.reverseEnd).toBeLessThan(r.reverseStart);
  if(r.id===471){expect(r.quadReverse?.clip).toBe('quad_reverse');expect(r.quadReverse.flags&2).toBe(0);expect(r.quadReverse.flags&1).toBe(0);expect(r.quadReverse.time).toBe(r.quadReverse.duration);}
  for(const matrix of r.frozenMatrices)expect(matrix.every(Number.isFinite)).toBe(true);
 }
 expect(errors).toEqual([]);
});
