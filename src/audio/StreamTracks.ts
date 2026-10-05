/* The stream packs' tracks the browser has: the AMBIENCE, BEATS and AA packs, packaged from the iOS port's .osw packs
 * by scripts/content/package-stream-tracks.mjs into public/play/audio/streams/ as one MP3 per track. */
import type {TrackBeat} from '../engine/ScmCutsceneTrack';
export interface StreamTrackManifest {version:1;tracks:{id:number;path:string;bytes:number;sha256:string;beats:TrackBeat[]}[]}
const hex=(b:ArrayBuffer)=>[...new Uint8Array(b)].map(v=>v.toString(16).padStart(2,'0')).join('');
/** Fetches and decodes stream tracks by id, once each, with their beats (TRKHEAD.DAT's, packaged in the manifest).
 * A track that cannot be had loads as nothing. */
export class StreamTracks {
 private manifest?:Promise<StreamTrackManifest|undefined>;
 private tracks=new Map<number,Promise<{buffer:AudioBuffer;beats:readonly TrackBeat[]}|undefined>>();
 constructor(private base:string,private decode:(mp3:ArrayBuffer)=>Promise<AudioBuffer>,private fetcher:typeof fetch=(...a)=>fetch(...a)){}
 private readManifest(){
  return this.manifest??=this.fetcher(new URL('streams.json',this.base)).then(r=>r.ok?r.json():undefined)
   .then((m:StreamTrackManifest|undefined)=>m&&m.version===1&&Array.isArray(m.tracks)?m:undefined).catch(()=>undefined);
 }
 load(id:number):Promise<{buffer:AudioBuffer;beats:readonly TrackBeat[]}|undefined>{
  let pending=this.tracks.get(id);
  if(!pending){
   pending=this.readManifest().then(async manifest=>{
    const entry=manifest?.tracks.find(t=>t.id===id);
    if(!entry||entry.path!==`track-${id}.mp3`)return undefined;
    const r=await this.fetcher(new URL(entry.path,this.base));if(!r.ok)throw new Error(`Stream track ${id} unavailable.`);
    const bytes=await r.arrayBuffer();
    if(bytes.byteLength!==entry.bytes||hex(await crypto.subtle.digest('SHA-256',bytes))!==entry.sha256)throw new Error(`Stream track ${id} checksum mismatch.`);
    const beats=Array.isArray(entry.beats)?entry.beats:[];
    return {buffer:await this.decode(bytes),beats};
   }).catch(()=>{this.tracks.delete(id);return undefined;});
   this.tracks.set(id,pending);
  }
  return pending;
 }
 /** A track decoded without being kept, unless it already is: the radio's come and go, and the AA pack alone decodes
  * to some 80 MB. */
 loadOnce(id:number){
  const kept=this.tracks.get(id);if(kept)return kept;
  const pending=this.load(id);this.tracks.delete(id);return pending;
 }
}
