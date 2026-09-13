import { TRAFFIC_SPAWNS } from '../world/traffic';
import { trafficControls, type TrafficDriver } from './traffic';
import { GAME_MINUTES_PER_SECOND, wrapMinutes } from '../world/timecycle';
import { Population } from '../population/Population';
import RAPIER from '@dimforge/rapier3d-compat';
import { angleDelta, clamp, damp, type Vec3 } from '../core/math';
import { ground, solids, SPAWN, VEHICLE_SPAWNS } from '../world/layout';

export interface Controls { x: number; y: number; sprint: boolean; jump: boolean; handbrake: boolean; cameraYaw: number }
export interface Vehicle {
  id: string; name: string; color: number;
  body: RAPIER.RigidBody; controller: RAPIER.DynamicRayCastVehicleController;
  traffic?: TrafficDriver;
  previous: Vec3; steer: number; door: number; brakeLights: boolean;
}
export interface VehicleTransition {
  vehicle: Vehicle; kind: 'enter' | 'exit'; phase: 'approach' | 'opening' | 'transfer' | 'closing';
  elapsed: number; foot: Vec3;
}
export class Simulation {
  readonly world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  readonly playerBody: RAPIER.RigidBody;
  readonly playerCollider: RAPIER.Collider;
  readonly character: RAPIER.KinematicCharacterController;
  readonly vehicles: Vehicle[] = [];
  readonly staticColliders = new Map<string, RAPIER.Collider>();
  readonly population: Population;
  player = { position: { ...SPAWN }, previous: { ...SPAWN }, heading: Math.PI, speed: 0, verticalSpeed: 0, grounded: false, stamina: 100, phase: 0, crouched: false };
  activeVehicle: Vehicle | null = null;
  transition: VehicleTransition | null = null;
  seated = 0;
  timeMinutes = 17 * 60 + 24;
  money = 350;
  constructor() {
    this.world.timestep = 1 / 60;
    // Terrain triangles give capsules a stable floor normal across the full district.
    this.world.createCollider(RAPIER.ColliderDesc.heightfield(32, 32, new Float32Array(33 * 33),
      { x: ground.width, y: 1, z: ground.depth }).setTranslation(ground.x, ground.y, ground.z).setFriction(0.8));
    for (const s of solids) {
      let desc: RAPIER.ColliderDesc;
      if (s.shape === 'cylinder') desc = RAPIER.ColliderDesc.cylinder(s.hy, s.hx);
      else if (s.shape === 'roof') desc = RAPIER.ColliderDesc.convexHull(new Float32Array([
        -s.hx, -s.hy, -s.hz, s.hx, -s.hy, -s.hz, 0, s.hy, -s.hz,
        -s.hx, -s.hy, s.hz, s.hx, -s.hy, s.hz, 0, s.hy, s.hz,
      ]))!;
      else desc = RAPIER.ColliderDesc.cuboid(s.hx, s.hy, s.hz);
      desc.setTranslation(s.x, s.y, s.z).setFriction(0.8);
      if (s.angle) desc.setRotation({ x: 0, y: Math.sin(s.angle / 2), z: 0, w: Math.cos(s.angle / 2) });
      if (s.tilt) desc.setRotation({ x: 0, y: 0, z: Math.sin(s.tilt / 2), w: Math.cos(s.tilt / 2) });
      this.staticColliders.set(s.id, this.world.createCollider(desc));
    }
    this.playerBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(SPAWN.x, SPAWN.y + 0.9, SPAWN.z));
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.3), this.playerBody);
    this.character = this.world.createCharacterController(0.025);
    this.character.enableAutostep(0.32, 0.2, false);
    this.character.enableSnapToGround(0.2);
    this.character.setMaxSlopeClimbAngle(Math.PI / 4);
    this.character.setMinSlopeSlideAngle(Math.PI / 3);
    for (const s of [...VEHICLE_SPAWNS, ...TRAFFIC_SPAWNS]) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(s.x, 1.0, s.z)
        .setRotation({ x: 0, y: Math.sin(s.heading / 2), z: 0, w: Math.cos(s.heading / 2) })
        .setLinearDamping(0.12).setAngularDamping(0.7).setCcdEnabled(true));
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.87, 0.28, 2.13).setMass(1250).setFriction(0.4), body);
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.77, 0.36, 1.02).setTranslation(0, 0.59, -0.14).setMass(80), body);
      const controller = this.world.createVehicleController(body);
      controller.indexUpAxis = 1; controller.setIndexForwardAxis = 2;
      for (const [x, z] of [[-0.87, 1.4], [0.87, 1.4], [-0.87, -1.4], [0.87, -1.4]]) {
        controller.addWheel({ x, y: -0.04, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, 0.38, 0.34);
        const i = controller.numWheels() - 1;
        controller.setWheelSuspensionStiffness(i, 32);
        controller.setWheelSuspensionCompression(i, 4.4);
        controller.setWheelSuspensionRelaxation(i, 5.4);
        controller.setWheelMaxSuspensionTravel(i, 0.24);
        controller.setWheelFrictionSlip(i, 2.2);
        controller.setWheelSideFrictionStiffness(i, 1.0);
        controller.setWheelMaxSuspensionForce(i, 19000);
      }
      const trafficSpawn = TRAFFIC_SPAWNS.find(t => t.id === s.id);
      this.vehicles.push({ ...s, traffic: trafficSpawn ? { laneZ: s.z, direction: trafficSpawn.direction, claimed: false, state: 'cruise', cycles: 0 } : undefined, body, controller, previous: { ...body.translation() }, steer: 0, door: 0, brakeLights: false });
    }
    this.population = new Population(this.world);
    // Establish broad-phase data before the first character or wheel query.
    this.world.step();
  }
  step(dt: number, controls: Controls) {
    this.timeMinutes = wrapMinutes(this.timeMinutes + dt * GAME_MINUTES_PER_SECOND);
    this.player.previous = { ...this.player.position };
    for (const vehicle of this.vehicles) {
      vehicle.previous = { ...vehicle.body.translation() };
      const active = vehicle === this.activeVehicle && !this.transition;
      const autonomous = trafficControls(this.world, vehicle, this.vehicles, this.player.position);
      const speed = vehicle.controller.currentVehicleSpeed();
      const steeringLimit = 0.48 / (1 + Math.abs(speed) * 0.045);
      vehicle.steer = damp(vehicle.steer, active ? -controls.x * steeringLimit : autonomous?.steer ?? 0, 6.5, dt);
      const braking = active && controls.y < 0 && speed > 1;
      vehicle.brakeLights = active ? braking || controls.handbrake : (autonomous?.brake ?? 0) > 0;
      const engine = active && !braking ? controls.y * (controls.y < 0 ? 2600 : 4600) : autonomous?.engine ?? 0;
      for (let i = 0; i < 4; i++) {
        vehicle.controller.setWheelSteering(i, i < 2 ? vehicle.steer : 0);
        vehicle.controller.setWheelEngineForce(i, i >= 2 ? engine : 0);
        vehicle.controller.setWheelBrake(i, !active ? autonomous?.brake ?? 25 : braking ? 170 : controls.handbrake && i >= 2 ? 230 : 0);
        vehicle.controller.setWheelFrictionSlip(i, active && controls.handbrake && i >= 2 ? 0.8 : 2.2);
      }
      if (active || autonomous) vehicle.body.wakeUp();
      vehicle.controller.updateVehicle(dt, undefined, undefined, c => c.parent()?.handle !== vehicle.body.handle && c.handle !== this.playerCollider.handle);
    }
    if (this.transition) this.stepTransition(dt);
    else if (!this.activeVehicle) this.moveCharacter(dt, controls);
    this.population.step(dt, this.vehicles, this.player.position);
    this.world.step();
    this.population.afterPhysics(dt);
    if (!this.transition) {
      if (this.activeVehicle) {
        this.player.position = this.vehiclePoint(this.activeVehicle, 0.42, -0.78, 0.05);
        this.player.heading = this.vehicleHeading(this.activeVehicle);
        this.player.speed = Math.abs(this.activeVehicle.controller.currentVehicleSpeed());
      } else {
        const center = this.playerBody.translation();
        this.player.position = { x: center.x, y: center.y - this.playerCenterHeight, z: center.z };
      }
    } else if (this.transition.phase === 'approach') {
      const center = this.playerBody.translation();
      this.player.position = { x: center.x, y: center.y - this.playerCenterHeight, z: center.z };
    }
    if (this.player.position.y < -15) this.resetPlayer();
  }
  private vehicleHeading(vehicle: Vehicle) {
    const q = vehicle.body.rotation();
    return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
  }
  private vehiclePoint(vehicle: Vehicle, x: number, y: number, z: number): Vec3 {
    const p = vehicle.body.translation(), heading = this.vehicleHeading(vehicle);
    return { x: p.x + Math.cos(heading) * x + Math.sin(heading) * z, y: p.y + y,
      z: p.z - Math.sin(heading) * x + Math.cos(heading) * z };
  }
  private stationary(vehicle: Vehicle) {
    const v = vehicle.body.linvel(), q = vehicle.body.rotation();
    return Math.hypot(v.x, v.z) < 1.2 && 1 - 2 * (q.x * q.x + q.z * q.z) > 0.85;
  }
  private doorClear(vehicle: Vehicle) {
    const foot = this.vehiclePoint(vehicle, 1.7, -0.65, 0.05);
    const hit = this.world.intersectionWithShape({ ...foot, y: foot.y + 0.9 },
      { x: 0, y: 0, z: 0, w: 1 }, new RAPIER.Capsule(0.55, 0.3), undefined, undefined, this.playerCollider, vehicle.body);
    const sweep = this.world.intersectionWithShape(this.vehiclePoint(vehicle, 1.5, 0.45, 0.45),
      vehicle.body.rotation(), new RAPIER.Cuboid(0.65, 0.5, 0.8), undefined, undefined, this.playerCollider, vehicle.body);
    return !hit && !sweep;
  }
  private placeOnFoot(position: Vec3) {
    const center = { ...position, y: position.y + 0.9 };
    this.playerBody.setEnabled(true);
    this.playerBody.setTranslation(center, true); this.playerBody.setNextKinematicTranslation(center);
    this.player.position = { ...position }; this.player.speed = 0; this.player.verticalSpeed = 0;
    this.seated = 0;
  }
  private abortTransition() {
    const t = this.transition!;
    t.vehicle.door = 0;
    if (t.kind === 'enter') this.placeOnFoot(t.foot);
    else { this.activeVehicle = t.vehicle; this.seated = 1; }
    this.transition = null;
  }
  private stepTransition(dt: number) {
    const t = this.transition!;
    t.elapsed += dt;
    if (!this.stationary(t.vehicle) || !this.doorClear(t.vehicle)) { this.abortTransition(); return; }
    const foot = this.vehiclePoint(t.vehicle, 1.7, -0.65, 0.05);
    const seat = this.vehiclePoint(t.vehicle, 0.42, -0.78, 0.05);
    if (t.phase === 'approach') {
      const dx = foot.x - this.player.position.x, dz = foot.z - this.player.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 0.08) {
        if (t.elapsed > 3) { this.abortTransition(); return; }
        this.moveCharacter(dt, { x: dx / distance * Math.min(1, distance / 0.2), y: -dz / distance * Math.min(1, distance / 0.2),
          sprint: false, jump: false, handbrake: false, cameraYaw: 0 });
        t.foot = { ...this.player.position };
        return;
      }
      t.foot = { ...this.player.position };
      this.player.speed = 0;
      t.phase = 'opening'; t.elapsed = 0;
      this.playerBody.setEnabled(false);
    }
    const duration = t.phase === 'opening' ? 0.4 : t.phase === 'transfer' ? 0.7 : 0.35;
    const amount = clamp(t.elapsed / duration, 0, 1), smooth = amount * amount * (3 - 2 * amount);
    t.vehicle.door = t.phase === 'opening' ? smooth : t.phase === 'closing' ? 1 - smooth : 1;
    this.seated = t.phase === 'transfer' ? (t.kind === 'enter' ? smooth : 1 - smooth)
      : t.kind === 'enter' ? (t.phase === 'closing' ? 1 : 0) : (t.phase === 'opening' ? 1 : 0);
    this.player.position = { x: foot.x + (seat.x - foot.x) * this.seated,
      y: foot.y + (seat.y - foot.y) * this.seated, z: foot.z + (seat.z - foot.z) * this.seated };
    const heading = this.vehicleHeading(t.vehicle);
    this.player.heading = heading - Math.PI / 2 * (1 - this.seated);
    this.player.speed = 0;
    if (amount < 1) return;
    if (t.phase === 'opening') t.phase = 'transfer';
    else if (t.phase === 'transfer') t.phase = 'closing';
    else {
      t.vehicle.door = 0;
      if (t.kind === 'enter') this.activeVehicle = t.vehicle;
      else { this.activeVehicle = null; this.placeOnFoot(foot); }
      this.transition = null;
    }
    t.elapsed = 0;
  }
  get playerCenterHeight() { return this.player.crouched ? 0.65 : 0.9; }
  setCrouched(crouched: boolean): boolean {
    if (this.activeVehicle || this.transition) return false;
    if (crouched === this.player.crouched) return true;
    const oldCenter = this.playerBody.translation();
    const center = { ...oldCenter, y: oldCenter.y + (crouched ? -0.25 : 0.25) };
    const shape = new RAPIER.Capsule(crouched ? 0.3 : 0.55, 0.3);
    if (!crouched && this.world.intersectionWithShape(center, { x: 0, y: 0, z: 0, w: 1 }, shape,
      undefined, undefined, this.playerCollider, this.playerBody)) return false;
    this.playerCollider.setShape(shape);
    this.playerBody.setTranslation(center, true); this.playerBody.setNextKinematicTranslation(center);
    this.player.crouched = crouched;
    return true;
  }
  toggleCrouch(): string {
    if (this.activeVehicle || this.transition || !this.player.grounded) return '';
    return this.setCrouched(!this.player.crouched) ? '' : 'There is not enough room to stand.';
  }
  private moveCharacter(dt: number, controls: Controls) {
    const length = Math.hypot(controls.x, controls.y);
    const sprinting = !this.player.crouched && controls.sprint && length > 0 && this.player.stamina > 0;
    const speed = length > 0 ? this.player.crouched ? 1.4 : sprinting ? 6.7 : 3.7 : 0;
    this.player.speed = damp(this.player.speed, speed, length ? 12 : 18, dt);
    this.player.stamina = clamp(this.player.stamina + (sprinting ? -12 : 8) * dt, 0, 100);
    let dx = 0, dz = 0;
    if (length) {
      const x = controls.x / length, y = controls.y / length;
      dx = x * Math.cos(controls.cameraYaw) - y * Math.sin(controls.cameraYaw);
      dz = -x * Math.sin(controls.cameraYaw) - y * Math.cos(controls.cameraYaw);
      this.player.heading += angleDelta(this.player.heading, Math.atan2(dx, dz)) * (1 - Math.exp(-14 * dt));
    }
    if (controls.jump && this.player.grounded && !this.player.crouched) this.player.verticalSpeed = 6.6;
    this.player.verticalSpeed -= 19.6 * dt;
    this.character.computeColliderMovement(this.playerCollider, { x: dx * this.player.speed * dt, y: this.player.verticalSpeed * dt, z: dz * this.player.speed * dt });
    const movement = this.character.computedMovement();
    const position = this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({ x: position.x + movement.x, y: position.y + movement.y, z: position.z + movement.z });
    this.player.grounded = this.character.computedGrounded();
    if (this.player.grounded && this.player.verticalSpeed < 0) this.player.verticalSpeed = -0.4;
    this.player.phase += this.player.speed * dt * (this.player.crouched ? 6 : 2.8);
  }
  nearbyVehicle() {
    return this.vehicles.find(v => Math.hypot(v.body.translation().x - this.player.position.x, v.body.translation().z - this.player.position.z) < 3.5);
  }
  interact(): string {
    if (this.transition) {
      if (this.transition.phase === 'approach') { this.abortTransition(); return ''; }
      return 'Wait until you finish getting in or out.';
    }
    const vehicle = this.activeVehicle ?? this.nearbyVehicle();
    if (!vehicle) return '';
    if (!this.stationary(vehicle)) return 'Stop the car before getting in or out.';
    if (!this.doorClear(vehicle)) return 'The driver door is blocked.';
    if (!this.activeVehicle) {
      const foot = this.vehiclePoint(vehicle, 1.7, -0.65, 0.05);
      if (Math.hypot(foot.x - this.player.position.x, foot.z - this.player.position.z) > 2.5) return 'Walk to the driver door.';
      if (!this.player.grounded) return 'Land before getting into the car.';
    }
    if (this.player.crouched && !this.setCrouched(false)) return 'There is not enough room to stand.';
    if (vehicle.traffic) { vehicle.traffic.claimed = true; vehicle.traffic.state = 'parked'; }
    this.transition = { vehicle, kind: this.activeVehicle ? 'exit' : 'enter', phase: this.activeVehicle ? 'opening' : 'approach', elapsed: 0, foot: { ...this.player.position } };
    return '';
  }
  resetTraffic(exclusions: readonly Vec3[] = []) {
    const reserved = [...exclusions];
    for (const spawn of TRAFFIC_SPAWNS) {
      const vehicle = this.vehicles.find(v => v.id === spawn.id)!;
      Object.assign(vehicle.traffic!, { claimed: false, state: 'cruise', cycles: 0 });
      const position = { x: spawn.x, y: 1, z: spawn.z };
      for (let attempt = 0; attempt < 30 && reserved.some(p => Math.hypot(p.x - position.x, p.z - position.z) < 12); attempt++) {
        position.x += spawn.direction * 20;
        if (Math.abs(position.x) > 200) position.x = -190 * spawn.direction;
      }
      reserved.push(position);
      vehicle.body.setTranslation(position, true); vehicle.previous = { ...position };
      vehicle.body.setRotation({ x: 0, y: Math.sin(spawn.heading / 2), z: 0, w: Math.cos(spawn.heading / 2) }, true);
      vehicle.body.setLinvel({ x: 0, y: 0, z: 0 }, true); vehicle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  }
  resetPlayer() {
    this.player.crouched = false; this.playerCollider.setShape(new RAPIER.Capsule(0.55, 0.3));
    this.transition = null; this.seated = 0;
    this.vehicles.forEach(v => { v.door = 0; });
    this.activeVehicle = null;
    this.playerBody.setEnabled(true);
    this.playerBody.setTranslation({ x: SPAWN.x, y: SPAWN.y + 0.9, z: SPAWN.z }, true);
    this.playerBody.setNextKinematicTranslation({ x: SPAWN.x, y: SPAWN.y + 0.9, z: SPAWN.z });
    this.player.position = { ...SPAWN }; this.player.previous = { ...SPAWN };
    this.player.speed = 0; this.player.verticalSpeed = 0;
  }
  cameraDistance(origin: Vec3, direction: Vec3, distance: number) {
    const hit = this.world.castShape(origin, { x: 0, y: 0, z: 0, w: 1 }, direction, new RAPIER.Ball(0.2), 0.03, distance, true,
      undefined, undefined, this.playerCollider, (this.activeVehicle ?? this.transition?.vehicle)?.body,
      c => c.handle !== this.playerCollider.handle);
    return hit ? Math.max(0.45, hit.time_of_impact - 0.1) : distance;
  }
  dispose() { this.world.free(); }
}
