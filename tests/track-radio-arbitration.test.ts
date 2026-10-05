import {describe,expect,test} from 'vitest';
import {ScmCutsceneTrack,type BeatTrackStream} from '../src/engine/ScmCutsceneTrack';
import {NativeAudioEngine} from '../src/audio/native/NativeAudioEngine';
import {NativeRadioTrackManager,RADIO_MODE} from '../src/audio/native/NativeRadioTrackManager';
import {RADIO_ID} from '../src/audio/native/vehicleRadio';
import {NativeAmbienceTracks,type AmbienceChannel} from '../src/audio/NativeAmbienceTracks';

/** The original's one stream carries the radio, the ambience and the beat and cutscene tracks: CAudioEngine gives
 * the stream to a track (PreloadBeatTrack), holds the radio back while one is loaded (GetBeatTrackStatus) and brings
 * the radio back after it (StopCutsceneTrack's wait, and Service once the mission-complete track has stopped). */
const settle=()=>new Promise(r=>setTimeout(r,0));
function hooks(){const calls:string[]=[];return {calls,audio:{stopForTrack:()=>{calls.push('stop for track');},radioAfterTrack:(kept:boolean)=>{calls.push(`radio after track ${kept}`);}}};}
function stream(lengthMs:number){
 let played:number|undefined;
 const s:BeatTrackStream={load:async()=>({beats:[],lengthMs}),play:()=>{played=0;},pause:()=>{},stop:()=>{played=undefined;},playedMs:()=>played};
 return {s,at:(ms:number)=>{played=ms;}};
}
/** An engine without its constructor (as tests/radio-speech.test.ts makes one), with the radio's state. */
function engine(){
 const e:any=Object.create(NativeAudioEngine.prototype);
 Object.assign(e,{radioId:RADIO_ID.off,requestedRadioId:RADIO_ID.off,radioTracks:new NativeRadioTrackManager(()=>0),radioClock:{days:1,month:1,hours:12},timeMs:0,trackRadioStationId:-1,radioHeld:false});
 return e as NativeAudioEngine&{radioTracks:NativeRadioTrackManager};
}

describe('CAudioEngine round the beat tracks',()=>{
 test('a preload first takes the stream from the radio or the ambience',()=>{
  const t=new ScmCutsceneTrack(),h=hooks();t.audio=h.audio;
  t.preloadBeatTrack(11);expect(h.calls).toEqual(['stop for track']);
 });
 test('on the iOS port a preload also holds the ambience',()=>{
  const t=new ScmCutsceneTrack(),calls:string[]=[];
  t.audio={stopForTrack:()=>{calls.push('stop for track');},radioAfterTrack:()=>{},holdAmbience:()=>{calls.push('hold ambience');}};
  t.preloadBeatTrack(11);expect(calls).toEqual(['stop for track','hold ambience']);
 });
 test('the mission-complete track brings the radio back once it has stopped, with the vehicle’s settings',async()=>{
  const t=new ScmCutsceneTrack(),h=hooks(),host=stream(4000);t.audio=h.audio;t.stream=host.s;
  t.preloadBeatTrack(11);t.service(20);await settle();t.service(20);t.play(true);t.service(20);
  expect(t.missionComplete).toBe(true);
  host.at(2000);t.service(20);expect(h.calls).toEqual(['stop for track']);
  host.at(4000);t.service(20);t.service(20);
  expect(h.calls).toEqual(['stop for track','radio after track false']);expect(t.missionComplete).toBe(false);
 });
 test('any other track brings it back only when the script stops it, to the station it kept',async()=>{
  const t=new ScmCutsceneTrack(),h=hooks(),host=stream(4000);t.audio=h.audio;t.stream=host.s;
  t.preloadBeatTrack(1);t.service(20);await settle();t.service(20);t.play();t.service(20);
  host.at(4000);t.service(20);t.service(20);expect(h.calls).toEqual(['stop for track']);
  t.stop();expect(h.calls).toEqual(['stop for track','radio after track true']);
 });
});

describe('the radio and the beat tracks',()=>{
 test('a station stops for a track, keeps its name hidden, and comes back on the station it played',()=>{
  const e=engine(),names:string[]=[];e.onRadioName=label=>names.push(label);
  expect(e.startRadio(400,0,12,1)).toBe(true);expect(e.radioId).toBe(8);
  e.tuneRadio(1);expect(e.radioId).toBe(9);
  expect(e.stopRadioForTrack()).toBe(true);expect(e.radioId).toBe(RADIO_ID.off);expect(e.radioLabel).toBeUndefined();
  // No retune, the player's or the script's, while the radio is off for the track.
  e.beatTrackStatus=()=>3;expect(e.tuneRadio(1)).toBeUndefined();e.retuneRadio(4);expect(e.radioId).toBe(RADIO_ID.off);
  e.beatTrackStatus=()=>0;e.restartRadioAfterTrack(true);
  expect(e.radioId).toBe(9);expect(names).toEqual(['K-Jah West']);
 });
 test('getting in while a track holds the stream: no radio until it is done, then the vehicle’s own',()=>{
  const e=engine(),names:string[]=[];e.onRadioName=label=>names.push(label);
  e.beatTrackStatus=()=>3;
  expect(e.startRadio(400,0,12,1)).toBe(true);expect(e.radioId).toBe(RADIO_ID.off);expect(e.radioLabel).toBeUndefined();
  e.beatTrackStatus=()=>0;e.restartRadioAfterTrack(false);
  expect(e.radioId).toBe(8);expect(names).toEqual(['CSR 103.9']);
 });
 test('the emergency channel stops for the track and starts again after it; on foot nothing comes back',()=>{
  const e=engine();
  e.startRadio(596,0,12,1);expect(e.radioTracks.initialised).toBe(true);
  // Serviced to playing, then given up for the track.
  expect(e.stopRadioForTrack()).toBe(true);expect(e.radioTracks.initialised).toBe(false);
  e.restartRadioAfterTrack(false);expect(e.radioId).toBe(RADIO_ID.emergency);expect(e.radioTracks.requested.stationId).toBe(0);expect(e.radioTracks.initialised).toBe(true);
  e.stopRadio(0,12,1);e.radioTracks.mode=RADIO_MODE.stopped;e.radioTracks.initialised=false;
  expect(e.stopRadioForTrack()).toBe(false);
  e.restartRadioAfterTrack(true);expect(e.radioId).toBe(RADIO_ID.off);expect(e.radioTracks.initialised).toBe(false);
 });
});

describe('the ambience gives the stream up',()=>{
 test('StopAmbienceTrack(true) stops it at once and keeps where it had got to',async()=>{
  const calls:string[]=[];let played:number|undefined;
  const c:AmbienceChannel={play:async(id,start)=>{calls.push(`play ${id} @${start}`);played=start;return true;},setVolume:()=>{},setFrequency:()=>{},stop:()=>{calls.push('stop');played=undefined;},playedMs:()=>played};
  const m=new NativeAmbienceTracks(c,()=>0),inside={zone:{id:21},camera:[0,0,0] as const,sandstorm:0,outside:true,held:false,nowMs:0};
  m.service(inside);await settle();for(let i=0;i<5;i++)m.service(inside);
  played=12000;m.stopNow(1000);
  expect(m.active).toBe(false);expect(calls.at(-1)).toBe('stop');
  // Held while the track plays; after it, back 7 s or more on from where it stopped.
  m.service({...inside,held:true,nowMs:2000});expect(m.active).toBe(false);
  m.service({...inside,nowMs:3000});expect(calls.at(-1)).toBe('play 135 @19000');
 });
});

describe('the radio and the ambience track, which share the original’s stream',()=>{
 function ambience(overrideRadio:boolean){
  const a={active:true,overrideRadio,stops:0,stop(){this.stops++;this.active=false;}};return a;
 }
 test('a vehicle’s radio stops an ambience track that plays, and does not start under one that overrides it',()=>{
  const e=engine(),sea=ambience(false);e.ambience=sea;
  expect(e.startRadio(400,0,12,1)).toBe(true);expect(sea.stops).toBe(1);expect(e.radioId).toBe(8);
  e.stopRadio(0,12,1);
  const stadium=ambience(true);e.ambience=stadium;
  expect(e.startRadio(400,0,12,1)).toBe(true);expect(stadium.stops).toBe(0);
  expect(e.radioId).toBe(RADIO_ID.off);expect(e.radioOn).toBe(false);expect(e.radioLabel).toBeUndefined();
  // Nor does a retune start a station under it.
  expect(e.tuneRadio(1)).toBeUndefined();e.retuneRadio(4);expect(e.radioId).toBe(RADIO_ID.off);
 });
 test('a track that overrides the radio turns it off; once it stops the station last asked for comes back',()=>{
  const e=engine(),names:string[]=[];e.onRadioName=label=>names.push(label);
  e.startRadio(400,0,12,1);e.tuneRadio(1);expect(e.radioId).toBe(9);expect(e.radioOn).toBe(true);
  e.stopRadioForAmbience();expect(e.radioOn).toBe(false);expect(e.radioLabel).toBeUndefined();
  e.restartRadioAfterAmbience();expect(e.radioId).toBe(9);expect(names).toEqual(['K-Jah West']);
 });
 test('on foot nothing comes back; with the radio last tuned off it comes back off, its name shown',()=>{
  const e=engine(),names:string[]=[];e.onRadioName=label=>names.push(label);
  e.restartRadioAfterAmbience();expect(e.radioId).toBe(RADIO_ID.off);expect(names).toEqual([]);
  e.startRadio(400,0,12,1);for(let i=0;i<4;i++)e.tuneRadio(1);expect(e.radioId).toBe(RADIO_ID.off);
  e.restartRadioAfterAmbience();expect(e.radioId).toBe(RADIO_ID.off);expect(names).toEqual(['Radio Off']);
 });
 test('the emergency channel stops for the track and starts again after it',()=>{
  const e=engine();
  e.startRadio(596,0,12,1);expect(e.radioTracks.initialised).toBe(true);
  e.stopRadioForAmbience();expect(e.radioTracks.initialised).toBe(false);expect(e.radioId).toBe(RADIO_ID.off);
  e.radioTracks.mode=RADIO_MODE.stopped;expect(e.radioOn).toBe(false);
  e.restartRadioAfterAmbience();expect(e.radioId).toBe(RADIO_ID.emergency);expect(e.radioTracks.requested.stationId).toBe(0);
 });
});
