import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('all native motorcycle and bicycle forks steer about their vehicles.ide rake axes',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),out:any[]=[];
  for(const id of [448,461,462,463,468,481,509,510,521,522,523,581,586]){
   const sim=new Simulation(),scene=new THREE.Scene();sim.world.createCollider(RAPIER.ColliderDesc.cuboid(100,.5,100).setTranslation(0,-.5,0));sim.player.position={x:5,y:1,z:0};
   const assets=await loadFixedWorldBike(catalog,{modelId:id,primaryColor:-1,secondaryColor:-1}),bike=new WorldBike(sim,scene,assets,{x:0,y:1.5,z:0},0);
   try{
    const forkIndex=assets.model.frames.findIndex((f:any)=>f.name==='forks_front'),wheelIndex=assets.wheelFrames.front[0];let fork:any,wheel:any;bike.root.traverse((f:any)=>{if(f.userData.nativeFrame===forkIndex)fork=f;if(f.userData.nativeFrame===wheelIndex)wheel=f;});
    if(!fork||!wheel)throw Error(`Missing native fork/wheel ${id}`);
    const tick=(steer=0)=>{bike.beforeStep(1/60,{throttle:0,steer,brake:false});sim.world.step();bike.afterStep();bike.update(1);};for(let i=0;i<40;i++)tick();bike.finishEnter();
    const neutral=[...fork.matrix.elements];for(let i=0;i<25;i++)tick(.8);
    const left=[...fork.matrix.elements],angle=bike.steer*assets.handling.values.steeringLock*Math.PI/180,rake=assets.vehicle.misc*Math.PI/180,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,Math.sin(rake),-Math.cos(rake)),-angle),expected=new THREE.Matrix4().makeRotationFromQuaternion(q);expected.setPosition(neutral[12],neutral[13],neutral[14]);
    const previousSteer=bike.steer;tick(-.8);const nextSteer=bike.steer;bike.update(.5);const half=[...fork.matrix.elements];bike.update(.5);const repeated=[...fork.matrix.elements];
    out.push({id,rake:assets.vehicle.misc,angle,neutral,left,expected:[...expected.elements],half,repeated,previousSteer,nextSteer,parent:wheel.parent===fork,sourcePosition:assets.model.frames[forkIndex].matrix.slice(12,15)});
   }finally{bike.dispose();sim.dispose();}
  }
  return out;
 });
 writeFileSync('artifacts/bike-steering.json',JSON.stringify({result,errors},null,2));
 for(const r of result){
  expect(r.parent).toBe(true);expect(r.angle).toBeGreaterThan(.05);expect(r.left[4],`${r.id} fork turns left`).toBeLessThan(-.02);expect(r.left.slice(12,15)).toEqual(r.sourcePosition);
  r.left.forEach((v:number,i:number)=>expect(v).toBeCloseTo(r.expected[i],6));expect(r.half).toEqual(r.repeated);expect(r.half).not.toEqual(r.left);
  // Native SetUnity resets the imported resting orientation before applying the steering quaternion.
  expect(r.neutral.slice(0,12).map((v:number)=>v===0?0:v)).toEqual([1,0,0,0,0,1,0,0,0,0,1,0]);
 }
 expect(errors).toEqual([]);
});
