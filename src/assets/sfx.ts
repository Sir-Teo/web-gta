import {requireAsset} from './binary';
export const SFX_BANK_HEADER_BYTES=4804;
export interface SfxBankLookup {packageIndex:number;offset:number;dataBytes:number}
export interface SfxSound {sampleRate:number;headroom:number;loopStartOffset:number;pcm16:Uint8Array}
export function readSfxBankLookups(bytes:Uint8Array):SfxBankLookup[]{
 requireAsset(bytes.length>0&&bytes.length%12===0&&bytes.length/12<=65535,'Invalid SFX bank lookup size.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),banks:SfxBankLookup[]=[];
 for(let offset=0;offset<bytes.length;offset+=12)banks.push({packageIndex:view.getUint8(offset),offset:view.getUint32(offset+4,true),dataBytes:view.getUint32(offset+8,true)});
 return banks;
}
/** Package records are 52 bytes; only the first 12 hold the base filename. */
export function readSfxPackageNames(bytes:Uint8Array):string[]{
 requireAsset(bytes.length>0&&bytes.length%52===0&&bytes.length/52<=256,'Invalid SFX package lookup size.');
 const names:string[]=[];
 for(let offset=0;offset<bytes.length;offset+=52){
  const field=bytes.subarray(offset,offset+12),end=field.indexOf(0);
  const name=new TextDecoder('ascii').decode(field.subarray(0,end<0?12:end));
  requireAsset(/^[A-Za-z0-9_-]+$/.test(name),'Invalid SFX package base filename.');names.push(name);
 }
 return names;
}
/** PC AEAudioStream contains 400 descriptor slots, followed by mono PCM16.
 * Lookup dataBytes excludes the 4804-byte header. Returned samples own their data. */
export function readSfxBank(bytes:Uint8Array,dataBytes:number):SfxSound[]{
 requireAsset(Number.isSafeInteger(dataBytes)&&dataBytes>=0&&dataBytes<=64*1024*1024,'Invalid SFX bank data size.');
 requireAsset(bytes.length===SFX_BANK_HEADER_BYTES+dataBytes,'Truncated or mismatched SFX bank.');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),count=view.getUint16(0,true);
 requireAsset(count<=400,'SFX bank exceeds 400 sounds.');
 const sounds:SfxSound[]=[];
 for(let i=0;i<count;i++){
  const entry=4+i*12,start=view.getUint32(entry,true),end=i+1<count?view.getUint32(entry+12,true):dataBytes;
  requireAsset(start<=end&&end<=dataBytes&&start%2===0&&end%2===0,'Invalid SFX sample boundaries.');
  const sampleRate=view.getUint16(entry+8,true);
  requireAsset(sampleRate>0,'Invalid SFX sample rate.');
  sounds.push({sampleRate,headroom:view.getInt16(entry+10,true),loopStartOffset:view.getUint32(entry+4,true),pcm16:bytes.slice(SFX_BANK_HEADER_BYTES+start,SFX_BANK_HEADER_BYTES+end)});
 }
 return sounds;
}
/** Read only the selected bank from a user-selected package, not the entire SFX file. */
export async function readSfxBankFile(file:Blob,lookup:SfxBankLookup):Promise<SfxSound[]>{
 const {offset,dataBytes}=lookup;
 requireAsset(Number.isSafeInteger(offset)&&offset>=0&&Number.isSafeInteger(dataBytes)&&dataBytes>=0&&dataBytes<=64*1024*1024,'Invalid SFX bank range.');
 const end=offset+SFX_BANK_HEADER_BYTES+dataBytes;
 requireAsset(end<=file.size,'SFX bank range exceeds package.');
 return readSfxBank(new Uint8Array(await file.slice(offset,end).arrayBuffer()),dataBytes);
}
export function sfxPcmSamples(sound:SfxSound):Float32Array{
 requireAsset(sound.pcm16.length%2===0,'Invalid PCM16 byte count.');
 const view=new DataView(sound.pcm16.buffer,sound.pcm16.byteOffset,sound.pcm16.byteLength),samples=new Float32Array(sound.pcm16.length/2);
 for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;
 return samples;
}

export function resolveSfxBank(bankId:number,banks:readonly SfxBankLookup[],packages:readonly string[]){
 requireAsset(Number.isInteger(bankId)&&bankId>=0&&bankId<banks.length,'Unknown SFX bank ID.');
 const lookup=banks[bankId],packageName=packages[lookup.packageIndex];
 requireAsset(packageName!==undefined,'SFX bank references a missing package.');
 return {bankId,packageName,lookup};
}
