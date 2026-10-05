import {expect,test} from 'vitest';
import {BEAT_TRACK_LOADED,BEAT_TRACK_LOADING,BEAT_TRACK_PLAYING,BEAT_TRACK_STOPPING,ScmCutsceneTrack,type BeatTrackStream} from '../src/engine/ScmCutsceneTrack';

test('a beat track loads over two services, plays when asked, and stops over two more',()=>{
 const t=new ScmCutsceneTrack();
 expect(t.reportedStatus).toBe(0);expect(t.active).toBe(false);
 t.preloadBeatTrack(10);expect(t.reportedStatus).toBe(BEAT_TRACK_LOADING);
 t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_LOADING);
 t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_LOADED);
 // Loaded, it waits for the play request.
 t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_LOADED);
 t.play();t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_PLAYING);
 for(let i=0;i<500;i++)t.service(20);
 // The silent stream has no length: it plays until stopped.
 expect(t.reportedStatus).toBe(BEAT_TRACK_PLAYING);
 t.stop();expect(t.reportedStatus).toBe(BEAT_TRACK_STOPPING);
 t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_STOPPING);
 t.service(20);expect(t.reportedStatus).toBe(0);expect(t.active).toBe(false);
});
test('stopping a track that is only loaded goes the same way, and stopping none changes nothing',()=>{
 const t=new ScmCutsceneTrack();t.stop();expect(t.reportedStatus).toBe(0);
 t.preloadBeatTrack(1);t.service(20);t.service(20);t.stop();t.service(20);t.service(20);
 expect(t.reportedStatus).toBe(0);
});

/** A host stream whose audio clock the test moves by hand. */
function fakeStream(track:{beats:[number,number][];lengthMs:number}|undefined){
 const calls:string[]=[];let played:number|undefined,resolve!:(v:typeof track)=>void;
 const stream:BeatTrackStream={
  load:id=>{calls.push(`load ${id}`);return new Promise(r=>{resolve=r;});},
  play:()=>{calls.push('play');played=0;},pause:p=>{calls.push(`pause ${p}`);},stop:()=>{calls.push('stop');played=undefined;},
  playedMs:()=>played,
 };
 return {stream,calls,arrive:()=>resolve(track),at:(ms:number)=>{played=ms;}};
}
const settle=()=>new Promise(r=>setTimeout(r,0));

test('a host stream holds the track loading until it has it, plays it on the audio clock and ends with it',async()=>{
 const t=new ScmCutsceneTrack(),host=fakeStream({beats:[[1000,1],[2000,2],[3000,33]],lengthMs:4000});t.stream=host.stream;
 t.preloadBeatTrack(1);expect(t.trackId).toBe(175);// gBeatTrackLookup[1]
 t.service(20);t.service(20);t.service(20);
 expect(host.calls).toEqual(['load 175']);expect(t.reportedStatus).toBe(BEAT_TRACK_LOADING);
 host.arrive();await settle();t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_LOADED);
 t.play();t.service(20);expect(t.reportedStatus).toBe(BEAT_TRACK_PLAYING);expect(host.calls).toContain('play');
 // PAUSE_CURRENT_BEAT_TRACK reaches the stream.
 t.pause(true);t.pause(false);expect(host.calls.slice(-2)).toEqual(['pause true','pause false']);
 host.at(1980);t.service(20);
 expect(t.beatProximity(1)).toEqual({time:20,key:2,number:1});// the next beat
 expect(t.beatProximity(-1)).toEqual({time:-980,key:1,number:1});// the last one
 expect(t.beatProximity(0)).toEqual({time:20,key:2,number:1});// the nearer
 host.at(1300);t.service(20);
 expect(t.beatProximity(0)).toEqual({time:-300,key:1,number:0});
 // Past its length the track stops by itself.
 host.at(4000);t.service(20);t.service(20);expect(t.reportedStatus).toBe(0);expect(host.calls.at(-1)).toBe('stop');
});

test('GetBeatInfo keeps a beat as the next for 50 ms once a number is out, and reads -1s with no beats',async()=>{
 const t=new ScmCutsceneTrack(),host=fakeStream({beats:[[1000,1],[2000,2]],lengthMs:9000});t.stream=host.stream;
 expect(t.beatProximity(0)).toEqual({time:-1,key:-1,number:-1});
 t.preloadBeatTrack(1);t.service(20);host.arrive();await settle();t.service(20);t.play();t.service(20);
 host.at(1030);t.service(0);
 const info=t.getBeatInfo();
 expect(info.present).toBe(true);expect(info.beatNumber).toBe(0);expect(info.window[10]).toEqual({time:-30,key:1});
 expect(info.window[11]).toEqual({time:970,key:2});
 // Past the last beat, the number goes to -1 and the last beats stay behind.
 host.at(3000);t.service(0);t.getBeatInfo();const after=t.getBeatInfo();
 expect(after.beatNumber).toBe(-1);expect(after.window[9]).toEqual({time:-1000,key:2});expect(after.window[10]).toEqual({time:0,key:0});
 // A track without beats (the passed tunes) has no beat info.
 const silent=new ScmCutsceneTrack(),h2=fakeStream({beats:[],lengthMs:9000});silent.stream=h2.stream;
 silent.preloadBeatTrack(11);silent.service(20);h2.arrive();await settle();silent.service(20);silent.play();silent.service(20);h2.at(100);silent.service(0);
 expect(silent.beatProximity(0)).toEqual({time:-1,key:-1,number:-1});
});
