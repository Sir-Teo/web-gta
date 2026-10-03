import {expect,test} from 'vitest';
import {DynamicResolution,RESOLUTION_STEPS,scaledRatio} from '../src/core/dynamicResolution';
import {DEFAULT_TOUCH,parseTouchSettings} from '../src/input/touchSettings';

/** Frames `interval` ms apart until the controller changes the scale or `limit` ms of them have gone: the new scale (or
 * none) and after how many seconds. A change closes a window, so the next call starts a fresh one. */
function next(drs:DynamicResolution,clock:{now:number},interval:number|(()=>number),limit:number,playing=true){
 const start=clock.now;
 while(clock.now-start<limit){clock.now+=typeof interval==='number'?interval:interval();const scale=drs.frame(clock.now,playing);if(scale!==undefined)return{scale,after:Math.round((clock.now-start)/1000)};}
 return{scale:undefined,after:Math.round((clock.now-start)/1000)};
}

test('a game falling behind draws fewer pixels a step a window, while each step quickens it, down to the last',()=>{
 const drs=new DynamicResolution(),clock={now:0};
 // 30 a second (the frame limiter's) keeps up for good.
 expect(next(drs,clock,1000/30,120000).scale).toBeUndefined();expect(drs.scale).toBe(1);
 // 17 a second, each step buying a little: down within a window or two (the first may hold quick frames).
 expect(next(drs,clock,60,10000).scale).toBe(.85);
 expect(next(drs,clock,52,10000)).toEqual({scale:.72,after:3});
 expect(next(drs,clock,46,10000)).toEqual({scale:.6,after:3});
 // Quicker at the last step, and still behind: it stays there.
 expect(next(drs,clock,42,60000).scale).toBeUndefined();expect(drs.scale).toBe(RESOLUTION_STEPS.at(-1));
});

test('a step that does not quicken a game still behind is taken back, and the resolution held a while, longer each time',()=>{
 const drs=new DynamicResolution(),clock={now:0};
 // A game held back by something else (the CPU): fewer pixels change nothing.
 expect(next(drs,clock,50,10000)).toEqual({scale:.85,after:3});
 expect(next(drs,clock,50,10000)).toEqual({scale:1,after:3});
 // Held a minute, then tried again; taken back again and held two.
 expect(next(drs,clock,50,120000)).toEqual({scale:.85,after:60});
 expect(next(drs,clock,50,10000)).toEqual({scale:1,after:3});
 expect(next(drs,clock,50,240000)).toEqual({scale:.85,after:120});
 // A step that brings the game up to pace stays, however little it bought.
 expect(next(drs,clock,38,25000).scale).toBeUndefined();expect(drs.scale).toBe(.85);
});

test('a game that keeps up tries a step back up after half a minute, and after one too many, twice as long the next time',()=>{
 const drs=new DynamicResolution(),clock={now:0};
 expect(next(drs,clock,60,10000)).toEqual({scale:.85,after:3});
 // At the lower step the game keeps up: half a minute on, a step up.
 expect(next(drs,clock,1000/30,120000)).toEqual({scale:1,after:30});
 // Too much: back down, and the next try a minute on.
 expect(next(drs,clock,60,10000)).toEqual({scale:.85,after:3});
 expect(next(drs,clock,1000/30,120000)).toEqual({scale:1,after:60});
 // Keeping up there, it stays.
 expect(next(drs,clock,1000/30,300000).scale).toBeUndefined();expect(drs.scale).toBe(1);
});

test('only play counts: slow frames under a menu change nothing, nor a load\'s stalls between quick ones',()=>{
 const drs=new DynamicResolution(),clock={now:0};
 expect(next(drs,clock,80,20000,false).scale).toBeUndefined();
 let n=0;expect(next(drs,clock,()=>++n%10===0?400:1000/30,30000).scale).toBeUndefined();
 expect(drs.scale).toBe(1);
});

test('the renderer\'s ratio: the chosen one at the step, never under half a pixel, nor raised to it',()=>{
 expect(scaledRatio(2,.6)).toBeCloseTo(1.2);expect(scaledRatio(1,.6)).toBeCloseTo(.6);
 expect(scaledRatio(.75,.6)).toBe(.5);expect(scaledRatio(.4,.85)).toBe(.4);expect(scaledRatio(1,1)).toBe(1);
});

test('the adaptive resolution is on unless turned off, and kept',()=>{
 expect(DEFAULT_TOUCH.dynamicResolution).toBe(true);
 expect(parseTouchSettings({}).dynamicResolution).toBe(true);
 expect(parseTouchSettings({dynamicResolution:false}).dynamicResolution).toBe(false);
 expect(parseTouchSettings({dynamicResolution:'no'}).dynamicResolution).toBe(true);
});
