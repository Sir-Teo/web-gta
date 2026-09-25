import {expect,test} from 'vitest';
import {BEAT_TRACK_LOADED,BEAT_TRACK_LOADING,BEAT_TRACK_PLAYING,BEAT_TRACK_STOPPING,ScmCutsceneTrack} from '../src/engine/ScmCutsceneTrack';

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
