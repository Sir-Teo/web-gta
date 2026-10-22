import {test,expect} from '@playwright/test';

test('the RC Baron accelerates from rest on its original landing gear',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),scene=new THREE.Scene();
  sim.playerCollider.setEnabled(false);
  const groupsPath='/src/simulation/solverGroups.ts',{WORLD_MESH_SOLVER_GROUPS}=await import(/* @vite-ignore */ groupsPath);
  sim.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array([-500,0,-500,-500,0,500,500,0,500,500,0,-500]),new Uint32Array([0,1,2,0,2,3])).setSolverGroups(WORLD_MESH_SOLVER_GROUPS).setFriction(.7));
  const a=await catalog.load(464),plane=new WorldPlane(sim,scene,a,{x:0,y:-a.collision.bounds.min[2],z:0});plane.remoteControlled=true;plane.body.setTranslation({x:0,y:plane.baseOffset,z:0},true);
  try{
   for(let i=0;i<120;i++){plane.beforeStep(1/60,{throttle:0,pitch:0,roll:0,rudder:0,brake:false});sim.world.step();plane.afterStep();}
   const start=plane.snapshot();
   for(let i=0;i<600;i++){
    plane.beforeStep(1/60,{throttle:1,pitch:0,roll:0,rudder:0,brake:false});sim.world.step();plane.afterStep();
   }
   return {start,end:plane.snapshot()};
  }finally{plane.dispose();sim.dispose();}
 });
 console.log(JSON.stringify(result));expect(Math.hypot(result.end.position.x-result.start.position.x,result.end.position.z-result.start.position.z)).toBeGreaterThan(10);
 expect(Math.hypot(result.end.velocity.x,result.end.velocity.z)).toBeGreaterThan(5);
});
