import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';

test('a script boat releases its anchor and maintains native propeller-water effects through dry, wet and removal states',async({page})=>{
 test.setTimeout(180000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/models.html');
 const result=await page.evaluate(async()=>{
  const [{openStaticWorld},{openStaticWorldVehicles},{WorldBoat},{WorldFx},{Simulation},{resolveCarColors},{THREE,RAPIER}]=await Promise.all(['/src/assets/staticWorldArchive.ts','/src/assets/staticWorldVehicles.ts','/src/simulation/WorldBoat.ts','/src/simulation/fx/WorldFx.ts','/src/simulation/Simulation.ts','/src/assets/carColors.ts','/tests/fixtures/native-render-dependencies.ts'].map(p=>import(/* @vite-ignore */ p)));
  await RAPIER.init();const base=new URL('/play/world/',location.href).href,catalog=await openStaticWorldVehicles(await openStaticWorld(base)),assets=await catalog.load(452),sim=new Simulation(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,1.8,.05,300);sim.player.position={x:0,y:3,z:0};sim.playerCollider.setEnabled(false);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,500);renderer.setClearColor(0x25303b);
  const boat=new WorldBoat(sim,scene,assets,{x:0,y:.5,z:0},0,resolveCarColors(catalog.colors,assets.vehicle.model,0).colors),fx=new WorldFx(scene,sim,camera);boat.waterLevel=()=>0;boat.setLighting([1,1,1],1,0);fx.waterLevel=()=>0;
  await fx.load(base);const start={...boat.body.translation()},rows:any[]=[];
  const systems=()=>fx.manager.systems.filter((s:any)=>s.name==='boat_prop');
  const capture=(mode:string)=>{const props=systems();rows.push({mode,anchored:boat.anchored,occupied:boat.occupied,submerged:boat.submergedInWater,position:boat.disposed?null:{...boat.body.translation()},engineOn:boat.pilot?.engineOn,systems:props.map((s:any)=>({play:s.playStatus,local:s.createLocal,constTime:s.constTime,parent:[...s.parent]})),particles:fx.manager.prims.flatMap((p:any)=>p.particles).filter((p:any)=>props.includes(p.system)).length});};
  const step=(seconds:number,include=true)=>{for(let i=0;i<Math.round(seconds*60);i++){if(include){boat.beforeStep(1/60);sim.world.step();boat.afterStep();boat.update(1);const p=boat.body.translation();camera.position.set(p.x+5,p.y+3,p.z+9);camera.lookAt(p.x,p.y,p.z);camera.updateMatrixWorld();}fx.step(1/60,[],[],[],[],include?[boat]:[]);}fx.draw(0);};
  let shot='';
  try{
   boat.tellBoatToGoToCoors(0,100,0);step(3);capture('navigating');const original=[...systems()];renderer.render(scene,camera);shot=renderer.domElement.toDataURL();
   const p=boat.body.translation();boat.body.setTranslation({x:p.x,y:50,z:p.z},true);boat.body.setLinvel({x:0,y:0,z:0},true);step(1/60);boat.frozen=true;step(2);capture('dry');
   boat.frozen=false;boat.body.setTranslation({x:p.x,y:.5,z:p.z},true);boat.body.setLinvel({x:0,y:0,z:0},true);step(2);capture('wet again');const reused=systems().every((s:any,i:number)=>s===original[i]);
   boat.boatStop();step(.1);capture('engine stopped');boat.dispose();step(4,false);capture('removed');
   fx.dispose();sim.dispose();renderer.render(scene,camera);const geometries=renderer.info.memory.geometries;renderer.dispose();return {rows,start,reused,geometries,children:scene.children.length,shot};
  }catch(error){fx.dispose();if(!boat.disposed)boat.dispose();sim.dispose();renderer.dispose();throw error;}
 });
 const {shot,...summary}=result;writeFileSync('artifacts/boat-propeller-fx.json',JSON.stringify({...summary,errors},null,2));writeFileSync('artifacts/boat-propeller-fx.png',Buffer.from(shot.split(',')[1],'base64'));
 const [moving,dry,wet,stopped,removed]=result.rows;expect(moving.anchored).toBe(false);expect(moving.occupied).toBe(false);expect(Math.hypot(moving.position.x-result.start.x,moving.position.z-result.start.z)).toBeGreaterThan(1);expect(moving.submerged).toBe(true);expect(moving.systems).toHaveLength(2);expect(moving.systems.every((s:any)=>s.local&&s.play===0)).toBe(true);expect(moving.particles).toBeGreaterThan(0);
 expect(dry.submerged).toBe(false);expect(dry.systems.every((s:any)=>s.play===1)).toBe(true);expect(wet.submerged).toBe(true);expect(wet.systems.every((s:any)=>s.play===0)).toBe(true);expect(result.reused).toBe(true);expect(stopped.engineOn).toBe(false);expect(stopped.systems.every((s:any)=>s.play===0)).toBe(true);expect(removed.systems).toHaveLength(0);expect(removed.particles).toBe(0);expect(result.children).toBe(0);expect(result.geometries).toBe(0);expect(errors).toEqual([]);
});
