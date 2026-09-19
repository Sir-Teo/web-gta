import type {AnimationPackage} from './ifp';
import type {CharacterClip} from '../render/NativeCharacter';

/** Names from the native player association table; root identity is a bone ID, not a track position. */
export function normalPlayerMovement(pack:AnimationPackage):Record<'idle'|'walk'|'run'|'sprint'|'crouchIdle'|'crouchWalk'|'launch'|'launchRight'|'airborne'|'landing'|'landingMoving'|'walkStart'|'runStop'|'runStopR',CharacterClip>{
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
 return {idle:select('idle_stance',false),walk:select('walk_player',true),run:select('run_player',true),sprint:select('sprint_civi',true),crouchIdle:select('weapon_crouch',false),crouchWalk:select('guncrouchfwd',true),launch:{...select('jump_launch',true),forwardMotion:true},launchRight:{...select('jump_launch_r',true),forwardMotion:true},airborne:select('jump_glide',true),landing:{...select('fall_land',true),forwardMotion:true},landingMoving:{...select('jump_land',true),forwardMotion:true},walkStart:select('walk_start',true),runStop:select('run_stop',true),runStopR:select('run_stopr',true)};
}

/** animgrp.dat `man` walkcycle for ordinary street civilians: walk_civi,
 * run_civi, sprint_panic. Speeds 1.522/4.304/5.903 m/s match these clips'
 * root motion, so civilian feet stop sliding. Gang/old/fat variants remain
 * future work; this replaces the previous reuse of player clips for peds. */
export function civilianPedMovement(pack:AnimationPackage):Record<'idle'|'walk'|'run'|'sprint',CharacterClip>{
 const select=(name:string,moving:boolean):CharacterClip=>{
  const matches=pack.animations.filter(clip=>clip.name.toLowerCase()===name);
  if(matches.length!==1)throw new Error(`Civilian movement requires one ${name} clip.`);
  const clip=matches[0];
  if(!(clip.duration>0))throw new Error(`Civilian movement requires a nonempty ${name} clip.`);
  if(!moving)return {clip};
  const roots=clip.tracks.flatMap((track,index)=>track.boneId===0&&track.translations&&track.times.length?[index]:[]);
  if(roots.length!==1)throw new Error(`${clip.name} requires one translated root bone (ID 0).`);
  return {clip,track:roots[0]};
 };
 return {idle:select('idle_stance',false),walk:select('walk_civi',true),run:select('run_civi',true),sprint:select('sprint_panic',true)};
}
