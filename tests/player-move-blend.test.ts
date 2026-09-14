import {expect,test} from 'vitest';
import {playerMoveBlend} from '../src/animation/playerMoveBlend';
test('native input ramp crosses the landing threshold only after sufficient movement',()=>{
 expect(playerMoveBlend(0,0,1,false,.4)).toBeCloseTo(1.4);
 expect(playerMoveBlend(0,0,1,false,.5)).toBeCloseTo(1.75);
 expect(playerMoveBlend(0,0,1,false,1)).toBeCloseTo(128/60);
});
test('walk modifier caps at one and released input resets immediately',()=>{
 expect(playerMoveBlend(0,1,1,true,1)).toBe(1);
 expect(playerMoveBlend(2,0,1,true,.1)).toBeCloseTo(1.65);
 expect(playerMoveBlend(2,0,0,false,.01)).toBe(0);
});
test('time subdivision preserves the same blend ramp',()=>{
 let blend=0;for(let i=0;i<30;i++)blend=playerMoveBlend(blend,0,1,false,1/60);
 expect(blend).toBeCloseTo(playerMoveBlend(0,0,1,false,.5));
});
