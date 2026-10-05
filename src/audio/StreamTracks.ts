/* The stream packs' tracks the browser has: the BEATS pack, packaged from the iOS port's BEATS.osw by
 * scripts/content/package-beat-tracks.mjs into public/play/audio/streams/ as one MP3 per track. */
/** gBeatTrackLookup (0x8AE538), read from the iOS port's executable: a beat track's number to its stream track. */
export const BEAT_TRACK_LOOKUP:readonly number[]=[180,175,178,179,178,175,175,175,175,176,184,183,182,181];
/** PLAY_MISSION_PASSED_TUNE's handler (the iOS port's, unreversed on the PC): tunes 1 and 2 preload beat track
 * 10 + n and play it as the mission-complete track; any other number does nothing. */
export function missionPassedTrack(tune:number){return tune===1||tune===2?BEAT_TRACK_LOOKUP[10+tune]:undefined;}
export interface StreamTrackManifest {version:1;tracks:{id:number;path:string;bytes:number;sha256:string}[]}
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
/** Fetches and decodes stream tracks by id, once each. A track that cannot be had loads as nothing. */
export class StreamTracks {
 private manifest?:Promise<StreamTrackManifest|undefined>;
 private tracks=new Map<number,Promise<AudioBuffer|undefined>>();
 constructor(private base:string,private decode:(mp3:ArrayBuffer)=>Promise<AudioBuffer>,private fetcher:typeof fetch=(...a)=>fetch(...a)){}
 private readManifest(){
  return this.manifest??=this.fetcher(new URL('streams.json',this.base)).then(r=>r.ok?r.json():undefined)
   .then((m:StreamTrackManifest|undefined)=>m&&m.version===1&&Array.isArray(m.tracks)?m:undefined).catch(()=>undefined);
 }
 load(id:number):Promise<AudioBuffer|undefined>{
  let pending=this.tracks.get(id);
  if(!pending){
   pending=this.readManifest().then(async manifest=>{
    const entry=manifest?.tracks.find(t=>t.id===id);
    if(!entry||entry.path!==`track-${id}.mp3`)return undefined;
    const r=await this.fetcher(new URL(entry.path,this.base));if(!r.ok)throw new Error(`Stream track ${id} unavailable.`);
    const bytes=await r.arrayBuffer();
    if(bytes.byteLength!==entry.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==entry.sha256)throw new Error(`Stream track ${id} checksum mismatch.`);
    return this.decode(bytes);
   }).catch(()=>{this.tracks.delete(id);return undefined;});
   this.tracks.set(id,pending);
  }
  return pending;
 }
}
