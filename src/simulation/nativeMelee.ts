/** Native melee combos from the original melee.dat (noclip public dataset).
 *
 * Standard fist combo UNARMED_1, animgrp melee_1, RANGES 1.6:
 *   ATTACK1 hit 5.0  chain 10.0 radius 0.4 H damage 6
 *   ATTACK2 hit 8.0  chain 17.0 radius 0.4 H damage 9
 *   ATTACK3 hit 10.0 chain 20.0 radius 0.4 H damage 15
 *   AGROUND hit 10.5 chain 20.0 radius 0.4 G damage 25 (downed victims)
 *   AMOVING hit 7.0  chain 10.0 radius 0.4 HL damage 5 (attacker sprinting)
 * Weapon combos follow the same layout (hit/chain frames at 30 fps):
 *   BBALLBAT 11/22/18, 14/28/18, 13/99/25 (golf, nightstick, bat, shovel, cue)
 *   KNIFE 8/20/10, 9/24/10, 10/99/25 (knife, white dildo, vibrator)
 *   SWORD 11/20/10, 15/22/15, 12/99/25 (katana, cane)
 *   DILDO 11/22/18, 15/28/18, 13/99/25 (purple dildo, vibrator)
 *   FLOWERS 6/21/18, 15/28/18, 13/99/25
 *   CHAINSAW 14/25/50, 14/20/60, 13/99/100 (holding attack chains its moves)
 * The weapon.dat melee rows map each weapon ID to its baseCombo; the browser
 * resolves that name here. CTaskSimpleFight applies damage on the hit frame
 * and opens the next chain at the chain frame; unarmed strikes queue so
 * animation and damage stay aligned, while swung weapons keep the existing
 * immediate cast with native damage, chain windows and 1.6 m reach.
 */
export interface NativeMeleeStage { hit: number; chain: number; radius: number; damage: number }
export interface NativeMeleeCombo { range: number; stages: [NativeMeleeStage, NativeMeleeStage, NativeMeleeStage]; ground: { hit: number; chain: number; damage: number }; moving: { hit: number; chain: number; damage: number } }
const FPS = 30;
const stage = (hit: number, chain: number, radius: number, damage: number): NativeMeleeStage => ({ hit: hit / FPS, chain: chain / FPS, radius, damage });
export const NATIVE_MELEE_COMBOS: Record<string, NativeMeleeCombo> = {
  UNARMED: { range: 1.6, stages: [stage(5, 10, 0.4, 6), stage(8, 17, 0.4, 9), stage(10, 20, 0.4, 15)], ground: { hit: 10.5 / FPS, chain: 20 / FPS, damage: 25 }, moving: { hit: 7 / FPS, chain: 10 / FPS, damage: 5 } },
  BBALLBAT: { range: 1.6, stages: [stage(11, 22, 0.5, 18), stage(14, 28, 0.5, 18), stage(13, 99, 0.5, 25)], ground: { hit: 18 / FPS, chain: 30 / FPS, damage: 25 }, moving: { hit: 11 / FPS, chain: 13 / FPS, damage: 10 } },
  KNIFE: { range: 1.6, stages: [stage(8, 20, 0.4, 10), stage(9, 24, 0.4, 10), stage(10, 99, 0.4, 25)], ground: { hit: 11 / FPS, chain: 21 / FPS, damage: 25 }, moving: { hit: 6 / FPS, chain: 10 / FPS, damage: 10 } },
  SWORD: { range: 1.6, stages: [stage(11, 20, 0.5, 10), stage(15, 22, 0.5, 15), stage(12, 99, 0.5, 25)], ground: { hit: 18 / FPS, chain: 30 / FPS, damage: 25 }, moving: { hit: 8 / FPS, chain: 10 / FPS, damage: 10 } },
  DILDO: { range: 1.6, stages: [stage(11, 22, 0.5, 18), stage(15, 28, 0.5, 18), stage(13, 99, 0.5, 25)], ground: { hit: 18 / FPS, chain: 30 / FPS, damage: 25 }, moving: { hit: 11 / FPS, chain: 13 / FPS, damage: 10 } },
  FLOWERS: { range: 1.6, stages: [stage(6, 21, 0.5, 18), stage(15, 28, 0.5, 18), stage(13, 99, 0.5, 25)], ground: { hit: 18 / FPS, chain: 30 / FPS, damage: 25 }, moving: { hit: 11 / FPS, chain: 13 / FPS, damage: 10 } },
  // The three styles the gyms teach, melee.dat's UNARMED_2 (boxing, melee_2), UNARMED_3 (kung fu, melee_3) and
  // UNARMED_4 (kickboxing, melee_4).
  UNARMED_2: { range: 1.6, stages: [stage(6, 18, 0.4, 10), stage(8, 27, 0.4, 7), stage(11, 99, 0.4, 16)], ground: { hit: 12 / FPS, chain: 21 / FPS, damage: 25 }, moving: { hit: 4 / FPS, chain: 10 / FPS, damage: 5 } },
  UNARMED_3: { range: 1.6, stages: [stage(9, 15, 0.4, 6), stage(13, 23, 0.4, 9), stage(15, 99, 0.4, 15)], ground: { hit: 8 / FPS, chain: 17 / FPS, damage: 25 }, moving: { hit: 7 / FPS, chain: 10 / FPS, damage: 5 } },
  UNARMED_4: { range: 1.6, stages: [stage(13, 25, 0.4, 12), stage(6, 48, 0.5, 15), stage(9, 99, 0.4, 200)], ground: { hit: 11 / FPS, chain: 99 / FPS, damage: 25 }, moving: { hit: 9 / FPS, chain: 10 / FPS, damage: 5 } },
  CHAINSAW: { range: 1.6, stages: [stage(14, 25, 0.5, 50), stage(14, 20, 0.5, 60), stage(13, 99, 0.5, 100)], ground: { hit: 10 / FPS, chain: 11 / FPS, damage: 25 }, moving: { hit: 1 / FPS, chain: 1.1 / FPS, damage: 25 } },
};
/** Resolve a weapon.dat baseCombo to its melee.dat table. */
export function meleeComboFor(baseCombo: string | undefined): NativeMeleeCombo | undefined {
  if (!baseCombo) return undefined;
  return NATIVE_MELEE_COMBOS[baseCombo];
}
export const NATIVE_UNARMED_RANGE = NATIVE_MELEE_COMBOS.UNARMED.range;
export const NATIVE_UNARMED_STAGES: NativeMeleeStage[] = NATIVE_MELEE_COMBOS.UNARMED.stages;
export const NATIVE_UNARMED_GROUND_DAMAGE = NATIVE_MELEE_COMBOS.UNARMED.ground.damage;
export const NATIVE_UNARMED_MOVING_DAMAGE = NATIVE_MELEE_COMBOS.UNARMED.moving.damage;

/** CPlayerPed::FindPedToAttack line distance with the gang discount. */
export function attackLineDistance(origin: { x: number; z: number }, forward: { x: number; z: number }, point: { x: number; z: number }, gang: boolean): number {
  const fx = forward.x, fz = forward.z;
  const fl = Math.hypot(fx, fz) || 1;
  const nx = fx / fl, nz = fz / fl;
  const rx = point.x - origin.x, rz = point.z - origin.z;
  const along = rx * nx + rz * nz;
  const lateral = Math.abs(rx * nz - rz * nx);
  const pointDist = Math.hypot(rx, rz);
  let dist = along < 0 ? pointDist + Math.abs(along) : lateral;
  if (pointDist > 20) dist += (pointDist - 20) / 5;
  if (gang) dist = Math.max(0, dist / 2 - 2);
  return dist;
}

/** The clips of each melee.dat ANIMGROUP, from the aMelee_1 .. aCsaw_1 tables
 * (Animation/AnimAssocAnimations.h, gta-reversed 0076f901): ANIM_ID_FIGHT_1..3, then
 * FIGHT_G (a downed target) and FIGHT_M (attacking on the move), then the victim's
 * FIGHT_HIT_1..3, which CTaskSimpleBeHit::StartAnim takes from the attacker's combo
 * group. Keyed by the weapon.dat baseCombo, which melee.dat maps to the group. */
export interface MeleeSwingClips {attacks:readonly [string,string,string];ground:string;moving:string;hits:readonly [string,string,string];
 /** The IFP block the group lives in (AnimAssocDefinitions), when it is not the weapon's own. */
 file?:string}
const swing=(a:string,b:string,c:string,ground:string,moving:string,hit:string,hit3=`${hit}_3`):MeleeSwingClips=>({attacks:[a,b,c],ground,moving,hits:[`${hit}_1`,`${hit}_2`,hit3]});
export const MELEE_SWING_CLIPS:Record<string,MeleeSwingClips>={
 UNARMED:swing('FightA_1','FightA_2','FightA_3','FightA_G','FightA_M','HitA'),
 UNARMED_2:{...swing('FightB_1','FightB_2','FightB_3','FightB_G','FightB_M','HitB'),file:'fight_b'},
 UNARMED_3:{...swing('FightC_1','FightC_2','FightC_3','FightC_G','FightC_M','HitC'),file:'fight_c'},
 UNARMED_4:{...swing('FightD_1','FightD_2','FightD_3','FightD_G','FightD_M','HitD'),file:'fight_d'},
 BBALLBAT:swing('Bat_1','Bat_2','Bat_3','Bat_4','BAT_PART','Bat_Hit'),
 GOLFCLUB:swing('Bat_1','Bat_2','Bat_3','Bat_4','BAT_PART','Bat_Hit'),
 KNIFE:swing('knife_1','knife_2','knife_3','knife_G','knife_part','knife_hit'),
 SWORD:swing('sword_1','sword_2','sword_3','sword_4','sword_part','sword_Hit'),
 CHAINSAW:swing('CSaw_1','CSaw_2','CSaw_3','CSaw_G','CSaw_Part','CSaw_Hit'),
 DILDO:swing('Dildo_1','Dildo_2','Dildo_3','Dildo_G','Dildo_1','Dildo_Hit'),
 FLOWERS:{...swing('Flower_attack','Flower_attack','Flower_attack','Flower_attack','Flower_attack','Flower_hit'),hits:['Flower_hit','Flower_hit','Flower_hit']},
};
/** Which swing a melee attack plays. */
export type MeleeSwing={kind:'attack';stage:0|1|2}|{kind:'ground'}|{kind:'moving'};

/** melee.dat FLAGS, least significant hex digit first: attack availability, then
 * FALL_1 (1), FALL_2 (2) and FALL_3 (4), the combo moves whose hit knocks the victim
 * down; then FALL_RUN, BLOCK and OWN_IDLE; then NOFALL_1..3. */
export const MELEE_COMBO_FLAGS:Record<string,number>={UNARMED:0x60f,UNARMED_2:0x64f,UNARMED_3:0x64f,UNARMED_4:0x264f,BBALLBAT:0x64f,KNIFE:0x64f,GOLFCLUB:0x00f,SWORD:0x64f,CHAINSAW:0x44f,DILDO:0x607,FLOWERS:0x00};
/** Whether attack `stage` (0, 1 or 2) of a combo knocks its victim down. */
export function meleeAttackFalls(combo:string,stage:0|1|2){return (((MELEE_COMBO_FLAGS[combo]??0)>>4)&(1<<stage))!==0;}
/** eFightingStyle: STYLE_STANDARD (4), STYLE_BOXING (5), STYLE_KUNG_FU (6) and STYLE_KNEE_HEAD (7) are melee.dat's
 * UNARMED_1 to UNARMED_4 by combo index; CPlayerPed starts on STYLE_GRAB_KICK (15, KICK_STD's index) with every move
 * allowed (15). */
export const FIGHTING_STYLE={standard:4,boxing:5,kungFu:6,kneeHead:7,grabKick:15,elbows:16} as const;
/** The combo a ped's fists use for its fighting style. CTaskSimpleFight's choice is unreversed; what the game shows is
 * the three gym styles punching with their own combos and every other style (the player's grab-kick start included)
 * with the standard UNARMED_1. */
export function fightingStyleCombo(style:number):string{return style===5?'UNARMED_2':style===6?'UNARMED_3':style===7?'UNARMED_4':'UNARMED';}
