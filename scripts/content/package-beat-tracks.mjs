/** Packages the beat tracks (the BEATS stream pack) from the iOS port's bundle into public/play/audio/streams/.
 *
 * The PC's AUDIO/STREAMS are not in the published depot. The iOS port (the gta3sa.app bundle,
 * github.com/Google61/gta3sa.app) ships each stream pack as a ZIP of MP3s, Track_001.mp3 on: BEATS.osw holds the ten
 * tracks its TrakLkup.dat gives the pack (StrmPaks.dat's entry 4), global ids 175 to 184 in order. They are the
 * mission-passed tunes (182 and 183, which PLAY_MISSION_PASSED_TUNE reaches through gBeatTrackLookup) and the dance
 * and lowrider games' beat tracks. The bundle's Track_003 (177) is a 756-byte deflated stub rather than a stored MP3,
 * so it is left out.
 *
 * Each track becomes track-{id}.mp3; streams.json lists them with their hashes and their beats. The PC's stream files
 * put a tTrackInfo (gta-reversed AETrackLoader.h, 0x1F84 bytes) in front of each track: 1000 beats of a u32 time in
 * ms and a u32 key, the list ending at the first key below 1, then the track's own fields. The iOS port moved those
 * headers into TRKHEAD.DAT, one per track in TrakLkup.dat's order (1922 of them), which is where the beats come from:
 * the dance tracks' keys are the four arrows (1 to 4), the lowrider tracks' 9 to 16, and 33 ends a track's moves.
 *
 * Usage: node scripts/content/package-beat-tracks.mjs [directory holding BEATS.osw, TrakLkup.dat, StrmPaks.dat and
 * TRKHEAD.DAT]
 * Without a directory the files are downloaded from the bundle's pinned revision. Either way they are checked against
 * their hashes. */
import {readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
const REVISION='67f70cb72eb207aeca650ea9e8c10b0e7dda166a',BASE=`https://raw.githubusercontent.com/Google61/gta3sa.app/${REVISION}/`;
const SOURCES={
 pack:{name:'BEATS.osw',bytes:9733284,sha256:'27b0e6ff721a872ad719fab7def50247cb0d04b9bb108ec0aca334491b64b053'},
 tracks:{name:'TrakLkup.dat',bytes:23064,sha256:'adf22fcdfe798c7ad59f1b8fbf6a71574fbf06f1ca39a074ad2b3163c341c0d9'},
 packs:{name:'StrmPaks.dat',bytes:272,sha256:'03e32ee0efb3505d0cea13952370d24a417799b085946087c851060d4120dea0'},
 heads:{name:'TRKHEAD.DAT',bytes:15506696,sha256:'6474abc1c02ed8647caca1c107e0d067cce2715021f9420c009c0f763ad1c0e4'},
};
/** sizeof(tTrackInfo), and its beats. */
const TRACK_INFO_BYTES=0x1f84,BEATS_PER_TRACK=1000;
const OUTPUT='public/play/audio/streams',PACK='BEATS';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function source({name,bytes,sha256}){
 const data=process.argv[2]?await readFile(join(process.argv[2],name)):Buffer.from(await (await fetch(BASE+name,{signal:AbortSignal.timeout(300000)})).arrayBuffer());
 if(data.length!==bytes||hash(data)!==sha256)throw new Error(`${name} is not the pinned one.`);
 return data;
}
const pack=await source(SOURCES.pack),lookup=await source(SOURCES.tracks),packs=await source(SOURCES.packs),heads=await source(SOURCES.heads);
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
const packIndex=Array.from({length:packs.length/16},(_,i)=>packs.toString('latin1',i*16,i*16+16).replace(/\0.*$/s,'')).indexOf(PACK);
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
await rm(OUTPUT,{recursive:true,force:true});await mkdir(OUTPUT,{recursive:true});
const listed=[];
for(const [i,entry] of entries.entries()){
 if(entry.name!==`Track_${String(i+1).padStart(3,'0')}.mp3`)throw new Error(`Unexpected entry ${entry.name}.`);
 if(entry.method!==0)continue;
 if(entry.bytes[0]!==0xff||(entry.bytes[1]&0xe0)!==0xe0)throw new Error(`${entry.name} is not an MP3.`);
 const id=ids[i],path=`track-${id}.mp3`;
 await writeFile(join(OUTPUT,path),entry.bytes);
 listed.push({id,path,bytes:entry.bytes.length,sha256:hash(entry.bytes),beats:beatsOf(id)});
}
await writeFile(join(OUTPUT,'streams.json'),JSON.stringify({version:1,source:{url:BASE+SOURCES.pack.name,sha256:SOURCES.pack.sha256},tracks:listed})+'\n');
console.log(`Packaged ${listed.length} ${PACK} tracks (${(listed.reduce((n,t)=>n+t.bytes,0)/1048576).toFixed(1)} MB).`);
