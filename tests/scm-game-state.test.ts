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

test('the script clock follows the world\'s time and weekday, carrying the day and month past midnight',()=>{
 const clock=new ScmClock();clock.initialise(1000,0);clock.month=2;clock.days=27;
 clock.follow(23*60+59.5,4);expect([clock.hours,clock.minutes,clock.seconds,clock.currentDay,clock.days]).toEqual([23,59,30,4,27]);
 clock.follow(0.25,5);expect([clock.hours,clock.minutes,clock.currentDay,clock.days,clock.month]).toEqual([0,0,5,28,2]);
 clock.follow(60,6);expect([clock.days,clock.month]).toEqual([1,3]);
});

test('a command that fails inside one thread retires that thread only when the host listens (onThreadError)',()=>{
 const space=new Uint8Array(512);
 // Thread A divides a global by zero; thread B counts up each frame.
 space.set([...op('DIV_INT_VAR_BY_VAL',global(8),int(0)),0x4e,0],128);
 space.set([...op('ADD_VAL_TO_INT_VAR',global(12),int(1)),...op('WAIT',int(0)),...op('GOTO',int(256))],256);
 const runtime=new ScmRuntime(space),failed:string[]=[];
 runtime.onThreadError=(error,thread)=>{failed.push(`${thread.currentInstruction.name}:${String(error)}`);};
 runtime.start(128);runtime.start(256);
 runtime.process(0,20);runtime.process(20,20);
 expect(failed).toHaveLength(1);expect(failed[0]).toMatch(/^DIV_INT_VAR_BY_VAL:.*integer division/);
 expect(new DataView(space.buffer).getInt32(12,true)).toBe(2);
});

test('a bound float stat reads and writes the host store: set, capped increment and decrement',()=>{
 const stats=new ScmStats();let skill=40;
 stats.bind(160,{get:()=>skill,set:v=>{skill=v;}});
 expect(stats.get(160)).toBe(40);
 stats.increment(160,2000);expect(skill).toBe(1000);
 stats.decrement(160,1500);expect(skill).toBe(0);
 stats.set(160,75);expect(skill).toBe(75);expect(stats.get(160)).toBe(75);
 stats.increment(160,2.7);expect(skill).toBe(77);
 let pistol=0;stats.bind(69,{get:()=>pistol,set:v=>{pistol=v;}});stats.increment(69,2.5);expect(pistol).toBe(2.5);
 expect(()=>stats.bind(1000,{get:()=>0,set:()=>{}})).toThrow();
});
test('stat reactions: stamina or lung capacity gained on negative energy burns 23 fat, energy past 1000 becomes fat, and a decrement never leaves energy negative',()=>{
 const stats=new ScmStats();const FAT=21,STAMINA=22,ENERGY=165,LUNG=225;
 // CStats::ProcessReactionStatsOnIncrement.
 stats.set(FAT,100);stats.set(ENERGY,-5);stats.increment(STAMINA,1);expect(stats.get(FAT)).toBe(77);
 stats.increment(LUNG,1);expect(stats.get(FAT)).toBe(54);
 stats.set(FAT,10);stats.increment(STAMINA,1);expect(stats.get(FAT)).toBe(0);
 stats.set(ENERGY,900);stats.set(FAT,100);stats.increment(ENERGY,150);expect(stats.get(ENERGY)).toBe(1000);
 // IncrementStat caps energy at a thousand before the reaction reads it: nothing over is left to become fat, even
 // from a value the script set higher.
 expect(stats.get(FAT)).toBe(100);
 stats.set(ENERGY,1100);stats.increment(ENERGY,1);expect(stats.get(ENERGY)).toBe(1000);expect(stats.get(FAT)).toBe(100);
 // CStats::ProcessReactionStatsOnDecrement: a decrement never takes energy below zero, so only a negative value set by the script reacts.
 stats.set(ENERGY,-5);stats.set(FAT,50);stats.decrement(ENERGY,1);expect(stats.get(ENERGY)).toBe(0);expect(stats.get(FAT)).toBe(50);
 stats.set(ENERGY,-40);stats.set(FAT,50);stats.decrement(ENERGY,10);expect(stats.get(FAT)).toBe(50);
});
