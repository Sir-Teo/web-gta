import {expect,test} from 'vitest';
import {AutoQuality,QUALITY_PRESETS,lowerPreset} from '../src/core/autoQuality';
import {parseTouchSettings} from '../src/input/touchSettings';
/** Frames every `interval` ms from `start` for `ms`, the verdicts given. */
function run(q:AutoQuality,start:number,interval:number,ms:number,playing=true){
 const verdicts:string[]=[];for(let t=start;t<=start+ms;t+=interval){const v=q.frame(t,playing);if(v)verdicts.push(v);}return verdicts;
}
test('a game holding the limiter\'s 30 a second is fine once warmed up and measured',()=>{
 const q=new AutoQuality();expect(run(q,0,1000/30,4000)).toEqual([]);
 expect(run(q,4000,1000/30,10000)).toEqual(['fine']);
});
test('one under 24 a second is slow',()=>{expect(run(new AutoQuality(),0,50,14000)).toEqual(['slow']);});
test('frames under a menu or a load do not count, nor a hitch',()=>{
 const q=new AutoQuality();expect(run(q,0,50,60000,false)).toEqual([]);
 // A load's 2 s hitch every second of play is left out: the rest keeps 30 a second.
 const verdicts:string[]=[];let t=0;for(let i=0;i<500;i++){t+=i%30===29?2000:1000/30;const v=q.frame(t,true);if(v)verdicts.push(v);}
 expect(verdicts).toEqual(['fine']);
});
test('the presets step down from the game\'s own to the port\'s middling, then its weakest device\'s',()=>{
 expect(lowerPreset({effects:'high'})).toBe('medium');expect(lowerPreset({effects:'medium'})).toBe('low');expect(lowerPreset({effects:'low'})).toBeUndefined();
 expect(QUALITY_PRESETS.medium).toEqual({effects:'medium',drawDistance:55});
 expect(QUALITY_PRESETS.low).toEqual({effects:'low',drawDistance:20,resolution:'low',density:'low'});
 expect(parseTouchSettings({}).qualityChosen).toBe(false);expect(parseTouchSettings({qualityChosen:true}).qualityChosen).toBe(true);
});
