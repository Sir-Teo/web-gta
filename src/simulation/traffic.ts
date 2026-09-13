import RAPIER from '@dimforge/rapier3d-compat';
import { angleDelta, clamp, type Vec3 } from '../core/math';
import type { Vehicle } from './Simulation';
export interface TrafficDriver { laneZ: number; direction: number; claimed: boolean; state: 'cruise' | 'brake' | 'parked'; cycles: number }
export function trafficControls(world: RAPIER.World, vehicle: Vehicle, vehicles: readonly Vehicle[], player: Vec3) {
  const driver = vehicle.traffic;
  if (!driver || driver.claimed) return null;
  const p = vehicle.body.translation(), q = vehicle.body.rotation(), speed = Math.max(0, vehicle.controller.currentVehicleSpeed());
  if (p.x * driver.direction > 216 && Math.hypot(p.x - player.x, p.z - player.z) > 180) {
    const spawn = { x: -216 * driver.direction, y: 1, z: driver.laneZ };
    if (Math.hypot(spawn.x - player.x, spawn.z - player.z) > 180 &&
      vehicles.every(v => v === vehicle || Math.abs(v.body.translation().z - spawn.z) > 2.5 || Math.abs(v.body.translation().x - spawn.x) > 10)) {
      vehicle.body.setTranslation(spawn, true); vehicle.previous = { ...spawn };
      vehicle.body.setRotation({ x: 0, y: Math.sin(driver.direction * Math.PI / 4), z: 0, w: Math.cos(driver.direction * Math.PI / 4) }, true);
      vehicle.previousRotation = { ...vehicle.body.rotation() };
      vehicle.body.setLinvel({ x: 0, y: 0, z: 0 }, true); vehicle.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      driver.cycles++; return { steer: 0, engine: 0, brake: 25 };
    }
  }
  const heading = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
  const goalHeading = Math.atan2(driver.direction * (6 + speed * 0.5), driver.laneZ - p.z);
  const steer = clamp(angleDelta(heading, goalHeading) * 1.2, -0.42, 0.42);
  const forward = { x: Math.sin(heading), y: 0, z: Math.cos(heading) };
  const hit = world.castShape({ x: p.x, y: p.y + 0.35, z: p.z }, q, forward, new RAPIER.Cuboid(1.0, 0.45, 2.2),
    0.05, 5 + speed * speed / 5, true, undefined, undefined, undefined, vehicle.body);
  const edgeDistance = 219 - p.x * driver.direction;
  const clearance = Math.min(hit?.time_of_impact ?? Infinity, edgeDistance);
  const targetSpeed = Math.min(7, Math.sqrt(Math.max(0, clearance - 1.5) * 4));
  const upright = 1 - 2 * (q.x * q.x + q.z * q.z) > 0.7;
  const braking = !upright || speed > targetSpeed + 0.25 || clearance < 2;
  driver.state = braking ? 'brake' : 'cruise';
  return { steer, engine: braking ? 0 : clamp((targetSpeed - speed) * 1100, 0, 3600), brake: braking ? 170 : 0 };
}
