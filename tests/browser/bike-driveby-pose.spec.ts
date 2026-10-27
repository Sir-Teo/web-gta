import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('all fourteen bike groups blend loaded drive-by poses and release back to their rider controller',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary},{NativeBikeRiderController},{NativeBicycleRider},{openWorldPedestrians},{NativeCharacter}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts','/src/simulation/nativeBikeRiderController.ts','/src/simulation/nativeBicycleRider.ts','/src/assets/worldPedestrians.ts','/src/render/NativeCharacter.ts'].map(p=>import(p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),clips=new VehicleAnimationLibrary(base),pedestrians=await openWorldPedestrians(base),view=new NativeCharacter(pedestrians.models[1]),models:any[]=[],rows:any[]=[],originalBike=NativeBikeRiderController.prototype.step,originalBmx=NativeBicycleRider.prototype.step;
  const record=function(this:any,original:any,dt:number,input:any,hopOrDriveBy:any,crank?:number,bmxDriveBy?:any){
   const bicycle=input.model!==undefined,driveBy=bicycle?bmxDriveBy:hopOrDriveBy,associations=this.associations.map(({group,...a}:any)=>a),state={...this.state},durations=Object.fromEntries([194,195,196,197,198,199,200,202,203,204,...(bicycle?[206,207,208]:[])].map(id=>[id,this.duration(id)]));
   const output=original.call(this,dt,input,hopOrDriveBy,crank,bmxDriveBy),timeStep=Math.fround(dt*50);
   const nativeInput={fire:driveBy?.fire??0,left:driveBy?.left??false,right:driveBy?.right??false,ammo:driveBy?.ammo??0,allowed:driveBy?.enabled??false,subtype:bicycle?10:9,dt,associations,durations,rider:{...input,previousLean:state.lean,previousForward:state.forward,timeStep,unclippedTimeStep:timeStep,crank:crank??0}};
   rows.push({nativeInput,shotReady:this.driveByShotReady,output,state:{...this.state},crank:this.crank,frame:this.associations.map(({identifier,amount,delta,time,speed,timeStep,flags}:any)=>({identifier,amount,delta,time,speed,timeStep,flags}))});return output;
  };
  NativeBikeRiderController.prototype.step=function(this:any,dt:number,input:any,driveBy?:any){return record.call(this,originalBike,dt,input,driveBy);};
  NativeBicycleRider.prototype.step=function(this:any,dt:number,input:any,hop?:boolean,crank?:number,driveBy?:any){return record.call(this,originalBmx,dt,input,hop,crank,driveBy);};
  WorldBike.riderClipSeconds=(block:string,clip:string)=>clips.peek(block,clip)?.duration;
  try{
   for(const id of [448,461,462,463,468,471,481,509,510,521,522,523,581,586]){
    const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
    const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0),bicycle=[481,509,510].includes(id);
    try{
     const block=await clips.block(assets.vehicle.animation);view.installVehicleClips(Object.fromEntries(block));
     const tick=(fire:number,left=false,right=false,ammo=100)=>{bike.beforeStep(1/60,{throttle:1,steer:.25,brake:false,driveBy:{enabled:true,fire,left,right,ammo,bicycle}});sim.world.step();bike.afterStep();bike.update(1);};
     const pose=()=>{const p=bike.riderPose();view.updateVehicle({vehicle:bike.root,local:p.seat!},{clip:p.idle,seconds:p.baseTime??p.time,partials:p.partials});return p;};
     bike.finishEnter();for(let i=0;i<40;i++)tick(0);
     for(let i=0;i<24;i++)tick(1,true);const left=pose(),leftActive=bike.riderDriveByActive,leftReady=bike.riderDriveByShotReady,leftMode=(bike as any).bicycleRider?.decision?.mode;
     for(let i=0;i<24;i++)tick(1,false,true);const right=pose(),rightReady=bike.riderDriveByShotReady;
     for(let i=0;i<24;i++)tick(1);const forward=pose(),forwardReady=bike.riderDriveByShotReady;
     const owner=(bike as any).bicycleRider??(bike as any).riderAnimation,beforeFreeze=structuredClone(owner.associations);bike.frozen=true;tick(1);pose();const afterFreeze=structuredClone(owner.associations),frozenReady=bike.riderDriveByShotReady;bike.frozen=false;
     for(let i=0;i<12;i++)tick(0);const released=pose(),releasedActive=bike.riderDriveByActive;
     for(let i=0;i<24;i++)tick(1,true);for(let i=0;i<12;i++)tick(1,true,false,0);const empty=pose();
     for(let i=0;i<24;i++)tick(1,true);bike.occupied=false;WorldBike.hasDriverPed=(b:any)=>b===bike;tick(0);const handoff=pose();WorldBike.hasDriverPed=undefined;
     models.push({id,handoff,bicycle,left,leftActive,leftReady,leftMode,right,rightReady,forward,forwardReady,frozenReady,released,releasedActive,empty,beforeFreeze,afterFreeze,visible:view.root.visible});
    }finally{bike.dispose();sim.dispose();}
   }
  }finally{view.dispose();WorldBike.hasDriverPed=undefined;WorldBike.riderClipSeconds=undefined;NativeBikeRiderController.prototype.step=originalBike;NativeBicycleRider.prototype.step=originalBmx;}
  return {models,rows};
 });
 writeFileSync('artifacts/bike-driveby-pose-live.json',JSON.stringify({result,errors},null,2));
 for(const r of result.models){
  const driveBy=(p:any)=>p.partials?.filter((a:any)=>/driveby/.test(a.clip))??[];
  expect(r.visible).toBe(true);expect(r.leftActive).toBe(true);expect(r.leftReady).toBe(true);expect(r.rightReady).toBe(true);expect(r.forwardReady).toBe(true);expect(r.frozenReady).toBe(false);expect(driveBy(r.left).some((a:any)=>/lhs$/.test(a.clip)&&a.amount===1)).toBe(true);expect(driveBy(r.right).some((a:any)=>/rhs$/.test(a.clip)&&a.amount===1)).toBe(true);expect(driveBy(r.forward).some((a:any)=>/ft$/.test(a.clip)&&a.amount===1)).toBe(true);
  expect(r.afterFreeze).toEqual(r.beforeFreeze);expect(r.releasedActive).toBe(false);expect(driveBy(r.released)).toEqual([]);expect(driveBy(r.empty)).toEqual([]);expect(driveBy(r.handoff)).toEqual([]);if(r.bicycle)expect(r.leftMode).toBe('ride');
 }
 expect(errors).toEqual([]);
});
