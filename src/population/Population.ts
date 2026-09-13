import RAPIER from '@dimforge/rapier3d-compat';
import { angleDelta, damp, random, type Vec3 } from '../core/math';
import { nearestSidewalk, sidewalkLength, sidewalkPoint } from '../world/sidewalks';
import type { Vehicle } from '../simulation/Simulation';

export type PedestrianState = 'walk' | 'idle' | 'yield' | 'flee';
export interface Pedestrian {
  id: string; body: RAPIER.RigidBody; collider: RAPIER.Collider; controller: RAPIER.KinematicCharacterController;
  position: Vec3; previous: Vec3; heading: number; previousHeading: number; speed: number; phase: number; grounded: boolean;
  state: PedestrianState; direction: number; cruise: number; decisionIn: number; idleIn: number; stateTime: number;
  verticalSpeed: number; motorSpeed: number; desired: { x: number; z: number }; stalled: number; random: () => number;
  appearance: { shirt: number; pants: number; skin: number; width: number; height: number };
}
const spawnDistances = [149, 173, 199, 224, 74, 106, 256, 292, 24, 327];
const outfits = [
  [0x526a42, 0x414b55, 0x805037], [0xc1b695, 0x525969, 0x976648],
  [0x738a94, 0x373c40, 0xbd9475], [0x884e44, 0x647383, 0x654531],
  [0xadafa4, 0x68715a, 0x9e7052],
];
export class Population {
  readonly pedestrians: Pedestrian[] = [];
  constructor(private world: RAPIER.World) {
    for (let i = 0; i < spawnDistances.length; i++) {
      const point = sidewalkPoint(spawnDistances[i]);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(point.x, 0.9, point.z));
      const collider = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), body);
      const controller = world.createCharacterController(0.025);
      controller.enableAutostep(0.3, 0.2, false); controller.enableSnapToGround(0.2);
      controller.setMaxSlopeClimbAngle(Math.PI / 4);
      const [shirt, pants, skin] = outfits[i % outfits.length];
      this.pedestrians.push({ id: `grove-resident-${i}`, body, collider, controller,
        position: { ...point, y: 0 }, previous: { ...point, y: 0 }, heading: 0, previousHeading: 0,
        speed: 0, phase: i * 1.7, grounded: false, state: 'walk', direction: i % 2 ? -1 : 1,
        cruise: 1.05 + (i % 4) * 0.11, decisionIn: i * 0.013, idleIn: 5 + i * 1.9, stateTime: 0,
        verticalSpeed: 0, motorSpeed: 0, desired: { x: 0, z: 0 }, stalled: 0, random: random(1992 + i * 71),
        appearance: { shirt, pants, skin, width: 0.95 + (i % 3) * 0.06, height: 0.96 + (i % 3) * 0.025 },
      });
    }
  }
  step(dt: number, vehicles: readonly Vehicle[], player: Vec3) {
    // Decisions are staggered at ~7 Hz; movement and collision stay at the fixed physics rate.
    for (const ped of this.pedestrians) {
      ped.previous = { ...ped.position }; ped.previousHeading = ped.heading;
      ped.decisionIn -= dt; ped.stateTime = Math.max(0, ped.stateTime - dt); ped.idleIn -= dt;
      if (ped.decisionIn <= 0) { this.decide(ped, vehicles, player); ped.decisionIn += 0.15; }
      const magnitude = Math.hypot(ped.desired.x, ped.desired.z);
      const speed = ped.state === 'flee' ? 4.8 : ped.state === 'walk' ? ped.cruise : 0;
      const desiredSpeed = magnitude > 0 ? speed : 0;
      const movingSpeed = ped.motorSpeed = damp(ped.motorSpeed, desiredSpeed, 10, dt);
      const dx = magnitude ? ped.desired.x / magnitude : 0, dz = magnitude ? ped.desired.z / magnitude : 0;
      if (desiredSpeed) ped.heading += angleDelta(ped.heading, Math.atan2(dx, dz)) * (1 - Math.exp(-10 * dt));
      ped.verticalSpeed = Math.max(-20, ped.verticalSpeed - 19.6 * dt);
      ped.controller.computeColliderMovement(ped.collider, { x: dx * movingSpeed * dt, y: ped.verticalSpeed * dt, z: dz * movingSpeed * dt });
      const movement = ped.controller.computedMovement(), center = ped.body.translation();
      ped.body.setNextKinematicTranslation({ x: center.x + movement.x, y: center.y + movement.y, z: center.z + movement.z });
      ped.grounded = ped.controller.computedGrounded();
      if (ped.grounded && ped.verticalSpeed < 0) ped.verticalSpeed = -0.4;
      const actualSpeed = Math.hypot(movement.x, movement.z) / dt;
      ped.stalled = ped.state === 'yield' || desiredSpeed > 0.5 && actualSpeed < 0.15 ? ped.stalled + dt : 0;
      if (ped.stalled > 1.5 && ped.state !== 'flee') {
        ped.direction *= -1; ped.stalled = 0; ped.decisionIn = 0;
      }
    }
  }
  afterPhysics(dt: number) {
    for (const ped of this.pedestrians) {
      const p = ped.body.translation(); ped.position = { x: p.x, y: p.y - 0.9, z: p.z };
      ped.speed = Math.hypot(p.x - ped.previous.x, p.z - ped.previous.z) / dt;
      ped.phase += ped.speed * dt * 3.7;
    }
  }
  private decide(ped: Pedestrian, vehicles: readonly Vehicle[], player: Vec3) {
    for (const vehicle of vehicles) {
      const car = vehicle.body.translation(), velocity = vehicle.body.linvel();
      if (Math.abs(car.y - (ped.position.y + 0.9)) > 2) continue;
      const speed2 = velocity.x ** 2 + velocity.z ** 2;
      if (speed2 < 6.25) continue;
      const dx = ped.position.x - car.x, dz = ped.position.z - car.z;
      const impactTime = (dx * velocity.x + dz * velocity.z) / speed2;
      if (impactTime < -0.15 || impactTime > 1.4) continue;
      const closest = { x: car.x + velocity.x * Math.max(0, impactTime), z: car.z + velocity.z * Math.max(0, impactTime) };
      const awayX = ped.position.x - closest.x, awayZ = ped.position.z - closest.z;
      if (Math.hypot(awayX, awayZ) < 2.7 && Math.hypot(dx, dz) < 15) {
        // Choose the nearest side of the predicted vehicle path, never run along it.
        const side = awayX * velocity.z - awayZ * velocity.x >= 0 ? 1 : -1;
        ped.desired = { x: velocity.z * side, z: -velocity.x * side };
        ped.state = 'flee'; ped.stateTime = 1.25; return;
      }
    }
    if (ped.state === 'flee' && ped.stateTime > 0) return;
    if (ped.state === 'idle' && ped.stateTime > 0) return;
    const nearest = nearestSidewalk(ped.position);
    if (ped.idleIn <= 0 && nearest.separation < 0.9) {
      ped.state = 'idle'; ped.stateTime = 1.5 + ped.random() * 3;
      ped.idleIn = 12 + ped.random() * 15; ped.desired = { x: 0, z: 0 }; return;
    }
    if (nearest.distance < 0.6) ped.direction = 1;
    if (nearest.distance > sidewalkLength - 0.6) ped.direction = -1;
    const goal = nearest.separation > 1.1 ? nearest.point : sidewalkPoint(nearest.distance + ped.direction * 1.8);
    let dx = goal.x - ped.position.x, dz = goal.z - ped.position.z;
    const length = Math.hypot(dx, dz); dx /= length || 1; dz /= length || 1;
    // Repulsion handles pedestrians and the player; Rapier remains the final authority.
    const neighbors = [...this.pedestrians.filter(other => other !== ped).map(other => other.position), player];
    for (const other of neighbors) {
      const ox = ped.position.x - other.x, oz = ped.position.z - other.z, distance = Math.hypot(ox, oz);
      if (distance > 0.01 && distance < 1.3) {
        dx += ox / distance * (1.3 - distance) * 1.5;
        dz += oz / distance * (1.3 - distance) * 1.5;
      }
    }
    for (const vehicle of vehicles) {
      const car = vehicle.body.translation();
      if (Math.abs(car.y - (ped.position.y + 0.9)) < 2 && Math.hypot(car.x - ped.position.x, car.z - ped.position.z) < 2.6 &&
          (car.x - ped.position.x) * dx + (car.z - ped.position.z) * dz > 0) {
        ped.state = 'yield'; ped.desired = { x: 0, z: 0 };
        // A parked obstruction should not permanently imprison the pedestrian.
        return;
      }
    }
    ped.state = 'walk'; ped.desired = { x: dx, z: dz };
  }
  reset(exclusions: readonly Vec3[]) {
    const reserved = [...exclusions];
    for (let i = 0; i < this.pedestrians.length; i++) {
      const ped = this.pedestrians[i]; let point = sidewalkPoint(spawnDistances[i]);
      for (let attempt = 0; attempt < 30 && reserved.some(p => Math.hypot(p.x - point.x, p.z - point.z) < 3.5); attempt++) {
        point = sidewalkPoint((spawnDistances[i] + (attempt + 1) * 7) % sidewalkLength);
      }
      const center = { ...point, y: 0.9 }; ped.body.setTranslation(center, true); ped.body.setNextKinematicTranslation(center);
      ped.position = { ...point, y: 0 }; ped.previous = { ...ped.position }; ped.speed = 0; ped.motorSpeed = 0; ped.verticalSpeed = 0;
      ped.state = 'walk'; ped.stateTime = 0; ped.stalled = 0; ped.decisionIn = i * 0.013; ped.idleIn = 5 + i * 1.9;
      reserved.push(ped.position); ped.phase = i * 1.7; ped.grounded = false; ped.heading = 0; ped.previousHeading = 0;
      ped.direction = i % 2 ? -1 : 1; ped.desired = { x: 0, z: 0 }; ped.random = random(1992 + i * 71);
    }
  }
}
