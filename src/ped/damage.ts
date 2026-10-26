/** Ped damage math — Module 3 of the full-engine rewrite.
 *
 * Provenance: `pedstats.dat` rows via `scripts/content/world-sources.json`
 * (STAT_PLAYER attack 3.0x / defend 0.4x, ordinary peds 1.0/1.0, temper
 * threshold 60). Mirrors `CPedDamageResponseCalculator` order: attacker
 * strength scales the blow, victim defend scales what lands, then armour absorbs it.
 */
export const PLAYER_ATTACK_MULT = 3.0;

/** ComputeWillKillPed's ordinary branch (PC 0x4B3210): below one HP is a death, while exactly one survives. */
export function healthAfter(health:number,damage:number){const remaining=health-damage;return remaining<1?0:remaining;}

/** AccountForPedArmour, inlined in iOS ComputeDamageResponse (0x100289d30–0x100289dc4):
 * spend the stat-scaled factor before ComputeWillKillPed. Drowning (53) and falls (54) bypass it.
 * Forced deaths still run afterwards, independently of the factor left by armour. */
export function spendPedArmour(damage:number,armour=0,weapon?:number){
 const absorbed=weapon===53||weapon===54?0:Math.min(Math.max(0,damage),Math.max(0,armour));
 return {armour:armour-absorbed,damageHealth:damage-absorbed,damageArmour:absorbed};
}

/** Scale an outgoing blow: base * attackerAttack * victimDefend. */
export function scaleBlow(base: number, attackerAttack: number, victimDefend: number): number {
  return base * attackerAttack * victimDefend;
}

/** Player punch damage after victim defend (melee.dat ground rows bypass scaling at the call site). */
export function playerPunchDamage(base: number, victimDefend: number): number {
  return scaleBlow(base, PLAYER_ATTACK_MULT, victimDefend);
}

/** NPC punch damage before Simulation.damagePlayer applies its native player scaling. */
export function npcPunchDamage(base: number, npcAttack: number): number {
  return base * npcAttack;
}
