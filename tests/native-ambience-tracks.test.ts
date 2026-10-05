import {describe,expect,test} from 'vitest';
import {AMBIENCE_ZONE_TRACKS,NativeAmbienceTracks,SANDSTORM_TRACK,type AmbienceChannel,type AmbienceWorld} from '../src/audio/NativeAmbienceTracks';

function channel(){
 const calls:string[]=[];let played:number|undefined,volume=0;
 const c:AmbienceChannel={
  play:async(id,start)=>{calls.push(`play ${id} @${start}`);played=start;return true;},
  setVolume:dB=>{volume=dB;},stop:()=>{calls.push('stop');played=undefined;},playedMs:()=>played,
 };
 return {c,calls,volume:()=>volume,at:(ms:number)=>{played=ms;}};
}
const world=(over:Partial<AmbienceWorld>={}):AmbienceWorld=>({camera:[0,0,0],sandstorm:0,outside:true,held:false,nowMs:0,...over});
const settle=()=>new Promise(r=>setTimeout(r,0));

describe('CAEAmbienceTrackManager’s zone tracks',()=>{
 test('the zone table is the reversal’s',()=>{
  expect(AMBIENCE_ZONE_TRACKS[21]).toBe(135);expect(AMBIENCE_ZONE_TRACKS[13]).toBe(157);
  expect(AMBIENCE_ZONE_TRACKS[28]).toBe(147);expect(AMBIENCE_ZONE_TRACKS[29]).toBe(147);
  expect(AMBIENCE_ZONE_TRACKS[30]).toBeUndefined();// a radio station's zone
  for(const track of Object.values(AMBIENCE_ZONE_TRACKS)){expect(track).toBeGreaterThanOrEqual(135);expect(track).toBeLessThanOrEqual(174);}
 });

 test('entering a zone starts its track at -34 dB, rising a dB a service to -6, at a random point the first time',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>.5),inside=world({zone:{id:21}});
  m.service(inside);expect(ch.calls).toEqual(['play 135 @300000']);
  await settle();m.service(inside);m.service(inside);
  expect(ch.volume()).toBeCloseTo(-32);// started at -34, risen twice as it came up
  for(let i=0;i<40;i++)m.service(inside);
  expect(ch.volume()).toBe(-6);
 });

 test('leaving fades 0.4 dB a service to -40 and stops; coming back resumes 7 s or more on from where it stopped',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0),inside=world({zone:{id:21}});
  m.service(inside);await settle();for(let i=0;i<40;i++)m.service(inside);
  ch.at(50000);
  let n=0;while(m.active&&n<200){m.service(world({nowMs:1000}));n++;}
  expect(n).toBeGreaterThan(80);// (-6 to -40) / 0.4 services of fade, then the stop
  expect(ch.calls.at(-1)).toBe('stop');
  m.service(world({zone:{id:21},nowMs:4000}));
  expect(ch.calls.at(-1)).toBe('play 135 @57000');// 50 s + max(3 s since the stop, 7 s)
 });

 test('another zone’s track replaces the playing one only once it has faded out',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  m.service(world({zone:{id:21}}));await settle();for(let i=0;i<40;i++)m.service(world({zone:{id:21}}));
  for(let i=0;i<200&&m.trackId===135;i++)m.service(world({zone:{id:13}}));
  expect(ch.calls).toContain('stop');expect(m.trackId).toBe(157);
 });

 test('the sandstorm plays its own track outside, and a held manager keeps its choice',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  m.service(world({sandstorm:1,zone:{id:21}}));expect(m.trackId).toBe(SANDSTORM_TRACK);
  const held=new NativeAmbienceTracks(channel().c);held.service(world({zone:{id:21},held:true}));expect(held.active).toBe(false);
 });

 test('zone 4 quietens 9 dB a unit below 1372',()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  m.service(world({zone:{id:4},camera:[0,0,1371]}));expect(m.target).toBe(-15);
 });
});
