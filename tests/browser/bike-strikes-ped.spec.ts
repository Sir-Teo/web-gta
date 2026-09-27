import {test,expect} from '@playwright/test';

test('a bike ridden into a ped knocks him down and rides on through him',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/models.html');const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{loadFixedWorldBike},{WorldBike},{WorldPedestrians},{WantedSystem},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/assets/fixedWorldBike.ts','/src/simulation/WorldBike.ts','/src/simulation/WorldPedestrians.ts','/src/simulation/WantedSystem.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href;
  const catalog=await openStaticWorldVehicles(await openStaticWorld(base));
  const sim=new Simulation(),scene=new THREE.Scene();
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(2490,12,1680));
  sim.respawn={x:2491.5,y:12.55,z:1702};sim.resetPlayer();sim.world.step();sim.player.grounded=true;
  const law=new WantedSystem(),crowd=new WorldPedestrians(sim,scene,base,()=>undefined,law) as any;
  crowd.pedTargets=()=>({dealers:0,gangs:0,cops:0,other:1,gangStrengths:Array(10).fill(0)});
  const bike=new WorldBike(sim,scene,await loadFixedWorldBike(catalog,{modelId:461,primaryColor:-1,secondaryColor:-1}),{x:2490,y:13.5,z:1700},0);
  crowd.bikes=()=>[{body:bike.body,nativeBody:bike.nativeBody,occupied:bike.occupied,boundRadius:bike.boundRadius}];
  try{
   for(let i=0;i<300&&crowd.snapshot().people.length<1;i++){crowd.update(i*1600);await new Promise(r=>setTimeout(r,20));}
   const ped=crowd.people[0];if(!ped)throw new Error('no ped');
   const stand=(p:any,x:number,z:number)=>{p.actor.player.position={x,y:12.55,z};p.loiter=true;p.flee=0;p.body.setTranslation({x,y:13.45,z},true);p.body.setNextKinematicTranslation({x,y:13.45,z});p.collider.setTranslation({x,y:13.45,z});};
   stand(ped,2490,1685);
   for(let i=0;i<20;i++){crowd.beforeStep(1/60,[]);bike.beforeStep(1/60);sim.world.step();crowd.afterStep();bike.afterStep();}
   bike.interact();
   // Ride at the ped (heading 0 drives toward -z), holding him where he stands until he is struck.
   bike.body.setLinvel({x:0,y:0,z:-12},true);
   let struck=-1,speedAt=0;
   for(let i=0;i<150;i++){
    if(ped.down>0||ped.health<100){struck=i;speedAt=Math.abs(bike.snapshot().speed);break;}
    crowd.beforeStep(1/60,[]);bike.beforeStep(1/60,{throttle:1,steer:0,brake:false});sim.world.step();crowd.afterStep();bike.afterStep();bike.update(1);
    if(ped.down===0)stand(ped,2490,1685);
   }
   return {struck,down:ped.down,health:ped.health,speedAt,bikeZ:bike.body.translation().z,occupied:bike.snapshot().occupied};
  }finally{crowd.dispose?.();bike.dispose();sim.dispose();}
 });
 expect(result.struck).toBeGreaterThanOrEqual(0);
 expect(result.down>0||result.health<100).toBe(true);
 // The ped does not stop the bike dead as a wall would.
 expect(result.speedAt).toBeGreaterThan(5);
 expect(errors).toEqual([]);
});
