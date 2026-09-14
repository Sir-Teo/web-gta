import {requireAsset} from './binary';
import {readSfxBankLookups,readSfxPackageNames,resolveSfxBank,readSfxBankFile,type SfxSound} from './sfx';
import type {FootstepCategory} from './surfaceAudio';
export interface NativeFootstepFiles {bankLookup:File;packageLookup:File;feet:File}
export const FOOTSTEP_BANKS={concrete:0,grass:1,gravel:2,metal:3,sand:4,tile:5,wood:6} as const;
export async function readNativeFootsteps(files:NativeFootstepFiles):Promise<SfxSound[][]>{
 requireAsset(files.bankLookup.size<=1024*1024&&files.packageLookup.size<=13312&&files.feet.size<=16*1024*1024,'Footstep files exceed size limits.');
 const banks=readSfxBankLookups(new Uint8Array(await files.bankLookup.arrayBuffer())),packages=readSfxPackageNames(new Uint8Array(await files.packageLookup.arrayBuffer()));
 const result:SfxSound[][]=[];
 for(let id=0;id<7;id++){
  const selected=resolveSfxBank(id,banks,packages);
  requireAsset(selected.packageName.toLowerCase()===files.feet.name.toLowerCase(),'Footstep bank references a different package.');
  const sounds=await readSfxBankFile(files.feet,selected.lookup);
  requireAsset(sounds.length>=(id===0?6:id===4?4:5),'Footstep bank is missing required sounds.');
  requireAsset(sounds.every(sound=>sound.pcm16.length>0&&sound.sampleRate>=3000),'Footstep sound cannot be played by Web Audio.');
  result.push(sounds);
 }
 return result;
}
/** HandleFootstepEvent uses generic samples 1–5 and surface samples starting at 0. */
export function nativeFootstepChoice(category:FootstepCategory,random:number){
 requireAsset(Number.isFinite(random)&&random>=0&&random<1,'Invalid footstep random value.');
 const bank=category==='water'?0:FOOTSTEP_BANKS[category];
 return {bank,sound:(bank===0?1:0)+Math.floor(random*(bank===4?4:5))};
}
