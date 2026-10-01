/* The quiet sounds the peds hear and GET_SOUND_LEVEL_AT_COORDS reads, pinned gta-reversed ead3051 (all reversed):
 * CEvent::GetSoundLevel (0x4B2850), CEvent::CalcSoundLevelIncrement (0x4AC050), CEventGlobalGroup::GetSoundLevel
 * (0x4AB900) and the player's footstep CEventSoundQuiet in CPed's footsteps (Ped.cpp:2407). The global group keeps a
 * frame's events until CWorld::Process flushes it, so a script reads the noise made in the frame before. */
export interface SoundQuietEvent<E=unknown> {source:E;level:number;position:{x:number;y:number;z:number}}
/** CEvent::GetSoundLevel for a CEventSoundQuiet heard at a point. The reference takes the smaller of the distance and
 * 1 (std::min), which leaves the level flat beyond a unit away; that is followed as reversed. A point on the source
 * itself is taken a millimetre off rather than giving an infinite level. */
export function eventSoundLevel(event:SoundQuietEvent,at:{x:number;y:number;z:number}){
 if(event.level===0)return 0;
 const distance=Math.max(1e-3,Math.min(Math.hypot(at.x-event.position.x,at.y-event.position.y,at.z-event.position.z),1));
 return event.level-Math.log10(distance*distance)*10-distance/100;
}
/** CEvent::CalcSoundLevelIncrement: what adding a sound of level2 to level1 raises it by, in decibels. */
export function calcSoundLevelIncrement(level1:number,level2:number){
 if(level2===0)return 0;
 if(level1===0)return level2;
 return Math.log10((10**(level1*.1)+10**(level2*.1))/(10**(level1*.1)))*10;
}
/** CEventGlobalGroup::GetSoundLevel: the frame's events from the source (any source when none is named), summed as
 * sound levels add. */
export function globalSoundLevel<E>(events:readonly SoundQuietEvent<E>[],source:E|undefined,at:{x:number;y:number;z:number}){
 let level=0;
 for(const event of events){
  if(source!==undefined&&event.source!==source)continue;
  const heard=eventSoundLevel(event,at);
  if(heard>0)level+=calcSoundLevelIncrement(level,heard);
 }
 return level;
}
/** The player's footstep CEventSoundQuiet for his move state and move blend ratio (Ped.cpp:2407-2440): a sprint 55
 * (65 in a balaclava); a jog or run 45 (55) at a ratio of 2 or more, else (ratio − 1) × 15 + 30 past 1.5 (× 20 past
 * 1.1 in a balaclava); walking and standing nothing. */
export function playerFootstepSoundLevel(moveState:'still'|'walk'|'run'|'sprint',moveBlendRatio:number,balaclava=false){
 if(moveState==='sprint')return balaclava?65:55;
 if(moveState!=='run')return 0;
 if(moveBlendRatio>=2)return balaclava?55:45;
 if(balaclava&&moveBlendRatio>1.1)return Math.max(0,(moveBlendRatio-1)*20+30);
 if(moveBlendRatio>1.5)return Math.max(0,(moveBlendRatio-1)*15+30);
 return 0;
}
