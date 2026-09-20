import {test,expect} from '@playwright/test';

test('a shattered windscreen hands its glass quad to the pane system',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{WorldFleet},{Simulation},{loadWorldRoadMaterials},{DAMSTATE},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/src/simulation/nativeCarDamage.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(300,.5,300).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base) as any;
  try{
   for(let i=0;i<300&&!fleet.catalog;i++){fleet.update(i*100);await new Promise(r=>setTimeout(r,20));}
   const car=await fleet.spawnTrafficCar(492,{x:2500,y:12.5,z:1700},Math.PI/6);
   for(let i=0;i<30;i++){car.beforeStep(1/60,{x:0,y:0},false);sim.world.step();car.afterStep(1/60);}
   const frame=car.windscreenGlassFrame();
   let handed:any=null;car.onWindscreenShatter=(f:any,speed:any)=>{handed={f,speed};};
   car.applyComponents([{kind:'panel',index:4,state:DAMSTATE.openedDamaged}]);
   const t=car.car.body.translation();
   return {frame:frame&&{extentRight:frame.extentRight,extentFwd:frame.extentFwd,center:frame.center,height:frame.center[2]-t.y},handed:!!handed,handedCenter:handed?.f.center,speed:handed?.speed};
  }finally{fleet.dispose();sim.dispose();}
 });
 expect(result.frame).toBeTruthy();
 // A Greenwood's windscreen: about a metre and a half wide, under a metre tall, above the body's centre.
 expect(result.frame!.extentRight).toBeGreaterThan(1);expect(result.frame!.extentRight).toBeLessThan(2.5);
 expect(result.frame!.extentFwd).toBeGreaterThan(0.3);expect(result.frame!.extentFwd).toBeLessThan(1.6);
 expect(result.frame!.height).toBeGreaterThan(0);
 expect(result.handed).toBe(true);
 expect(result.handedCenter).toEqual(result.frame!.center);
});
