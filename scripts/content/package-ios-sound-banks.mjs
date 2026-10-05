/** Rebuilds PC sound banks that the PC audio depot copy lacks from the iOS port's bundle, into
 * public/play/audio/bank-{id}.bin beside the PC ones, listed in public/play/audio/ios-banks.json.
 *
 * The PC GENRL package the port's banks came from (package-native-audio.mjs) is not on hand any more, and only the
 * banks the ported entities asked for were taken from it. The iOS port (the gta3sa.app bundle,
 * github.com/Google61/gta3sa.app) ships the same pack as GENRL.osw: a ZIP of one file per sound as
 * Bank_NNN/sound_NNN.mp3 (or .wav), Bank_001 being global bank 7 (BankLkup.dat, byte-identical to the PC's, gives GENRL banks 7 to
 * 143 in order), with GENRL.osw.idx beside it (a u32 count, then per entry a u32 offset, a u32 size, a u16 name length
 * and the name). Its SOUNDINF.DAT keeps every bank's PC sound headers: a u32 bank count (710), a u32 sound count per
 * bank, then per sound the PC bank header's 12-byte record (a u32 byte offset into the bank's PCM, a u32 loop start in
 * samples, a u16 sample rate and an s16 headroom). Those records are the PC banks' own: for all 85 GENRL banks the port
 * already has from the PC, every count, offset, loop, rate and headroom matches.
 *
 * So a bank is rebuilt as the PC has it: the header from SOUNDINF.DAT verbatim, and each sound's PCM16 at the PC rate and
 * length. The bundle's sound is one of three things:
 * - a RIFF WAV of the PC's PCM (19 of the GENRL sounds the port lacks; all 41 the port has from the PC are identical);
 * - an MPEG-1 layer III file at 32 kHz, which `afconvert` (macOS) decodes; the decoded audio starts DECODER_DELAY
 *   samples late (measured against the 437 such sounds of the PC banks on hand: the best alignment is 577 samples for
 *   311 of them, 576 to 579 for all but 12, median 577.15), so that many are dropped, and the rest is resampled to the
 *   PC rate (windowed sinc) and cut or padded to the PC length, so loop starts and lengths stay the PC's;
 * - empty (13 sounds, one of them in the banks rebuilt here), which becomes silence of the PC length.
 * The MP3s are lossy and band-limited to the 32 kHz encode, so a rebuilt bank is not the PC's bytes; `--check` rebuilds
 * the PC banks on hand and reports how close it comes (see docs/FIDELITY_AUDIT.md).
 *
 * Usage: node scripts/content/package-ios-sound-banks.mjs [directory holding GENRL.osw, GENRL.osw.idx, SOUNDINF.DAT
 * and BankLkup.dat] [--check]
 * Without a directory the files are downloaded from the bundle's pinned revision. Either way they are checked against
 * their hashes. Needs macOS (`afconvert`) for the MP3s. */
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {REVISION} from './lib/ios-executable.mjs';
const BASE=`https://raw.githubusercontent.com/Google61/gta3sa.app/${REVISION}/`;
const SOURCES={
 pack:{name:'GENRL.osw',bytes:9362373,sha256:'3d469654805f1c457bdcdd8025f4e8840b3d6674503be53709484d8680544328'},
 index:{name:'GENRL.osw.idx',bytes:20868,sha256:'dbdf66a159e3a4d855cbc1ca56df5e575025cb6b928ff04448c37f2f70df2c9a'},
 info:{name:'SOUNDINF.DAT',bytes:746760,sha256:'639b880be8c20dd35b2a8702f2ec466946cf8ed44b8f3fd0a74fb8342af16d99'},
 lookup:{name:'BankLkup.dat',bytes:8520,sha256:'b89a66ddef4e5da74c4c13abb38a9aa7985397bee45b00e080da89f07a1eee50'},
};
/** GENRL's first bank (Bank_001), and its last. */
const GENRL_FIRST=7,GENRL_LAST=143;
/** The banks rebuilt, with the eSoundBank names gta-reversed (0076f901) gives them:
 * - SND_BANK_GENRL_BULLET_PASS_1 to _4 (28 to 31), which CAEFrontendAudioEntity rotates through for a bullet's whizz;
 * - the motorbikes' engines that VehicleAudioSettings names and the PC copy lacks: COPBIKE_D and _P (40, 41),
 *   SCOOTER_P (119), SPORTSBIKE_D and _P (124, 125), VTWINBIKE_D and _P (139, 140);
 * - BOAT_INBOARD_D (21), the dummy bank of every boat, whose one loop ProcessBoatEngine plays (a boat loads no player
 *   bank);
 * - TRAIN_D and TRAM_D (131, 133), the trains' and the tram's dummy banks: the engine loop and the track sound (no one
 *   drives the port's trains, so TRAIN_P's brakes are not asked for);
 * - BICYCLE_D and _P (18, 19): the tyres and the freewheel of the BMX and the mountain bikes, and the player bank whose
 *   presence lets the freewheel be heard;
 * - FRONTEND_MENU (60): the menus' select, back, highlight and error pairs. */
const BANKS=[18,19,21,28,29,30,31,40,41,60,119,124,125,131,133,139,140];
/** Samples the decoded 32 kHz MP3s start late by (see above). */
const DECODER_DELAY=577,MP3_RATE=32000;
const OUTPUT='public/play/audio',MANIFEST='ios-banks.json';
const args=process.argv.slice(2),check=args.includes('--check'),directory=args.find(a=>a!=='--check');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function source({name,bytes,sha256}){
 const data=directory?await readFile(join(directory,name)):Buffer.from(await (await fetch(BASE+name,{signal:AbortSignal.timeout(300000)})).arrayBuffer());
 if(data.length!==bytes||hash(data)!==sha256)throw new Error(`${name} is not the pinned one.`);
 return data;
}
const pack=await source(SOURCES.pack),index=await source(SOURCES.index),info=await source(SOURCES.info),lookup=await source(SOURCES.lookup);
// The bundle's sounds by global bank.
const bundled=new Map();
{
 let at=4;
 for(let n=index.readUInt32LE(0);n>0;n--){
  const offset=index.readUInt32LE(at),size=index.readUInt32LE(at+4),length=index.readUInt16LE(at+8),name=index.toString('latin1',at+10,at+10+length);at+=10+length;
  const match=/^Bank_(\d{3})\/sound_(\d{3})\.(mp3|wav)$/.exec(name);if(!match)throw new Error(`Unexpected entry ${name}.`);
  const bank=GENRL_FIRST-1+Number(match[1]),sound=Number(match[2])-1,sounds=bundled.get(bank)??[];
  if(bank>GENRL_LAST||sound!==sounds.length)throw new Error(`${name} is out of order.`);
  // The ZIP's local header ends where the index says the sound starts: its name, then stored data of the same size.
  const header=offset-30-length;
  if(pack.readUInt32LE(header)!==0x04034b50||pack.readUInt16LE(header+8)!==0||pack.readUInt32LE(header+18)!==size||pack.toString('latin1',header+30,offset)!==name)throw new Error(`${name} does not match the pack.`);
  sounds.push(pack.subarray(offset,offset+size));bundled.set(bank,sounds);
 }
 if(at!==index.length||bundled.size!==GENRL_LAST-GENRL_FIRST+1)throw new Error('The index does not cover every GENRL bank.');
}
// SOUNDINF.DAT: each bank's PC sound records.
const bankCount=info.readUInt32LE(0);
if(bankCount!==lookup.length/12)throw new Error('SOUNDINF.DAT and BankLkup.dat disagree on the banks.');
const firstRecord=[];
{let n=0;for(let b=0;b<bankCount;b++){firstRecord.push(n);n+=info.readUInt32LE(4+b*4);}if(info.length!==4+bankCount*4+n*12)throw new Error('SOUNDINF.DAT is not one record per sound.');}
function records(bank){
 const count=info.readUInt32LE(4+bank*4),base=4+bankCount*4+firstRecord[bank]*12;
 return Array.from({length:count},(_,i)=>info.subarray(base+i*12,base+i*12+12));
}
const tmp=await mkdtemp(join(tmpdir(),'ios-banks-'));
/** A WAV's PCM16 mono data and rate. */
function readWav(bytes){
 let at=12,rate=0,data;
 while(at+8<=bytes.length){
  const id=bytes.toString('latin1',at,at+4),size=bytes.readUInt32LE(at+4);
  if(id==='fmt '){if(bytes.readUInt16LE(at+8)!==1||bytes.readUInt16LE(at+10)!==1||bytes.readUInt16LE(at+22)!==16)throw new Error('Not a mono PCM16 WAV.');rate=bytes.readUInt32LE(at+12);}
  if(id==='data')data=new Int16Array(bytes.buffer.slice(bytes.byteOffset+at+8,bytes.byteOffset+at+8+(size&~1)));
  at+=8+size+(size&1);
 }
 if(!rate||!data)throw new Error('A WAV without format or data.');
 return {rate,data};
}
let decoded=0;
function decodeMp3(bytes){
 // An MPEG-1 layer III frame header at 32 kHz: 0xFFFx with version 3, layer 1, rate index 2.
 if(bytes[0]!==0xff||(bytes[1]&0xfe)!==0xfa||((bytes[2]>>2)&3)!==2)throw new Error('Not a 32 kHz MPEG-1 layer III file.');
 const mp3=join(tmp,`${decoded}.mp3`),wav=join(tmp,`${decoded++}.wav`);
 writeFileSync(mp3,bytes);
 execFileSync('afconvert',['-f','WAVE','-d','LEI16',mp3,wav],{stdio:'ignore'});
 const out=readWav(readFileSync(wav));if(out.rate!==MP3_RATE)throw new Error(`afconvert gave ${out.rate} Hz.`);
 return out.data;
}
/** Windowed-sinc resampling of `source` (at `from` Hz, starting `skip` samples in) to `length` samples at `to` Hz. */
function resample(source,from,to,skip,length){
 const out=new Int16Array(length),ratio=from/to,cutoff=Math.min(1,to/from),half=16,reach=Math.ceil(half/cutoff);
 for(let k=0;k<length;k++){
  const x=skip+k*ratio,centre=Math.floor(x);let sum=0;
  for(let j=centre-reach;j<=centre+reach;j++){
   if(j<0||j>=source.length)continue;
   const t=(x-j)*cutoff;if(Math.abs(t)>half)continue;
   sum+=source[j]*cutoff*(t===0?1:Math.sin(Math.PI*t)/(Math.PI*t))*(.5+.5*Math.cos(Math.PI*t/half));
  }
  out[k]=Math.max(-32768,Math.min(32767,Math.round(sum)));
 }
 return out;
}
/** The bank as the PC has it: the 4804-byte header (u16 count, two pad bytes, 400 records) and the PCM. */
function rebuild(bank){
 const recs=records(bank),sounds=bundled.get(bank),dataBytes=lookup.readUInt32LE(bank*12+8);
 if(!sounds||sounds.length!==recs.length)throw new Error(`Bank ${bank}: the bundle has ${sounds?.length} sounds, SOUNDINF.DAT ${recs.length}.`);
 const header=Buffer.alloc(4804),data=Buffer.alloc(dataBytes);header.writeUInt16LE(recs.length,0);
 const kinds={wav:0,mp3:0,empty:0};
 recs.forEach((rec,i)=>{
  rec.copy(header,4+i*12);
  const start=rec.readUInt32LE(0),end=i+1<recs.length?recs[i+1].readUInt32LE(0):dataBytes,rate=rec.readUInt16LE(8),samples=(end-start)/2;
  if(start%2||end%2||end<start||end>dataBytes)throw new Error(`Bank ${bank} sound ${i}: bad bounds.`);
  const bytes=sounds[i];let pcm;
  if(bytes.length===0){kinds.empty++;pcm=new Int16Array(samples);}
  else if(bytes.toString('latin1',0,4)==='RIFF'){
   kinds.wav++;const wav=readWav(bytes);
   if(wav.rate!==rate||wav.data.length!==samples)throw new Error(`Bank ${bank} sound ${i}: the WAV is not the PC's sound.`);
   pcm=wav.data;
  }
  else{kinds.mp3++;pcm=resample(decodeMp3(bytes),MP3_RATE,rate,DECODER_DELAY,samples);}
  Buffer.from(pcm.buffer,pcm.byteOffset,pcm.byteLength).copy(data,start);
 });
 return {bytes:Buffer.concat([header,data]),dataBytes,kinds};
}
try{
 if(check){
  // Rebuild every PC bank on hand and compare it with the PC's.
  const pc=JSON.parse(await readFile(join(OUTPUT,'banks.json'),'utf8')).banks.filter(b=>b.id>=GENRL_FIRST&&b.id<=GENRL_LAST);
  let headers=0,worst=1;const correlations=[];
  for(const {id,path} of pc){
   const real=await readFile(join(OUTPUT,path)),{bytes}=rebuild(id);
   if(real.subarray(0,4804).equals(bytes.subarray(0,4804)))headers++;
   const recs=records(id),dataBytes=real.length-4804;
   recs.forEach((rec,i)=>{
    const start=4804+rec.readUInt32LE(0),end=4804+(i+1<recs.length?recs[i+1].readUInt32LE(0):dataBytes);
    let ab=0,aa=0,bb=0;for(let at=start;at<end;at+=2){const a=real.readInt16LE(at),b=bytes.readInt16LE(at);ab+=a*b;aa+=a*a;bb+=b*b;}
    if(aa>0&&bb>0){const c=ab/Math.sqrt(aa*bb);correlations.push(c);worst=Math.min(worst,c);}
   });
  }
  correlations.sort((a,b)=>a-b);
  console.log(`${headers}/${pc.length} headers identical; ${correlations.length} sounds, correlation median ${correlations[correlations.length>>1].toFixed(4)}, 10th percentile ${correlations[Math.floor(correlations.length*.1)].toFixed(4)}, worst ${worst.toFixed(4)}.`);
 }
 else{
  const listed=[];
  for(const id of BANKS){
   if(id<GENRL_FIRST||id>GENRL_LAST)throw new Error(`Bank ${id} is not a GENRL bank.`);
   const {bytes,dataBytes,kinds}=rebuild(id),path=`bank-${id}.bin`;
   await writeFile(join(OUTPUT,path),bytes);
   listed.push({id,path,dataBytes,bytes:bytes.length,sounds:bytes.readUInt16LE(0),sha256:hash(bytes),from:kinds});
  }
  await writeFile(join(OUTPUT,MANIFEST),JSON.stringify({version:1,source:{url:BASE+SOURCES.pack.name,sha256:SOURCES.pack.sha256,soundInfoSha256:SOURCES.info.sha256},decoderDelay:DECODER_DELAY,banks:listed},null,1)+'\n');
  console.log(`Rebuilt ${listed.length} banks from the iOS bundle (${(listed.reduce((n,b)=>n+b.bytes,0)/1048576).toFixed(2)} MB).`);
 }
}
finally{await rm(tmp,{recursive:true,force:true});}
