import {test,expect} from '@playwright/test';
import {endStoryMission} from './freeRoam';

test('Andromada flies with its original handling and its cargo ramp moves visual and collision geometry',async({page})=>{
 test.setTimeout(120000);await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldPlane},{Simulation},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldPlane.ts','/src/simulation/Simulation.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(p)));
  await RAPIER.init();const catalog=await openStaticWorldVehicles(await openStaticWorld(new URL('/play/world/',location.href).href)),assets=await catalog.load(592),sim=new Simulation(),scene=new THREE.Scene();sim.playerCollider.setEnabled(false);
  const plane=new WorldPlane(sim,scene,assets,{x:0,y:300,z:0}) as any;plane.missionCar=true;
  try{
   const original=[...assets.collision.mesh.positions],frame=plane.root.getObjectByName('misc_b'),source=[...plane.physical.sources.values()].find((s:any)=>s.kind==='mesh') as any;
   if(!frame||!source)throw new Error('Andromada ramp frame or original COL is missing');const rest=frame.matrix.clone();
   plane.controlMovingComponent(1);const offset=plane.movingComponentOffset(),changed=source.mesh.positions.some((v:number,i:number)=>v!==original[i]),drawn=[...frame.matrix.elements],bounds=plane.collisionBounds;
   plane.controlMovingComponent(.5);const half=plane.movingComponentOffset();plane.controlMovingComponent(0);
   const reset=source.mesh.positions.every((v:number,i:number)=>Math.abs(v-original[i])<1e-4),positionUnchanged=frame.matrix.elements.slice(12,15).every((v:number,i:number)=>v===rest.elements[12+i]);
   plane.remoteControlled=true;plane.startsInAir();plane.propSpeed=1;plane.body.setLinvel({x:0,y:0,z:-60},true);
   const start={...plane.body.translation()};for(let i=0;i<600;i++){plane.beforeStep(1/60,{throttle:1,pitch:0,roll:0,rudder:0,brake:false});sim.world.step();plane.afterStep();}plane.update(1);
   return {offset,half,changed,drawn,reset,positionUnchanged,originalUnchanged:assets.collision.mesh.positions.every((v:number,i:number)=>v===original[i]),bounds,start,end:plane.snapshot(),movingTriangles:[...assets.collision.mesh.materials].filter(v=>v===65).length,mass:assets.handling.values.mass};
  }finally{plane.dispose();sim.dispose();}
 });
 console.log('Andromada',JSON.stringify(result));expect(result.mass).toBe(40000);expect(result.movingTriangles).toBeGreaterThan(0);expect(result.offset).toBeCloseTo(.375,6);expect(result.half).toBeCloseTo(result.offset/2,6);
 expect(result.changed).toBe(true);expect(result.reset).toBe(true);expect(result.positionUnchanged).toBe(true);expect(result.originalUnchanged).toBe(true);expect(result.drawn[6]).toBeCloseTo(Math.sin(result.offset),6);
 const p=result.end.position,v=result.end.velocity;expect([p.x,p.y,p.z,v.x,v.y,v.z].every(Number.isFinite)).toBe(true);expect(Math.hypot(p.x-result.start.x,p.y-result.start.y,p.z-result.start.z)).toBeGreaterThan(100);expect(Math.hypot(v.x,v.y,v.z)).toBeGreaterThan(20);expect(result.end.health).toBeGreaterThan(0);
});

test('CREATE_CAR routes model 592 to the aircraft host and its SCM ramp commands affect the cargo plane',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await page.getByRole('button',{name:'Explore San Andreas',exact:true}).click({timeout:120000});
 await page.waitForFunction(()=>(window as any).__game?.state()?.player?.grounded===true,undefined,{timeout:90000});await endStoryMission(page);
 const h=await page.evaluate(()=>{const m=(window as any).__game.missionForProfiling(),p=m.runtime.world.pedPosition(1);return m.vehicles.create(592,{x:p.x+20,y:p.y,z:p.z+100});});
 await page.waitForFunction(h=>!!(window as any).__game.missionForProfiling().vehicles.entity(h),h,{timeout:60000});
 const result=await page.evaluate(h=>{const g=(window as any).__game,m=g.missionForProfiling(),v=m.vehicles.entity(h),w=m.runtime.world;w.controlMovableVehiclePart(h,1);return {plane:g.fleet().planes.has(v),car:g.fleet().cars.has(v),offset:w.getCarMovingComponentOffset(h),name:v.name};},h);
 expect(result).toEqual({plane:true,car:false,offset:Math.fround(2500*Math.fround(.00015)),name:'Andromada'});
 await page.evaluate(h=>{const w=(window as any).__game.missionForProfiling().runtime.world;w.controlMovableVehiclePart(h,.5);w.taskWarpCharIntoCarAsDriver(1,h);w.setPlayerControl(0,true);},h);
 await expect.poll(()=>page.evaluate(h=>(window as any).__game.missionForProfiling().vehicles.entity(h).occupied,h)).toBe(true);
 const offset=()=>page.evaluate(h=>(window as any).__game.missionForProfiling().runtime.world.getCarMovingComponentOffset(h),h),start=await offset();
 await page.keyboard.down('Numpad2');await expect.poll(offset,{timeout:10000}).toBeGreaterThan(start+.03);await page.keyboard.up('Numpad2');
 const peak=await offset();await page.keyboard.down('Numpad8');await expect.poll(offset,{timeout:10000}).toBeLessThan(peak-.02);await page.keyboard.up('Numpad8');
 await page.evaluate(()=>(window as any).__game.missionForProfiling().runtime.world.setPlayerControl(0,false));const held=await offset();await page.keyboard.down('Numpad2');await page.waitForTimeout(500);await page.keyboard.up('Numpad2');expect(await offset()).toBe(held);
 expect(errors).toEqual([]);
});
