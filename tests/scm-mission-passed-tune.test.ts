import {expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

test('PLAY_MISSION_PASSED_TUNE preloads and plays beat track 10 + tune, and the script carries on',()=>{
 const game=new ScmGameState(),space=new Uint8Array(1024);
 // PLAY_MISSION_PASSED_TUNE 1, then SET_VAR_INT $256 7.
 const tune=scmOpcode('PLAY_MISSION_PASSED_TUNE'),set=scmOpcode('SET_VAR_INT');
 space.set([tune&0xff,tune>>8,1,1,0,0,0,set&0xff,set>>8,2,0,1,1,7,0,0,0],0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as unknown as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 expect(game.missionPassedTune).toBe(1);
 // Tune 1 is beat track 11, stream track 183, played as the mission-complete track.
 expect(game.cutsceneTrack.trackId).toBe(183);expect(game.cutsceneTrack.reportedStatus).toBe(1);expect(game.cutsceneTrack.playRequest).toBe(true);
 expect(game.cutsceneTrack.missionComplete).toBe(true);
 expect(new DataView(space.buffer).getInt32(256,true)).toBe(7);
});
