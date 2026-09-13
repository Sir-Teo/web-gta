import { readFileSync } from 'node:fs';
import { beforeAll, afterEach, expect, test } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Scene } from 'three';
import { Simulation } from '../src/simulation/Simulation';
import { readCol } from '../src/assets/col';
import { readDff } from '../src/assets/dff';
import { installNativeScene } from '../src/simulation/nativeScene';
import { importedSpawn } from '../src/simulation/importedSpawn';
import type { ScenePart } from '../src/assets/scene';
let sim: Simulation;
beforeAll(async () => { await RAPIER.init(); });
afterEach(() => sim?.dispose());
const part = (): ScenePart => ({ name: 'walk_floor', model: readDff(new Uint8Array(readFileSync('tests/fixtures/walk-floor.dff'))), collision: readCol(new Uint8Array(readFileSync('tests/fixtures/walk-floor.col')))[0], collisionSource: 'floor.col', dictionaryNames: [], notices: [], textures: [], placements: [{ modelId: 500, modelName: 'walk_floor', instanceType: 0, interior: 0, position: [100,200,5], rotation: [0,0,0,1], lodIndex: -1 }] });
test('imported simulation walks on matched source collision and respawns on that scene', () => {
  sim = new Simulation(true); expect(sim.vehicles).toHaveLength(0); expect(sim.population.pedestrians).toHaveLength(0); expect(sim.world.colliders.len()).toBe(1);
  const parts = [part()], installed = installNativeScene(sim.world, new Scene(), parts); sim.world.step();
  sim.respawn = importedSpawn(sim.world, parts, new Set(installed.sources.keys()), sim.playerCollider); sim.resetPlayer();
  const start = { ...sim.player.position };
  for (let i = 0; i < 60; i++) sim.step(1/60, { x: 0, y: 1, sprint: false, jump: false, handbrake: false, cameraYaw: 0 });
  expect(sim.player.grounded).toBe(true); expect(sim.player.position.y).toBeCloseTo(5, 1); expect(Math.hypot(sim.player.position.x-start.x, sim.player.position.z-start.z)).toBeGreaterThan(3);
  sim.resetPlayer(); expect(sim.player.position).toEqual(sim.respawn); installed.dispose();
});
test('unsupported spawn fails explicitly when imported shapes provide no upright surface', () => {
  sim = new Simulation(true); const source = part(); source.placements[0].rotation = [Math.SQRT1_2,0,0,Math.SQRT1_2];
  const installed = installNativeScene(sim.world, new Scene(), [source]); sim.world.step();
  expect(() => importedSpawn(sim.world, [source], new Set(installed.sources.keys()), sim.playerCollider)).toThrow('No clear supported spawn'); installed.dispose();
});

test('preferred scene spawn uses the requested ground point and falls back when unsupported', () => {
  sim=new Simulation(true);const parts=[part()],installed=installNativeScene(sim.world,new Scene(),parts);sim.world.step();
  const handles=new Set(installed.sources.keys());
  const spawn=importedSpawn(sim.world,parts,handles,sim.playerCollider,{x:102,z:-202});
  expect(spawn.x).toBe(102);expect(spawn.z).toBe(-202);expect(spawn.y).toBeCloseTo(5.05,3);
  const obstacle=sim.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(102,5.9,-202));
  sim.world.createCollider(RAPIER.ColliderDesc.ball(0.6),obstacle);sim.world.step();
  const nearby=importedSpawn(sim.world,parts,handles,sim.playerCollider,{x:102,z:-202});
  expect(Math.hypot(nearby.x-102,nearby.z+202)).toBeGreaterThan(0.5);expect(nearby.y).toBeCloseTo(5.05,3);
  sim.world.removeRigidBody(obstacle);
  const fallback=importedSpawn(sim.world,parts,handles,sim.playerCollider,{x:9000,z:9000});
  expect(fallback.y).toBeCloseTo(5.05,3);expect(fallback.x).toBeLessThan(200);
  expect(()=>importedSpawn(sim.world,parts,handles,sim.playerCollider,{x:NaN,z:0})).toThrow('Invalid preferred scene spawn');
  installed.dispose();
});
