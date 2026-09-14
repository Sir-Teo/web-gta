import type {AnimationPackage} from './ifp';
import type {CharacterClip} from '../render/NativeCharacter';

/** Names from the native player association table; root identity is a bone ID, not a track position. */
export function normalPlayerMovement(pack:AnimationPackage):Record<'idle'|'walk'|'run'|'sprint'|'crouchIdle'|'crouchWalk'|'launch'|'launchRight'|'airborne'|'landing'|'landingMoving',CharacterClip>{
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
 return {idle:select('idle_stance',false),walk:select('walk_player',true),run:select('run_player',true),sprint:select('sprint_civi',true),crouchIdle:select('weapon_crouch',false),crouchWalk:select('guncrouchfwd',true),launch:select('jump_launch',true),launchRight:select('jump_launch_r',true),airborne:select('jump_glide',true),landing:select('fall_land',true),landingMoving:select('jump_land',true)};
}
