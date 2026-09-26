import {readSfxBank,sfxPcmSamples} from '../../assets/sfx';
import type {NativeBankSlots,NativeBankSound} from './NativeSoundManager';
/** eSoundBankSlot values used by the ported entities. */
export const SLOT={frontendGame:0,frontendMenu:1,collisions:2,bulletHits:3,explosions:4,weaponGen:5,weather:6,dummyFirst:7,dummyEnd:17,hornAndSiren:17,copHeli:18,vehicleGen:19,playerEngine:40} as const;
/** eSoundBank values used by the ported entities. */
export const BANK={apacheD:13,bulletHits:27,collisions:39,explosions:52,frontendGame:59,horn:74,icevanP:79,rain:105,vehicleGen:138,weapons:143} as const;
export interface NativeBankManifest {version:1;packageSha256:string;banks:{id:number;path:string;dataBytes:number;bytes:number;sounds:number;sha256:string}[]}
type Fetcher=(entry:NativeBankManifest['banks'][number])=>Promise<Uint8Array>;
/** How long a bank that failed to download waits before a request may try it again; after the last, it stays failed. */
const RETRY_WAITS_MS=[5000,20000,60000];
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
/** CAEMP3BankLoader bank slots over the packaged GENRL banks (`public/play/audio/banks.json`).
 * A slot keeps its previous bank until the requested bank has been read, as the streaming requests do. */
export class NativeBankLoader implements NativeBankSlots {
 private slots=Array.from({length:45},()=>({bank:-1,sounds:undefined as NativeBankSound[]|undefined}));
 private requests=new Map<number,number>();
 private decoded=new Map<number,Promise<NativeBankSound[]>>();
 readonly failures=new Map<number,string>();
 /** Failed downloads so far, per bank. */
 private attempts=new Map<number,number>();
 constructor(readonly manifest:NativeBankManifest,private fetchBank:Fetcher){
  if(manifest.version!==1||!Array.isArray(manifest.banks))throw new Error('Invalid native audio bank manifest.');
 }
 static async open(base:string){
  const response=await fetch(new URL('banks.json',base));if(!response.ok)throw new Error('Native audio bank manifest unavailable.');
  return new NativeBankLoader(await response.json(),async entry=>{
   if(entry.path!==`bank-${entry.id}.bin`||entry.bytes>8*1024*1024)throw new Error('Invalid native sound bank entry.');
   // Banks load at initialization as in the original, behind the terrain and scene downloads play waits on.
   const r=await fetch(new URL(entry.path,base),{priority:'low'});if(!r.ok)throw new Error(`Sound bank ${entry.id} unavailable.`);
   const bytes=new Uint8Array(await r.arrayBuffer());
   if(bytes.length!==entry.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==entry.sha256)throw new Error(`Sound bank ${entry.id} checksum mismatch.`);
   return bytes;
  });
 }
 private decode(bank:number){
  let pending=this.decoded.get(bank);
  if(!pending){
   const entry=this.manifest.banks.find(b=>b.id===bank);
   pending=entry?this.fetchBank(entry).then(bytes=>readSfxBank(bytes,entry.dataBytes).map(s=>({samples:sfxPcmSamples(s),sampleRate:s.sampleRate,headroom:s.headroom,loopStart:s.loopStartOffset===0xffffffff?-1:s.loopStartOffset}))):Promise.reject(new Error(`Sound bank ${bank} is not packaged.`));
   this.decoded.set(bank,pending);
   const attempt=pending;
   attempt.then(()=>{this.failures.delete(bank);this.attempts.delete(bank);},e=>{
    this.failures.set(bank,String(e));if(!entry)return;
    // A download that failed is tried again on a later request, after a growing wait; a bank that keeps failing stays failed.
    const tries=(this.attempts.get(bank)??0)+1;this.attempts.set(bank,tries);
    const wait=RETRY_WAITS_MS[tries-1];if(wait===undefined)return;
    setTimeout(()=>{if(this.decoded.get(bank)===attempt)this.decoded.delete(bank);},wait);
   });
  }
  return pending;
 }
 /** LoadSoundBank (0x4E0670). */
 loadSoundBank(bank:number,slot:number){
  if(bank<0||slot<0||slot>=this.slots.length||this.isSoundBankLoaded(bank,slot)||this.requests.get(slot)===bank)return;
  this.requests.set(slot,bank);
  void this.decode(bank).then(sounds=>{if(this.requests.get(slot)!==bank)return;this.requests.delete(slot);this.slots[slot]={bank,sounds};}).catch(()=>{if(this.requests.get(slot)===bank)this.requests.delete(slot);});
 }
 isSoundBankLoaded(bank:number,slot:number){return this.slots[slot]?.bank===bank&&bank>=0;}
 sound(slot:number,sound:number){return this.slots[slot]?.sounds?.[sound];}
 loadedBank(slot:number){return this.slots[slot]?.bank??-1;}
 snapshot(){return {slots:this.slots.map((s,i)=>s.bank>=0?[i,s.bank]:undefined).filter(Boolean),pending:this.requests.size,failures:[...this.failures.keys()]};}
}
