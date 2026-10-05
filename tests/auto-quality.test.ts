import {expect,test} from 'vitest';
import {AutoQuality,QUALITY_PRESETS,lowerPreset} from '../src/core/autoQuality';
import {parseTouchSettings} from '../src/input/touchSettings';
/** Frames every `interval` ms from `start` for `ms`, the verdicts given. */
function run(q:AutoQuality,start:number,interval:number,ms:number,playing=true,context:'foot'|'vehicle'|'aircraft'='foot'){
 const verdicts:string[]=[];for(let t=start;t<=start+ms;t+=interval){const v=q.frame(t,playing,context);if(v)verdicts.push(v);}return verdicts;
}
test('a game holding the limiter\'s 30 a second is fine once warmed up and measured on foot, at the wheel and flying',()=>{
 const q=new AutoQuality();expect(run(q,0,1000/30,4000)).toEqual([]);
 expect(run(q,4000,1000/30,10000)).toEqual([]);
 expect(q.measuring('foot')).toBe(false);expect(q.measuring('vehicle')).toBe(true);expect(q.settled).toBe('foot');
 expect(run(q,14000,1000/30,14000,true,'vehicle')).toEqual([]);expect(q.settled).toBe('vehicle');
 expect(run(q,28000,1000/30,14000,true,'aircraft')).toEqual(['fine']);expect(q.settled).toBe('aircraft');
});
test('a phone that keeps up driving but crawls flying is slow; one measured on the ground before is measured in the air alone',()=>{
 const q=new AutoQuality(undefined,undefined,undefined,undefined,['aircraft']);
 expect(q.measuring('foot')).toBe(false);expect(q.measuring('vehicle')).toBe(false);
 expect(run(q,0,1000/15,14000,true,'aircraft')).toEqual(['slow']);
 expect(run(q,14000,1000/30,14000,true,'aircraft')).toEqual(['fine']);
});
test('a phone that keeps up on foot but crawls in a car is slow, though every frame there takes a quarter second',()=>{
 const q=new AutoQuality();expect(run(q,0,1000/30,14000)).toEqual([]);
 expect(run(q,14000,300,14000,true,'vehicle')).toEqual(['slow']);
 // The lowered settings are measured afresh, on foot too.
 expect(run(q,28000,1000/30,14000)).toEqual([]);expect(run(q,42000,1000/30,14000,true,'vehicle')).toEqual([]);
 expect(run(q,56000,1000/30,14000,true,'aircraft')).toEqual(['fine']);
});
test('one under 24 a second is slow',()=>{expect(run(new AutoQuality(),0,50,14000)).toEqual(['slow']);});
test('frames under a menu or a load do not count, nor a hitch',()=>{
 const q=new AutoQuality(undefined,undefined,undefined,undefined,['foot']);expect(run(q,0,50,60000,false)).toEqual([]);
 // A load's 2 s hitch every second of play is left out: the rest keeps 30 a second.
 const verdicts:string[]=[];let t=0;for(let i=0;i<500;i++){t+=i%30===29?2000:1000/30;const v=q.frame(t,true);if(v)verdicts.push(v);}
 expect(verdicts).toEqual(['fine']);
});
test('the presets step down from the game\'s own to the port\'s middling, then its weakest device\'s',()=>{
 expect(lowerPreset({effects:'high'})).toBe('medium');expect(lowerPreset({effects:'medium'})).toBe('low');expect(lowerPreset({effects:'low'})).toBeUndefined();
 expect(QUALITY_PRESETS.medium).toEqual({effects:'medium',drawDistance:55});
 // The weakest device's preset turns the Car Reflections off too, as the port's does.
 expect(QUALITY_PRESETS.low).toEqual({effects:'low',drawDistance:20,resolution:'low',density:'low',carReflections:false,shadows:false});
 expect(parseTouchSettings({}).qualityChosen).toBe(false);expect(parseTouchSettings({qualityChosen:true}).qualityChosen).toBe(true);
});

test('a phone that says it is weak starts at the port\'s preset for one; one that says nothing is measured',async()=>{
 const {devicePreset}=await import('../src/core/autoQuality');
 // Chrome on Android: navigator.deviceMemory (GB) and the cores.
 expect(devicePreset({deviceMemory:1,hardwareConcurrency:8})).toBe('low');expect(devicePreset({deviceMemory:2,hardwareConcurrency:8})).toBe('low');
 expect(devicePreset({deviceMemory:4,hardwareConcurrency:4})).toBe('medium');expect(devicePreset({deviceMemory:4,hardwareConcurrency:8})).toBeUndefined();
 expect(devicePreset({deviceMemory:8,hardwareConcurrency:4})).toBeUndefined();
 // Safari names neither: measured from the game's own.
 expect(devicePreset({hardwareConcurrency:4})).toBeUndefined();expect(devicePreset({})).toBeUndefined();
});
