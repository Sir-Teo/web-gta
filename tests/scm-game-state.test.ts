import {expect,test} from 'vitest';
import {ScmClock,ScmGameState,ScmStats} from '../src/engine/ScmGameState';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {scmOpcode} from '../src/engine/scmOpcodes';
import {SCM_GAME_COMMAND_NAMES} from '../src/engine/ScmGameCommands';
import {NATIVE_NOP_COMMANDS} from '../src/engine/ScmNativeNops';

const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const global=(n:number)=>[2,n&255,n>>8];
const op=(name:string,...args:number[][])=>{const n=scmOpcode(name);return [n&255,n>>8,...args.flat()];};
function run(code:number[][],nowMs=0){
 const space=new Uint8Array(512);space.set([...code.flat(),0x4e,0],128);
 const runtime=new ScmRuntime(space);const {thread}=runtime.start(128);runtime.process(nowMs,20);
 return {runtime,thread,globals:new DataView(space.buffer)};
}

test('stats keep float and integer storage apart, cast through float and reject stats without PC storage',()=>{
 const stats=new ScmStats();
 expect(stats.floats[24]).toBe(569);expect(stats.floats[22]).toBe(100);
 expect(ScmStats.isFloat(81)).toBe(true);expect(ScmStats.isFloat(82)).toBe(false);
 stats.set(165,800.9);expect(stats.ints[45]).toBe(800);expect(stats.get(165)).toBe(800);
 stats.set(21,200.5);expect(stats.floats[21]).toBe(200.5);
 stats.setNewRecord(21,150);expect(stats.floats[21]).toBe(200.5);stats.setNewRecord(21,300);expect(stats.floats[21]).toBe(300);
 expect(()=>stats.get(90)).toThrow('no PC 1.0 storage');expect(()=>stats.set(343,1)).toThrow('no PC 1.0 storage');
 expect(ScmStats.isCapped(225)).toBe(true);expect(ScmStats.isCapped(0)).toBe(false);
});

test('stat commands round integers through single precision and truncate on read',()=>{
 const {runtime,globals}=run([op('SET_INT_STAT',int(134),int(16777217)),op('GET_INT_STAT',int(134),global(8)),op('SET_FLOAT_STAT',int(0),float(12.75)),op('GET_FLOAT_STAT',int(0),global(12)),op('GET_INT_STAT',int(0),global(16)),op('REGISTER_FLOAT_STAT',int(0),float(3)),op('REGISTER_INT_STAT',int(134),int(20000000))]);
 expect(runtime.game.stats.ints[14]).toBe(20000000);expect(globals.getInt32(8,true)).toBe(16777216);
 expect(globals.getFloat32(12,true)).toBe(12.75);expect(globals.getInt32(16,true)).toBe(12);expect(runtime.game.stats.floats[0]).toBe(12.75);
});

test('clock set, normalise, update, minutes-until and store/restore follow CClock',()=>{
 const clock=new ScmClock();clock.initialise(1000,500);
 expect([clock.hours,clock.minutes,clock.currentDay,clock.days,clock.month,clock.lastTick]).toEqual([12,0,4,1,1,500]);
 clock.setGameClock(25,70,0,900);
 expect([clock.hours,clock.minutes,clock.days,clock.currentDay,clock.lastTick]).toEqual([2,10,2,4,900]);
 clock.setGameClock(8,0,6,1000);expect([clock.currentDay,clock.days]).toEqual([6,3]);
 clock.update(1500);expect([clock.hours,clock.minutes,clock.seconds]).toEqual([8,0,30]);
 clock.update(2001);expect([clock.hours,clock.minutes,clock.seconds,clock.lastTick]).toEqual([8,1,0,2000]);
 expect(clock.minutesUntil(8,0)).toBe(1439);expect(clock.minutesUntil(9,30)).toBe(89);
 clock.store();clock.setGameClock(23,59,0,3000);
 for(let t=3001;t<=4001;t+=1000)clock.update(t);
 expect([clock.hours,clock.minutes,clock.days,clock.currentDay]).toEqual([0,0,4,7]);
 clock.restore();expect([clock.hours,clock.minutes,clock.days]).toEqual([8,1,3]);
 const unstored=new ScmClock();unstored.restore();expect([unstored.hours,unstored.minutes,unstored.days,unstored.month]).toEqual([0,0,0,0]);
});

test('clock commands read and write the shared clock with the scheduler time as the tick reference',()=>{
 const {runtime,globals}=run([op('SET_TIME_OF_DAY',int(20),int(45)),op('GET_TIME_OF_DAY',global(8),global(12)),op('GET_MINUTES_TO_TIME_OF_DAY',int(6),int(0),global(16)),op('STORE_CLOCK'),op('SET_TIME_OF_DAY',int(1),int(2)),op('RESTORE_CLOCK'),op('GET_GAME_TIMER',global(20))],2500);
 expect([globals.getInt32(8,true),globals.getInt32(12,true),globals.getInt32(16,true),globals.getInt32(20,true)]).toEqual([20,45,555,2500]);
 expect([runtime.game.clock.hours,runtime.game.clock.minutes,runtime.game.clock.lastTick]).toEqual([20,45,2500]);
});

test('wanted, weather, fade colour, zone names and language commands update their statics',()=>{
 const {runtime,globals}=run([op('SET_MAX_WANTED_LEVEL',int(3)),op('FORCE_WEATHER',int(4)),op('FORCE_WEATHER_NOW',int(9)),op('SET_FADING_COLOUR',int(2),int(2),int(2)),op('DISPLAY_ZONE_NAMES',int(0)),op('GET_CURRENT_LANGUAGE',global(8)),op('RELEASE_WEATHER'),op('SET_FADING_COLOUR',int(300),int(0),int(7))]);
 const {game}=runtime;
 expect([game.maximumWantedLevel,game.maximumChaosLevel]).toEqual([3,875]);
 expect([game.forcedWeather,game.oldWeather,game.newWeather]).toEqual([-1,9,9]);
 expect(game.fadeTargetIsSplashScreen).toBe(false);expect(game.fadeColour).toEqual({red:44,green:0,blue:7});
 expect(game.displayAreaName).toBe(false);expect(globals.getInt32(8,true)).toBe(0);
 expect(()=>new ScmGameState().setMaximumWantedLevel(7)).toThrow('unreachable');
 const splash=new ScmGameState();splash.setFadeColour(2,2,2);expect(splash.fadeTargetIsSplashScreen).toBe(true);
});

test('handled command families do not overlap the native no-op set',()=>{
 const nops=new Set(NATIVE_NOP_COMMANDS);
 expect(SCM_GAME_COMMAND_NAMES.filter(name=>nops.has(name))).toEqual([]);
 expect(SCM_GAME_COMMAND_NAMES).toContain('CREATE_PLAYER');
});

test('CClock::Update carries February by its 29-day entry, with the table\'s own off-by-one',()=>{
 const clock=new ScmClock();clock.initialise(1000,0);
 clock.month=2;clock.days=27;clock.hours=23;clock.minutes=59;
 clock.update(1001);
 // 28 is still under the table's 29, so February goes on.
 expect([clock.month,clock.days,clock.hours,clock.minutes]).toEqual([2,28,0,0]);
 clock.hours=23;clock.minutes=59;clock.update(2002);
 expect([clock.month,clock.days]).toEqual([3,1]);
});
