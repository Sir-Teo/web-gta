/** Inspect local PC SFX banks without copying native recordings into the project. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {openAsBlob} from 'node:fs';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {build} from 'rolldown';
const [root,output,...requested]=process.argv.slice(2);
if(!root||!output)throw new Error('Usage: audit-sfx.mjs /absolute/game-root /absolute/new-report.json [bank IDs; default 0–6]');
const ids=requested.length?requested.map(value=>{
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value)))throw new Error('Bank IDs must be nonnegative integers.');return Number(value);
}):[0,1,2,3,4,5,6];
if(ids.length>128||new Set(ids).size!==ids.length)throw new Error('Choose at most 128 distinct bank IDs.');
const temporary=await mkdtemp(join(tmpdir(),'web-gta-sfx-'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
try{
 await build({input:resolve('src/assets/sfx.ts'),platform:'node',output:{file:join(temporary,'sfx.mjs'),format:'esm'}});
 const {readSfxBankLookups,readSfxPackageNames,resolveSfxBank,readSfxBankFile,sfxPcmSamples}=await import(pathToFileURL(join(temporary,'sfx.mjs')));
 const [lookupBytes,packageBytes]=await Promise.all(['BankLkup.dat','PakFiles.dat'].map(name=>readFile(join(root,'audio','CONFIG',name))));
 const banks=readSfxBankLookups(lookupBytes),packages=readSfxPackageNames(packageBytes);
 const selected=[];
 for(const id of ids){
  const {bankId,packageName,lookup}=resolveSfxBank(id,banks,packages);
  const file=await openAsBlob(join(root,'audio','SFX',packageName));
  const sounds=await readSfxBankFile(file,lookup);
  selected.push({bankId,packageName,packageBytes:file.size,offset:lookup.offset,dataBytes:lookup.dataBytes,sounds:sounds.map((sound,soundId)=>{
   const samples=sfxPcmSamples(sound);let peak=0,energy=0;
   for(const value of samples){peak=Math.max(peak,Math.abs(value));energy+=value*value;}
   return {soundId,pcmBytes:sound.pcm16.length,sha256:hash(sound.pcm16),sampleRate:sound.sampleRate,seconds:samples.length/sound.sampleRate,headroom:sound.headroom,loopStartOffset:sound.loopStartOffset,peak,rms:samples.length?Math.sqrt(energy/samples.length):0};
  })});
 }
 const report={checkedAt:new Date().toISOString(),root:resolve(root),format:'PC SFX PCM16 mono',lookup:{bytes:lookupBytes.length,sha256:hash(lookupBytes),banks:banks.length},packages:{bytes:packageBytes.length,sha256:hash(packageBytes),names:packages},selected};
 await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 console.log(`${selected.length} banks, ${selected.reduce((n,b)=>n+b.sounds.length,0)} sounds inspected. Report: ${resolve(output)}`);
}finally{await rm(temporary,{recursive:true,force:true});}
