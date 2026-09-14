import {requireAsset} from './binary';
import {nativeSurfaceId,nativeSurfaceName} from './surfaceIds';
export const SURFACE_AUDIO_FLAGS=['concrete','grass','sand','gravel','wood','water','metal','longGrass','tile'] as const;
export type SurfaceAudioFlags=Record<typeof SURFACE_AUDIO_FLAGS[number],boolean>;
export type FootstepCategory='concrete'|'grass'|'sand'|'gravel'|'wood'|'water'|'metal'|'tile';
/** LoadSurfaceAudioInfos: signed integer flags narrow to bool; later rows win. */
export function readSurfaceAudio(text:string){
 requireAsset(text.length<=1024*1024,'Surface audio exceeds the 1 MiB limit.');
 const byId=new Map<number,SurfaceAudioFlags>(),warnings:string[]=[];
 for(const [index,raw] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
  const line=raw.trim();if(!line||line.startsWith('#'))continue;
  const tokens=line.split(/[\s,]+/),label=`Surface audio line ${index+1}`;
  requireAsset(tokens.length===10&&tokens[0].length<=63&&!line.includes('\0'),`${label}: expected a surface name and nine flags.`);
  const flags={} as SurfaceAudioFlags;
  SURFACE_AUDIO_FLAGS.forEach((flag,i)=>{
   const token=tokens[i+1],n=Number(token);
   requireAsset(/^[+-]?\d+$/.test(token)&&n>=-2147483648&&n<=2147483647,`${label}: invalid ${flag} integer.`);
   flags[flag]=n!==0;
  });
  const id=nativeSurfaceId(tokens[0]);
  if(nativeSurfaceName(id)!==tokens[0])warnings.push(`${label}: unknown name ${tokens[0]} maps to DEFAULT (0).`);
  if(byId.has(id))warnings.push(`${label}: replaces surface ${id}.`);
  byId.set(id,flags);
 }
 return {byId,warnings};
}
/** HandleFootstepEvent category precedence, before bank loading and sound choice. */
export function nativeFootstepCategory(flags?:SurfaceAudioFlags):FootstepCategory{
 if(flags?.water)return 'water';
 if(flags?.concrete)return 'concrete';
 if(flags?.grass||flags?.longGrass)return 'grass';
 for(const category of ['sand','gravel','wood','tile','metal'] as const)if(flags?.[category])return category;
 return 'concrete';
}
/** Only concrete/grass recordings are currently shipped. Preserve other categories
 * in the parsed table; use the generic recording until their banks are supported. */
export function availableFootstepSurface(flags?:SurfaceAudioFlags):'concrete'|'grass'{return nativeFootstepCategory(flags)==='grass'?'grass':'concrete';}
