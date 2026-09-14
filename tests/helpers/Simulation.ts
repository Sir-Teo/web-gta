// Isolated physics regression scenery. Never imported by the application.
import RAPIER from '@dimforge/rapier3d-compat';
import {Simulation as NativeSimulation} from '../../src/simulation/Simulation';
import {Population} from '../fixtures/physics-world/Population';
import {STREET_SURFACES,streetSurfaceTriangles} from '../fixtures/physics-world/streetSurfaces';
import {TRAFFIC_SPAWNS} from '../fixtures/physics-world/traffic';
import {ground,solids,SPAWN,VEHICLE_SPAWNS} from '../fixtures/physics-world/layout';
import type {Vec3} from '../../src/core/math';
export type {Controls,Vehicle} from '../../src/simulation/Simulation';
export class Simulation extends NativeSimulation {
 constructor(imported=false){
  super(imported);
  if(imported)return;
  this.respawn={...SPAWN};this.resetPlayer();
    // Terrain triangles give capsules a stable floor normal across the full district.
    if (!imported) this.world.createCollider(RAPIER.ColliderDesc.heightfield(32, 32, new Float32Array(33 * 33),
      { x: ground.width, y: 1, z: ground.depth }).setTranslation(ground.x, ground.y, ground.z).setFriction(0.8));
    for(const surface of imported?[]:STREET_SURFACES){
      const {vertices,indices}=streetSurfaceTriangles(surface);
      this.staticColliders.set(surface.id,this.world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,indices).setTranslation(surface.x,surface.y,surface.z).setFriction(.8)));
    }
    for (const s of imported ? [] : solids) {
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
    for (const s of imported ? [] : [...VEHICLE_SPAWNS, ...TRAFFIC_SPAWNS]) {
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
      this.vehicles.push({ ...s, traffic: trafficSpawn ? { laneZ: s.z, direction: trafficSpawn.direction, claimed: false, state: 'cruise', cycles: 0 } : undefined, body, controller, previous: { ...body.translation() }, previousRotation: { ...body.rotation() }, steer: 0, door: 0, brakeLights: false });
    }
    this.population = new Population(this.world, imported ? 0 : undefined);
    this.world.step();
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
      vehicle.previousRotation = { ...vehicle.body.rotation() };
      vehicle.body.setLinvel({ x: 0, y: 0, z: 0 }, true); vehicle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
    this.world.propagateModifiedBodyPositionsToColliders();
  }
}
