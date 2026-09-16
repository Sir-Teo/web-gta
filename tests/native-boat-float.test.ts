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

test.skipIf(!process.env.GTA_CONTENT_DIR)('a Predator hull settles onto flat water and trails a wake',async()=>{
 await RAPIER.init();
 const depot=process.env.GTA_CONTENT_DIR!,archive=await openAsBlob(join(depot,'gta3.img')),entries=await readImgIndex(archive);
 const model=readDff(await readImgEntry(archive,entries.find(e=>e.name==='predator.dff')!));
 const vehicle=readVehicleIde(readFileSync(join(depot,'vehicles/vehicles.ide'),'utf8')).records.find(r=>r.id===430)!;
 const handlingFile=readHandling(readFileSync(join(depot,'vehicles/handling.cfg'),'utf8'));
 const row=handlingFile.records.find(r=>r.name===vehicle.handling)!;
 const assets={vehicle,handling:row,collision:model.embeddedCollisions![0],model,textures:[],missingTextures:[],supplements:handlingFile.supplements.filter(r=>r.tokens[0]===vehicle.handling)};
 const sim=new Simulation(),scene=new Scene();
 const boat=new WorldBoat(sim,scene,assets as never,{x:0,y:3,z:0});
 boat.waterLevel=()=>0;
 try{
  boat.body.setLinvel({x:5,y:0,z:0},true);
  for(let i=0;i<240;i++){boat.beforeStep(1/60);sim.world.step();}
  const snap=boat.snapshot();
  expect(snap.inWater).toBe(true);
  expect(snap.immersion).toBeGreaterThan(.05);expect(snap.immersion).toBeLessThan(1);
  expect(snap.position.y).toBeGreaterThan(-5);expect(snap.position.y).toBeLessThan(2);
  expect(snap.wake).toBeGreaterThan(0);
 }finally{boat.dispose();sim.dispose();expect(scene.children).toHaveLength(0);}
});
