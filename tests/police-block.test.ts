import {expect,test} from 'vitest';
import {blockHandbrakeStop} from '../src/simulation/WorldPolice';
import {BLOCK_TO_STOP_DISTANCE,STOP_TO_BLOCK_DISTANCE,blockPlayerTarget} from '../src/vehicle/nativeCarCtrl';

// CCarAI::FindPoliceCarMissionForWantedLevel: always BLOCKPLAYER_FARAWAY at one star or none; HANDBRAKESTOP one time
// in four at two stars, one in two at three, three in four from four.
test('the block mission roll by wanted level',()=>{
 expect(blockHandbrakeStop(1,()=>.99)).toBe(false);expect(blockHandbrakeStop(0,()=>.99)).toBe(false);
 expect(blockHandbrakeStop(2,()=>.7)).toBe(false);expect(blockHandbrakeStop(2,()=>.8)).toBe(true);
 expect(blockHandbrakeStop(3,()=>.4)).toBe(false);expect(blockHandbrakeStop(3,()=>.6)).toBe(true);
 expect(blockHandbrakeStop(4,()=>.2)).toBe(false);expect(blockHandbrakeStop(4,()=>.3)).toBe(true);expect(blockHandbrakeStop(6,()=>.3)).toBe(true);
});
// SteerAICarWithPhysicsTryingToBlockTarget (re3): the target is the player a CARAI second (60 frames) of his speed
// ahead, the speed capped at 0.13 a frame; the stop comes within 5 of the target and ends 10 from the player.
test('the block target leads the player by his capped speed',()=>{
 expect(blockPlayerTarget({x:100,y:200},{x:.1,y:0})).toEqual({x:106,y:200});
 const capped=blockPlayerTarget({x:0,y:0},{x:0,y:.5});expect(capped.x).toBe(0);expect(capped.y).toBeCloseTo(7.8,6);
 expect(blockPlayerTarget({x:3,y:4},{x:0,y:0})).toEqual({x:3,y:4});
 expect([BLOCK_TO_STOP_DISTANCE,STOP_TO_BLOCK_DISTANCE]).toEqual([5,10]);
});
