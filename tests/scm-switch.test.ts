import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {decodeScmInstructions,readScmHeader} from '../src/assets/scm';
import {SCRIPT_SPACE_SIZE,ScmRuntime} from '../src/engine/ScmRuntime';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const global=(n:number)=>[2,n&255,n>>8],local=(n:number)=>[3,n&255,n>>8];
const op=(name:string|number,...args:number[][])=>{const n=typeof name==='number'?name:scmOpcode(name);return [n&255,n>>8,...args.flat()];};

/** A nine-case switch on $8: START carries seven pairs, CONTINUED the last two.
 * Case stubs sit 16 bytes apart from 400 (block-relative and negative for missions); the default stub is at 600. */
function switchScript(mission:boolean,defaultExists:number){
 const label=(k:number)=>mission?-(400+k*16):400+k*16;
 const pairs=[...Array(9).keys()].map(k=>[(k+1)*10,label(k)] as const);
 const start=op('SWITCH_START',global(8),int(9),int(defaultExists),int(mission?-600:600),...pairs.slice(0,7).flatMap(([v,l])=>[int(v),int(l)]));
 const continued=op('SWITCH_CONTINUED',...pairs.slice(7).flatMap(([v,l])=>[int(v),int(l)]),...Array(14).fill(int(0)));
 return {start,continued};
}

test('switch tables jump through the reversed binary search with START and CONTINUED pairs',()=>{
 const space=new Uint8Array(1024),globals=new DataView(space.buffer);
 const {start,continued}=switchScript(false,1);
 space.set([...start,...continued,...op(4,global(12),int(-1)),...op(0x4e)],128);
 for(let k=0;k<9;k++)space.set([...op(4,global(12),int(k+1)),...op(0x4e)],400+k*16);
 space.set([...op(4,global(12),int(99)),...op(0x4e)],600);
 for(const [value,expected] of [[10,1],[40,4],[90,9],[70,7],[80,8],[5,99],[95,99],[45,99]] as const){
  globals.setInt32(8,value,true);globals.setInt32(12,0,true);
  const runtime=new ScmRuntime(space);runtime.start(128);runtime.process(0,20);
  expect(globals.getInt32(12,true)).toBe(expected);
  expect(runtime.game.switchCases).toHaveLength(0);expect(runtime.game.switchEntriesToRead).toBe(0);
 }
});

test('mission switches resolve negative labels against the mission block and a lone START jumps immediately',()=>{
 const space=new Uint8Array(SCRIPT_SPACE_SIZE),globals=new DataView(space.buffer);
 const {start,continued}=switchScript(true,0);
 const file=new Uint8Array(4000);file.set([...start,...continued,...op(0x4e)],1000);
 for(let k=0;k<9;k++)file.set([...op(4,global(12),int(k+1)),...op(0x4e)],1400+k*16);
 file.set([...op(4,global(12),int(99)),...op(0x4e)],1600);
 space.set([...op('LOAD_AND_LAUNCH_MISSION_INTERNAL',int(0)),...op(0x4e)],128);
 globals.setInt32(8,80,true);
 const runtime=new ScmRuntime(space,undefined,undefined,undefined,{file,offsets:[1000],exclusiveMissions:0});
 runtime.start(128);runtime.process(0,20);runtime.process(20,20);
 expect(globals.getInt32(12,true)).toBe(8);
 // Three cases fit into START alone: no CONTINUED is consulted.
 const short=op('SWITCH_START',local(0),int(3),int(0),int(500),int(1),int(520),int(2),int(540),int(3),int(560),...Array(8).fill(int(0)));
 const small=new Uint8Array(1024);small.set([...short,...op(4,global(12),int(-1)),...op(0x4e)],128);
 small.set([...op(4,global(12),int(2)),...op(0x4e)],540);small.set([...op(4,global(12),int(0)),...op(0x4e)],500);
 const small2=new ScmRuntime(small),{thread}=small2.start(128);thread.locals.setInt32(0,2,true);small2.process(0,20);
 expect(new DataView(small.buffer).getInt32(12,true)).toBe(2);
 thread.locals.setInt32(0,7,true);const again=new ScmRuntime(small);again.start(128).thread.locals.setInt32(0,7,true);again.process(0,20);
 expect(new DataView(small.buffer).getInt32(12,true)).toBe(0);
});

test('switch helpers mirror CTheScripts statics and reject an empty table',()=>{
 const game=new ScmGameState();
 for(let i=0;i<75;i++)game.addSwitchCase(i,1000+i);
 expect(()=>game.addSwitchCase(75,0)).toThrow('75');
 game.switchValue=74;expect(game.useSwitchJumpTable()).toBe(1074);expect(game.switchCases).toHaveLength(0);
 game.switchDefaultAddress=5;expect(()=>game.useSwitchJumpTable()).toThrow('unsigned wrap');
 game.addSwitchCase(3,30);game.switchValue=4;game.switchDefaultAddress=5;expect(game.useSwitchJumpTable()).toBe(5);expect(game.switchDefaultAddress).toBe(0);
});

test('constant-operand integer compares follow operand order and the NOT bit',()=>{
 const space=new Uint8Array(512),globals=new DataView(space.buffer);
 globals.setInt32(8,5,true);
 const cases:[string,number[][],boolean][]=[['IS_INT_VAR_EQUAL_TO_CONSTANT',[global(8),int(5)],true],['IS_INT_VAR_GREATER_THAN_CONSTANT',[global(8),int(5)],false],['IS_CONSTANT_GREATER_THAN_INT_VAR',[int(6),global(8)],true],
  ['IS_INT_VAR_GREATER_OR_EQUAL_TO_CONSTANT',[global(8),int(5)],true],['IS_CONSTANT_GREATER_OR_EQUAL_TO_INT_VAR',[int(4),global(8)],false]];
 for(const [name,args,expected] of cases){
  space.set([...op(name,...args),...op(0x4e)],128);
  const runtime=new ScmRuntime(space),{thread}=runtime.start(128);runtime.process(0,20);expect(thread.condition,name).toBe(expected);
  space.set([...op(scmOpcode(name)|0x8000,...args),...op(0x4e)],128);
  const negated=new ScmRuntime(space),{thread:t2}=negated.start(128);negated.process(0,20);expect(t2.condition,`NOT ${name}`).toBe(!expected);
 }
});

test('every switch in the packaged MAIN.SCM is sorted, chained through CONTINUED blocks and carries a default address',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm')),header=readScmHeader(bytes);
 let starts=0,continued=0,implicitDefaults=0,maxCases=0;
 const scan=(from:number,to:number)=>{
  const instructions=decodeScmInstructions(bytes,from,to);
  for(let k=0;k<instructions.length;k++){
   const i=instructions[k];if(i.name!=='SWITCH_START')continue;starts++;
   const value=(n:number,from=i)=>from.parameters[n].value as number;
   let remaining=value(1);maxCases=Math.max(maxCases,remaining);
   expect(remaining).toBeGreaterThan(0);expect(value(3)).not.toBe(0);if(!value(2))implicitDefaults++;
   const values:number[]=[];
   for(let j=0;j<7&&remaining>0;j++,remaining--)values.push(value(4+2*j));
   let block=k;
   while(remaining>0){const next=instructions[++block];expect(next.name).toBe('SWITCH_CONTINUED');continued++;for(let j=0;j<9&&remaining>0;j++,remaining--)values.push(value(2*j,next));}
   for(let j=1;j<values.length;j++)expect(values[j]).toBeGreaterThan(values[j-1]);
  }
 };
 scan(header.entry,header.mainSize);for(const mission of header.missions)scan(mission.start,mission.end);
 expect([starts,continued,implicitDefaults,maxCases]).toEqual([592,178,405,67]);
});
