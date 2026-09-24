import type {FootstepCategory} from '../assets/surfaceAudio';
import type { Simulation } from '../simulation/Simulation';
import type { Vec3 } from '../core/math';
export interface SoundEvent { sound: string; footstep?:FootstepCategory; position: Vec3; gain: number; rate: number; /** The step ends a fall faster than 2.5 m/s. */ landed?:boolean; /** The landing alone, with no footstep. */ landingOnly?:boolean }
export class SoundEvents {
  private feet = new Map<string, { phase: number; grounded: boolean; fallSpeed: number; variant: number }>();
  reset(sim: Simulation) {
    this.feet.clear();
    this.observe(sim, false);
  }
  observe(sim: Simulation, emit = true, landingContacts?: readonly ('right' | 'left')[], playerSurface?: FootstepCategory): SoundEvent[] {
    const events: SoundEvent[] = [];
    const actors = [{ id: 'player', ...sim.player, foot:true }];
    for (const actor of actors) {
      const phase = Math.floor(actor.phase / Math.PI), previous = this.feet.get(actor.id);
      let variant = previous?.variant ?? 0;
      if (emit && actor.foot && actor.grounded && previous) {
        const landed = !previous.grounded && previous.fallSpeed < -2.5;
        const nativeLanding = actor.id === 'player' && landingContacts !== undefined;
        // The landing is its own event (TaskComplexInAirAndLand), even on the touchdown step the land clip has made no
        // foot contact yet; the clip's contacts, or the gait, play the steps.
        const category=actor.id==='player'&&playerSurface!==undefined?playerSurface:'concrete';
        if (landed) events.push({ footstep:actor.id==='player'?category:undefined, landed:true, landingOnly:true, sound:`step-${category==='grass'?'grass':'concrete'}-${variant % 3}`, position:{ ...actor.position }, gain:.5, rate:.94 + variant % 3 * .05 });
        const count = nativeLanding ? landingContacts.length : !landed && actor.speed > 0.3 && phase !== previous.phase ? 1 : 0;
        for (let i = 0; i < count; i++) {
          events.push({ footstep:actor.id==='player'?category:undefined, sound: `step-${category==='grass'?'grass':'concrete'}-${variant % 3}`, position: { ...actor.position },
            gain: actor.id === 'player' ? nativeLanding || landed ? 0.5 : 0.32 : 0.15, rate: 0.94 + variant % 3 * 0.05 }); variant++;
        }
      }
      this.feet.set(actor.id, { phase, grounded: actor.grounded, fallSpeed: actor.verticalSpeed, variant });
    }
    return events;
  }
}
