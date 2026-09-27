import {test,expect} from '@playwright/test';

/** A traffic car with its driver, and a world stepped around it. */
const setup=`
  const [{WorldTraffic},{WorldFleet},{Simulation},{loadWorldRoadMaterials},{THREE,RAPIER}]=await Promise.all(['/src/simulation/WorldTraffic.ts','/src/simulation/WorldFleet.ts','/src/simulation/Simulation.ts','/src/assets/worldRoadMaterials.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const sim=new Simulation(),scene=new THREE.Scene(),base=new URL('/play/world/',location.href).href;
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(700,.5,700).setTranslation(2490,12,1680));sim.respawn={x:2495,y:12.55,z:1687};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const fleet=new WorldFleet(sim,scene,await loadWorldRoadMaterials(base),undefined,base),traffic=new WorldTraffic(sim,fleet,base);
  for(let i=0;i<300&&!traffic.snapshot().cars.length;i++){traffic.update(i*2100);await new Promise(r=>setTimeout(r,20));}
  if(!fleet.cars.size)throw new Error(JSON.stringify(traffic.snapshot()));
  const car=[...fleet.cars][0];
  const tick=()=>{const at=car.car.body.translation();sim.player.position={x:at.x+10,y:at.y,z:at.z+10};traffic.beforeStep(1/60);for(const c of fleet.cars)c.beforeStep(1/60,{x:0,y:0},false);sim.world.step();for(const c of fleet.cars)c.afterStep?.(1/60);traffic.afterStep?.(1/60);};
  for(let i=0;i<60;i++)tick();
`;

test('a driver shot dead is a corpse from the shot on, even if CJ drags him out at once',async({page})=>{
 test.setTimeout(180000);await page.goto('/models.html');
 const result=await page.evaluate(async setup=>{
  const run=new Function(`return (async()=>{${setup}
   try{const before=car.driverDead;const shot=traffic.driverShot(car,500);return {before:!!before,shot,dead:!!car.driverDead};}
   finally{traffic.dispose();fleet.dispose();sim.dispose();}})()`);
  return run();
 },setup);
 expect(result).toEqual({before:false,shot:'killed',dead:true});
});
