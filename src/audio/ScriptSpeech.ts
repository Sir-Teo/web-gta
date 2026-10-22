/* Mission dialogue: the SCRIPT sound pack's banks, packaged from the iOS port's SCRIPT.osw by
 * scripts/content/package-script-speech.mjs into public/play/audio/script/. A bank file is a u16 sound count, then per
 * sound a u32 offset from the file's start and a u32 size, then the MP3s. */
/** AE_SCRIPT_SLOT_FIRST, the first sample a mission-audio slot plays one sound of (eAudioEvents.h). */
export const SCRIPT_SLOT_FIRST=2000;
/** SND_BANK_SCRIPT_FIRST (eSoundBank.h), and the sounds each script bank's samples are numbered in. */
export const SCRIPT_BANK_FIRST=147,SOUNDS_PER_BANK=200;
/** CAEAudioUtility::GetBankAndSoundFromScriptSlotAudioEvent (0x4D9CC0) for a sample that names one sound. The
 * samples below 2000 name a whole bank (the casino games' and the like), which no slot plays as one line. */
export function scriptSpeechSound(sample:number){
 if(!Number.isInteger(sample)||sample<SCRIPT_SLOT_FIRST||sample===0xffff)return undefined;
 const n=sample-SCRIPT_SLOT_FIRST;
 return {bank:SCRIPT_BANK_FIRST+Math.floor(n/SOUNDS_PER_BANK),sound:n%SOUNDS_PER_BANK};
}
/** One sound's MP3 out of a packaged bank, or nothing for a sound the bank does not have. */
export function scriptSpeechMp3(bank:Uint8Array,sound:number){
 const view=new DataView(bank.buffer,bank.byteOffset,bank.byteLength);
 if(bank.length<2)throw new Error('Truncated speech bank.');
 const count=view.getUint16(0,true);
 if(2+count*8>bank.length)throw new Error('Truncated speech bank.');
 if(sound<0||sound>=count)return undefined;
 const offset=view.getUint32(2+sound*8,true),size=view.getUint32(6+sound*8,true);
 if(offset<2+count*8||offset+size>bank.length)throw new Error('Speech bank entry out of range.');
 return bank.subarray(offset,offset+size);
}
export interface ScriptSpeechManifest {version:1;firstBank:number;banks:{id:number;path:string;sounds:number;bytes:number;sha256:string}[]}
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
/** How many decoded lines are kept: a mission's conversation is a few dozen, each a second or few of mono. */
const LINES_KEPT=96,BANKS_KEPT=4;
/** Streams the banks a mission asks for and decodes its lines. A line that cannot be had (no manifest, a failed
 * download, a sound the bank lacks) loads as nothing, and the mission runs on sized from its subtitle. */
export class ScriptSpeech {
 private manifest?:Promise<ScriptSpeechManifest|undefined>;
 private banks=new Map<number,Promise<Uint8Array|undefined>>();
 private lines=new Map<number,Promise<AudioBuffer|undefined>>();
 private decoded=new Map<number,AudioBuffer>();
 constructor(private base:string,private decode:(mp3:ArrayBuffer)=>Promise<AudioBuffer>,private fetcher:typeof fetch=(...a)=>fetch(...a)){}
 private readManifest(){
  if(!this.manifest){
   const pending=this.fetcher(new URL('script.json',this.base)).then(r=>{
    if(r.status===404)return undefined;
    if(!r.ok)throw new Error('Speech manifest unavailable.');
    return r.json();
   }).then((m:ScriptSpeechManifest|undefined)=>m&&m.version===1&&m.firstBank===SCRIPT_BANK_FIRST&&Array.isArray(m.banks)?m:undefined);
   this.manifest=pending;
   // A transient failure must also reject the dependent bank/line requests, so their caches evict it.
   void pending.catch(()=>{if(this.manifest===pending)this.manifest=undefined;});
  }
  return this.manifest;
 }
 private bank(id:number){
  let pending=this.banks.get(id);
  if(!pending){
   pending=this.readManifest().then(async manifest=>{
    const entry=manifest?.banks.find(b=>b.id===id);
    if(!entry||entry.path!==`bank-${id}.bin`)return undefined;
    const r=await this.fetcher(new URL(entry.path,this.base));if(!r.ok)throw new Error(`Speech bank ${id} unavailable.`);
    const bytes=new Uint8Array(await r.arrayBuffer());
    if(bytes.length!==entry.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==entry.sha256)throw new Error(`Speech bank ${id} checksum mismatch.`);
    return bytes;
   });
   // A failed bank may be asked for again by the next mission; the script's own retry is the next LOAD.
   pending.catch(()=>{if(this.banks.get(id)===pending)this.banks.delete(id);});
   this.banks.set(id,pending);
   for(const key of this.banks.keys()){if(this.banks.size<=BANKS_KEPT)break;if(key!==id)this.banks.delete(key);}
  }
  return pending;
 }
 /** Loads a sample's line, resolving once it has decoded (or is known not to be had). Never rejects. */
 load(sample:number):Promise<boolean>{
  const where=scriptSpeechSound(sample);if(!where)return Promise.resolve(false);
  let pending=this.lines.get(sample);
  if(!pending){
   pending=this.bank(where.bank).then(bytes=>{
    const mp3=bytes&&scriptSpeechMp3(bytes,where.sound);
    return mp3?this.decode(mp3.slice().buffer):undefined;
   }).then(buffer=>{if(buffer&&this.lines.get(sample)===pending)this.decoded.set(sample,buffer);return buffer;},()=>{if(this.lines.get(sample)===pending)this.lines.delete(sample);return undefined;});
   this.lines.set(sample,pending);
   for(const key of this.lines.keys()){if(this.lines.size<=LINES_KEPT)break;if(key!==sample){this.lines.delete(key);this.decoded.delete(key);}}
  }
  return pending.then(buffer=>!!buffer);
 }
 /** The decoded line, once load has resolved. */
 line(sample:number){return this.decoded.get(sample);}
}
