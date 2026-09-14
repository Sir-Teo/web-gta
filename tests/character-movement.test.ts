import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import RAPIER from '@dimforge/rapier3d-compat';
import { Simulation } from '../src/simulation/Simulation';
import { characterMovement } from '../src/simulation/characterMovement';
let sim: Simulation;
beforeAll(async () => RAPIER.init());
afterEach(() => sim?.dispose());
const controls = { x: 0, y: 0, cameraYaw: 0, sprint: false, jump: false, handbrake: false };
function setup(floor: 'mesh' | 'box' | 'heightfield' = 'mesh') {
  sim = new Simulation(); sim.respawn = { x: 0, y: .03, z: 0 }; sim.resetPlayer();
  const shape = floor === 'box' ? RAPIER.ColliderDesc.cuboid(20,.5,20).setTranslation(0,-.5,0)
    : floor === 'heightfield' ? RAPIER.ColliderDesc.heightfield(4,4,new Float32Array(25),{x:40,y:1,z:40})
    : RAPIER.ColliderDesc.trimesh(new Float32Array([-20,0,-20,-20,0,20,20,0,20,20,0,-20]),new Uint32Array([0,1,2,0,2,3]));
  sim.world.createCollider(shape); sim.world.step();
}
function advance(steps: number, x = 0, z = 2/60) {
  for (let i=0; i<steps; i++) sim.step(1/60, {...controls, animationMotion:{x,z}});
}
test.each(['mesh','box','heightfield'] as const)('preserves a six-meter diagonal root path on a %s floor', floor => {
  setup(floor); advance(180,1/60);
  expect(Math.abs(sim.player.position.x-3)).toBeLessThan(.02);
  expect(Math.abs(sim.player.position.z-6)).toBeLessThan(.02);
  expect(sim.player.grounded).toBe(true);
});
test('clears a low step and returns to the lower floor after the edge', () => {
  setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(2,.1,1).setTranslation(0,.1,2)); sim.world.step();
  advance(60); expect(sim.player.position.z).toBeGreaterThan(1.7); expect(sim.player.position.y).toBeGreaterThan(.15);
  advance(90); expect(sim.player.position.z).toBeGreaterThan(4.5); expect(sim.player.position.y).toBeCloseTo(0,1); expect(sim.player.grounded).toBe(true);
});
test('climbs and descends a walkable ramp while remaining supported', () => {
  setup();
  sim.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array([-2,0,1,-2,1,3,2,1,3,2,0,1]),new Uint32Array([0,1,2,0,2,3]))); sim.world.step();
  advance(70); expect(sim.player.position.z).toBeGreaterThan(1.7); expect(sim.player.position.y).toBeGreaterThan(.3); expect(sim.player.grounded).toBe(true);
  advance(70,0,-2/60); expect(sim.player.position.z).toBeLessThan(.5); expect(sim.player.position.y).toBeCloseTo(0,1); expect(sim.player.grounded).toBe(true);
});
test('jump rises, hits a ceiling, and lands without losing horizontal travel', () => {
  setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.1,10).setTranslation(0,2.4,0)); sim.world.step(); advance(10,0,0);
  let highest = 0;
  for(let i=0;i<100;i++) { sim.step(1/60,{...controls,jump:i===0,animationMotion:{x:0,z:2/60}}); highest=Math.max(highest,sim.player.position.y); }
  expect(highest).toBeGreaterThan(.2); expect(highest).toBeLessThan(.7); expect(sim.player.grounded).toBe(true); expect(sim.player.position.z).toBeGreaterThan(3.2);
});
test('query restores collider and body transforms before the world integration', () => {
  setup(); const collider = sim.playerCollider.translation(), body = sim.playerBody.translation(), local = sim.playerCollider.translationWrtParent();
  const resolved = characterMovement(sim.character,sim.playerCollider,{x:.1,y:-.1,z:.2});
  expect(resolved.movement.x).toBeGreaterThan(.09);
  expect(sim.playerCollider.translation()).toEqual(collider); expect(sim.playerCollider.translationWrtParent()).toEqual(local); expect(sim.playerBody.translation()).toEqual(body);
});

test('restores the temporary collider pose even when the vertical query fails', () => {
  setup(); const start = sim.playerCollider.translation();
  const compute = sim.character.computeColliderMovement.bind(sim.character);
  vi.spyOn(sim.character, 'computeColliderMovement').mockImplementationOnce(compute).mockImplementationOnce(() => { throw new Error('query failed'); });
  expect(() => characterMovement(sim.character,sim.playerCollider,{x:.1,y:-.1,z:.2})).toThrow('query failed');
  expect(sim.playerCollider.translation()).toEqual(start);
});
