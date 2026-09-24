import {expect,test} from 'vitest';
import {playerMotionGroupToLoad} from '../src/ped/playerMotionGroup';

test('GetPlayerMotionGroupToLoad: fat past 500 over the muscle, else muscle past 500, else the player group',()=>{
 expect(playerMotionGroupToLoad(0,0)).toBeUndefined();
 expect(playerMotionGroupToLoad(501,0)).toBe('fat');
 expect(playerMotionGroupToLoad(500,0)).toBeUndefined();
 expect(playerMotionGroupToLoad(600,700)).toBe('muscular');
 expect(playerMotionGroupToLoad(700,700)).toBe('muscular');
 expect(playerMotionGroupToLoad(400,500)).toBeUndefined();
});
