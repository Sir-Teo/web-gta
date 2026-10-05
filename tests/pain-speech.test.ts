import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {PAIN_BANKS,PAIN_SPEECH_LOOKUP,PAIN_VOICE_CARL,PAIN_VOICE_FEMALE,PAIN_VOICE_MALE,painSound,painVoice} from '../src/audio/native/painSpeech';
import {NativeBankLoader} from '../src/audio/native/NativeBankLoader';
import {NativeAudioEngine} from '../src/audio/native/NativeAudioEngine';
import {scriptSpeechMp3} from '../src/audio/ScriptSpeech';

describe('pain cries from the PAIN_A pack',()=>{
 test('the voice is CJ’s for the player, female for CIVFEMALE and PROSTITUTE, else male',()=>{
  expect(painVoice(true,'CIVFEMALE')).toBe(PAIN_VOICE_CARL);
  expect(painVoice(false,'CIVFEMALE')).toBe(PAIN_VOICE_FEMALE);expect(painVoice(false,'PROSTITUTE')).toBe(PAIN_VOICE_FEMALE);
  expect(painVoice(false,'GANG2')).toBe(PAIN_VOICE_MALE);expect(painVoice(false,undefined)).toBe(PAIN_VOICE_MALE);
 });
 test('a context picks within gPainSpeechLookup’s range for the voice',()=>{
  // PAIN_HIGH: a ped's generic row (18), CJ's generic high (7); PAIN_ON_FIRE: 19 and 6.
  expect(painSound('high',PAIN_VOICE_MALE,()=>0)).toEqual({bank:145,sound:46});
  expect(painSound('high',PAIN_VOICE_MALE,()=>.999)).toEqual({bank:145,sound:87});
  expect(painSound('high',PAIN_VOICE_FEMALE,()=>0)).toEqual({bank:146,sound:36});
  expect(painSound('onFire',PAIN_VOICE_FEMALE,()=>.999)).toEqual({bank:146,sound:83});
  expect(painSound('high',PAIN_VOICE_CARL,()=>0)).toEqual({bank:144,sound:87});
  expect(painSound('low',PAIN_VOICE_CARL,()=>.999)).toEqual({bank:144,sound:121});
 });
 test('the published banks hold the table’s sounds, each an MP3',()=>{
  const manifest=JSON.parse(readFileSync('public/play/audio/pain/pain.json','utf8'));
  expect(manifest.banks.map((b:{id:number})=>b.id)).toEqual([...PAIN_BANKS]);
  const lastOf=(voice:number)=>Math.max(...PAIN_SPEECH_LOOKUP.map(row=>row[voice]?.[1]??-1));
  for(const [voice,entry] of manifest.banks.entries()){
   const bytes=new Uint8Array(readFileSync(`public/play/audio/pain/${entry.path}`));
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
   expect(entry.sounds).toBe(lastOf(voice)+1);
   const mp3=scriptSpeechMp3(bytes,0)!;expect(mp3[0]).toBe(0xff);
  }
 });
 test('a ped’s cry waits for its bank in a speech slot, then plays from it',async()=>{
  const loader=new NativeBankLoader({version:1,packageSha256:'',banks:[]},async()=>new Uint8Array());
  const asked:number[]=[];
  loader.otherBanks=async id=>{asked.push(id);return Array.from({length:131},()=>({samples:new Float32Array(100),sampleRate:22050,headroom:0,loopStart:-1}));};
  const engine=new NativeAudioEngine(loader,undefined,()=>0);
  engine.pedSpeech({},{x:0,y:0,z:0},'pain',0,{voice:PAIN_VOICE_MALE,context:'high'});
  expect(engine.painCries).toBe(0);
  await new Promise(r=>setTimeout(r,0));
  expect(asked.filter(id=>id>=144&&id<=146)).toEqual([145]);expect(loader.isSoundBankLoaded(145,21)).toBe(true);
  engine.pedSpeech({},{x:0,y:0,z:0},'pain',0,{voice:PAIN_VOICE_MALE,context:'high'});
  expect(engine.painCries).toBe(1);
 });
});

import {playerPainContext} from '../src/simulation/Simulation';
describe('CJ’s pain',()=>{
 test('ComputeWillKillPed’s choice of line, and SayDeathSample’s',()=>{
  expect(playerPainContext(22,4,50,false)).toBe('low');// a graze, still healthy
  expect(playerPainContext(22,4,8,false)).toBe('high');// a graze that leaves him low
  expect(playerPainContext(22,20,50,false)).toBe('high');
  expect(playerPainContext(54,30,40,false)).toBe('low');// a fall
  expect(playerPainContext(53,1,60,false)).toBe('drowning');
  expect(playerPainContext(37,1,60,true,()=>.05)).toBe('onFire');expect(playerPainContext(37,1,60,true,()=>.5)).toBeUndefined();
  expect(playerPainContext(49,50,0,false)).toBe('deathHigh');expect(playerPainContext(54,50,0,false)).toBe('deathHigh');
  expect(playerPainContext(51,50,0,false)).toBeUndefined();expect(playerPainContext(53,50,0,false)).toBeUndefined();
  expect(playerPainContext(22,50,0,false)).toBe('deathLow');
 });
 test('CJ’s lines come from his bank: drowning, the high fall and death',()=>{
  expect(painSound('drowning',PAIN_VOICE_CARL,()=>0)).toEqual({bank:144,sound:34});
  expect(painSound('highFall',PAIN_VOICE_CARL,()=>.999)).toEqual({bank:144,sound:78});
  expect(painSound('deathLow',PAIN_VOICE_CARL,()=>0)).toEqual({bank:144,sound:25});
  expect(painSound('drowning',PAIN_VOICE_MALE,()=>0)).toBeUndefined();
 });
 test('the player’s cry plays at his position from slot 20 once the bank is in',async()=>{
  const loader=new NativeBankLoader({version:1,packageSha256:'',banks:[]},async()=>new Uint8Array());
  loader.otherBanks=async()=>Array.from({length:169},()=>({samples:new Float32Array(100),sampleRate:22050,headroom:0,loopStart:-1}));
  const engine=new NativeAudioEngine(loader,undefined,()=>0);engine.setPlayer(()=>({x:1,y:2,z:3}));
  engine.playerPain('high');await new Promise(r=>setTimeout(r,0));
  expect(loader.isSoundBankLoaded(144,20)).toBe(true);
  engine.playerPain('high');expect(engine.painCries).toBe(0);// within his pain timer
 });
});
