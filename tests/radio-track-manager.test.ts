import {describe,expect,test} from 'vitest';
import {NativeRadioTrackManager,RADIO_MODE,TRACK_TYPE,isTrackBanned,type RadioTrackHardware,type RadioWorld} from '../src/audio/native/NativeRadioTrackManager';
import {EMERGENCY_DJ_BANTER,RADIO_ADVERTS,RADIO_INTROS,RADIO_MUSIC_TRACKS,RADIO_OUTROS} from '../src/audio/native/radioTables';
import {vehicleRadioSettings} from '../src/audio/native/vehicleRadio';

/** A stream that readies a track at once and moves on to the next when one ends, as CAEStreamThread does. */
class FakeStream implements RadioTrackHardware {
 state=-6;active=-1;next=-1;time=0;volume=0;requests:[number,number,number][]=[];played:number[]=[];
 constructor(private length=(id:number)=>id<60?6000:1600,private fails=new Set<number>()){}
 playTrack(track:number,next:number,startMs:number){
  this.requests.push([track,next,startMs]);
  if(this.state===-1&&this.active===track){this.next=next;return;}
  if(this.fails.has(track)&&(next<0||this.fails.has(next))){this.state=-8;this.active=next>=0?next:track;return;}
  this.active=track;this.next=next;this.time=startMs%this.length(track);this.state=-2;
 }
 startTrackPlayback(){this.state=-1;this.played.push(this.active);}
 stopTrack(){this.state=-6;}
 trackPlayTime(){return this.state===-1?this.time:this.state;}
 trackLengthMs(){return this.active<0?-1:this.length(this.active);}
 activeTrackId(){return this.state===-8?this.active:this.active;}
 playingTrackId(){return this.state===-1||this.state===-8?this.active:-1;}
 setChannelVolume(dB:number){this.volume=dB;}
 setFrequencyScalingFactor(){}
 advance(ms:number){
  if(this.state!==-1)return;
  this.time+=ms;
  if(this.time<this.length(this.active))return;
  if(this.next>=0){this.time-=this.length(this.active);this.active=this.next;this.next=-1;this.played.push(this.active);}
  else this.state=-6;
 }
}
/** A random sequence (each value used once, then the last again), for ResolveProbability and GetRandomNumberInRange. */
const sequence=(...values:number[])=>{let i=0;return ()=>values[Math.min(i++,values.length-1)];};
const world=(over:Partial<RadioWorld>={}):RadioWorld=>({timeMs:0,pauseTimeMs:0,paused:false,clock:{days:1,month:1,hours:12},widescreen:false,slowMotion:false,
 effectsLevel:1,musicLevel:1,dialogue:false,ambienceRadio:false,laRiotsHere:false,vehicleRadioType:3,...over});
const EMERGENCY=0;

describe('the iOS port’s radio tables',()=>{
 test('the emergency channel: two bursts of static, each with an intro and an outro, and the dispatcher',()=>{
  expect(RADIO_MUSIC_TRACKS[EMERGENCY]).toEqual([60,63]);
  expect(RADIO_INTROS[EMERGENCY]).toEqual([[61,61],[64,64]]);expect(RADIO_OUTROS[EMERGENCY]).toEqual([[62,62],[65,65]]);
  expect(EMERGENCY_DJ_BANTER).toEqual({general:[0,38],riots:[39,59]});expect(RADIO_ADVERTS).toEqual([66,134]);
 });
 test('the tracks the iOS port removed are runs IsTrackBanned tests',()=>{
  expect(isTrackBanned(294)).toBe(true);expect(isTrackBanned(300)).toBe(true);expect(isTrackBanned(301)).toBe(false);expect(isTrackBanned(293)).toBe(false);
  expect(isTrackBanned(1314)).toBe(true);expect(isTrackBanned(1315)).toBe(false);expect([...Array(66).keys()].some(isTrackBanned)).toBe(false);
 });
 test('an emergency vehicle starts the emergency channel; the police bike cuts the bass',()=>{
  expect(vehicleRadioSettings(596)).toEqual({station:13,type:3,bass:0});expect(vehicleRadioSettings(523)).toMatchObject({type:3,bass:1});
 });
});

describe('CAERadioTrackManager on the emergency channel',()=>{
 test('ChooseTracksForStation: nine times in ten and more, a music track and its outro, from a random point up to 5 minutes in',()=>{
  const radio=new NativeRadioTrackManager(sequence(0));
  radio.startRadio(EMERGENCY,0,0,false,world());
  expect(radio.requested.trackQueue).toEqual([60,62,-1,-1,-1]);
  expect(radio.requested.trackTypes).toEqual([TRACK_TYPE.track,TRACK_TYPE.outro,6,6,6]);
  expect(radio.requested.playTime).toBe(0);
  expect(radio.initialised).toBe(true);
 });
 test('one time in twenty, the dispatcher first and then an intro, its burst and its outro',()=>{
  // ResolveProbability(0.95) fails; the dispatcher's line comes from a random point of lines 0 to 38.
  const radio=new NativeRadioTrackManager(sequence(.99,.5,0));
  radio.startRadio(EMERGENCY,0,0,false,world());
  const q=radio.requested.trackQueue;
  expect(q[0]).toBeGreaterThanOrEqual(0);expect(q[0]).toBeLessThanOrEqual(38);
  expect(q.slice(1)).toEqual([61,60,62,-1]);
  expect(radio.requested.trackTypes).toEqual([TRACK_TYPE.djBanter,TRACK_TYPE.intro,TRACK_TYPE.track,TRACK_TYPE.outro,6]);
 });
 test('while the riots are on where the player is, the dispatcher talks of them',()=>{
  const radio=new NativeRadioTrackManager(sequence(.99,.5,0));
  radio.startRadio(EMERGENCY,0,0,false,world({laRiotsHere:true}));
  expect(radio.requested.trackQueue[0]).toBeGreaterThanOrEqual(39);expect(radio.requested.trackQueue[0]).toBeLessThanOrEqual(59);
 });
 test('Service: it waits for the stream to ready the track, plays it, and moves along the queue as the stream moves on',()=>{
  const stream=new FakeStream(),radio=new NativeRadioTrackManager(sequence(0));radio.hardware=stream;
  radio.startRadio(EMERGENCY,0,0,false,world());
  radio.service(world());expect(radio.mode).toBe(RADIO_MODE.waitingToPlay);expect(stream.requests[0]).toEqual([60,62,0]);
  radio.service(world());expect(radio.mode).toBe(RADIO_MODE.playing);expect(stream.played).toEqual([60]);
  // The burst ends and its outro plays: the queue moves up and the dispatcher follows the outro.
  for(let t=0;t<30;t++){stream.advance(1000/30*3);radio.service(world());}
  expect(stream.played.slice(0,2)).toEqual([60,62]);
  expect(radio.active.trackTypes[0]).toBe(TRACK_TYPE.outro);expect(radio.active.trackTypes[1]).toBe(TRACK_TYPE.djBanter);
  // After the dispatcher an intro, its burst and its outro.
  for(let t=0;t<120;t++){stream.advance(1000/30*3);radio.service(world());}
  const types=stream.played.map(id=>id<60?'line':id===60||id===63?'burst':id===61||id===64?'intro':'outro');
  expect(types.slice(0,6)).toEqual(['burst','outro','line','intro','burst','outro']);
  expect(radio.snapshot().banter.length).toBeGreaterThan(0);
 });
 test('UpdateRadioVolumes: -4 dB, -16 in the widescreen bars, 9 dB lower under dialogue and back a fiftieth at a time',()=>{
  const stream=new FakeStream(),radio=new NativeRadioTrackManager(sequence(0));radio.hardware=stream;
  radio.startRadio(EMERGENCY,0,0,false,world());radio.service(world());
  expect(stream.volume).toBe(-4);
  radio.service(world({widescreen:true}));expect(stream.volume).toBe(-16);
  radio.service(world({dialogue:true}));expect(stream.volume).toBeCloseTo(-13,5);
  // A fiftieth of the duck back each time the volume is set, which a playing radio's service does twice.
  radio.service(world());expect(stream.volume).toBeCloseTo(-13+.18*2,5);
  for(let i=0;i<60;i++)radio.service(world());
  expect(stream.volume).toBe(-4);
  // The police bike's cut bass takes 2 dB off.
  const bike=new NativeRadioTrackManager(sequence(0)),bikeStream=new FakeStream();bike.hardware=bikeStream;
  // (Service sets the volume before m_ActiveSettings takes the request, so from its second call on.)
  bike.startRadio(EMERGENCY,1,0,false,world());bike.service(world());expect(bikeStream.volume).toBe(-4);
  bike.service(world());expect(bikeStream.volume).toBe(-6);
 });
 test('StopRadio keeps the place, and TrackRadioStation goes on from it a little later',()=>{
  const stream=new FakeStream(),radio=new NativeRadioTrackManager(sequence(0));radio.hardware=stream;
  radio.startRadio(EMERGENCY,0,0,false,world());radio.service(world());radio.service(world());
  stream.advance(1000);radio.service(world());
  expect(radio.active.currTrackId).toBe(60);
  const settings={radioStation:0,bassSetting:0};
  radio.stopRadio(settings,false,world({timeMs:1000}));
  // The burst's last 500 ms and its outro, reckoned at 5 s.
  expect(radio.radioState[EMERGENCY].elapsed).toEqual([1600-100-1000,5000,0]);
  expect(radio.radioState[EMERGENCY].trackQueue).toEqual([60,62,-1]);
  expect(settings.radioStation).toBe(0);
  radio.service(world());expect(radio.mode).toBe(RADIO_MODE.waitingToStop);radio.service(world());expect(radio.mode).toBe(RADIO_MODE.stopped);
  // Back 3 s on (7 s at least): past the kept two, a new intro, a little way in.
  radio.startRadio(EMERGENCY,0,0,false,world({timeMs:4000}));
  expect(radio.requested.trackTypes.slice(0,3)).toEqual([TRACK_TYPE.intro,TRACK_TYPE.track,TRACK_TYPE.outro]);
  expect(radio.requested.playTime).toBe(1500);
  // Six game hours on, it starts afresh.
  radio.stopRadio(settings,false,world({timeMs:5000}));
  radio.startRadio(EMERGENCY,0,0,false,world({timeMs:6000,clock:{days:1,month:1,hours:18}}));
  expect(radio.requested.trackQueue.slice(0,2)).toEqual([60,62]);expect(radio.requested.playTime).toBe(0);
 });
 test('a track the stream cannot ready gives way to an advert and a music track',()=>{
  const stream=new FakeStream(undefined,new Set([60,62])),radio=new NativeRadioTrackManager(sequence(0));radio.hardware=stream;
  radio.startRadio(EMERGENCY,0,0,false,world());radio.service(world());radio.service(world());radio.service(world());
  expect(radio.active.trackTypes.slice(0,3)).toEqual([TRACK_TYPE.advert,TRACK_TYPE.track,TRACK_TYPE.outro]);
  expect(radio.active.trackQueue[0]).toBeGreaterThanOrEqual(RADIO_ADVERTS[0]);expect(radio.active.trackQueue[0]).toBeLessThanOrEqual(RADIO_ADVERTS[1]);
  expect(radio.mode).toBe(RADIO_MODE.waitingToPlay);
 });
 test('CheckForPause: out of a vehicle with a radio, it stops',()=>{
  const stream=new FakeStream(),radio=new NativeRadioTrackManager(sequence(0));radio.hardware=stream;
  radio.startRadio(EMERGENCY,0,0,false,world());radio.service(world());radio.service(world());
  radio.service(world({vehicleRadioType:undefined}));
  expect(radio.mode).toBe(RADIO_MODE.stopping);
 });
});
