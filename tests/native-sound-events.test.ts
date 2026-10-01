import {expect,test} from 'vitest';
import {calcSoundLevelIncrement,eventSoundLevel,globalSoundLevel,playerFootstepSoundLevel} from '../src/ped/nativeSoundEvents';

test('the player\'s footsteps: a sprint 55, a full run 45, a jog by its ratio past 1.5, walking nothing (Ped.cpp:2407)',()=>{
 expect(playerFootstepSoundLevel('sprint',2.5)).toBe(55);expect(playerFootstepSoundLevel('sprint',2.5,true)).toBe(65);
 expect(playerFootstepSoundLevel('run',2)).toBe(45);
 expect(playerFootstepSoundLevel('run',1.8)).toBeCloseTo(42,9);
 expect(playerFootstepSoundLevel('run',1.4)).toBe(0);expect(playerFootstepSoundLevel('run',1.4,true)).toBeCloseTo(38,9);
 expect(playerFootstepSoundLevel('walk',1)).toBe(0);expect(playerFootstepSoundLevel('still',0)).toBe(0);
});

test('CEvent::GetSoundLevel takes min(distance, 1), as reversed: flat beyond a unit, louder inside one',()=>{
 const e={source:'p',level:45,position:{x:0,y:0,z:0}};
 expect(eventSoundLevel(e,{x:10,y:0,z:0})).toBeCloseTo(44.99,9);
 expect(eventSoundLevel(e,{x:.5,y:0,z:0})).toBeCloseTo(45-Math.log10(.25)*10-.005,9);
 expect(eventSoundLevel({...e,level:0},{x:10,y:0,z:0})).toBe(0);
});

test('sound levels add as decibels (CalcSoundLevelIncrement / CEventGlobalGroup::GetSoundLevel)',()=>{
 expect(calcSoundLevelIncrement(0,40)).toBe(40);expect(calcSoundLevelIncrement(40,0)).toBe(0);
 // Two equal sounds are three decibels louder than one.
 expect(calcSoundLevelIncrement(40,40)).toBeCloseTo(3.0103,4);
 const at={x:5,y:0,z:0},a={source:'a',level:40,position:{x:0,y:0,z:0}},b={source:'b',level:40,position:{x:0,y:1,z:0}};
 expect(globalSoundLevel([a,b],undefined,at)).toBeCloseTo(eventSoundLevel(a,at)+calcSoundLevelIncrement(eventSoundLevel(a,at),eventSoundLevel(b,at)),9);
 expect(globalSoundLevel([a,b],'b',at)).toBeCloseTo(eventSoundLevel(b,at),9);
 expect(globalSoundLevel([],undefined,at)).toBe(0);
});
