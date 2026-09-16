import {requireAsset} from './binary';
import type {AnimationPackage,NativeAnimation} from './ifp';
import type {CharacterClip} from '../render/NativeCharacter';

/** One animgrp.dat walkcycle row: native walk/run/sprint/idle clip names. */
export interface PedWalkcycle {group:string;walk:string;run:string;sprint:string;idle:string}
/** Parse animgrp.dat walkcycle groups (all native walkcycles live in ped.ifp).
 * Only `ped` file groups are kept; other association types stay unparsed. */
export function readPedAnimGroups(text:string):Map<string,PedWalkcycle>{
 requireAsset(text.length<=256*1024&&!text.includes('\0'),'Invalid animation group resource.');
 const groups=new Map<string,PedWalkcycle>();
 let pending:{name:string;file:string;expected:number;anims:string[]}|undefined,skipping=false;
 for(const [line,raw] of text.split(/\r?\n/).entries()){
  const body=raw.split('#')[0].trim();
  if(!body)continue;
  if(skipping){
   if(body.toLowerCase()==='end')skipping=false;
   continue;
  }
  if(!pending){
   const fields=body.split(',').map(f=>f.trim());
   requireAsset(fields.length===4&&fields.every(f=>f.length>0),`Animation group line ${line+1}: expected name, file, type and count.`);
   const [name,file,kind,count]=fields,expected=Number(count);
   requireAsset(Number.isInteger(expected)&&expected>=4&&expected<=64,`Animation group line ${line+1}: invalid animation count.`);
   if(kind.toLowerCase()!=='walkcycle'||file.toLowerCase()!=='ped'){skipping=true;continue;}
   pending={name:name.toLowerCase(),file:file.toLowerCase(),expected,anims:[]};
   continue;
  }
  if(body.toLowerCase()==='end'){
   requireAsset(pending.anims.length===pending.expected,`Animation group ${pending.name}: expected ${pending.expected} animations, found ${pending.anims.length}.`);
   const [walk,run,sprint,idle]=pending.anims;
   requireAsset(!groups.has(pending.name),`Duplicate animation group: ${pending.name}.`);
   groups.set(pending.name,{group:pending.name,walk,run,sprint,idle});
   pending=undefined;continue;
  }
  const token=body.split(/\s+/)[0].toLowerCase();
  requireAsset(token.length>0,`Animation group ${pending.name} line ${line+1}: expected a clip name.`);
  pending.anims.push(token);
 }
 requireAsset(!pending,'Unterminated animation group block.');
 requireAsset(groups.has('man'),'Animation groups lack the `man` walkcycle.');
 return groups;
}
/** Planar root-motion speed of a translated root track (native IFP ground plane is XY). */
export function clipRootSpeed(clip:NativeAnimation):{track:number;speed:number}{
 const roots=clip.tracks.flatMap((track,index)=>track.boneId===0&&track.translations&&track.times.length?[index]:[]);
 requireAsset(roots.length===1,`${clip.name} requires one translated root bone (ID 0).`);
 requireAsset(clip.duration>0,`${clip.name} requires a positive duration.`);
 const translations=clip.tracks[roots[0]].translations!,last=translations.length;
 const speed=Math.hypot(translations[last-3]-translations[0],translations[last-2]-translations[1])/clip.duration;
 requireAsset(Number.isFinite(speed)&&speed>0,`${clip.name} has no root motion.`);
 return {track:roots[0],speed};
}
export interface PedLocomotion extends Record<'idle'|'walk'|'run'|'sprint',CharacterClip>{speeds:{walk:number;run:number;sprint:number}}
/** Resolve a native walkcycle group to locomotion clips with root-motion speeds,
 * so variant feet stop sliding instead of reusing `man` timings. */
export function pedLocomotion(pack:AnimationPackage,cycle:PedWalkcycle):PedLocomotion{
 const select=(name:string,moving:boolean):CharacterClip=>{
  const matches=pack.animations.filter(clip=>clip.name.toLowerCase()===name);
  if(matches.length!==1)throw new Error(`Walkcycle ${cycle.group} requires one ${name} clip.`);
  const clip=matches[0];
  if(!(clip.duration>0))throw new Error(`Walkcycle ${cycle.group} requires a nonempty ${name} clip.`);
  if(!moving)return {clip};
  return {clip,track:clipRootSpeed(clip).track};
 };
 const walk=select(cycle.walk,true),run=select(cycle.run,true),sprint=select(cycle.sprint,true);
 return {idle:select(cycle.idle,false),walk,run,sprint,speeds:{walk:clipRootSpeed(walk.clip).speed,run:clipRootSpeed(run.clip).speed,sprint:clipRootSpeed(sprint.clip).speed}};
}
