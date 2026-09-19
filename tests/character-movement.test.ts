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
test('jump rises and lands without losing horizontal travel', () => {
  setup(); advance(10,0,0);
  let highest = 0;
  for(let i=0;i<100;i++) { sim.step(1/60,{...controls,jump:i===0,animationMotion:{x:0,z:2/60}}); highest=Math.max(highest,sim.player.position.y); }
  // CTaskSimpleJump::Launch: 8.5 / 70 units per frame up against 0.008 gravity, about 0.87 above the start.
  expect(highest).toBeGreaterThan(.8); expect(highest).toBeLessThan(.95); expect(sim.player.grounded).toBe(true); expect(sim.player.position.z).toBeGreaterThan(3.2);
});
test('a ceiling within reach of the raised col spheres blocks the jump (CheckIfJumpBlocked)', () => {
  setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.1,10).setTranslation(0,2.4,0)); sim.world.step(); advance(10,0,0);
  let highest = 0;
  for(let i=0;i<60;i++) { sim.step(1/60,{...controls,jump:i===0}); highest=Math.max(highest,sim.player.position.y); }
  expect(highest).toBeLessThan(.05); expect(sim.player.grounded).toBe(true);
});
test('a ledge ahead at head height makes a climb jump that plays CLIMB_jump in the air until it ends', () => {
  setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(1,.15,.3).setTranslation(0,1.85,.72)); sim.world.step(); advance(10,0,0); sim.player.heading = 0;
  sim.climbDurations = { CLIMB_jump: .5 } as typeof sim.climbDurations;
  sim.step(1/60,{...controls,jump:true});
  const seen: number[] = [];
  for(let i=0;i<45&&!sim.player.grounded;i++){ if(sim.climbJumpSeconds!==undefined) seen.push(sim.climbJumpSeconds); sim.step(1/60,controls); }
  expect(seen.length).toBeGreaterThan(20); expect(seen[0]).toBeLessThan(.05);
  expect(seen.every((t,i)=>i===0||t>seen[i-1])).toBe(true); expect(Math.max(...seen)).toBeLessThanOrEqual(.5);
});
test('a blocked jump runs CTaskSimpleHitHead: HIT_WALL plays and the player stands still until it ends', () => {
  setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.1,10).setTranslation(0,2.4,0)); sim.world.step(); advance(10,0,0);
  let played = 0; sim.onHitHead = () => { played++; return .5; };
  sim.step(1/60,{...controls,jump:true});
  expect(played).toBe(1); expect(sim.hitHead).toBeCloseTo(.5, 5);
  const start = { ...sim.player.position };
  for(let i=0;i<20;i++) sim.step(1/60,{...controls,y:-1});
  expect(Math.hypot(sim.player.position.x-start.x,sim.player.position.z-start.z)).toBeLessThan(.01);
  for(let i=0;i<30;i++) sim.step(1/60,{...controls,y:-1});
  expect(sim.hitHead).toBe(0); expect(Math.hypot(sim.player.position.x-start.x,sim.player.position.z-start.z)).toBeGreaterThan(.1);
});
test('a standing jump leaves along the heading at 0.1 units per frame', () => {
  setup(); advance(10,0,0); sim.player.heading = 0;
  for(let i=0;i<60&&(i===0||!sim.player.grounded);i++) sim.step(1/60,{...controls,jump:i===0});
  // 5 m/s for the ~0.6 s flight.
  expect(sim.player.position.z).toBeGreaterThan(2.6); expect(sim.player.position.z).toBeLessThan(3.2); expect(Math.abs(sim.player.position.x)).toBeLessThan(.01);
});
test('an open canopy glides toward the heading with a capped descent', () => {
  setup(); sim.step(1/60,{...controls,jump:true});
  sim.step(1/60,{x:0,y:-1,cameraYaw:0,sprint:false,jump:false,parachute:true});
  const z0=sim.player.position.z;
  for(let i=0;i<110;i++)sim.step(1/60,{x:0,y:-1,cameraYaw:0,sprint:false,jump:false,parachute:true});
  expect(sim.player.position.z-z0).toBeGreaterThan(2);
  expect(sim.player.verticalSpeed).toBeGreaterThanOrEqual(-3.01);
  expect(sim.player.health).toBe(100);
});
test('a steep hillside slides instead of sticking halfway up', () => {
  setup();
  // 56° ramp: rise 3 over a 2-unit run, far past the 45° climb limit.
  sim.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array([-2,0,1,-2,3,3,2,3,3,2,0,1]),new Uint32Array([0,1,2,0,2,3]))); sim.world.step();
  advance(60); expect(sim.player.position.z).toBeLessThan(1.5); expect(sim.player.position.y).toBeLessThan(1.0);
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
