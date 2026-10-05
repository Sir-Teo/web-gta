import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {BEAT_TRACK_LOOKUP,StreamTracks,missionPassedTrack} from '../src/audio/StreamTracks';

const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

describe('the beat tracks from the iOS port’s BEATS pack',()=>{
 test('the mission-passed tunes are beat tracks 11 and 12, the short tracks 183 and 182',()=>{
  expect(BEAT_TRACK_LOOKUP).toHaveLength(14);
  expect(missionPassedTrack(1)).toBe(183);
  expect(missionPassedTrack(2)).toBe(182);
  expect(missionPassedTrack(0)).toBeUndefined();
  expect(missionPassedTrack(3)).toBeUndefined();
 });

 test('the published tracks are the BEATS pack’s, each an MP3 matching its hash',()=>{
  const manifest=JSON.parse(readFileSync('public/play/audio/streams/streams.json','utf8'));
  const ids=manifest.tracks.map((t:{id:number})=>t.id);
  expect(ids).toEqual([175,176,178,179,180,181,182,183,184]);// 177 is a stub in the bundle
  for(const id of new Set(BEAT_TRACK_LOOKUP))if(id!==177)expect(ids).toContain(id);
  for(const track of manifest.tracks){
   const bytes=new Uint8Array(readFileSync(`public/play/audio/streams/${track.path}`));
   expect(bytes.length).toBe(track.bytes);expect(sha(bytes)).toBe(track.sha256);
   expect(bytes[0]).toBe(0xff);expect(bytes[1]&0xe0).toBe(0xe0);
  }
 });

 test('a track is fetched and decoded once, and a bad one loads as nothing',async()=>{
  const good=new Uint8Array([0xff,0xf3,1,2]),manifest={version:1,tracks:[{id:183,path:'track-183.mp3',bytes:4,sha256:sha(good)},{id:182,path:'track-182.mp3',bytes:4,sha256:'0'.repeat(64)}]};
  const fetched:string[]=[];
  const fetcher=(async(url:URL)=>{const name=String(url).split('/').pop()!;fetched.push(name);
   return name==='streams.json'?new Response(JSON.stringify(manifest)):new Response(good.slice());}) as typeof fetch;
  let decodes=0;
  const tracks=new StreamTracks('https://game.test/play/audio/streams/',async()=>{decodes++;return {duration:9.14} as AudioBuffer;},fetcher);
  expect((await tracks.load(183))?.duration).toBe(9.14);
  expect((await tracks.load(183))?.duration).toBe(9.14);
  expect(decodes).toBe(1);expect(fetched.filter(n=>n==='track-183.mp3')).toHaveLength(1);
  expect(await tracks.load(182)).toBeUndefined();
  expect(await tracks.load(177)).toBeUndefined();
 });
});
