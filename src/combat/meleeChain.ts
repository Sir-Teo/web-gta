/** Shared melee chain — Module 1 of the full-engine rewrite.
 *
 * Provenance:
 * - Combo data: `melee.dat` via `scripts/content/world-sources.json`,
 *   surfaced through `src/simulation/nativeMelee.ts` (no executable copy).
 * - Sequencing shape: gta-reversed `CTaskSimpleFight` (damage applied on the
 *   hit frame, next link opens at the chain frame; whiffs reset to the jab)
 *   plus `CPlayerPed::FindPedToAttack` line scoring for lock-on. Upstream
 *   `CTaskSimpleFight` itself is still an executable call, so frame handling
 *   here is a clean-room port marked as such, not a line copy.
 *
 * Pure + deterministic: no Date/performance/Rapier/Three. Both the player
 * (`WorldPedestrians.punch`) and NPC brawlers consume these helpers so the
 * 3-hit jab/cross/hook, ground finisher (25) and sprint-attack rules match.
 */
import {
  NATIVE_MELEE_COMBOS,
  meleeComboFor,
  type NativeMeleeCombo,
} from '../simulation/nativeMelee';

export type { NativeMeleeCombo };
export { NATIVE_MELEE_COMBOS, meleeComboFor };

/** Extra seconds after `chain` during which a landed hit still links. */
export const MELEE_CHAIN_GRACE = 0.25;
/** Frontal-cone cosine: strikes connect only while aligned at the hit frame. */
export const MELEE_FRONTAL_DOT = 0.35;

export interface StrikeRequest {
  /** Stage that was swung (0 jab, 1 cross, 2 hook). */
  stage: number;
  moving: boolean;
  victimDown: boolean;
}

export interface ResolvedStrike {
  stage: number;
  damage: number;
  /** Seconds after the swing starts when damage lands (hit frame / 30). */
  delay: number;
  /** Whether the chain link stays open if this strike lands. */
  links: boolean;
  finisher: boolean;
}

/** Which stage index swings next given time since the last *landed* strike. */
export function nextChainIndex(
  current: number,
  elapsedSinceLanded: number,
  chain: number,
): number {
  if (Number.isFinite(elapsedSinceLanded) && elapsedSinceLanded < chain + MELEE_CHAIN_GRACE) {
    return (current + 1) % 3;
  }
  return 0;
}

/** Cooldown after starting a swing at `stage` (the chain window). */
export function chainCooldown(combo: NativeMeleeCombo, stage: number): number {
  return combo.stages[stage]?.chain ?? 0.5;
}

/** Resolve damage + hit-frame delay for a swing. */
export function resolveStrike(
  combo: NativeMeleeCombo,
  req: StrikeRequest,
): ResolvedStrike {
  const stage = combo.stages[req.stage] ?? combo.stages[0];
  if (req.victimDown) {
    return { stage: req.stage, damage: combo.ground.damage, delay: combo.ground.hit, links: false, finisher: true };
  }
  if (req.moving) {
    return { stage: req.stage, damage: combo.moving.damage, delay: combo.moving.hit, links: false, finisher: false };
  }
  return {
    stage: req.stage,
    damage: stage.damage,
    delay: stage.hit,
    links: req.stage < 2,
    finisher: req.stage === 2,
  };
}

/** Frontal-cone check shared by player and NPC strikers. */
export function inStrikeCone(
  dx: number,
  dz: number,
  hx: number,
  hz: number,
  dot = MELEE_FRONTAL_DOT,
): boolean {
  const flat = Math.hypot(dx, dz);
  if (flat < 1e-4) return true;
  return (dx * hx + dz * hz) / flat > dot;
}
