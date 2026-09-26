import {afterEach,expect,test,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {NativeBankLoader,type NativeBankManifest} from '../src/audio/native/NativeBankLoader';
const manifest=JSON.parse(readFileSync('public/play/audio/banks.json','utf8')) as NativeBankManifest;
const bytes=new Uint8Array(readFileSync('public/play/audio/bank-5.bin'));
afterEach(()=>{vi.useRealTimers();});
const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
test('a sound bank whose download failed is tried again after a wait, and loads',async()=>{
 vi.useFakeTimers();let calls=0;
 const loader=new NativeBankLoader(manifest,async()=>{calls++;if(calls===1)throw new Error('Sound bank 5 unavailable.');return bytes;});
 loader.loadSoundBank(5,7);await settle();
 expect(loader.isSoundBankLoaded(5,7)).toBe(false);expect(loader.failures.has(5)).toBe(true);
 // Asked again at once, the failed attempt answers; after the wait, the bank is fetched again.
 loader.loadSoundBank(5,7);await settle();expect(calls).toBe(1);
 await vi.advanceTimersByTimeAsync(5000);
 loader.loadSoundBank(5,7);await settle();await vi.waitFor(()=>expect(loader.isSoundBankLoaded(5,7)).toBe(true));
 expect(calls).toBe(2);expect(loader.failures.has(5)).toBe(false);
});
test('a bank that keeps failing stops being fetched after three retries',async()=>{
 vi.useFakeTimers();let calls=0;
 const loader=new NativeBankLoader(manifest,async()=>{calls++;throw new Error('down');});
 for(const wait of [0,5000,20000,60000,120000,600000]){await vi.advanceTimersByTimeAsync(wait);loader.loadSoundBank(5,7);await settle();}
 expect(calls).toBe(4);
});
