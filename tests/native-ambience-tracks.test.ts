import {describe,expect,test} from 'vitest';
import {AMBIENCE_ZONE_TRACKS,NativeAmbienceTracks,RIOT_TRACK,SANDSTORM_TRACK,SEA_TRACK,type AmbienceChannel,type AmbienceRadio,type AmbienceWorld} from '../src/audio/NativeAmbienceTracks';
import {NativeAudioEnvironment} from '../src/audio/native/NativeSound';

function channel(){
 const calls:string[]=[];let played:number|undefined,volume=0,frequency=1;
 const c:AmbienceChannel={
  play:async(id,start)=>{calls.push(`play ${id} @${start}`);played=start;return true;},
  setVolume:dB=>{volume=dB;},setFrequency:f=>{frequency=f;},stop:()=>{calls.push('stop');played=undefined;},playedMs:()=>played,
 };
 return {c,calls,volume:()=>volume,frequency:()=>frequency,at:(ms:number)=>{played=ms;}};
}
const world=(over:Partial<AmbienceWorld>={}):AmbienceWorld=>({camera:[0,0,0],sandstorm:0,outside:true,held:false,nowMs:0,...over});
const settle=()=>new Promise(r=>setTimeout(r,0));
function radio(on=false){
 const calls:string[]=[];
 const r:AmbienceRadio&{on:boolean}={on,get radioOn(){return this.on;},stopRadioForAmbience(){calls.push('stop radio');this.on=false;},restartRadioAfterAmbience(){calls.push('restart radio');}};
 return {r,calls};
}
/** Serviced until the track is playing (the channel's play resolves between services). */
async function playing(m:NativeAmbienceTracks,w:AmbienceWorld){m.service(w);await settle();for(let i=0;i<3;i++)m.service(w);}

describe('CAEAmbienceTrackManager’s zone tracks',()=>{
 test('the zone table is the iOS port’s',()=>{
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

 test('leaving every zone stops the track at once; coming back resumes 7 s or more on from where it stopped',async()=>{
  const ch=channel(),r=radio(),m=new NativeAmbienceTracks(ch.c,()=>0),inside=world({zone:{id:21},radio:r.r});
  await playing(m,inside);for(let i=0;i<40;i++)m.service(inside);
  ch.at(50000);
  m.service(world({nowMs:1000,radio:r.r}));m.service(world({nowMs:1000,radio:r.r}));
  expect(m.active).toBe(false);expect(ch.calls.at(-1)).toBe('stop');
  // The vehicle's radio is asked back (it comes back only in a vehicle with one), each service until the track has
  // stopped.
  expect(r.calls).toEqual(['restart radio','restart radio']);
  m.service(world({zone:{id:21},nowMs:4000}));
  expect(ch.calls.at(-1)).toBe('play 135 @57000');// 50 s + max(3 s since the stop, 7 s)
 });

 test('another zone’s track replaces the playing one only once it has faded out',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  await playing(m,world({zone:{id:21}}));for(let i=0;i<40;i++)m.service(world({zone:{id:21}}));
  let n=0;for(;n<200&&m.trackId===135;n++)m.service(world({zone:{id:12}}));
  expect(n).toBeGreaterThan(80);// (-6 to -40) / 0.4 services of fade, then the stop
  expect(ch.calls).toContain('stop');expect(m.trackId).toBe(168);
 });

 test('zone 37’s track starts at the beginning',()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>.5);
  m.service(world({zone:{id:37}}));expect(ch.calls).toEqual(['play 144 @0']);
 });

 test('zone 4 quietens 9 dB a unit below 1372; the lowrider meet’s falls off from its centre',()=>{
  const m=new NativeAmbienceTracks(channel().c,()=>0);
  m.service(world({zone:{id:4},camera:[0,0,1371]}));expect(m.target).toBe(-15);
  const lowrider=new NativeAmbienceTracks(channel().c,()=>0);
  lowrider.service(world({zone:{id:13,center:[1792,-1921,12]},camera:[1792,-1871,12]}));
  expect(lowrider.trackId).toBe(157);expect(lowrider.target).toBe(NativeAudioEnvironment.distanceAttenuation(10)-6);
 });
});

describe('the sandstorm',()=>{
 test('outside and under the sky it plays at 20 log10 of its strength less 6 dB, and a held manager keeps its choice',()=>{
  const m=new NativeAmbienceTracks(channel().c,()=>0);
  m.service(world({sandstorm:.5,zone:{id:21}}));expect(m.trackId).toBe(SANDSTORM_TRACK);expect(m.target).toBeCloseTo(20*Math.log10(.5)-6);
  const held=new NativeAmbienceTracks(channel().c);held.service(world({zone:{id:21},held:true}));expect(held.active).toBe(false);
 });
 test('where it cannot be heard the zone plays instead, and the storm’s own track fades out',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  m.service(world({sandstorm:1,noRain:true,zone:{id:21}}));expect(m.trackId).toBe(135);
  const storm=new NativeAmbienceTracks(ch.c,()=>0);
  await playing(storm,world({sandstorm:1}));for(let i=0;i<30;i++)storm.service(world({sandstorm:1}));
  storm.service(world({sandstorm:1,outside:false}));expect(storm.volume).toBeCloseTo(-6.4);expect(storm.active).toBe(true);
 });
});

describe('the sea and the riots',()=>{
 const shore={water:{distance:3,height:0},camera:[0,0,4] as const};
 test('near water with waves the sea starts at -34 dB and steps a dB a service to its volume',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0),w=world(shore);
  await playing(m,w);expect(m.trackId).toBe(SEA_TRACK);
  for(let i=0;i<40;i++)m.service(w);
  // GetDistanceAttenuation(5 / 1.75) - 12: within 5 units it is 0 dB.
  expect(ch.volume()).toBe(-12);expect(ch.frequency()).toBe(1);
  // Further off it steps back down.
  const off=world({water:{distance:12,height:0},camera:[0,0,4]});
  m.service(off);expect(ch.volume()).toBe(-13);
 });
 test('under water it plays at 14 dB and a sixteenth of its speed, easing back a quarter a service on surfacing',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0),under=world({...shore,underwaterness:1});
  await playing(m,under);expect(ch.frequency()).toBe(.0625);
  m.service(world(shore));expect(m.frequency).toBe(.3125);
  m.service(world(shore));m.service(world(shore));m.service(world(shore));expect(m.frequency).toBe(1);
 });
 test('out of earshot it is silenced, and stopped once well out of it',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  await playing(m,world(shore));
  // 26 units off: GetDistanceAttenuation(26 / 1.75) - 12 is between -40 and -34.
  m.service(world({water:{distance:26,height:0},camera:[0,0,0]}));expect(m.volume).toBe(-100);expect(m.active).toBe(true);
  m.service(world({water:{distance:60,height:0},camera:[0,0,0]}));m.service(world());expect(m.active).toBe(false);
 });
 test('it waits for the radio to be off and for the iOS port’s cutscene hold, which also holds any start',async()=>{
  const ch=channel(),r=radio(true),m=new NativeAmbienceTracks(ch.c,()=>0);
  m.service(world({...shore,radio:r.r}));expect(m.active).toBe(false);
  m.service(world({...shore,trackHold:true}));expect(m.active).toBe(false);
  const zone=new NativeAmbienceTracks(ch.c,()=>0);
  zone.service(world({zone:{id:21},trackHold:true}));zone.service(world({zone:{id:21},trackHold:true}));
  expect(zone.active).toBe(true);expect(ch.calls).toEqual([]);
  zone.service(world({zone:{id:21}}));expect(ch.calls).toEqual(['play 135 @0']);
 });
 test('the riots play outdoors where they are on, rising to -12 dB',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0),w=world({riots:true});
  await playing(m,w);expect(m.trackId).toBe(RIOT_TRACK);
  for(let i=0;i<40;i++)m.service(w);expect(ch.volume()).toBe(-12);
  const inside=new NativeAmbienceTracks(channel().c,()=>0);inside.service(world({riots:true,outside:false}));expect(inside.active).toBe(false);
 });
});

describe('the ambience and the radio',()=>{
 test('with the radio on no track starts, but one that overrides the radio turns it off and plays',()=>{
  const ch=channel(),r=radio(true),m=new NativeAmbienceTracks(ch.c,()=>0);
  m.service(world({zone:{id:21},radio:r.r}));expect(m.active).toBe(false);expect(r.calls).toEqual([]);
  m.service(world({zone:{id:41},radio:r.r}));expect(r.calls).toEqual(['stop radio']);expect(m.active).toBe(false);
  m.service(world({zone:{id:41},radio:r.r}));expect(m.trackId).toBe(169);expect(m.overrideRadio).toBe(true);
 });
 test('a radio station’s zone stops the ambience track, as the station starting would',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>0);
  await playing(m,world({zone:{id:21}}));
  m.service(world({zone:{id:58}}));m.service(world({zone:{id:58}}));expect(m.active).toBe(false);
 });
 test('StopAmbienceTrack lets go of the radio override',async()=>{
  const m=new NativeAmbienceTracks(channel().c,()=>0);
  m.service(world({zone:{id:13}}));expect(m.overrideRadio).toBe(true);
  m.stop();expect(m.overrideRadio).toBe(false);
 });
});

describe('a mission’s own ambience track (PlaySpecialMissionAmbienceTrack, as the iOS executable plays it)',()=>{
 test('it takes the zone’s place, from the beginning at -2 dB with no rise, and the stop ends it',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>.5),inside=world({zone:{id:21}});
  m.playSpecialMissionAmbienceTrack(153);
  await playing(m,inside);
  expect(ch.calls).toEqual(['play 153 @0']);expect(ch.volume()).toBe(-2);
  for(let i=0;i<10;i++)m.service(inside);expect(ch.volume()).toBe(-2);
  m.stopSpecialMissionAmbienceTrack();m.service(world());m.service(world());
  expect(ch.calls.at(-1)).toBe('stop');expect(m.active).toBe(false);expect(m.specialMissionTrack).toBe(-1);
 });
 test('a zone track playing fades out first; a radio that is on is turned off for it',async()=>{
  const ch=channel(),m=new NativeAmbienceTracks(ch.c,()=>.5),inside=world({zone:{id:21}});
  await playing(m,inside);for(let i=0;i<40;i++)m.service(inside);
  m.playSpecialMissionAmbienceTrack(150);
  for(let i=0;i<120&&!ch.calls.includes('play 150 @0');i++){m.service(inside);await settle();}
  expect(ch.calls).toEqual(['play 135 @300000','stop','play 150 @0']);
  const {r,calls}=radio(true),m2=new NativeAmbienceTracks(channel().c,()=>.5);
  m2.playSpecialMissionAmbienceTrack(141);m2.service(world({radio:r}));
  expect(calls).toEqual(['stop radio']);
 });
});
