import {openStaticWorld} from './staticWorldArchive';
import {readIfp,resolveTrackBones,type NativeAnimation} from './ifp';
import {readImgEntry} from './img';

/** CTaskSimplePlayerOnFoot::PlayIdleAnimations' ANIM_GROUP_PLAYIDLES clips, in its table order: ANIM_ID_STRETCH,
 * ANIM_ID_TIME, ANIM_ID_SHLDR and ANIM_ID_STRLEG. */
export const PLAYER_IDLE_CLIPS=['stretch','time','shldr','strleg'] as const;
export type PlayerIdleClip=typeof PLAYER_IDLE_CLIPS[number];

/** playidles.ifp from gta3.img, with name-only tracks resolved through ped.ifp's skeleton. */
export async function loadPlayerIdles(base:string){
 const source=await openStaticWorld(base);
 const entry=source.entries.find(e=>e.name.toLowerCase()==='playidles.ifp');if(!entry)throw new Error('Missing playidles.ifp.');
 const pedResource=source.manifest.resources.find(r=>r.path==='animations/ped.ifp');if(!pedResource)throw new Error('Missing ped animations.');
 const pack=readIfp(await readImgEntry(source.file,entry)),ped=readIfp(new Uint8Array(await (await source.resource(pedResource)).arrayBuffer()));
 const out={} as Record<PlayerIdleClip,NativeAnimation>;
 for(const name of PLAYER_IDLE_CLIPS){
  const clip=pack.animations.find(a=>a.name.toLowerCase()===name);if(!clip)throw new Error(`playidles.ifp lacks ${name}.`);
  out[name]=resolveTrackBones(clip,ped);
 }
 return out;
}

/** The idle timer PlayIdleAnimations keeps from CPad's last-touched time (all times in milliseconds). */
export class PlayerIdles {
 /** gLastTouchTimeDelta and gLastRandomNumberForIdleAnimationID. */
 lastDelta=0;lastIndex=-1;
 /** One frame. `untouched` is CPad::GetTouchedTimeDelta; `playing` whether a playidles clip is on the ped. Returns
  * 'stop' to blend the idles out, a clip to start, or undefined. `random` gives [0, 1). */
 step(untouched:number,playing:boolean,random:()=>number):'stop'|PlayerIdleClip|undefined{
  if(untouched<=10000){this.lastDelta=0;return playing?'stop':undefined;}
  if(untouched-this.lastDelta<=20000||playing)return undefined;
  // GetRandomNumberInRange(0, 4), redrawn while it repeats the last one.
  let index=Math.floor(random()*4);for(let i=0;i<16&&index===this.lastIndex;i++)index=Math.floor(random()*4);
  this.lastDelta=untouched;this.lastIndex=index;
  return PLAYER_IDLE_CLIPS[index];
 }
}
