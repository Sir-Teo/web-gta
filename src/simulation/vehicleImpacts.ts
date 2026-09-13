import type RAPIER from '@dimforge/rapier3d-compat';
import type { Vehicle } from './Simulation';
import type { Vec3 } from '../core/math';

interface Motion { center: Vec3; linear: Vec3; angular: Vec3 }
export interface VehicleImpact { damage: number; velocity: Vec3 }

// Contact episodes, not every touching frame, produce hits. All response tuning is authored.
export class VehicleImpacts {
  private motion = new Map<string, Motion>();
  private contacts = new Map<string, number>();
  capture(vehicles: readonly Vehicle[]) {
    for (const v of vehicles) this.motion.set(v.id, {
      center: { ...v.body.translation() }, linear: { ...v.body.linvel() }, angular: { ...v.body.angvel() },
    });
  }
  detect(dt: number, vehicles: readonly Vehicle[], player: RAPIER.Collider, playerVelocity: Vec3): VehicleImpact | null {
    let strongest: VehicleImpact | null = null;
    for (const v of vehicles) {
      let touching = false, closing = 0, direction: Vec3 = { x: 0, y: 0, z: 0 };
      const motion = this.motion.get(v.id);
      if (!motion) continue;
      for (let i = 0; i < v.body.numColliders(); i++) {
        const contact = v.body.collider(i).contactCollider(player, 0.04);
        if (!contact) continue;
        touching = true;
        const n = contact.normal1, r = { x: contact.point1.x - motion.center.x, y: contact.point1.y - motion.center.y, z: contact.point1.z - motion.center.z };
        const a = motion.angular, l = motion.linear;
        const velocity = { x: l.x + a.y * r.z - a.z * r.y, y: l.y + a.z * r.x - a.x * r.z, z: l.z + a.x * r.y - a.y * r.x };
        const vehicleApproach = velocity.x * n.x + velocity.y * n.y + velocity.z * n.z;
        const relativeApproach = vehicleApproach - (playerVelocity.x * n.x + playerVelocity.y * n.y + playerVelocity.z * n.z);
        // Running into a stationary car is not a vehicle strike.
        if (vehicleApproach > 2 && relativeApproach > closing) { closing = relativeApproach; direction = { ...n }; }
      }
      const previous = this.contacts.get(v.id) ?? 0;
      if (touching) {
        this.contacts.set(v.id, 0.15);
        const damage = Math.min(100, Math.max(0, closing - 2) * 8);
        if (previous === 0 && damage > (strongest?.damage ?? 0)) {
          const strength = Math.min(8, closing * 0.55);
          strongest = { damage, velocity: { x: direction.x * strength, y: 0, z: direction.z * strength } };
        }
      } else if (previous > dt) this.contacts.set(v.id, previous - dt);
      else this.contacts.delete(v.id);
    }
    return strongest;
  }
  reset() { this.motion.clear(); this.contacts.clear(); }
}
