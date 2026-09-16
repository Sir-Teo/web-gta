import {expect,test} from 'vitest';
import {playHornIfNecessary,type NativeCarHornState} from '../src/simulation/nativeCarHorn';
const car=(over:Partial<NativeCarHornState>={}):NativeCarHornState=>({honkAtCar:true,honkAtPed:false,stoppedForLight:false,hornTimer:0,horn:{counter:0},...over});
// rand() values: 106 % 128 → timer 0, 106 + 2 → 2, 106 + 5 → 5, 0 → −106, 106 + 21 → 21.
const rand=(value:number)=>()=>value/32768;

test('blocked cars honk from the signed-char timer and wait while it counts down',()=>{
 const c=car();playHornIfNecessary(c,rand(106));expect([c.hornTimer,c.horn.counter]).toEqual([0,45]);
 // A sounding horn holds the timer.
 playHornIfNecessary(c,rand(0));expect([c.hornTimer,c.horn.counter]).toEqual([0,45]);
 c.horn.counter=0;playHornIfNecessary(c,rand(106+2));expect([c.hornTimer,c.horn.counter]).toEqual([2,45]);
 c.horn.counter=0;playHornIfNecessary(c,rand(0));playHornIfNecessary(c,rand(0));expect([c.hornTimer,c.horn.counter]).toEqual([0,0]);
 // Remainder 5 only speaks (not ported): no horn.
 playHornIfNecessary(c,rand(106+5));expect([c.hornTimer,c.horn.counter]).toEqual([5,0]);
});

test('negative timers honk and then wrap through -128 before the next attempt',()=>{
 const c=car();playHornIfNecessary(c,rand(128*7));expect([c.hornTimer,c.horn.counter]).toEqual([-106,45]);
 c.horn.counter=0;let calls=0;
 while(c.hornTimer!==0){playHornIfNecessary(c,rand(0));calls++;}
 // -106 → -128 is 22 calls, one more wraps to 127, then 127 calls to zero.
 expect(calls).toBe(22+1+127);expect(c.horn.counter).toBe(0);
});

test('only car or pedestrian blocks outside a red light start the horn',()=>{
 for(const c of [car({honkAtCar:false}),car({stoppedForLight:true}),car({honkAtCar:false,honkAtPed:false})]){playHornIfNecessary(c,rand(106));expect(c.horn.counter).toBe(0);expect(c.hornTimer).toBe(0);}
 const ped=car({honkAtCar:false,honkAtPed:true});playHornIfNecessary(ped,rand(106));expect(ped.horn.counter).toBe(45);
});
