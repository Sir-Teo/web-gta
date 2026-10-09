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
test('adrenaline keeps a sprint from spending stamina for 20 s (HandleSprintEnergy)', () => {
  setup(); sim.world.createCollider(RAPIER.ColliderDesc.cuboid(400,.5,400).setTranslation(0,-.5,0)); sim.world.step(); advance(10,0,0);
  sim.player.adrenaline = 20;
  for(let i=0;i<60*5;i++) sim.step(1/60,{...controls,y:-1,sprint:true});
  expect(sim.player.stamina).toBe(100); expect(sim.player.adrenaline).toBeCloseTo(15, 3);
  for(let i=0;i<60*16;i++) sim.step(1/60,{...controls,y:-1,sprint:true});
  expect(sim.player.adrenaline).toBe(0); expect(sim.player.stamina).toBeLessThan(100);
});

test('a long fall below the spawn height lands; leaving the world puts him back over the nearest path node', () => {
  setup('box');
  // Spawned 100 m up with the floor at 0: the old rule (30 m under the spawn) would have sent him back up mid-fall.
  sim.respawn = { x: 0, y: 100, z: 0 }; sim.resetPlayer();
  // Safe (MAKE_PLAYER_SAFE): the landing past 0.6 units a frame is 500 damage (landingDamage), and Wasted would respawn
  // him up there.
  sim.playerCanBeDamaged = false;
  let lowest = 100;
  for (let i = 0; i < 400; i++) { sim.step(1 / 50, controls); lowest = Math.min(lowest, sim.player.position.y); }
  sim.playerCanBeDamaged = true;
  expect(lowest).toBeLessThan(70);
  expect(sim.player.position.y).toBeLessThan(1);
  expect(sim.player.grounded).toBe(true);
  // Through the floor and out of the world: CWorld::RemoveFallenPeds puts him 2 units over the nearest pedestrian
  // node, speed reset, health and armour as they were.
  sim.nearestPedNode = () => ({ x: 3, y: 0, z: 4 });
  sim.player.health = 40; sim.player.armour = 20;
  sim.playerBody.setTranslation({ x: 0, y: -150, z: 0 }, true); sim.playerBody.setNextKinematicTranslation({ x: 0, y: -150, z: 0 }); sim.playerCollider.setTranslation({ x: 0, y: -150, z: 0 });
  sim.step(1 / 50, controls);
  expect(sim.player.position).toMatchObject({ x: 3, y: 2, z: 4 });
  expect([sim.player.health, sim.player.armour, sim.player.verticalSpeed]).toEqual([40, 20, 0]);
  // With no node loaded he waits at -95.
  sim.nearestPedNode = () => undefined;
  sim.playerBody.setTranslation({ x: 0, y: -150, z: 0 }, true); sim.playerBody.setNextKinematicTranslation({ x: 0, y: -150, z: 0 }); sim.playerCollider.setTranslation({ x: 0, y: -150, z: 0 });
  sim.step(1 / 50, controls);
  expect(sim.player.position.y).toBe(-95);
});

test('the game weekday starts on Thursday and rolls over at midnight like CClock', () => {
  setup(); const clock = sim;
  expect(clock.weekDay).toBe(4);
  clock.timeMinutes = 23 * 60 + 50;
  clock.advanceClock(5);
  expect(clock.weekDay).toBe(4);
  clock.advanceClock(10);
  expect(clock.timeMinutes).toBe(5);
  expect(clock.weekDay).toBe(5);
  clock.advanceClock(3 * 1440);
  expect(clock.weekDay).toBe(1);
  clock.advanceClock(1440 * 7);
  expect(clock.weekDay).toBe(1);
});
test('a dead CJ in the water floats just under the surface instead of sinking (CPed::ProcessBuoyancy)', () => {
  setup('box');
  // A deep pool: water at 10 over the floor at 0, the body put in at 5.
  sim.player.position = { x: 0, y: 5, z: 0 }; sim.playerBody.setTranslation({ x: 0, y: 5.9, z: 0 }, true); sim.player.health = 0;
  for (let i = 0; i < 240; i++) sim.step(1/60, { ...controls, swimWater: 10 });
  const origin = sim.player.position.y + 1;
  // pedFloatDepth(false) = 1.9 / 1.8 - 1: the origin rests 0.056 under the surface.
  expect(origin).toBeGreaterThan(9.8); expect(origin).toBeLessThan(10);
});
test('a canopy opened after a long freefall lands with no FALL_COLLAPSE or knockdown', () => {
  setup('box');
  // Dropped from 200 units: past the knockdown speed within a couple of seconds.
  sim.player.position = { x: 0, y: 200, z: 0 }; sim.playerBody.setTranslation({ x: 0, y: 200.9, z: 0 }, true); sim.player.grounded = false;
  for (let i = 0; i < 150; i++) sim.step(1/60, { ...controls });
  expect(sim.fall.falling).toBe(true); expect(sim.fall.minVz).toBeLessThan(-.4 * 50);
  let landing: string | undefined;
  for (let i = 0; i < 6000 && !sim.player.grounded; i++) { sim.step(1/60, { ...controls, parachute: true }); landing ??= sim.fallLanding; }
  expect(sim.player.grounded).toBe(true); expect(landing).toBeUndefined();
});
test('a teleport lands no fall speed, jump momentum or knockdown with CJ (CPed::Teleport)', () => {
  setup('box');
  sim.player.verticalSpeed = -40; sim.player.jumpMomentum = { x: 5, z: 3 }; sim.collisionPush = { x: 2, z: 0 }; sim.knockdown = 2; sim.knockdownGetUp = 1;
  let flushed = 0; sim.onFlushPlayerTasks = () => flushed++;
  sim.flushPlayerTasks();
  sim.player.position = { x: 0, y: .03, z: 0 }; sim.playerBody.setTranslation({ x: 0, y: .93, z: 0 }, true);
  for (let i = 0; i < 10; i++) sim.step(1/60, { ...controls });
  expect(sim.player.health).toBe(100); expect(sim.knockdown).toBe(0); expect(flushed).toBe(1);
  expect(Math.abs(sim.player.position.x) + Math.abs(sim.player.position.z)).toBeLessThan(.05);
});
test('CJ rides a moving body he stands on, and a jump from it keeps its speed (CTaskSimpleJump::Launch)', () => {
  setup('box');
  // A floating deck (a truck bed) moving at 5 m/s along +x, its top at 1.
  const deck = sim.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0, .75, 0).setGravityScale(0).setLinvel(5, 0, 0).lockRotations());
  sim.world.createCollider(RAPIER.ColliderDesc.cuboid(6, .25, 3).setDensity(1000), deck);
  sim.player.position = { x: 0, y: 1.02, z: 0 }; sim.playerBody.setTranslation({ x: 0, y: 1.92, z: 0 }, true);
  for (let i = 0; i < 10; i++) { deck.setLinvel({ x: 5, y: 0, z: 0 }, true); sim.step(1/60, { ...controls }); }
  const x0 = sim.player.position.x, d0 = deck.translation().x;
  for (let i = 0; i < 30; i++) { deck.setLinvel({ x: 5, y: 0, z: 0 }, true); sim.step(1/60, { ...controls }); }
  // Half a second at 5 m/s: he keeps his place on the deck.
  expect(sim.player.position.x - x0).toBeGreaterThan(2); expect(Math.abs((sim.player.position.x - x0) - (deck.translation().x - d0))).toBeLessThan(.3);
  deck.setLinvel({ x: 5, y: 0, z: 0 }, true); sim.step(1/60, { ...controls, jump: true });
  expect(sim.player.jumpMomentum.x).toBeGreaterThan(4);
});
