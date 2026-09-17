/** Survival engine — full-game port facade.
 *
 * Provenance: `src/simulation/health.ts` (landing impact, 4 s death
 * recovery), `Simulation.damagePlayer` armour order
 * (`CPedDamageResponseCalculator::AccountForPedArmour`), swim breath via
 * `nativeSwim.ts`. Pure helpers so HUD, police bust/wasted and tests share one source.
 */
export { landingDamage, DEATH_RECOVERY_SECONDS } from '../simulation/health';
export {beginPlayerBreathFrame,handlePlayerBreath} from '../simulation/playerBreath';

export const ARMOUR_ABSORBS_FIRST = true;

/** Armour absorbs first (except falls/drowning which bypass). Returns [healthLost, armourLeft]. */
export function applyArmour(health: number, armour: number, amount: number, bypassArmour = false): [number, number] {
  if (!bypassArmour && armour > 0) {
    const absorbed = Math.min(armour, amount);
    armour -= absorbed;
    amount -= absorbed;
  }
  return [Math.max(0, health - amount), armour];
}
