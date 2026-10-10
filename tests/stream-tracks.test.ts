import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {StreamTracks} from '../src/audio/StreamTracks';
import {BEAT_TRACK_LOOKUP} from '../src/engine/ScmCutsceneTrack';

const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

describe('the stream tracks from the iOS port’s AMBIENCE, BEATS and AA packs',()=>{
 test('the mission-passed tunes are beat tracks 11 and 12, the short tracks 183 and 182',()=>{
  expect(BEAT_TRACK_LOOKUP).toHaveLength(14);
  expect(BEAT_TRACK_LOOKUP[11]).toBe(183);
  expect(BEAT_TRACK_LOOKUP[12]).toBe(182);
 });

 test('the published tracks are the AMBIENCE, BEATS and AA packs’ and the published cutscenes’, each an MP3 matching its hash',()=>{
  const manifest=JSON.parse(readFileSync('public/play/audio/streams/streams.json','utf8'));
  const ids=manifest.tracks.map((t:{id:number})=>t.id);
  // AMBIENCE's 135 to 174, then BEATS' 175 to 184 but 177, a stub in the bundle, then AA's 0 to 65 (the emergency
  // channel), then the published cutscenes' tracks of the CUTSCENE pack in order, each once (the dates share two).
  const cutscenes=JSON.parse(readFileSync('public/play/cuts/manifest.json','utf8')) as {cutscenes:Record<string,{track:number}>};
  const voices=[...new Set(Object.values(cutscenes.cutscenes).map(c=>c.track))].sort((a,b)=>a-b);
  expect(voices).toHaveLength(137);expect(voices[0]).toBe(626);expect(voices.at(-1)).toBe(766);
  expect(ids).toEqual([...Array.from({length:40},(_,i)=>135+i),175,176,178,179,180,181,182,183,184,...Array.from({length:66},(_,i)=>i),...voices]);
  for(const id of new Set(BEAT_TRACK_LOOKUP))if(id!==177)expect(ids).toContain(id);
  for(const track of manifest.tracks){
   const bytes=new Uint8Array(readFileSync(`public/play/audio/streams/${track.path}`));
   expect(bytes.length).toBe(track.bytes);expect(sha(bytes)).toBe(track.sha256);
   expect(bytes[0]).toBe(0xff);expect(bytes[1]&0xe0).toBe(0xe0);
  }
  // TRKHEAD.DAT's beats: the dance tracks' arrows (1 to 4) and the lowrider tracks' moves (9 to 16), each ending on 33,
  // in time order; the passed tunes have none.
  const beats=new Map<number,[number,number][]>(manifest.tracks.map((t:{id:number;beats:[number,number][]})=>[t.id,t.beats]));
  expect(beats.get(175)).toHaveLength(174);expect(beats.get(175)![0]).toEqual([18328,4]);
  expect(beats.get(180)![0]).toEqual([4375,10]);
  for(const id of [175,178,179,180,181]){
   const list=beats.get(id)!;expect(list.at(-1)![1]).toBe(33);
   for(let i=1;i<list.length;i++)expect(list[i][0]).toBeGreaterThanOrEqual(list[i-1][0]);
  }
  expect(beats.get(183)).toEqual([]);
 });

 test('a track is fetched and decoded once, and a bad one loads as nothing',async()=>{
  const good=new Uint8Array([0xff,0xf3,1,2]),manifest={version:1,tracks:[{id:183,path:'track-183.mp3',bytes:4,sha256:sha(good),beats:[[500,1]]},{id:182,path:'track-182.mp3',bytes:4,sha256:'0'.repeat(64),beats:[]}]};
  const fetched:string[]=[];
  const fetcher=(async(url:URL)=>{const name=String(url).split('/').pop()!;fetched.push(name);
   return name==='streams.json'?new Response(JSON.stringify(manifest)):new Response(good.slice());}) as typeof fetch;
  let decodes=0;
  const tracks=new StreamTracks('https://game.test/play/audio/streams/',async()=>{decodes++;return {duration:9.14} as AudioBuffer;},fetcher);
  expect((await tracks.load(183))?.buffer.duration).toBe(9.14);
  expect((await tracks.load(183))?.beats).toEqual([[500,1]]);
  expect(decodes).toBe(1);expect(fetched.filter(n=>n==='track-183.mp3')).toHaveLength(1);
  expect(await tracks.load(182)).toBeUndefined();
  expect(await tracks.load(177)).toBeUndefined();
 });

 test('the radio’s tracks are decoded each time and not kept, unless one already is',async()=>{
  const good=new Uint8Array([0xff,0xf3,1,2]),manifest={version:1,tracks:[{id:5,path:'track-5.mp3',bytes:4,sha256:sha(good),beats:[]},{id:183,path:'track-183.mp3',bytes:4,sha256:sha(good),beats:[]}]};
  const fetcher=(async(url:URL)=>String(url).endsWith('streams.json')?new Response(JSON.stringify(manifest)):new Response(good.slice())) as typeof fetch;
  let decodes=0;
  const tracks=new StreamTracks('https://game.test/play/audio/streams/',async()=>{decodes++;return {duration:1.6} as AudioBuffer;},fetcher);
  await tracks.loadOnce(5);await tracks.loadOnce(5);expect(decodes).toBe(2);
  await tracks.load(183);await tracks.loadOnce(183);expect(decodes).toBe(3);
 });
});
