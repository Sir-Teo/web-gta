import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {MAIN_SCRIPT_SIZE,SCRIPT_SPACE_SIZE,ScmRuntime} from '../src/engine/ScmRuntime';
import {ScmCameraFade} from '../src/engine/ScmCameraFade';
import {scmOpcode} from '../src/engine/scmOpcodes';
import {NATIVE_NOP_COMMANDS,NATIVE_NOP_OPCODES} from '../src/engine/ScmNativeNops';
import type {ScmWorldCommands} from '../src/engine/ScmThread';

const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const local=(n:number)=>[3,n&255,n>>8],global=(n:number)=>[2,n&255,n>>8];
const op=(name:string|number,...args:number[][])=>{const n=typeof name==='number'?name:scmOpcode(name);return [n&255,n>>8,...args.flat()];};
const name8=(s:string)=>[9,...Array.from({length:8},(_,i)=>s.charCodeAt(i)||0)];
/** Lay out labelled fragments contiguously; labels resolve to byte offsets from the start. */
function assemble(parts:(number[]|string)[]){
 const labels=new Map<string,number>();let size=0;
 for(const part of parts){if(typeof part==='string')labels.set(part,size);else size+=part.length;}
 const bytes:number[]=[];for(const part of parts)if(typeof part!=='string')bytes.push(...part);
 return {bytes,labels};
}
/** Source layout: a fake MAIN.SCM whose mission block lives at file offset 1000. */
function missionFixture(mission:(number[]|string)[],main:number[][],world?:ScmWorldCommands,exclusiveMissions=0){
 const space=new Uint8Array(SCRIPT_SPACE_SIZE);
 const file=new Uint8Array(4000);const assembled=assemble(mission);file.set(assembled.bytes,1000);
 space.set(main.flat(),128);
 const runtime=new ScmRuntime(space,world,undefined,undefined,{file,offsets:[1000],exclusiveMissions});
 return {runtime,space,labels:assembled.labels,main:runtime.start(128).thread};
}

test('LOAD_AND_LAUNCH_MISSION_INTERNAL copies the block above MAIN, wipes mission locals and defers the thread',()=>{
 const {runtime,space,main}=missionFixture([op('SCRIPT_NAME',name8('TEST')),op(4,local(0),int(7)),op(1,int(0)),op(0x4e)],[op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),op(1,int(0)),op(0x4e)]);
 runtime.missionLocals.setInt32(0,123,true);
 runtime.process(0,20);
 expect(runtime.active.map(s=>s.thread.name)).toEqual(['noname','noname']);
 const mission=runtime.active[0].thread;
 expect(mission.ip).toBe(MAIN_SCRIPT_SIZE);expect(mission.base).toBe(MAIN_SCRIPT_SIZE);
 expect(mission.usesMissionCleanup).toBe(true);expect(mission.thisMustBeTheOnlyMissionRunning).toBe(true);
 expect(main.usesMissionCleanup).toBe(false);
 expect(runtime.game.alreadyRunningAMissionScript).toBe(true);expect(runtime.missionRunning).toBe(true);
 expect(runtime.missionLocals.getInt32(0,true)).toBe(0); // wiped, not yet executed
 expect(space[MAIN_SCRIPT_SIZE]).toBe(0xa4);expect(space[MAIN_SCRIPT_SIZE+1]).toBe(0x03);
 runtime.process(20,20);
 expect(mission.name).toBe('TEST');expect(runtime.missionLocals.getInt32(0,true)).toBe(7);
 expect(mission.locals).toBe(runtime.missionLocals);
 runtime.process(40,20);
 expect(runtime.active).toHaveLength(0);expect(runtime.game.alreadyRunningAMissionScript).toBe(false);expect(runtime.missionRunning).toBe(false);
});

test('mission timers advance once per frame in shared storage while each thread keeps its own timers',()=>{
 const {runtime}=missionFixture([op(1,int(1000)),op(0x4e)],[op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),op(1,int(1000)),op(0x4e)]);
 runtime.process(0,16.9);runtime.process(16,16.9);runtime.process(32,16.9);
 // Frames truncate to 16 ms. Mission timers tick before the load wipes them,
 // so the mission sees two frames; MAIN's own timers see all three.
 expect(runtime.missionLocals.getInt32(32*4,true)).toBe(32);expect(runtime.missionLocals.getInt32(33*4,true)).toBe(32);
 expect(runtime.active[0].thread.locals.getInt32(32*4,true)).toBe(32);
 expect(runtime.active[1].thread.locals.getInt32(32*4,true)).toBe(48);
});

test('FAIL_CURRENT_MISSION counts down and resets a subroutine-nested mission to its wrapper on the frame it reaches one',()=>{
 const {runtime,labels}=missionFixture([
  op('SCRIPT_NAME',name8('FAILME')),op(4,local(0),int(7)),op(0x50,int(-40)),'after',op(4,local(1),int(99)),op(0x4e),
  'sub',op('FAIL_CURRENT_MISSION'),op(1,int(0)),op(1,int(0)),op(1,int(0)),op(0x51)],
  [op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),op(0x4e)]);
 expect(labels.get('sub')).toBe(40);
 runtime.process(0,20);
 const mission=runtime.active[0].thread;
 runtime.process(20,20);
 expect(runtime.game.failCurrentMission).toBe(2);expect(mission.stack).toEqual([MAIN_SCRIPT_SIZE+labels.get('after')!]);
 expect(runtime.missionLocals.getInt32(4,true)).toBe(0);
 runtime.process(40,20);
 expect(runtime.game.failCurrentMission).toBe(1);
 expect(runtime.missionLocals.getInt32(4,true)).toBe(99);expect(mission.terminated).toBe(true);expect(runtime.active).toHaveLength(0);
 runtime.process(60,20);expect(runtime.game.failCurrentMission).toBe(0);
});

test('death/arrest check clears the on-mission flag and unwinds only when enabled, on a mission and restarting',()=>{
 let restarting=false,cleared=0;
 const world:ScmWorldCommands={fade(){},isPlayerRestarting:()=>restarting,clearSmallMessages(){cleared++;}};
 const build=(deathArrest:number)=>missionFixture([
  op('DECLARE_MISSION_FLAG',global(8)),op('SET_DEATHARREST_STATE',int(deathArrest)),op(4,global(8),int(1)),op(0x50,int(-41)),'after',op(4,local(2),int(5)),op(0x4e),
  'sub',op(1,int(0)),op(1,int(0)),op(1,int(0)),op(0x51)],
  [op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),op(0x4e)],world);
 let fixture=build(1);
 expect(fixture.labels.get('sub')).toBe(41);
 fixture.runtime.process(0,20);fixture.runtime.process(20,20);
 const mission=fixture.runtime.active[0].thread;
 expect(fixture.runtime.game.onAMissionFlag).toBe(8);expect(fixture.space[8]).toBe(1);
 fixture.runtime.process(40,20);expect(fixture.runtime.missionLocals.getInt32(8,true)).toBe(0); // not restarting: still inside the subroutine
 restarting=true;
 fixture.runtime.process(60,20);
 expect(cleared).toBe(1);expect(fixture.space[8]).toBe(0);expect(mission.doneDeathArrest).toBe(true);
 expect(fixture.runtime.missionLocals.getInt32(8,true)).toBe(5);expect(mission.terminated).toBe(true);
 // SET_DEATHARREST_STATE 0 disables the check for that thread.
 restarting=true;cleared=0;fixture=build(0);
 fixture.runtime.process(0,20);fixture.runtime.process(20,20);fixture.runtime.process(40,20);fixture.runtime.process(60,20);
 expect(cleared).toBe(0);expect(fixture.space[8]).toBe(1);expect(fixture.runtime.active[0].thread.doneDeathArrest).toBe(false);
});

test('exclusive mission files remap identifiers from 0xFFFF and ignore ordinary ones',()=>{
 const fixture=missionFixture([op(0x4e)],[op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0xffff)),op(0x4e)],undefined,1);
 fixture.runtime.process(0,20);
 expect(fixture.runtime.active).toHaveLength(1);expect(fixture.runtime.active[0].thread.thisMustBeTheOnlyMissionRunning).toBe(true);
 expect(()=>missionFixture([op(0x4e)],[op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(3)),op(0x4e)]).runtime.process(0,20)).toThrow('MultiScriptArray');
 expect(()=>new ScmRuntime(new Uint8Array(200)).loadAndLaunchMission(0)).toThrow('ScmRuntime.load');
});

test('LAUNCH_MISSION starts an ordinary thread at the label and TERMINATE_ALL_SCRIPTS_WITH_THIS_NAME is case-insensitive',()=>{
 const space=new Uint8Array(1024);
 space.set([...op('LAUNCH_MISSION',int(256)),...op('LAUNCH_MISSION',int(256)),...op('LAUNCH_MISSION',int(384)),...op(1,int(0)),...op('TERMINATE_ALL_SCRIPTS_WITH_THIS_NAME',name8('ABC')),...op(0x4e)],128);
 space.set([...op('SCRIPT_NAME',name8('abc')),...op(1,int(0)),...op(0x4e)],256);
 space.set([...op('SCRIPT_NAME',name8('other')),...op(1,int(0)),...op(0x4e)],384);
 const runtime=new ScmRuntime(space);runtime.start(128);
 runtime.process(0,20);
 expect(runtime.active.map(s=>s.thread.ip)).toEqual([384,256,256,156]);
 const [other,abc1,abc2,main]=runtime.active.map(s=>s.thread);
 runtime.process(20,20);
 // Launched threads name themselves first; MAIN then retires both "abc" threads and itself in the same pass.
 expect([other.name,abc1.name,abc2.name,main.name]).toEqual(['other','abc','abc','noname']);
 expect([abc1.terminated,abc2.terminated,main.terminated,other.terminated]).toEqual([true,true,true,false]);
 expect(runtime.active.map(s=>s.thread)).toEqual([other]);
 expect(runtime.active.every(s=>!s.thread.thisMustBeTheOnlyMissionRunning)).toBe(true);
 runtime.process(40,20);expect(runtime.active).toEqual([]);
 for(let i=0;i<96;i++)runtime.start(128);expect(()=>runtime.start(128)).toThrow('pool exhausted');
});

test('native no-op commands consume operands without touching storage or the condition flag',()=>{
 expect(NATIVE_NOP_COMMANDS).toHaveLength(282);expect(NATIVE_NOP_OPCODES.size).toBe(282);
 const space=new Uint8Array(512);
 space.set([...op('DISPLAY_TIMER_BARS',int(0)),...op(scmOpcode('WANTED_STARS_ARE_FLASHING')|0x8000),...op('REGISTER_STREAMED_SCRIPT_INTERNAL',int(5)),...op('VIEW_INTEGER_VARIABLE',global(8),global(8)),...op(0x4e)],128);
 space[8]=42;
 const runtime=new ScmRuntime(space),{thread}=runtime.start(128);thread.condition=true;
 runtime.process(0,20);
 expect(thread.terminated).toBe(true);expect(thread.condition).toBe(true);expect(space[8]).toBe(42);
});

/** Records the world calls MAIN makes before its first mission. */
function recordingWorld(){
 const calls:unknown[][]=[];
 const record=(name:string)=>(...args:unknown[])=>{calls.push([name,...args]);};
 const world:ScmWorldCommands={fade(ms,direction){calls.push(['fade',ms,direction]);},requestCollision:record('requestCollision'),loadScene:record('loadScene'),createPlayer:record('createPlayer'),
  getPlayerChar:(id)=>{calls.push(['getPlayerChar',id]);return 0x1234;},getPlayerGroup:(id)=>{calls.push(['getPlayerGroup',id]);return 0x10000;},
  setCameraBehindPlayer:record('setCameraBehindPlayer'),setCharHeading:record('setCharHeading'),setRelationship:record('setRelationship'),setLaRiots:record('setLaRiots')};
 return {world,calls};
}

test('original MAIN runs its prologue, launches mission INITIAL into the mission block and stops at its first unsupported command',()=>{
 const file=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
 const {world,calls}=recordingWorld();
 const {runtime,header}=ScmRuntime.load(file,world);
 expect(runtime.scriptSpace.length).toBe(SCRIPT_SPACE_SIZE);expect(runtime.scriptSpace[MAIN_SCRIPT_SIZE]).toBe(0);
 const main=runtime.start(header.entry).thread;
 runtime.process(100,20);
 // MAIN reached WAIT 0 after LOAD_AND_LAUNCH_MISSION_INTERNAL 0.
 expect(main.ip).toBe(56369);expect(main.name).toBe('MAIN');expect(main.deathArrestEnabled).toBe(false);
 const {game}=runtime;
 expect([game.totalNumberOfMissions,game.progressTotal,game.missionRespectTotal]).toEqual([147,187,1339]);
 expect([game.maximumWantedLevel,game.maximumChaosLevel]).toEqual([6,6900]);
 expect([game.clock.hours,game.clock.minutes,game.clock.lastTick]).toEqual([8,0,100]);
 expect(game.stats.get(165)).toBe(800);expect(game.stats.ints[45]).toBe(800); // SET_FLOAT_STAT on an integer stat truncates into StatTypesInt
 expect(game.stats.floats[23]).toBe(50);expect(game.stats.floats[21]).toBe(200);expect(game.stats.floats[68]).toBe(0);
 const globals=new DataView(runtime.scriptSpace.buffer);
 expect(globals.getInt32(8,true)).toBe(0);expect(globals.getInt32(44,true)).toBe(0x10000);expect(globals.getInt32(12,true)).toBe(0x1234);
 expect(calls[0]).toEqual(['fade',0,0]);
 expect(calls[1]).toEqual(['requestCollision',2488.562255859375,-1666.864501953125]);
 expect(calls[2]).toEqual(['loadScene',2488.562255859375,-1666.864501953125,13.375699996948242]);
 expect(calls[3]).toEqual(['createPlayer',0,2488.562255859375,-1666.864501953125,12.875699996948242]);
 expect(calls.filter(c=>c[0]==='setRelationship')).toHaveLength(22);
 expect(calls.slice(-4)).toEqual([['getPlayerGroup',0],['getPlayerChar',0],['setCameraBehindPlayer'],['setCharHeading',0x1234,262]]);
 const [initial]=runtime.active;
 expect(initial.thread.thisMustBeTheOnlyMissionRunning).toBe(true);expect(initial.thread.ip).toBe(MAIN_SCRIPT_SIZE);
 expect(runtime.scriptSpace.subarray(MAIN_SCRIPT_SIZE,MAIN_SCRIPT_SIZE+16)).toEqual(file.subarray(header.missions[0].start,header.missions[0].start+16));
 expect(()=>runtime.process(120,20)).toThrow('SET_CLOSEST_ENTRY_EXIT_FLAG');
 expect(initial.thread.name).toBe('INITIAL');expect(initial.thread.ip).toBe(201006);
 expect(calls.at(-1)).toEqual(['setLaRiots',false]);
 expect(globals.getFloat32(6000,true)).toBe(5);expect(globals.getFloat32(6016,true)).toBe(-30);expect(globals.getInt32(3164,true)).toBe(31);
 expect(globals.getFloat32(6096,true)).toBe(-1969.27001953125);
 expect(main.ip).toBe(56369); // MAIN has not run this pass: INITIAL precedes it and stopped the scheduler
});

test('without a world adapter the same MAIN stops at the first collision request',()=>{
 const file=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
 const fade=new ScmCameraFade(),{runtime,header}=ScmRuntime.load(file,fade);
 const main=runtime.start(header.entry).thread;
 expect(()=>runtime.process(100,20)).toThrow('REQUEST_COLLISION');expect(main.ip).toBe(56022);
});

test('a mission script ending processes its cleanup: the world lets its entities go and the mission state is put back',()=>{
 let cleaned=0;const made:boolean[]=[];
 const world={fade(){},missionCleanUp:()=>{cleaned++;}} as unknown as ScmWorldCommands;
 const {runtime}=missionFixture([op('SCRIPT_NAME',name8('CLEAN')),op('SET_CAR_DENSITY_MULTIPLIER',[6,0,0,0,0]),op('SWITCH_WIDESCREEN',int(1)),op(1,int(0)),op(0x4e)],
  [op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),op(1,int(0)),op(0x4e)],world);
 const g=runtime.game;
 runtime.process(0,20);runtime.process(20,20);
 made.push(runtime.currentThread===undefined);
 expect(g.carDensityMultiplier).toBe(0);expect(g.widescreenOn).toBe(true);
 const sequence=g.sequences.open(true);g.sequences.close(sequence);
 runtime.process(40,20);
 // TERMINATE_THIS_SCRIPT on the mission: its cleanup list is processed once.
 expect(cleaned).toBe(1);
 expect(g.carDensityMultiplier).toBe(1);expect(g.widescreenOn).toBe(false);
 expect(g.sequences.index(sequence)).toBe(-1);
 // MAIN ending is not a mission's end.
 runtime.terminateAllWithName('noname');expect(cleaned).toBe(1);
 expect(made).toEqual([true]);
});
