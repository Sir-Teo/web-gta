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
/** The same branch with native float field/arithmetic rounding, for damage entries that supply a float32 factor. */
export function healthAfterFloat32(health:number,damage:number){const remaining=Math.fround(Math.fround(health)-Math.fround(damage));return remaining<1?0:remaining;}

/** AccountForPedArmour, inlined in iOS ComputeDamageResponse (0x100289d30–0x100289dc4):
 * spend the stat-scaled factor before ComputeWillKillPed. Drowning (53) and falls (54) bypass it.
 * Forced deaths still run afterwards, independently of the factor left by armour. */
export function spendPedArmour(damage:number,armour=0,weapon?:number){
 const absorbed=weapon===53||weapon===54?0:Math.min(Math.max(0,damage),Math.max(0,armour));
 return {armour:armour-absorbed,damageHealth:damage-absorbed,damageArmour:absorbed};
}

/** AccountForPedDamageStats's native float input fields and multiply. */
export function pedDamageFactor(damage:number,defend:number){return Math.fround(Math.fround(damage)*Math.fround(defend));}
/** AccountForPedArmour's float fields and subtractions for native calculator entries. */
export function spendPedArmourFloat32(damage:number,armour=0,weapon?:number){
 const response=spendPedArmour(Math.fround(damage),Math.fround(armour),weapon);
 return {armour:Math.fround(response.armour),damageHealth:Math.fround(response.damageHealth),damageArmour:Math.fround(response.damageArmour)};
}

/** DAMAGE_CHAR (0851), iOS 0x1001fea44 / 0x1001fee30: direct float fields, optional armour,
 * no damage stats/proofs or one-HP calculator boundary. Negative amounts also follow the native subtraction. */
export function scriptPedDamage(health:number,armour:number,amount:number,damageArmour:boolean){
 let factor=Math.fround(amount),remainingArmour=Math.fround(armour);
 if(damageArmour){
  if(factor>remainingArmour){factor=Math.fround(factor-remainingArmour);remainingArmour=0;}
  else{remainingArmour=Math.fround(remainingArmour-factor);factor=0;}
 }
 const remainingHealth=Math.fround(Math.fround(health)-factor);
 return {health:remainingHealth>0?remainingHealth:0,armour:remainingArmour};
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
