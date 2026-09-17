/** Ped brain tasks — Module 2 of the full-engine rewrite.
 *
 * Provenance: behavior shape follows gta-reversed `CTaskComplexWander`,
 * `CTaskSimpleHitReaction` (locomotion owned mid-reaction), `CTaskComplexFight`
 * and `CEventDamage` retaliation routing. Upstream fight/hit tasks are still
 * executable calls, so durations here are clean-room values marked as such
 * and tuned to the existing browser reactions (0.5 s stagger, 6 s brawl).
 * Pure logic only — WorldPedestrians owns Rapier/Three wiring.
 */
import { TaskStack, EventQueue, type Task } from '../engine/task';

export type BrainKind = 'wander' | 'loiter' | 'flee' | 'hit' | 'fight' | 'downed' | 'pursue' | 'follow';

export interface BrainState {
  health: number;
  down: number;
  flee: number;
  retaliate: number;
  stagger: number;
  temper: number;
  officer: boolean;
  follow: boolean;
  loiter: boolean;
}

export const HIT_REACTION_SECONDS = 0.5;
export const BRAWL_SECONDS = 6;
export const BUMP_RETALIATE_SECONDS = 4;
export const FLEE_SECONDS = 8;

/** pedstats.dat temper routing for EVENT_DAMAGE (hotheads 60+ stand and fight). */
export function decideDamageResponse(o: {
  temper: number;
  officer: boolean;
  alreadyFighting: boolean;
  healthAfter: number;
}): 'fight' | 'flee' | 'none' {
  if (o.officer || o.healthAfter <= 0) return 'none';
  if (o.temper >= 60 || o.alreadyFighting) return 'fight';
  return 'flee';
}

function timedTask<TCtx>(
  name: BrainKind,
  seconds: number,
  extra?: Partial<Task<TCtx>>,
): Task<TCtx & { dt: number }> {
  let t = 0;
  return {
    name,
    ...extra,
    update: (ctx, dt) => {
      t += Math.max(0, dt);
      void ctx;
      return t >= seconds ? 'done' : 'running';
    },
  };
}

export function hitReactionTask(): Task<{ dt: number }> {
  return timedTask('hit', HIT_REACTION_SECONDS);
}
export function fightTask(): Task<{ dt: number }> {
  return timedTask('fight', BRAWL_SECONDS);
}
export function fleeTask(seconds = FLEE_SECONDS): Task<{ dt: number }> {
  return timedTask('flee', seconds);
}

/** Apply an EVENT_DAMAGE routing decision to mutable brain timers. */
export function applyDamageResponse(
  state: Pick<BrainState, 'retaliate' | 'flee'>,
  decision: 'fight' | 'flee' | 'none',
): void {
  if (decision === 'fight') {
    state.retaliate = Math.max(state.retaliate, BRAWL_SECONDS);
    state.flee = 0;
  } else if (decision === 'flee') {
    state.flee = Math.max(state.flee, FLEE_SECONDS);
  }
}

export { TaskStack, EventQueue };
export type { Task };
