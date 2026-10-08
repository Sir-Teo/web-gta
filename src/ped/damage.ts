/** Ped damage math — Module 3 of the full-engine rewrite.
 *
 * Provenance: `pedstats.dat` rows via `scripts/content/world-sources.json`
 * (STAT_PLAYER attack 3.0x / defend 0.4x, ordinary peds 1.0/1.0, temper
 * threshold 60). Mirrors `CPedDamageResponseCalculator` order: attacker
 * strength scales the blow, victim defend scales what lands. Armour handling
 * stays in `Simulation.damagePlayer`.
 */
export const PLAYER_ATTACK_MULT = 3.0;

/** Scale an outgoing blow: base * attackerAttack * victimDefend. */
export function scaleBlow(base: number, attackerAttack: number, victimDefend: number): number {
  return base * attackerAttack * victimDefend;
}

/** Player punch damage after victim defend (melee.dat ground rows bypass scaling at the call site). */
export function playerPunchDamage(base: number, victimDefend: number): number {
  return scaleBlow(base, PLAYER_ATTACK_MULT, victimDefend);
}

/** NPC punch damage to the player (defend 0.4x applied inside damagePlayer). */
export function npcPunchDamage(base: number, npcAttack: number): number {
  return base * npcAttack;
}
