import {test,expect} from '@playwright/test';

test('a frozen Maverick spins its real rotor frames, winds down and retains solid body collision',async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),sim=new Simulation(),heli=new WorldPlane(sim,new THREE.Scene(),await catalog.load(487),{x:0,y:100,z:0});
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(100,1,100).setTranslation(0,79,0));
  sim.player.position={x:0,y:100,z:0};heli.remoteControlled=true;heli.frozen=true;
  const rotors:any[]=[];heli.root.traverse((o:any)=>{if(o.userData.nativeFrame!==undefined&&/^static_rotor/.test(o.name.toLowerCase()))rotors.push(o);});
  const input={throttle:1,pitch:1,roll:1,rudder:1,brake:false},position={...heli.body.translation()},rotation={...heli.body.rotation()},before=rotors.map(o=>o.matrix.toArray());
  try{
   for(let i=0;i<60;i++){heli.beforeStep(1/60,input);sim.world.step();heli.afterStep();heli.update(1);}
   const speed=heli.rotorSpeed,changed=rotors.map((o,i)=>o.matrix.toArray().some((v:number,j:number)=>Math.abs(v-before[i][j])>1e-4)),held={...heli.body.translation()},heldRotation={...heli.body.rotation()};
   let solid=false;for(let x=-2;x<=2&&!solid;x++)for(let z=-4;z<=4&&!solid;z++)solid=!!sim.world.castRay(new RAPIER.Ray({x,y:110,z},{x:0,y:-1,z:0}),20,true,undefined,undefined,undefined,undefined,(c:any)=>c.parent()?.handle===heli.body.handle);
   heli.remoteControlled=false;for(let i=0;i<120;i++){heli.beforeStep(1/60,input);sim.world.step();heli.afterStep();heli.update(1);}
   const stopped=rotors.map(o=>o.matrix.toArray());for(let i=0;i<10;i++){heli.beforeStep(1/60,input);sim.world.step();heli.update(1);}
   return {rotorCount:rotors.length,speed,changed,position,rotation,held,heldRotation,solid,stoppedSpeed:heli.rotorSpeed,stoppedFrames:rotors.every((o,i)=>o.matrix.toArray().every((v:number,j:number)=>v===stopped[i][j])),enabled:heli.body.isEnabled(),final:{...heli.body.translation()}};
  }finally{heli.dispose();sim.dispose();}
 });
 expect(result.rotorCount).toBeGreaterThan(0);expect(result.speed).toBeCloseTo(.03,6);expect(result.changed.every(Boolean)).toBe(true);expect(result.held).toEqual(result.position);expect(result.heldRotation).toEqual(result.rotation);expect(result.final).toEqual(result.position);expect(result.solid).toBe(true);expect(result.enabled).toBe(true);expect(result.stoppedSpeed).toBe(0);expect(result.stoppedFrames).toBe(true);expect(errors).toEqual([]);
});
