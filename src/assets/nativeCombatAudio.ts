import {readSfxBank,type SfxSound} from './sfx';
export type CombatSound='fire'|'impact'|'reloadA'|'reloadB'|'explosion';
/** Native bank/sample IDs from CAEWeaponAudioEntity and SoundIDs.h. Mixing is browser-authored. */
export function combatSample(event:CombatSound,weapon:number):{bank:number;sample:number;rate:number;duration?:number}|undefined{
 if(event==='explosion')return {bank:52,sample:3,rate:1};
 let sample:number|undefined,rate=1,duration:number|undefined;
 if(event==='impact')sample=weapon===0?36:weapon===1?44:weapon===4?57:weapon===8?56:35;
 else if(event==='reloadA'||event==='reloadB'){
  const reload:Record<number,[number,number]>={22:[55,66],23:[55,66],24:[55,51],25:[72,71],26:[70,69],27:[72,71],28:[85,84],29:[85,84],30:[32,31],31:[32,31],32:[85,84],33:[32,32],34:[55,32]};sample=reload[weapon]?.[event==='reloadA'?0:1];
 }else{
  const shots:Record<number,number>={2:34,3:34,4:57,5:34,6:75,7:67,8:56,10:50,11:50,12:50,13:50,14:54,15:47,22:6,23:24,24:6,25:21,26:21,27:21,28:0,29:17,30:3,31:3,32:0,33:26,34:26,35:68,36:68,37:10,38:11,40:49,41:28,42:9,43:45,44:64,45:64,46:65};sample=shots[weapon];
  rate=weapon===22?1.41421:weapon===24?.94387:weapon===26?.7937:weapon===32?1.25992:weapon===33?.89:1;
  if([37,41,42].includes(weapon))duration=.13;
 }
 return sample===undefined?undefined:{bank:143,sample,rate,duration};
}
export async function readNativeCombatAudio(base:string){
 const response=await fetch(new URL('combat.json',base));if(!response.ok)throw new Error('Combat sound manifest unavailable.');const manifest=await response.json();
 if(manifest.version!==1||!Array.isArray(manifest.banks)||manifest.banks.length!==2)throw new Error('Invalid combat sound manifest.');
 const banks=new Map<number,SfxSound[]>();
 for(const entry of manifest.banks){if(![52,143].includes(entry.id)||entry.path!==`bank-${entry.id}.bin`||entry.bytes>2*1024*1024)throw new Error('Invalid combat sound bank.');const response=await fetch(new URL(entry.path,base));if(!response.ok)throw new Error('Combat sound bank unavailable.');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==entry.bytes)throw new Error('Combat bank length mismatch.');const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(hash!==entry.sha256)throw new Error('Combat bank checksum mismatch.');const sounds=readSfxBank(bytes,entry.dataBytes);if(sounds.length!==entry.sounds)throw new Error('Combat bank count mismatch.');banks.set(entry.id,sounds);}
 return banks;
}
