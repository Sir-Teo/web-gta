import type { Simulation } from '../simulation/Simulation';
import type { Vec3 } from '../core/math';
export interface SoundEvent { sound: string; position: Vec3; gain: number; rate: number }
export function footSurface(p: Vec3): 'concrete' | 'grass' {
  return p.y > 2 || Math.hypot(p.x, p.z) <= 19 || Math.abs(p.x) <= 10.5 && p.z >= -12 && p.z <= 158 ||
    Math.abs(p.z - 161) <= 12 || Math.abs(p.z + 82) <= 9 ? 'concrete' : 'grass';
}
export class SoundEvents {
  private feet = new Map<string, { phase: number; grounded: boolean; fallSpeed: number; variant: number }>();
  private doors = new Map<string, number>();
  reset(sim: Simulation) {
    this.feet.clear(); this.doors.clear();
    this.observe(sim, false);
  }
  observe(sim: Simulation, emit = true): SoundEvent[] {
    const events: SoundEvent[] = [];
    const actors = [{ id: 'player', ...sim.player, foot: !sim.activeVehicle && (!sim.transition || sim.transition.phase === 'approach') },
      ...sim.population.pedestrians.map(p => ({ ...p, foot: true }))];
    for (const actor of actors) {
      const phase = Math.floor(actor.phase / Math.PI), previous = this.feet.get(actor.id);
      let variant = previous?.variant ?? 0;
      if (emit && actor.foot && actor.grounded && previous) {
        const landed = !previous.grounded && previous.fallSpeed < -2.5;
        if (landed || actor.speed > 0.3 && phase !== previous.phase) {
          events.push({ sound: `step-${footSurface(actor.position)}-${variant % 3}`, position: { ...actor.position },
            gain: actor.id === 'player' ? landed ? 0.5 : 0.32 : 0.15, rate: 0.94 + variant % 3 * 0.05 }); variant++;
        }
      }
      this.feet.set(actor.id, { phase, grounded: actor.grounded, fallSpeed: actor.verticalSpeed, variant });
    }
    for (const car of sim.vehicles) {
      const previous = this.doors.get(car.id) ?? car.door;
      if (emit && car.door > 0.02 && previous <= 0.02) events.push({ sound: 'door-open', position: { ...car.body.translation() }, gain: 0.55, rate: 1.15 });
      if (emit && car.door === 0 && previous > 0) events.push({ sound: 'door-close', position: { ...car.body.translation() }, gain: 0.6, rate: 1.05 });
      this.doors.set(car.id, car.door);
    }
    return events;
  }
}
