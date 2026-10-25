import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('all three native bicycles articulate their cranks with the rider and keep pedal treads level',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER},{VehicleAnimationLibrary}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts','/src/assets/vehicleAnimations.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),clips=new VehicleAnimationLibrary(new URL('/play/world/',location.href).href),out:any[]=[];
  WorldBike.riderClipSeconds=(block:string,clip:string)=>clips.peek(block,clip)?.duration;WorldBike.hopClipSeconds=(id:number)=>{const block=id===509?'choppa':id===510?'mtb':'bmx';return clips.peek(block,`${block}_bunnyhop`)?.duration;};
  for(const id of [481,509,510]){
   const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
   const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
   try{
    await clips.block(assets.vehicle.animation);const names=['chainset','pedal_r','pedal_l'],indices=names.map(name=>assets.model.frames.findIndex((f:any)=>f.name===name)),frames=indices.map((index:number)=>{let frame:any;bike.root.traverse((f:any)=>{if(f.userData.nativeFrame===index)frame=f;});return frame;});
    if(frames.some((f:any)=>!f))throw Error(`Missing bicycle frames ${id}`);
    const matrices=()=>frames.map((f:any)=>[...f.matrix.elements]),tick=(throttle=0,hop=false)=>{bike.beforeStep(1/60,{throttle,steer:0,brake:false,hop});sim.world.step();bike.afterStep();bike.update(1);};
    for(let i=0;i<40;i++)tick();bike.finishEnter();const before=matrices();
    for(let i=0;i<87;i++)tick(1);
    const moving=matrices(),pose=bike.riderPose(),duration=clips.peek(pose.block,pose.idle)!.duration,angle=-Math.PI*2*(pose.time%duration)/duration;
    const level=frames.slice(1).map((f:any)=>new THREE.Matrix4().multiplyMatrices(frames[0].matrix,f.matrix).elements.slice(0,12));
    const last=matrices();bike.afterStep();bike.update(1);const noExtraStep=matrices();bike.update(.5);const half=matrices();bike.update(.5);const repeated=matrices();
    bike.frozen=true;tick(1);bike.update(0);const frozenStart=matrices();bike.update(1);const frozenEnd=matrices();bike.frozen=false;
    bike.occupied=false;for(let i=0;i<5;i++)tick();const abandoned=matrices();
    // Script drivers use the same association phase even with CJ outside the bike.
    WorldBike.hasDriverPed=(b:any)=>b===bike;for(let i=0;i<5;i++)tick(1);const scripted=matrices();WorldBike.hasDriverPed=undefined;
    bike.occupied=true;WorldBike.hopCooldown=0;
    for(let i=0;i<30;i++)tick(0,true);const charged=bike.riderPose().hop,chargedCrank=[...frames[0].matrix.elements];
    const jumpClip=charged&&clips.peek(assets.vehicle.animation,charged.clip),jumpDuration=jumpClip?.duration;
    bike.frozen=true;tick(0,true);const frozenHop=bike.riderPose().hop;bike.frozen=false;
    tick();const released=bike.riderPose().hop,releaseRemaining=bike.hopLaunch;let jumpVy=0;
    for(let i=0;i<90;i++){tick();jumpVy=Math.max(jumpVy,bike.body.linvel().y);}const cleared=bike.riderPose().hop===undefined;
    WorldBike.hopCooldown=0;for(let i=0;i<10;i++)tick(0,true);bike.occupied=false;tick();bike.occupied=true;tick();const remounted=bike.riderPose().hop===undefined;
    out.push({id,before,moving,angle,duration,level,last,noExtraStep,half,repeated,frozenStart,frozenEnd,abandoned,scripted,charged,chargedCrank,frozenHop,released,releaseRemaining,jumpDuration,jumpVy,cleared,remounted,source:indices.map((i:number)=>assets.model.frames[i].matrix.slice(12,15))});
   }finally{bike.dispose();sim.dispose();}
  }
  WorldBike.riderClipSeconds=undefined;WorldBike.hopClipSeconds=undefined;return out;
 });
 writeFileSync('artifacts/bicycle-pedals.json',JSON.stringify({result,errors},null,2));
 for(const r of result){
  expect(r.moving[0]).not.toEqual(r.before[0]);expect(r.moving[0][5]).toBeCloseTo(Math.cos(r.angle),5);expect(r.moving[0][6]).toBeCloseTo(Math.sin(r.angle),5);
  for(const basis of r.level)basis.forEach((v:number,i:number)=>expect(v,`${r.id} level pedal basis ${i}`).toBeCloseTo([1,0,0,0,0,1,0,0,0,0,1,0][i],6));
  r.moving.forEach((m:number[],i:number)=>expect(m.slice(12,15),`${r.id} ${i} mounting position`).toEqual(r.source[i]));
  expect(r.charged?.clip).toMatch(/_bunnyhop$/);expect(r.charged?.seconds).toBeCloseTo(.2,6);expect(r.charged?.amount).toBe(1);expect(r.frozenHop).toEqual(r.charged);
  expect(r.chargedCrank[5]).toBeCloseTo(0,5);expect(r.chargedCrank[6]).toBeCloseTo(1,5);
  expect(r.jumpDuration).toBeGreaterThan(.2);expect(r.released?.seconds).toBeCloseTo(r.jumpDuration-r.releaseRemaining*1.5,5);expect(r.jumpVy).toBeGreaterThan(4);expect(r.cleared).toBe(true);expect(r.remounted).toBe(true);
  expect(r.last).toEqual(r.noExtraStep);expect(r.half).toEqual(r.repeated);expect(r.frozenStart).toEqual(r.frozenEnd);expect(r.abandoned).toEqual(r.frozenEnd);expect(r.scripted).not.toEqual(r.abandoned);
 }
 expect(errors).toEqual([]);
});
