import {expect,test} from 'vitest';
import {ScmThread,MissingWorldAdapter,type ScmThreadHost} from '../src/engine/ScmThread';
import {SCM_COMMAND_OUTPUTS,SCM_CONDITION_COMMANDS} from '../src/engine/scmCommandSignatures';

const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const local=(n:number)=>[3,n&255,n>>8];
const op=(n:number,...args:number[][])=>[n&255,n>>8,...args.flat()];
const space=(code:number[],entry=128)=>{const a=new Uint8Array(entry+code.length);a.set(code,entry);return a;};
const CREATE_SEARCHLIGHT=0x06b1,DOES_SEARCHLIGHT_EXIST=0x06b3;

test('the signatures name outputs and conditions',()=>{
 expect(SCM_COMMAND_OUTPUTS.get(CREATE_SEARCHLIGHT)).toBe('h');
 expect(SCM_CONDITION_COMMANDS.has(DOES_SEARCHLIGHT_EXIST)).toBe(true);
});
test('a command the world cannot answer is skipped when the host asks: its handle reads -1 and its test false',()=>{
 const code=[...op(6,local(0),int(7)),...op(CREATE_SEARCHLIGHT,...Array(8).fill(float(1)),local(0)),
  ...op(0xd6,int(0)),...op(DOES_SEARCHLIGHT_EXIST|0x8000,local(0)),...op(0x4e)];
 const skipped:string[]=[];
 const host:ScmThreadHost={startScript(){},world:{fade(){}} as never,skipUnported:(_t,error)=>{skipped.push(error.command);return true;}};
 const thread=new ScmThread(space(code),128,0,undefined,host);
 expect(thread.run(0)).toBe('terminated');
 expect(thread.locals.getInt32(0,true)).toBe(-1);
 // NOT DOES_SEARCHLIGHT_EXIST: the skipped test answers false, negated to true.
 expect(thread.condition).toBe(true);
 expect(skipped).toEqual(['CREATE_SEARCHLIGHT','DOES_SEARCHLIGHT_EXIST']);
});
test('without the host\'s say-so the thread still gives up at the command',()=>{
 const code=[...op(CREATE_SEARCHLIGHT,...Array(8).fill(float(1)),local(0)),...op(0x4e)];
 const thread=new ScmThread(space(code),128,0,undefined,{startScript(){},world:{fade(){}} as never});
 expect(()=>thread.run(0)).toThrow(MissingWorldAdapter);
});
