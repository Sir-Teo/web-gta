import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('native bike and quad wheel frames roll with travel without moving their centers',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),out:any[]=[];
  for(const id of [448,461,462,463,468,471,481,509,510,521,522,523,581,586]){
   const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
   const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
   try{
    const indices=[...assets.wheelFrames.front,...assets.wheelFrames.rear],frames:any[]=indices.map((index:number)=>{let frame:any;bike.root.traverse((f:any)=>{if(f.userData.nativeFrame===index)frame=f;});if(!frame)throw Error(`Missing wheel ${id}:${index}`);return frame;});
    const matrices=()=>frames.map(f=>[...f.matrix.elements]);
    const tick=(input={throttle:0,steer:0,brake:false})=>{bike.beforeStep(1/60,input);sim.world.step();bike.afterStep();bike.update(1);};
    for(let i=0;i<40;i++)tick();bike.finishEnter();const before=matrices(),start={...bike.body.translation()};
    for(let i=0;i<90;i++)tick({throttle:1,steer:0,brake:false});const rolling=matrices(),position={...bike.body.translation()},speed=bike.speed();
    bike.update(.5);const interpolated=matrices();bike.update(.5);const repeated=matrices();
    // A rear wheel locked by the brake holds its angle while the rolling front follows travel.
    tick({throttle:0,steer:0,brake:true});const brakeStart=matrices();tick({throttle:0,steer:0,brake:true});const brakeEnd=matrices();
    bike.frozen=true;tick();bike.update(0);const frozenStart=matrices();bike.update(1);const frozenEnd=matrices();
    out.push({id,rake:assets.vehicle.misc,steerFrames:assets.model.frames.filter((f:any)=>/forks_front|handlebars/.test(f.name)).map((f:any)=>({name:f.name,parent:assets.model.frames[f.parent]?.name,matrix:f.matrix})),front:assets.wheelFrames.front.length,frames:indices.map((i:number)=>({name:assets.model.frames[i].name,parent:assets.model.frames[assets.model.frames[i].parent].name,base:assets.model.frames[i].matrix})),before,rolling,interpolated,repeated,start,position,speed,brakeStart,brakeEnd,frozenStart,frozenEnd});
   }finally{bike.dispose();sim.dispose();}
  }
  return out;
 });
 writeFileSync('artifacts/bike-wheel-motion.json',JSON.stringify({result,errors},null,2));
 for(const r of result){
  expect(r.speed).toBeGreaterThan(2);expect(r.position.z).toBeLessThan(r.start.z-2);expect(r.repeated).toEqual(r.interpolated);expect(r.frozenStart).toEqual(r.frozenEnd);
  r.rolling.forEach((m:number[],i:number)=>{expect(m.slice(0,12),`${r.id} wheel ${i} rotates`).not.toEqual(r.before[i].slice(0,12));expect(m.slice(12,15)).toEqual(r.before[i].slice(12,15));});
  r.brakeEnd.forEach((m:number[],i:number)=>{if(i<r.front)expect(m.slice(0,12),`${r.id} front rolls under rear brake`).not.toEqual(r.brakeStart[i].slice(0,12));else expect(m).toEqual(r.brakeStart[i]);});
 }
 expect(errors).toEqual([]);
});
