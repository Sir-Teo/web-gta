import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {readSfxBank,sfxPcmSamples} from '../src/assets/sfx';
import {NativeBankLoader,mergeBanks,type NativeBankManifest} from '../src/audio/native/NativeBankLoader';
const pc=JSON.parse(readFileSync('public/play/audio/banks.json','utf8')) as NativeBankManifest;
const ios=JSON.parse(readFileSync('public/play/audio/ios-banks.json','utf8')) as NativeBankManifest&{decoderDelay:number};
const file=(path:string)=>new Uint8Array(readFileSync(`public/play/audio/${path}`));
test('the banks rebuilt from the iOS bundle are PC-format banks the PC list lacks',()=>{
 // SND_BANK_GENRL_BULLET_PASS_1 to _4 (three whizzes each), and the motorbike engines COPBIKE_D/_P, SCOOTER_P,
 // SPORTSBIKE_D/_P and VTWINBIKE_D/_P.
 expect(ios.banks.map(b=>b.id)).toEqual([28,29,30,31,40,41,119,124,125,139,140]);
 const have=new Set(pc.banks.map(b=>b.id));
 for(const bank of ios.banks){
  expect(have.has(bank.id)).toBe(false);
  const bytes=file(bank.path);
  expect(bytes.length).toBe(bank.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(bank.sha256);
  const sounds=readSfxBank(bytes,bank.dataBytes);
  expect(sounds).toHaveLength(bank.sounds);if(bank.id<=31)expect(sounds).toHaveLength(3);
  for(const sound of sounds){
   expect(sound.sampleRate).toBeGreaterThan(8000);
   // Each sound is heard: not the silence an empty bundle entry would leave.
   const samples=sfxPcmSamples(sound);let peak=0;for(const v of samples)peak=Math.max(peak,Math.abs(v));
   expect(peak).toBeGreaterThan(.05);
  }
 }
});
test('the rebuilt banks join the PC list, and the PC keeps any bank both have',()=>{
 const merged=mergeBanks(pc.banks,ios.banks);
 expect(merged.length).toBe(pc.banks.length+ios.banks.length);
 const twin={...pc.banks[0],sha256:'x'};
 expect(mergeBanks(pc.banks,[twin]).filter(b=>b.id===twin.id)).toEqual([pc.banks[0]]);
 expect(mergeBanks(pc.banks,undefined)).toBe(pc.banks);
});
test('the first bullet-pass bank loads into its slot as CAEFrontendAudioEntity::Initialise asks',async()=>{
 const manifest={...pc,banks:mergeBanks(pc.banks,ios.banks)};
 const loader=new NativeBankLoader(manifest,async entry=>file(entry.path));
 // SND_BANK_SLOT_BULLET_PASS.
 loader.loadSoundBank(28,42);
 await expect.poll(()=>loader.isSoundBankLoaded(28,42)).toBe(true);
 for(let sound=0;sound<3;sound++)expect(loader.sound(42,sound)?.samples.length).toBeGreaterThan(1000);
});
