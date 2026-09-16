import {openAsBlob} from 'node:fs';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {expect,test} from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import {Scene} from 'three';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readDff} from '../src/assets/dff';
import {readVehicleIde} from '../src/assets/vehicleIde';
import {readHandling} from '../src/assets/handling';
import {Simulation} from '../src/simulation/Simulation';
import {WorldBoat} from '../src/simulation/WorldBoat';

/** Park the player capsule far away: the hull must float on water, not perch on it. */
function clearPlayer(sim:Simulation){
 sim.player.position={x:200,y:0,z:0};sim.player.previous={x:200,y:0,z:0};
 sim.playerBody.setTranslation({x:200,y:.9,z:0},true);sim.playerBody.setNextKinematicTranslation({x:200,y:.9,z:0});
}

test.skipIf(!process.env.GTA_CONTENT_DIR)('a Predator hull settles onto flat water and trails a wake',async()=>{
 await RAPIER.init();
 const depot=process.env.GTA_CONTENT_DIR!,archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive);
 const model=readDff(await readImgEntry(archive,entries.find(e=>e.name==='predator.dff')!));
 const vehicle=readVehicleIde(readFileSync(join(depot,'vehicles/vehicles.ide'),'utf8')).records.find(r=>r.id===430)!;
 const handlingFile=readHandling(readFileSync(join(depot,'vehicles/handling.cfg'),'utf8'));
 const row=handlingFile.records.find(r=>r.name===vehicle.handling)!;
 const assets={vehicle,handling:row,collision:model.embeddedCollisions![0],model,textures:[],missingTextures:[],supplements:handlingFile.supplements.filter(r=>r.tokens[0]===vehicle.handling)};
 const sim=new Simulation(),scene=new Scene();
 clearPlayer(sim);
 const boat=new WorldBoat(sim,scene,assets as never,{x:0,y:3,z:0});
 boat.waterLevel=()=>0;
 try{
  boat.body.setLinvel({x:5,y:0,z:0},true);
  for(let i=0;i<60;i++){boat.beforeStep(1/60);sim.world.step();}
  expect(boat.snapshot().inWater).toBe(true);
  expect(boat.snapshot().wake).toBeGreaterThan(0);
  for(let i=0;i<240;i++){boat.beforeStep(1/60);sim.world.step();}
  const snap=boat.snapshot();
  expect(snap.inWater).toBe(true);
  expect(snap.immersion).toBeGreaterThan(.05);expect(snap.immersion).toBeLessThan(.6);
  expect(snap.position.y).toBeGreaterThan(-3);expect(snap.position.y).toBeLessThan(2);
 }finally{boat.dispose();sim.dispose();expect(scene.children).toHaveLength(0);}
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('a driven Predator makes way, yaws with steering and checks with brake',async()=>{
 await RAPIER.init();
 const depot=process.env.GTA_CONTENT_DIR!,archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive);
 const model=readDff(await readImgEntry(archive,entries.find(e=>e.name==='predator.dff')!));
 const vehicle=readVehicleIde(readFileSync(join(depot,'vehicles/vehicles.ide'),'utf8')).records.find(r=>r.id===430)!;
 const handlingFile=readHandling(readFileSync(join(depot,'vehicles/handling.cfg'),'utf8'));
 const row=handlingFile.records.find(r=>r.name===vehicle.handling)!;
 const assets={vehicle,handling:row,collision:model.embeddedCollisions![0],model,textures:[],missingTextures:[],supplements:handlingFile.supplements.filter(r=>r.tokens[0]===vehicle.handling)};
 const sim=new Simulation(),scene=new Scene();
 clearPlayer(sim);
 const boat=new WorldBoat(sim,scene,assets as never,{x:0,y:1,z:0});
 boat.waterLevel=()=>0;boat.occupied=true;
 try{
  for(let i=0;i<120;i++){boat.beforeStep(1/60);sim.world.step();}
  expect(boat.snapshot().inWater).toBe(true);
  const start=boat.snapshot().position;
  for(let i=0;i<180;i++){boat.beforeStep(1/60,{throttle:1,steer:0,brake:false});sim.world.step();}
  const run=boat.snapshot().position;
  expect(Math.hypot(run.x-start.x,run.z-start.z)).toBeGreaterThan(2);
  expect(boat.snapshot().wake).toBeGreaterThan(0);
  const heading0=Math.atan2(boat.body.rotation().y,boat.body.rotation().w);
  for(let i=0;i<120;i++){boat.beforeStep(1/60,{throttle:.5,steer:.5,brake:false});sim.world.step();}
  const heading1=Math.atan2(boat.body.rotation().y,boat.body.rotation().w);
  expect(Math.abs(heading1-heading0)).toBeGreaterThan(.02);
  const v0=Math.hypot(...Object.values(boat.body.linvel()).slice(0,1),boat.body.linvel().z);
  for(let i=0;i<240;i++){boat.beforeStep(1/60,{throttle:0,steer:0,brake:true});sim.world.step();}
  const v1=Math.hypot(boat.body.linvel().x,boat.body.linvel().z);
  expect(v1).toBeLessThan(Math.max(v0,.5));
 }finally{boat.dispose();sim.dispose();}
});

test.skipIf(!process.env.GTA_CONTENT_DIR)('a boarded Predator warps in and refuses deep-water exits',async()=>{
 await RAPIER.init();
 const depot=process.env.GTA_CONTENT_DIR!,archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive);
 const model=readDff(await readImgEntry(archive,entries.find(e=>e.name==='predator.dff')!));
 const vehicle=readVehicleIde(readFileSync(join(depot,'vehicles/vehicles.ide'),'utf8')).records.find(r=>r.id===430)!;
 const handlingFile=readHandling(readFileSync(join(depot,'vehicles/handling.cfg'),'utf8'));
 const row=handlingFile.records.find(r=>r.name===vehicle.handling)!;
 const assets={vehicle,handling:row,collision:model.embeddedCollisions![0],model,textures:[],missingTextures:[],supplements:handlingFile.supplements.filter(r=>r.tokens[0]===vehicle.handling)};
 const sim=new Simulation(),scene=new Scene();
 clearPlayer(sim);
 const boat=new WorldBoat(sim,scene,assets as never,{x:0,y:1,z:0});
 boat.waterLevel=()=>0;
 try{
  // Too far to board.
  sim.player.position={x:50,y:0,z:0};
  expect(boat.interact()).toMatch(/Move closer/);
  expect(boat.occupied).toBe(false);
  // Alongside: immediate warp aboard (no boat entry clips exist).
  sim.player.position={x:2,y:1,z:0};
  expect(boat.interact()).toMatch(/W\/S throttle/);
  expect(boat.occupied).toBe(true);
  expect(sim.playerCollider.isEnabled()).toBe(false);
  // High above the water: leaving refused until swimming exists.
  boat.body.setTranslation({x:0,y:9,z:0},true);
  expect(boat.interact()).toMatch(/beach the boat/);
  expect(boat.occupied).toBe(true);
 }finally{boat.dispose();sim.dispose();}
});
