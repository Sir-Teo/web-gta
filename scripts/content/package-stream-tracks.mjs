/** Packages the beat tracks, the ambience tracks and the emergency channel (the BEATS, AMBIENCE and AA stream packs), and
 * the published cutscenes' tracks of the CUTSCENE pack, from the iOS port's bundle into public/play/audio/streams/.
 *
 * The PC's AUDIO/STREAMS are not in the published depot. The iOS port (the gta3sa.app bundle,
 * github.com/Google61/gta3sa.app) ships each stream pack as a ZIP of MP3s, Track_001.mp3 on: BEATS.osw holds the ten
 * tracks its TrakLkup.dat gives the pack (StrmPaks.dat's entry 4), global ids 175 to 184 in order. They are the
 * mission-passed tunes (182 and 183, which PLAY_MISSION_PASSED_TUNE reaches through gBeatTrackLookup) and the dance
 * and lowrider games' beat tracks. The bundle's Track_003 (177) is a 756-byte deflated stub rather than a stored MP3,
 * so it is left out. AMBIENCE.osw holds the 40 tracks of pack 3, 135 to 174: the loops CAEAmbienceTrackManager plays in
 * the clubs, bars, casinos and the like by audio zone, the sandstorm and the sea. AA.osw holds pack 0's 66, 0 to 65:
 * the emergency channel CAERadioTrackManager plays in an emergency vehicle, the dispatcher's lines (0 to 59) and the
 * bursts of static it puts between them (its two music tracks, 60 and 63, each with an intro and an outro).
 *
 * Each track becomes track-{id}.mp3; streams.json lists them with their hashes and their beats. The PC's stream files
 * put a tTrackInfo (gta-reversed AETrackLoader.h, 0x1F84 bytes) in front of each track: 1000 beats of a u32 time in
 * ms and a u32 key, the list ending at the first key below 1, then the track's own fields. The iOS port moved those
 * headers into TRKHEAD.DAT, one per track in TrakLkup.dat's order (1922 of them), which is where the beats come from:
 * the dance tracks' keys are the four arrows (1 to 4), the lowrider tracks' 9 to 16, and 33 ends a track's moves.
 *
 * Usage: node scripts/content/package-stream-tracks.mjs [directory holding BEATS.osw, AMBIENCE.osw, AA.osw,
 * CUTSCENE.osw, TrakLkup.dat, StrmPaks.dat and TRKHEAD.DAT]
 * Without a directory the files are downloaded from the bundle's pinned revision. Either way they are checked against
 * their hashes. */
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const REVISION='67f70cb72eb207aeca650ea9e8c10b0e7dda166a',BASE=`https://raw.githubusercontent.com/Google61/gta3sa.app/${REVISION}/`;
const SOURCES={
 BEATS:{name:'BEATS.osw',bytes:9733284,sha256:'27b0e6ff721a872ad719fab7def50247cb0d04b9bb108ec0aca334491b64b053'},
 AMBIENCE:{name:'AMBIENCE.osw',bytes:22719112,sha256:'fbe8d0c10cf5af252496e2a5729efae6e0afe37004d5905d872cf6dcc83fe272'},
 AA:{name:'AA.osw',bytes:2553090,sha256:'70f7f5dcd69f4e0eaab6963fbe97dd6e90b4a0c932ed4c61fde7e58111bf6e7d'},
 tracks:{name:'TrakLkup.dat',bytes:23064,sha256:'adf22fcdfe798c7ad59f1b8fbf6a71574fbf06f1ca39a074ad2b3163c341c0d9'},
 packs:{name:'StrmPaks.dat',bytes:272,sha256:'03e32ee0efb3505d0cea13952370d24a417799b085946087c851060d4120dea0'},
 heads:{name:'TRKHEAD.DAT',bytes:15506696,sha256:'6474abc1c02ed8647caca1c107e0d067cce2715021f9420c009c0f763ad1c0e4'},
 CUTSCENE:{name:'CUTSCENE.osw',bytes:59449950,sha256:'04bb1dc7107f57dee406871e72b8e36873a39b50c05f7e0a462f9a80e5aa55d7'},
};
/** sizeof(tTrackInfo), and its beats. */
const TRACK_INFO_BYTES=0x1f84,BEATS_PER_TRACK=1000;
const OUTPUT='public/play/audio/streams',PACKS=['AMBIENCE','BEATS','AA'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function source({name,bytes,sha256}){
 const data=process.argv[2]?await readFile(join(process.argv[2],name)):Buffer.from(await (await fetch(BASE+name,{signal:AbortSignal.timeout(300000)})).arrayBuffer());
 if(data.length!==bytes||hash(data)!==sha256)throw new Error(`${name} is not the pinned one.`);
 return data;
}
const lookup=await source(SOURCES.tracks),packs=await source(SOURCES.packs),heads=await source(SOURCES.heads);
if(heads.length!==lookup.length/12*TRACK_INFO_BYTES)throw new Error('TRKHEAD.DAT does not hold one header per track.');
/** A track's beats as [time, key], up to the first key below 1 (where GetBeatInfo's scan stops). */
function beatsOf(id){
 const out=[];
 for(let i=0;i<BEATS_PER_TRACK;i++){
  const at=id*TRACK_INFO_BYTES+i*8,time=heads.readInt32LE(at),key=heads.readInt32LE(at+4);
  if(key<1)break;out.push([time,key]);
 }
 return out;
}
// StrmPaks.dat: 16-byte names. TrakLkup.dat: per track a u8 pack, three pad bytes, a u32 offset and a u32 size.
const packNames=Array.from({length:packs.length/16},(_,i)=>packs.toString('latin1',i*16,i*16+16).replace(/\0.*$/s,''));
await rm(OUTPUT,{recursive:true,force:true});await mkdir(OUTPUT,{recursive:true});
const listed=[],sources=[];
for(const PACK of PACKS){
 const pack=await source(SOURCES[PACK]);sources.push({url:BASE+SOURCES[PACK].name,sha256:SOURCES[PACK].sha256});
 const packIndex=packNames.indexOf(PACK);
 if(packIndex<0)throw new Error(`StrmPaks.dat has no ${PACK}.`);
 const ids=[];for(let id=0;id<lookup.length/12;id++)if(lookup[id*12]===packIndex)ids.push(id);
 if(!ids.length||ids.some((id,i)=>id!==ids[0]+i))throw new Error(`${PACK}'s tracks are not one run.`);
 // The ZIP's entries in order: a local header, the name, then the data.
 const entries=[];
 for(let at=0;at+4<=pack.length&&pack.readUInt32LE(at)===0x04034b50;){
  const method=pack.readUInt16LE(at+8),size=pack.readUInt32LE(at+18),nameLength=pack.readUInt16LE(at+26),extra=pack.readUInt16LE(at+28);
  const name=pack.toString('latin1',at+30,at+30+nameLength),data=at+30+nameLength+extra;
  entries.push({name,method,bytes:pack.subarray(data,data+size)});at=data+size;
 }
 if(entries.length!==ids.length)throw new Error(`${PACK}.osw has ${entries.length} tracks, TrakLkup.dat ${ids.length}.`);
 for(const [i,entry] of entries.entries()){
  if(entry.name!==`Track_${String(i+1).padStart(3,'0')}.mp3`)throw new Error(`Unexpected entry ${entry.name}.`);
  if(entry.method!==0)continue;
  if(entry.bytes[0]!==0xff||(entry.bytes[1]&0xe0)!==0xe0)throw new Error(`${PACK} ${entry.name} is not an MP3.`);
  const id=ids[i],path=`track-${id}.mp3`;
  await writeFile(join(OUTPUT,path),entry.bytes);
  listed.push({id,path,bytes:entry.bytes.length,sha256:hash(entry.bytes),beats:beatsOf(id)});
 }
}
// The cutscene pack's tracks (626 to 766, FindCutsceneAudioTrackId's), only those of the cutscenes published under
// public/play/cuts/ (tests/build-cutscenes.test.ts writes each one's track there). CUTSCENE.osw holds one entry more
// than TrakLkup.dat gives the pack: Track_142, an ID3-tagged MP3 no id reaches.
{
 const wanted=new Set(Object.values(JSON.parse(await readFile('public/play/cuts/manifest.json','utf8')).cutscenes).map(c=>c.track).filter(id=>id!==undefined));
 const pack=await source(SOURCES.CUTSCENE),packIndex=packNames.indexOf('CUTSCENE');sources.push({url:BASE+SOURCES.CUTSCENE.name,sha256:SOURCES.CUTSCENE.sha256});
 const ids=[];for(let id=0;id<lookup.length/12;id++)if(lookup[id*12]===packIndex)ids.push(id);
 if(ids.length!==141||ids.some((id,i)=>id!==626+i))throw new Error('The cutscene pack is not tracks 626 to 766.');
 let at=0;
 for(let i=0;at+4<=pack.length&&pack.readUInt32LE(at)===0x04034b50;i++){
  const method=pack.readUInt16LE(at+8),size=pack.readUInt32LE(at+18),nameLength=pack.readUInt16LE(at+26),extra=pack.readUInt16LE(at+28);
  const name=pack.toString('latin1',at+30,at+30+nameLength),data=at+30+nameLength+extra,bytes=pack.subarray(data,data+size);at=data+size;
  if(name!==`Track_${String(i+1).padStart(3,'0')}.mp3`)throw new Error(`Unexpected entry ${name}.`);
  const id=ids[i];if(id===undefined||!wanted.has(id))continue;
  if(method!==0||bytes[0]!==0xff||(bytes[1]&0xe0)!==0xe0)throw new Error(`CUTSCENE ${name} is not a stored MP3.`);
  const path=`track-${id}.mp3`;await writeFile(join(OUTPUT,path),bytes);
  listed.push({id,path,bytes:bytes.length,sha256:hash(bytes),beats:beatsOf(id)});wanted.delete(id);
 }
 if(wanted.size)throw new Error(`CUTSCENE.osw has no track ${[...wanted].join(', ')}.`);
}
await writeFile(join(OUTPUT,'streams.json'),JSON.stringify({version:1,sources,tracks:listed})+'\n');
console.log(`Packaged ${listed.length} ${PACKS.join(' and ')} tracks (${(listed.reduce((n,t)=>n+t.bytes,0)/1048576).toFixed(1)} MB).`);
