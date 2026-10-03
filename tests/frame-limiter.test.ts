import {expect,test} from 'vitest';
import {frameDue,parseDisplaySettings,FRAME_LIMITER_FPS,MENU_FPS} from '../src/core/frameLimiter';
test('the limiter draws every second 60 Hz frame at 30 fps, every fourth at 120 Hz, and every frame without a cap',()=>{
 expect(FRAME_LIMITER_FPS).toBe(30);expect(MENU_FPS).toBe(10);
 const pacer={lastDrawn:0};let drawn=0;
 for(let i=1;i<=120;i++)if(frameDue(pacer,i*1000/60,30))drawn++;
 expect(drawn).toBe(60);
 const fast={lastDrawn:0};drawn=0;
 for(let i=1;i<=240;i++)if(frameDue(fast,i*1000/120,30))drawn++;
 expect(drawn).toBe(60);
 const free={lastDrawn:0};drawn=0;
 for(let i=1;i<=60;i++)if(frameDue(free,i*1000/60,undefined))drawn++;
 expect(drawn).toBe(60);
});
test('a stall resynchronises the grid instead of drawing a burst of catch-up frames',()=>{
 const pacer={lastDrawn:1000};
 expect(frameDue(pacer,1500,30)).toBe(true);expect(pacer.lastDrawn).toBe(1500);
 expect(frameDue(pacer,1510,30)).toBe(false);
 expect(frameDue(pacer,1534,30)).toBe(true);
});
test('display settings default to the limiter and subtitles on and reject junk',()=>{
 expect(parseDisplaySettings(null)).toEqual({frameLimiter:true,subtitles:true});
 expect(parseDisplaySettings({frameLimiter:false})).toEqual({frameLimiter:false,subtitles:true});
 expect(parseDisplaySettings({frameLimiter:'no',subtitles:'off'})).toEqual({frameLimiter:true,subtitles:true});
 // Subtitles off (the PC's and the mobile ports' option) is kept.
 expect(parseDisplaySettings({subtitles:false})).toEqual({frameLimiter:true,subtitles:false});
});
