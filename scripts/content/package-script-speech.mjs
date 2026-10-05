/** Packages the mission dialogue (the SCRIPT sound pack) and the pain cries (PAIN_A) from the iOS port's bundle into
 * public/play/audio/script/ and public/play/audio/pain/.
 *
 * The PC's AUDIO/SFX/SCRIPT is not in the published depot; the iOS port (the gta3sa.app bundle,
 * github.com/Google61/gta3sa.app) ships the same pack as SCRIPT.osw: a ZIP that stores, uncompressed, one MP3 per
 * sound as Bank_NNN/sound_NNN.mp3, with SCRIPT.osw.idx beside it (a u32 count, then per entry a u32 offset of the
 * MP3 in the ZIP, a u32 size, a u16 name length and the name). Its BankLkup.dat gives pack 3 (SCRIPT) 218 banks,
 * global ids 147 to 364, which are Bank_001 to Bank_218 in order; CAEAudioUtility::GetBankAndSoundFromScriptSlot-
 * AudioEvent (gta-reversed AEAudioUtility.cpp, 0x4D9CC0) sends a script's sample 2000 + 200 * n + s to bank
 * SND_BANK_SCRIPT_FIRST (147) + n, sound s, and sound s is the file sound_{s+1}.
 *
 * Each bank becomes one file, bank-{id}.bin: a u16 sound count, then per sound a u32 offset (from the file's start)
 * and a u32 size, then the MP3s as the pack holds them. script.json lists the files with their hashes.
 *
 * PAIN_A.osw is laid out the same way: BankLkup.dat gives pack 2 three banks, 144 to 146 (CJ's, then the male and
 * female pain voices, as gPainVoiceToBankLookup and gPainSpeechLookup's 169, 131 and 101 sounds have them).
 *
 * Usage: node scripts/content/package-script-speech.mjs [directory holding SCRIPT.osw, PAIN_A.osw and their .idx]
 * Without a directory both are downloaded from the bundle's pinned revision. Either way they are checked against
 * their hashes. */
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const REVISION='67f70cb72eb207aeca650ea9e8c10b0e7dda166a',BASE=`https://raw.githubusercontent.com/Google61/gta3sa.app/${REVISION}/`;
/** Each pack: its two files, its first bank (SND_BANK_SCRIPT_FIRST, SND_BANK_PAIN_A_CARL) and bank count in the iOS
 * BankLkup.dat, and where it goes. */
const PACKS=[
 {pack:{name:'SCRIPT.osw',bytes:99239609,sha256:'250fa728c4504a356bf90d070704431bf7b128ba7dfc3ea8cb8d9ee1f3202262'},
  index:{name:'SCRIPT.osw.idx',bytes:219236,sha256:'3b3ee4d9a584e426da06fcc60482170afccafce1d15fc5301ef5aa6d9899aae8'},
  firstBank:147,banks:218,output:'public/play/audio/script',manifest:'script.json'},
 {pack:{name:'PAIN_A.osw',bytes:3247335,sha256:'b6e917e21c007e394b76b0d1f7121b5f1c6f397073de3554b8b56599104816e1'},
  index:{name:'PAIN_A.osw.idx',bytes:12836,sha256:'6f64edb08e2a7e0895a70a2467d6e848e2cffcb189adaf2d74a014189060ea43'},
  firstBank:144,banks:3,output:'public/play/audio/pain',manifest:'pain.json'},
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function source({name,bytes,sha256}){
 const data=process.argv[2]?await readFile(join(process.argv[2],name)):Buffer.from(await (await fetch(BASE+name,{signal:AbortSignal.timeout(900000)})).arrayBuffer());
 if(data.length!==bytes||hash(data)!==sha256)throw new Error(`${name} is not the pinned one.`);
 return data;
}
for(const {pack:packSource,index:indexSource,firstBank:FIRST_BANK,banks:BANKS,output:OUTPUT,manifest} of PACKS){
const pack=await source(packSource),index=await source(indexSource);
const banks=Array.from({length:BANKS},()=>[]);
let at=4;
for(let n=index.readUInt32LE(0);n>0;n--){
 const offset=index.readUInt32LE(at),size=index.readUInt32LE(at+4),length=index.readUInt16LE(at+8),name=index.toString('latin1',at+10,at+10+length);at+=10+length;
 const match=/^Bank_(\d{3})\/sound_(\d{3})\.mp3$/.exec(name);if(!match)throw new Error(`Unexpected entry ${name}.`);
 const bank=Number(match[1])-1,sound=Number(match[2])-1;
 if(bank<0||bank>=BANKS||sound!==banks[bank].length)throw new Error(`${name} is out of order.`);
 // The ZIP's local header ends where the index says the MP3 starts: its name, then stored data of the same size.
 const header=offset-30-length;
 if(pack.readUInt32LE(header)!==0x04034b50||pack.readUInt16LE(header+8)!==0||pack.readUInt32LE(header+18)!==size||pack.toString('latin1',header+30,offset)!==name)throw new Error(`${name} does not match the pack.`);
 banks[bank].push(pack.subarray(offset,offset+size));
}
if(at!==index.length||banks.some(sounds=>!sounds.length))throw new Error('The index does not cover every bank.');
await rm(OUTPUT,{recursive:true,force:true});await mkdir(OUTPUT,{recursive:true});
const listed=[];
for(const [i,sounds] of banks.entries()){
 const head=Buffer.alloc(2+sounds.length*8);head.writeUInt16LE(sounds.length,0);
 let offset=head.length;
 sounds.forEach((mp3,s)=>{head.writeUInt32LE(offset,2+s*8);head.writeUInt32LE(mp3.length,6+s*8);offset+=mp3.length;});
 const id=FIRST_BANK+i,bytes=Buffer.concat([head,...sounds]),path=`bank-${id}.bin`;
 await writeFile(join(OUTPUT,path),bytes);
 listed.push({id,path,sounds:sounds.length,bytes:bytes.length,sha256:hash(bytes)});
}
await writeFile(join(OUTPUT,manifest),JSON.stringify({version:1,source:{url:BASE+packSource.name,sha256:packSource.sha256},firstBank:FIRST_BANK,banks:listed})+'\n');
console.log(`Packaged ${listed.length} ${packSource.name} banks, ${listed.reduce((n,b)=>n+b.sounds,0)} sounds (${(listed.reduce((n,b)=>n+b.bytes,0)/1048576).toFixed(1)} MB).`);
}
