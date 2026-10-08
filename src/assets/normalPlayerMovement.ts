import type {AnimationPackage} from './ifp';
import type {CharacterClip} from '../render/NativeCharacter';

/** Names from the native player association table; root identity is a bone ID, not a track position. */
export function normalPlayerMovement(pack:AnimationPackage):Record<'idle'|'walk'|'run'|'sprint'|'crouchIdle'|'crouchWalk'|'crouchWalkBack'|'crouchRollL'|'crouchRollR'|'launch'|'launchRight'|'airborne'|'landing'|'landingMoving'|'walkStart'|'runStop'|'runStopR'|'gunStand'|'gunMoveFwd'|'gunMoveBwd'|'gunMoveL'|'gunMoveR'|'fightIdle'|'fightShFwd'|'fightShBwd'|'fightShL'|'fightShR',CharacterClip>&{fallGlide?:CharacterClip}{
 const select=(name:string,moving:boolean):CharacterClip=>{
  const matches=pack.animations.filter(clip=>clip.name.toLowerCase()===name);
  if(matches.length!==1)throw new Error(`Normal movement requires one ${name} clip.`);
  const clip=matches[0];
  if(!(clip.duration>0))throw new Error(`Normal movement requires a nonempty ${name} clip.`);
  if(!moving)return {clip};
  const roots=clip.tracks.flatMap((track,index)=>track.boneId===0&&track.translations&&track.times.length?[index]:[]);
  if(roots.length!==1)throw new Error(`${clip.name} requires one translated root bone (ID 0).`);
  return {clip,track:roots[0]};
 };
 return {idle:select('idle_stance',false),walk:select('walk_player',true),run:select('run_player',true),sprint:select('sprint_civi',true),crouchIdle:select('weapon_crouch',false),crouchWalk:select('guncrouchfwd',true),crouchWalkBack:select('guncrouchbwd',true),crouchRollL:select('crouch_roll_l',true),crouchRollR:select('crouch_roll_r',true),launch:{...select('jump_launch',true),forwardMotion:true},launchRight:{...select('jump_launch_r',true),forwardMotion:true},airborne:select('jump_glide',true),landing:{...select('fall_land',true),forwardMotion:true},landingMoving:{...select('jump_land',true),forwardMotion:true},walkStart:select('walk_start',true),runStop:select('run_stop',true),runStopR:select('run_stopr',true),gunStand:select('gun_stand',false),gunMoveFwd:select('gunmove_fwd',true),gunMoveBwd:select('gunmove_bwd',true),gunMoveL:select('gunmove_l',true),gunMoveR:select('gunmove_r',true),
  // CTaskSimpleFight's stance (melee_1's FIGHTIDLE) and the standard group's FightSh shuffles.
  fightIdle:select('fightidle',false),fightShFwd:select('fightsh_fwd',true),fightShBwd:select('fightsh_bwd',true),fightShL:select('fightsh_left',true),fightShR:select('fightsh_right',true),
  // CTaskSimpleInAir's pose for a drop that is no jump (FALL_glide); the jump keeps JUMP_glide.
  fallGlide:(()=>{try{return select('fall_glide',true);}catch{try{return select('fall_glide',false);}catch{return undefined;}}})()};
}

