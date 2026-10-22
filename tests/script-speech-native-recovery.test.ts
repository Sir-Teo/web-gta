import {expect,test} from 'vitest';
import {createHash} from 'node:crypto';
import {AudioSystem} from '../src/audio/AudioSystem';
import {ScriptSpeech} from '../src/audio/ScriptSpeech';
import {NativeBankLoader} from '../src/audio/native/NativeBankLoader';
import {NativeAudioEngine} from '../src/audio/native/NativeAudioEngine';
import {MISSION_BANK_SLOT_FIRST} from '../src/audio/native/NativeScriptAudio';

const buffer={duration:1,sampleRate:8000,getChannelData:()=>new Float32Array(8000)}as unknown as AudioBuffer;
function setup(decode:()=>Promise<AudioBuffer>){
 const bytes=new Uint8Array(20),v=new DataView(bytes.buffer);v.setUint16(0,2,true);v.setUint32(2,18,true);v.setUint32(6,1,true);v.setUint32(10,19,true);v.setUint32(14,1,true);bytes.set([1,2],18);
 const manifest={version:1,firstBank:147,banks:[{id:147,path:'bank-147.bin',sounds:2,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}]};let manifests=0;
 const speech=new ScriptSpeech('https://game.test/audio/',decode,(async(url:URL)=>String(url).endsWith('script.json')?(++manifests===1?new Response(null,{status:503}):new Response(JSON.stringify(manifest))):new Response(bytes.slice()))as typeof fetch);
 const audio=new AudioSystem(),bank=new NativeBankLoader({version:1,packageSha256:'',banks:[]},async()=>{throw new Error('No whole bank requested');}),native=new NativeAudioEngine(bank);
 Object.assign(audio,{speech,native});bank.otherSound=(bank,sound)=>(audio as any).scriptSound(bank,sound);
 return{audio,bank,native,manifests:()=>manifests};
}
test('a recovered mission line fills its native slot and can use native playback',async()=>{
 const {audio,bank,native,manifests}=setup(async()=>buffer);
 expect(await audio.loadSpeech(2000,1)).toBe(true);expect(manifests()).toBe(2);
 expect(bank.isSoundLoaded(147,0,MISSION_BANK_SLOT_FIRST)).toBe(true);expect(native.scriptAudio.missionAudioLoaded(0)).toBe(true);expect(native.scriptAudio.playLoadedMissionAudio(0)).toBe(true);
});
test('recovering an older line does not overwrite a newer native preload',async()=>{
 let release!:(buffer:AudioBuffer)=>void,started!:()=>void,decodes=0;const decoding=new Promise<void>(r=>{started=r;}),pending=new Promise<AudioBuffer>(r=>{release=r;});
 const {audio,bank,native}=setup(async()=>{if(++decodes===1){started();return pending;}return buffer;});
 const old=audio.loadSpeech(2000,1);await decoding;
 native.scriptAudio.preloadMissionAudio(0,2001);expect(await bank.loadSoundAsync(147,1,MISSION_BANK_SLOT_FIRST)).toBe(true);
 release(buffer);expect(await old).toBe(true);expect(native.scriptAudio.missionLinks[0].event).toBe(2001);expect(bank.isSoundLoaded(147,1,MISSION_BANK_SLOT_FIRST)).toBe(true);expect(bank.isSoundLoaded(147,0,MISSION_BANK_SLOT_FIRST)).toBe(false);
});
