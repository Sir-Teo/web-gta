import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ScriptSpeech,scriptSpeechMp3,scriptSpeechSound} from '../src/audio/ScriptSpeech';
import {ScmMissionAudio,AUDIO_LOADED,AUDIO_LOADING} from '../src/engine/ScmMissionAudio';

/** A packaged bank: a u16 count, per sound a u32 offset and a u32 size, then the sounds. */
function bank(...sounds:number[][]){
 const head=2+sounds.length*8,bytes=new Uint8Array(head+sounds.reduce((n,s)=>n+s.length,0)),view=new DataView(bytes.buffer);
 view.setUint16(0,sounds.length,true);let at=head;
 sounds.forEach((s,i)=>{view.setUint32(2+i*8,at,true);view.setUint32(6+i*8,s.length,true);bytes.set(s,at);at+=s.length;});
 return bytes;
}
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test.each(['server','network','json'])('speech retries a %s manifest failure and coalesces concurrent lines',async failure=>{
 const bytes=bank([1],[2]),manifest={version:1,firstBank:147,banks:[{id:147,path:'bank-147.bin',sounds:2,bytes:bytes.length,sha256:sha(bytes)}]};
 let manifests=0,banks=0,decodes=0;
 const fetcher=(async(url:URL)=>{
  if(String(url).endsWith('script.json')){
   if(++manifests===1){if(failure==='network')throw new TypeError('Failed to fetch');return new Response(failure==='json'?'temporarily invalid JSON':null,{status:failure==='server'?503:200});}
   return new Response(JSON.stringify(manifest));
  }
  banks++;return new Response(bytes.slice());
 }) as typeof fetch;
 const speech=new ScriptSpeech('https://game.test/audio/',async()=>{decodes++;return{duration:1.25}as AudioBuffer;},fetcher);
 expect(await Promise.all([speech.load(2000),speech.load(2001),speech.load(2000)])).toEqual([false,false,false]);expect(manifests).toBe(1);expect(banks).toBe(0);
 expect(await Promise.all([speech.load(2000),speech.load(2001),speech.load(2000)])).toEqual([true,true,true]);expect(manifests).toBe(2);expect(banks).toBe(1);expect(decodes).toBe(2);expect(speech.line(2000)?.duration).toBe(1.25);
});
test('a failed speech decode retries from the retained verified bank',async()=>{
 const bytes=bank([1]),manifest={version:1,firstBank:147,banks:[{id:147,path:'bank-147.bin',sounds:1,bytes:bytes.length,sha256:sha(bytes)}]};let banks=0,decodes=0;
 const speech=new ScriptSpeech('https://game.test/audio/',async()=>{if(++decodes===1)throw new Error('Decoder temporarily unavailable');return{duration:2}as AudioBuffer;},(async(url:URL)=>String(url).endsWith('script.json')?new Response(JSON.stringify(manifest)):(banks++,new Response(bytes.slice())))as typeof fetch);
 expect(await speech.load(2000)).toBe(false);expect(await speech.load(2000)).toBe(true);expect(banks).toBe(1);expect(decodes).toBe(2);
});
test('an absent optional speech manifest stays cached without repeated downloads',async()=>{
 let fetches=0;const speech=new ScriptSpeech('https://game.test/audio/',async()=>{throw new Error('Unexpected decode');},(async()=>{fetches++;return new Response(null,{status:404});})as typeof fetch);
 expect(await speech.load(2000)).toBe(false);expect(await speech.load(2001)).toBe(false);expect(await speech.load(2000)).toBe(false);expect(fetches).toBe(1);
});

describe('mission dialogue from the SCRIPT pack',()=>{
 test('a sample names its bank and sound as GetBankAndSoundFromScriptSlotAudioEvent does',()=>{
  expect(scriptSpeechSound(2000)).toEqual({bank:147,sound:0});// AE_SCRIPT_SLOT_ALDEAMALVADA, SND_BANK_SCRIPT_SCANNER_AREAS
  expect(scriptSpeechSound(20000)).toEqual({bank:237,sound:0});// AE_SCRIPT_SLOT_INT1_AA, SND_BANK_SCRIPT_INT1
  expect(scriptSpeechSound(20004)).toEqual({bank:237,sound:4});
  expect(scriptSpeechSound(1800)).toBeUndefined();// a whole bank, not one line
  expect(scriptSpeechSound(0xffff)).toBeUndefined();// AE_SCRIPT_SLOT_USE_CUSTOM
 });

 test('a packaged bank gives each sound its own bytes',()=>{
  const bytes=bank([1,2,3],[4,5]);
  expect([...scriptSpeechMp3(bytes,0)!]).toEqual([1,2,3]);
  expect([...scriptSpeechMp3(bytes,1)!]).toEqual([4,5]);
  expect(scriptSpeechMp3(bytes,2)).toBeUndefined();
  expect(()=>scriptSpeechMp3(bytes.subarray(0,12),1)).toThrow();
 });

 test('the published pack lists INTRO1 as bank 237 with its lines in order',()=>{
  const manifest=JSON.parse(readFileSync('public/play/audio/script/script.json','utf8'));
  expect(manifest.firstBank).toBe(147);
  expect(manifest.banks).toHaveLength(218);
  const intro=manifest.banks.find((b:{id:number})=>b.id===237),bytes=new Uint8Array(readFileSync(`public/play/audio/script/${intro.path}`));
  expect(bytes.length).toBe(intro.bytes);expect(sha(bytes)).toBe(intro.sha256);
  const first=scriptSpeechMp3(bytes,0)!;
  expect(first[0]).toBe(0xff);expect(first[1]&0xe0).toBe(0xe0);// an MP3 frame sync
 });

 test('a line loads once its bank is in and decoded, and a bad bank loads as nothing',async()=>{
  const good=bank([9,9],[7]),files:Record<string,Uint8Array>={'bank-147.bin':good,'bank-148.bin':new Uint8Array([1,0])};
  const manifest={version:1,firstBank:147,banks:[{id:147,path:'bank-147.bin',sounds:2,bytes:good.length,sha256:sha(good)},{id:148,path:'bank-148.bin',sounds:1,bytes:2,sha256:'0'.repeat(64)}]};
  const fetched:string[]=[];
  const fetcher=(async(url:URL)=>{const name=String(url).split('/').pop()!;fetched.push(name);
   return name==='script.json'?new Response(JSON.stringify(manifest)):files[name]?new Response(files[name].slice()):new Response(null,{status:404});}) as typeof fetch;
  const decoded:number[][]=[];
  const speech=new ScriptSpeech('https://game.test/play/audio/script/',async mp3=>{decoded.push([...new Uint8Array(mp3)]);return {duration:1.5} as AudioBuffer;},fetcher);
  expect(await speech.load(2001)).toBe(true);
  expect(decoded).toEqual([[7]]);expect(speech.line(2001)?.duration).toBe(1.5);
  expect(await speech.load(2000)).toBe(true);
  expect(fetched.filter(n=>n==='bank-147.bin')).toHaveLength(1);// the bank is fetched once for its lines
  expect(await speech.load(2200)).toBe(false);// checksum mismatch
  expect(await speech.load(2400)).toBe(false);// not in the manifest
  expect(await speech.load(1900)).toBe(false);
  expect(speech.line(2200)).toBeUndefined();
 });

 test('a streamed slot stays loading until its line is in, and a cleared slot ignores a late one',()=>{
  const audio=new ScmMissionAudio();
  audio.preload(1,20000);expect(audio.stream(1,20000)).toBe(true);
  audio.service(33);audio.service(33);
  expect(audio.slots[0].loadingStatus).toBe(AUDIO_LOADING);
  audio.streamed(1,20000);expect(audio.hasLoaded(1)).toBe(true);
  expect(audio.stream(1,20000)).toBe(false);// already in
  audio.preload(2,20001);audio.stream(2,20001);audio.clear(2);audio.streamed(2,20001);
  expect(audio.slots[1].loadingStatus).not.toBe(AUDIO_LOADED);
  audio.preload(3,20002);audio.stream(3,20002);audio.preload(3,20003);audio.streamed(3,20002);
  expect(audio.slots[2]).toMatchObject({audioEvent:20003,loadingStatus:AUDIO_LOADING});
  audio.service(33);expect(audio.slots[2].loadingStatus).toBe(AUDIO_LOADED);// not streamed: the next frame has it
 });

 test('a played line runs for its decoded length',()=>{
  const audio=new ScmMissionAudio();
  audio.preload(1,20000);audio.service(0);audio.play(1);
  audio.settleLengths(()=>2500);
  audio.service(2400);expect(audio.hasFinished(1)).toBe(false);
  audio.service(200);expect(audio.hasFinished(1)).toBe(true);
 });
});
