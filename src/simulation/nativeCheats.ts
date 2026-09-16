/** CKeyGen::GetKey: the CRC-32 table update without a final complement. */
const TABLE=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function nativeKey(text:string){let h=0xffffffff;for(let i=0;i<text.length;i++)h=(TABLE[(h^text.charCodeAt(i))&0xff]^(h>>>8))>>>0;return h;}
/** m_aCheatHashKeys entries for the cheats the browser applies. */
export const CHEAT_HASHES={weaponSet1:0xde4b237d,weaponSet2:0xb22a28d1,weaponSet3:0x5a783fae,moneyArmourHealth:0xeeccea2b,wantedLevelUp:0x42af1e28,wantedLevelDown:0x555fc201} as const;
export type CheatName=keyof typeof CHEAT_HASHES;
/** CCheat::AddToCheatString: the latest keys, newest first, hashed over every length from 6 to 29 characters. */
export class NativeCheatString {
 private text='';
 add(key:string):CheatName|undefined{
  this.text=(key+this.text).slice(0,29);
  if(this.text.length<6)return;
  for(let size=6;size<=this.text.length;size++){
   const hash=nativeKey(this.text.slice(0,size)),name=(Object.keys(CHEAT_HASHES) as CheatName[]).find(n=>CHEAT_HASHES[n]===hash);
   if(name){this.text='';return name;}
  }
 }
}
