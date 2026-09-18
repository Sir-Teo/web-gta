import {requireAsset} from '../assets/binary';
import {randomIntInRange} from '../engine/nativeRandomRange';

/* CEventDamage::ComputeDeathAnim and ComputeDamageAnim, pinned gta-reversed
 * 0076f9017b4aeef7433957ac2bd8b6988e9df166, Events/EventDamage.cpp, with
 * CPed::GetLocalDirection (Ped.cpp). Clip names come from aStdAnimations
 * (Animation/AnimAssocAnimations.h), indexed by animation id.
 *
 * Pure: the caller describes the victim, the source and the damage. Three
 * inputs stand in for routines that are still retail stubs upstream and
 * default to neutral values: CStats::GetFatAndMuscleModifier(STAT_MOD_4)
 * (knockback only), CPedDamageResponseCalculator::ComputeWillForceDeath (the
 * forceDeath flag) and the victim task's MakeAbortable result. */

/** ePedPieceTypes. Zero is the generic piece used when no body part is known. */
export const PED_PIECE={generic:0,torso:3,ass:4,leftArm:5,rightArm:6,leftLeg:7,rightLeg:8,head:9} as const;
/** eWeaponType ids referenced by the branches below. */
export const WEAPON={unarmed:0,brassKnuckle:1,golfClub:2,nightstick:3,knife:4,baseballBat:5,shovel:6,poolCue:7,katana:8,chainsaw:9,
 dildo1:10,dildo2:11,vibe1:12,vibe2:13,flowers:14,cane:15,grenade:16,teargas:17,molotov:18,rocket:19,rocketHs:20,freefallBomb:21,
 pistol:22,pistolSilenced:23,desertEagle:24,shotgun:25,sawnoff:26,spas12:27,microUzi:28,mp5:29,ak47:30,m4:31,tec9:32,countryRifle:33,
 sniperRifle:34,rocketLauncher:35,rocketLauncherHs:36,flamethrower:37,minigun:38,satchel:39,detonator:40,spraycan:41,extinguisher:42,
 camera:43,nightVision:44,infrared:45,parachute:46,lastWeapon:47,armour:48,rammedByCar:49,runOverByCar:50,explosion:51,uziDriveby:52,
 drowning:53,fall:54} as const;
/** eMoveState values the damage choice compares against. */
export const PEDMOVE={none:0,still:1,walk:4,run:6,sprint:7} as const;
/** FIGHT_ATTACK_HIT_3 and FIGHT_ATTACK_FIGHTIDLE (TaskSimpleFight.h). */
const FIGHT_ATTACK_HIT_3=2,FIGHT_ATTACK_FIGHTIDLE=4;

/** Animation ids with a clip in the default ped group. */
export const ANIM_ID={noAnimation:-1,koShotFront0:15,koShotFront2:17,koShotFace:19,kdLeft:22,kdRight:23,koSkidFront:24,koSpinR:25,koSkidBack:26,koSpinL:27,
 shotPartial:28,hitFront:32,floorHit:36,hitWalk:37,floorHitF:39,hitBehind:40,drown:140,
 damArmLBack:171,damArmLFront:172,damArmLLeft:173,damArmRBack:174,damArmRFront:175,damArmRRight:176,
 damLegLBack:177,damLegLFront:178,damLegLLeft:179,damLegRBack:180,damLegRFront:181,damLegRRight:182,
 damStomachBack:183,damStomachFront:184,damStomachLeft:185,damStomachRight:186,
 /** ComputeDamageAnim's marker for a victim whose task refused to abort. */
 doorLHingeO:-2,
 /** ANIM_ID_FIGHT_HIT_1: added to the source's current move in its combo group. */
 fightHit1:-3} as const;

/** aStdAnimations entries for the ids the damage choice can produce, lowercased like the ped.ifp catalog. */
const STD_NAMES:Readonly<Record<number,string>>={
 15:'ko_shot_front',16:'ko_shot_front',17:'ko_shot_front',18:'ko_shot_front',19:'ko_shot_face',20:'ko_shot_stom',
 22:'kd_left',23:'kd_right',24:'ko_skid_front',25:'ko_spin_r',26:'ko_skid_back',27:'ko_spin_l',
 28:'shot_partial',29:'shot_leftp',30:'shot_partial_b',31:'shot_rightp',
 32:'hit_front',33:'hit_l',34:'hit_back',35:'hit_r',36:'floor_hit',37:'hit_walk',38:'hit_wall',39:'floor_hit_f',40:'hit_behind',
 140:'drown',171:'dam_arml_frmbk',172:'dam_arml_frmft',173:'dam_arml_frmlt',174:'dam_armr_frmbk',175:'dam_armr_frmft',176:'dam_armr_frmrt',
 177:'dam_legl_frmbk',178:'dam_legl_frmft',179:'dam_legl_frmlt',180:'dam_legr_frmbk',181:'dam_legr_frmft',182:'dam_legr_frmrt',
 183:'dam_stomach_frmbk',184:'dam_stomach_frmft',185:'dam_stomach_frmlt',186:'dam_stomach_frmrt'};
/** Every clip the damage choice can name in the default group. */
export const NATIVE_DAMAGE_CLIPS:readonly string[]=[...new Set(Object.values(STD_NAMES))];

export type LocalDirection=0|1|2|3;
/** CPed::GetLocalDirection in native axes (x east, y north). `rotation` is
 * m_fCurrentRotation and (dx, dy) points from the ped towards the point.
 * 0 is in front, 1 left, 2 behind, 3 right. */
export function nativeLocalDirection(rotation:number,dx:number,dy:number):LocalDirection{
 requireAsset([rotation,dx,dy].every(Number.isFinite),'Invalid local direction input.');
 let angle=Math.atan2(-dx,dy)-rotation+Math.PI/4;
 while(angle<0)angle+=Math.PI*2;
 return (Math.trunc(Math.trunc(angle*180/Math.PI)/90)%4) as LocalDirection;
}
/** The browser's x/z plane with heading h facing (sin h, cos h): native y is
 * -z and the native rotation is h + pi. */
export function browserLocalDirection(heading:number,dx:number,dz:number){return nativeLocalDirection(heading+Math.PI,dx,-dz);}

/** The source ped's melee state (CTaskSimpleFight). */
export interface DamageSourceFight {comboSet:number;currentMove:number;comboActive:boolean;hitComboActive:boolean;
 /** The combo group's clip for FIGHT_HIT_1 + move, e.g. hita_1..3 for the default set. */
 hitClip:(move:number)=>string;group:string}
export interface DamageAnimInput {
 weapon:number;pedPiece:number;direction:LocalDirection;
 /** Victim health after this damage has been applied. */
 health:number;
 /** m_damageResponse armour and health loss, and m_bForceDeath. */
 damageArmour:number;damageHealth:number;forceDeath?:boolean;
 victim:{player:boolean;inVehicle:boolean;moveState:number;ducking?:boolean;upperBodyOnly?:boolean;attached?:boolean;
  /** TASK_SIMPLE_FALL or TASK_SIMPLE_GET_UP is the simplest active task. */
  fallingOrGettingUp?:boolean;
  /** Head bone below the root (damage) / root more than 0.2 above it (death). */
  headBelowRoot?:boolean;lyingOnFront?:boolean;
  submerged?:boolean;standing?:boolean;
  /** The active task refuses MakeAbortable(ABORT_PRIORITY_URGENT). */
  taskRefusesAbort?:boolean;
  /** CPlayerPedData::m_nHitAnimDelayTimer and whether the player is driving. */
  hitAnimDelayUntil?:number;driving?:boolean};
 source?:{ped:boolean;player?:boolean;adrenaline?:boolean;object?:boolean;fight?:DamageSourceFight;pistolWhip?:{group:string;clip:string}};
 /** The animation id of the victim's current damage event, for the re-pick. */
 previousAnimId?:number;
 /** CGeneral random samples, 0..32767, for the re-pick. */
 nextRandom?:()=>number;
 nowMs?:number;
 /** CStats::GetFatAndMuscleModifier(STAT_MOD_4), a retail stub. */
 fatMuscleModifier?:number;
 megaPunch?:boolean;
 /** CWeaponInfo for the in-vehicle branch: fire type 0 is melee. */
 weaponInfo?:{fire:number;damage:number};
}
export interface DamageAnimResult {
 id:number;
 /** ped.ifp clip name; undefined for no animation or the abort marker. */
 clip?:string;group:string;blend:number;speed:number;fallDown:boolean;
 /** Horizontal knockback away from the source; vertical force is 5 whenever this is non-zero. */
 force:number;
 /** The player's next hit-animation time when this hit set it. */
 hitAnimDelayUntil?:number;
}
const result=(id:number,group:string,blend:number,speed:number,fallDown:boolean,force:number):DamageAnimResult=>
 ({id,clip:id>=0?STD_NAMES[id]:undefined,group,blend,speed,fallDown,force});

/** CEventDamage::ComputeDeathAnim. */
export function computeDeathAnim(input:DamageAnimInput):DamageAnimResult{
 const {weapon,direction,victim,source}=input;
 let id:number=ANIM_ID.koShotFront0,group='ped',blend=4,force=0,fallDown=false;
 if(victim.inVehicle||victim.taskRefusesAbort)return result(ANIM_ID.noAnimation,group,blend,1,false,0);
 if(weapon===WEAPON.drowning||victim.submerged&&!victim.standing)return result(ANIM_ID.drown,group,blend,1,false,0);
 const fight=source?.ped?source.fight:undefined;
 if(victim.headBelowRoot&&victim.fallingOrGettingUp){
  return result(victim.lyingOnFront?ANIM_ID.floorHitF:ANIM_ID.floorHit,group,blend,1,true,0);
 }
 if(!direction&&fight&&fight.comboActive&&fight.comboSet>=4&&fight.currentMove<=FIGHT_ATTACK_HIT_3){
  group=fight.group;blend=16;force=1;
  const out:DamageAnimResult={id:ANIM_ID.fightHit1,clip:fight.hitClip(fight.currentMove),group,blend,speed:1,fallDown,force:0};
  return finishDeathForce(out,force,input);
 }
 let knockOut=false,shotFront=false,extraForce=false;
 switch(weapon){
  case WEAPON.unarmed:case WEAPON.brassKnuckle:case WEAPON.nightstick:case WEAPON.chainsaw:case WEAPON.parachute:force=.5;extraForce=true;break;
  case WEAPON.golfClub:case WEAPON.baseballBat:case WEAPON.shovel:case WEAPON.poolCue:case WEAPON.katana:case WEAPON.dildo1:force=1.5;extraForce=true;break;
  case WEAPON.knife:case WEAPON.dildo2:case WEAPON.vibe1:case WEAPON.vibe2:case WEAPON.flowers:case WEAPON.cane:extraForce=true;break;
  case WEAPON.grenade:case WEAPON.rocketLauncher:case WEAPON.rocketLauncherHs:case WEAPON.satchel:case WEAPON.explosion:knockOut=true;break;
  case WEAPON.teargas:case WEAPON.molotov:case WEAPON.flamethrower:case WEAPON.spraycan:case WEAPON.extinguisher:id=ANIM_ID.koShotFront0;break;
  case WEAPON.pistol:case WEAPON.pistolSilenced:case WEAPON.microUzi:case WEAPON.mp5:case WEAPON.tec9:case WEAPON.countryRifle:case WEAPON.sniperRifle:case WEAPON.uziDriveby:shotFront=true;break;
  case WEAPON.desertEagle:force=1;shotFront=true;break;
  case WEAPON.shotgun:case WEAPON.sawnoff:case WEAPON.spas12:case WEAPON.minigun:force=2;shotFront=true;break;
  case WEAPON.ak47:case WEAPON.m4:force=.5;shotFront=true;break;
  case WEAPON.rammedByCar:case WEAPON.runOverByCar:
   // Direction 0: arm-specific knockdowns, otherwise a skid back, and the
   // generic piece falls to the right. Direction 2 mirrors that forwards.
   if(direction===0)id=input.pedPiece===PED_PIECE.leftArm?ANIM_ID.kdLeft:input.pedPiece?ANIM_ID.koSkidBack:ANIM_ID.kdRight;
   else if(direction===1)id=ANIM_ID.koSpinR;
   else if(direction===2)id=input.pedPiece===PED_PIECE.leftArm?ANIM_ID.kdLeft:input.pedPiece===PED_PIECE.rightArm?ANIM_ID.kdRight:ANIM_ID.koSkidFront;
   else id=ANIM_ID.koSpinL;
   break;
  case WEAPON.drowning:id=ANIM_ID.drown;break;
  case WEAPON.fall:id=ANIM_ID.koShotFront2;break;
 }
 if(extraForce){
  if(input.forceDeath){id=ANIM_ID.koShotFace;force=0;}else knockOut=true;
  if(source?.ped&&source.player)force=source.adrenaline?force*5:(input.fatMuscleModifier??1)*force;
 }
 if(shotFront){
  if(input.forceDeath){id=ANIM_ID.koShotFront0;force=0;}
  else if(force<=0)id=ANIM_ID.koShotFront0;
  else knockOut=true;
 }
 if(knockOut)id=[ANIM_ID.koSkidFront,ANIM_ID.koSpinR,ANIM_ID.koSkidBack,ANIM_ID.koSpinL][direction];
 return finishDeathForce(result(id,group,blend,1,fallDown,0),force,input);
}
function finishDeathForce(out:DamageAnimResult,force:number,input:DamageAnimInput){
 if(input.megaPunch&&(!input.weapon||input.weapon===WEAPON.brassKnuckle||input.weapon===WEAPON.parachute))force*=20;
 // ApplyMoveForce((source - ped).normalized * force * -5, z = 5): away from the source.
 if(force>0&&input.source)out.force=force*5;
 return out;
}

/** CEventDamage::ComputeDamageAnim. */
export function computeDamageAnim(input:DamageAnimInput):DamageAnimResult{
 const {weapon,direction,victim,source}=input,player=victim.player;
 if(victim.inVehicle){
  const info=input.weaponInfo??{fire:1,damage:0};
  const fallDown=!info.fire&&!!weapon&&weapon!==WEAPON.brassKnuckle&&weapon!==WEAPON.parachute||info.damage>50;
  return result(ANIM_ID.noAnimation,'ped',8,1,fallDown,0);
 }
 let heavyHit=weapon===WEAPON.spas12||weapon===WEAPON.shotgun||weapon===WEAPON.sawnoff||weapon===WEAPON.desertEagle||weapon===WEAPON.countryRifle;
 if(victim.upperBodyOnly)heavyHit=false;
 let strength=1,healthThreshold=15,force=0,fallDown=false;
 const fight=source?.ped?source.fight:undefined,pistolWhip=source?.ped&&!fight?source.pistolWhip:undefined;
 if(source?.ped&&source.player){
  if(source.adrenaline)strength=2;
  else{strength=((input.fatMuscleModifier??1)+1)*.5;healthThreshold=10*.5+10;}
 }
 let id:number=ANIM_ID.noAnimation,group='ped',blend=8,speed=1,hitAnimDelayUntil:number|undefined;
 if(victim.headBelowRoot&&!player&&victim.fallingOrGettingUp){
  fallDown=true;id=victim.lyingOnFront?ANIM_ID.floorHitF:ANIM_ID.floorHit;
 }else if(input.pedPiece===PED_PIECE.torso){
  let scaled=false;
  if(pistolWhip){scaled=!!direction&&!player;}
  else if(heavyHit&&!player)scaled=true;
  if(victim.upperBodyOnly||victim.ducking||victim.attached||!scaled||!source){
   if(weapon>=WEAPON.chainsaw||input.health>=healthThreshold){
    if(weapon!==WEAPON.fall||!source||!source.object){
     if(fight&&fight.currentMove===FIGHT_ATTACK_FIGHTIDLE&&!player&&victim.moveState>PEDMOVE.walk)fallDown=true;
    }else fallDown=true;
   }else{fallDown=true;force=strength*5;}
  }else{fallDown=true;force=5;}
 }
 let playHitAnim=true,noComboHit=false;
 if(fallDown&&(direction||!fight||!fight.comboActive&&!fight.hitComboActive)){noComboHit=true;playHitAnim=false;}
 else{
  fallDown=false;
  if(!direction){
   if(fight&&fight.comboSet>=4&&fight.currentMove<=FIGHT_ATTACK_HIT_3){
    group=fight.group;id=ANIM_ID.fightHit1;blend=16;if(fight.comboActive)fallDown=true;playHitAnim=false;
    const out:DamageAnimResult={id,clip:fight.hitClip(fight.currentMove),group,blend,speed,fallDown,force:0};
    return finishDamage(out,input,noComboHit,force,hitAnimDelayUntil);
   }
   if(pistolWhip){
    const out:DamageAnimResult={id:ANIM_ID.fightHit1+1,clip:pistolWhip.clip,group:pistolWhip.group,blend:16,speed,fallDown,force:0};
    return finishDamage(out,input,noComboHit,force,hitAnimDelayUntil);
   }
  }
 }
 if(playHitAnim){
  const gun=weapon>=WEAPON.pistol&&weapon<=WEAPON.countryRifle;
  const bodyPartBranch=!gun||heavyHit&&!player||(!player||heavyHit)&&victim.moveState<=PEDMOVE.still&&!victim.ducking&&!victim.upperBodyOnly;
  if(bodyPartBranch){
   let play=true;
   if(player&&weapon>=WEAPON.pistol){
    const now=input.nowMs??0;
    if(now<=(victim.hitAnimDelayUntil??0)||victim.driving){id=ANIM_ID.noAnimation;play=false;}
    else hitAnimDelayUntil=now+2500;
   }
   if(play){
    if(weapon<WEAPON.pistol||weapon>WEAPON.lastWeapon){
     id=ANIM_ID.hitFront+direction;
     if(direction||input.damageArmour+input.damageHealth<=20){
      if(direction===2&&weapon<=WEAPON.cane)id=ANIM_ID.hitBehind;
     }else id=ANIM_ID.hitWalk;
    }else{
     const previous=input.previousAnimId??-1;
     const repick=(options:number[])=>{
      if(id!==previous)return;
      requireAsset(input.nextRandom,'A repeated damage animation needs CGeneral random samples.');
      do id=options[randomIntInRange(input.nextRandom!(),0,options.length)];while(id===previous);
     };
     switch(input.pedPiece){
      case PED_PIECE.leftArm:id=direction===2?ANIM_ID.damArmLBack:direction===1?ANIM_ID.damArmLLeft:ANIM_ID.damArmLFront;
       repick([ANIM_ID.damArmLBack,ANIM_ID.damArmLFront,ANIM_ID.damArmLLeft]);break;
      case PED_PIECE.rightArm:id=direction===2?ANIM_ID.damArmRBack:direction===3?ANIM_ID.damArmRRight:ANIM_ID.damArmRFront;
       repick([ANIM_ID.damArmRBack,ANIM_ID.damArmRFront,ANIM_ID.damArmRRight]);break;
      case PED_PIECE.leftLeg:id=direction===2?ANIM_ID.damLegLBack:direction===1?ANIM_ID.damLegLLeft:ANIM_ID.damLegLFront;
       repick([ANIM_ID.damLegLBack,ANIM_ID.damLegLFront,ANIM_ID.damLegLLeft]);break;
      case PED_PIECE.rightLeg:id=direction===2?ANIM_ID.damLegRBack:direction===3?ANIM_ID.damLegRRight:ANIM_ID.damLegRFront;
       repick([ANIM_ID.damLegRBack,ANIM_ID.damLegRFront,ANIM_ID.damLegRRight]);break;
      case PED_PIECE.torso:case PED_PIECE.ass:
       id=[ANIM_ID.damStomachFront,ANIM_ID.damStomachLeft,ANIM_ID.damStomachBack,ANIM_ID.damStomachRight][direction];
       repick([ANIM_ID.damStomachBack,ANIM_ID.damStomachFront,ANIM_ID.damStomachLeft,ANIM_ID.damStomachRight]);break;
      default:id=ANIM_ID.hitFront+direction;
     }
    }
   }
  }else{
   group='ped';blend=8;id=ANIM_ID.shotPartial+direction;
   if(player){
    const now=input.nowMs??0;
    if(now>(victim.hitAnimDelayUntil??0)&&!victim.driving)hitAnimDelayUntil=now+(weapon===WEAPON.m4?2500:1500);
    else id=ANIM_ID.noAnimation;
   }
  }
 }
 return finishDamage(result(id,group,blend,speed,fallDown,0),input,noComboHit,force,hitAnimDelayUntil);
}
function finishDamage(out:DamageAnimResult,input:DamageAnimInput,noComboHit:boolean,force:number,hitAnimDelayUntil:number|undefined){
 if(hitAnimDelayUntil!==undefined)out.hitAnimDelayUntil=hitAnimDelayUntil;
 if(input.victim.taskRefusesAbort){out.id=ANIM_ID.doorLHingeO;out.clip=undefined;out.group='ped';out.fallDown=false;return out;}
 if(out.fallDown&&noComboHit){
  out.id=ANIM_ID.koSkidFront+input.direction;out.clip=STD_NAMES[out.id];out.group='ped';
  if(force>0&&input.source)out.force=force;
 }
 return out;
}
/** CEventDamage::ComputeAnim: the death choice once health is gone. */
export function computeDamageEventAnim(input:DamageAnimInput){return input.health<=0?computeDeathAnim(input):computeDamageAnim(input);}
