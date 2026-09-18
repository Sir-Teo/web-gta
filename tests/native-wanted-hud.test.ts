import {expect,it} from 'vitest';
import {WANTED_BLINK_MS,wantedStarsDrawn} from '../src/ui/WantedHud';

it('blinks the wanted stars on the frame counter for 2 s after a change, then holds them',()=>{
 // Frames 0-3 of each eight at 30 fps are off, 4-7 on.
 const frame=(n:number)=>n*1000/30+1;
 expect([0,3,4,7,8,12].map(n=>wantedStarsDrawn(frame(n),0))).toEqual([false,false,true,true,false,true]);
 expect(wantedStarsDrawn(WANTED_BLINK_MS+1,0)).toBe(true);
 expect(wantedStarsDrawn(frame(0)+10*WANTED_BLINK_MS,10*WANTED_BLINK_MS-1)).toBe(false);
});
