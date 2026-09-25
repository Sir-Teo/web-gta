import {expect,test} from 'vitest';
import {ScmEntityPending,ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

test('a command naming a ped still being built waits a frame at that command and runs it again',()=>{
 // SET_CHAR_HEALTH ped 7 to 50, then TERMINATE_THIS_SCRIPT.
 const set=scmOpcode('SET_CHAR_HEALTH'),end=scmOpcode('TERMINATE_THIS_SCRIPT');
 const int=(v:number)=>{const b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,v,true);return [1,...b];};
 const float=(v:number)=>{const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,v,true);return [6,...b];};
 const code=[set&0xff,set>>8&0xff,...int(7),...int(50),end&0xff,end>>8&0xff];
 const space=new Uint8Array(64);space.set(code,0);
 let built=false;const set50:number[]=[];
 const world={fade(){},setPedHealth:(_handle:number,health:number)=>{if(!built)throw new ScmEntityPending('ped 7');set50.push(health);}} as unknown as ScmWorldCommands;
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world};
 const thread=new ScmThread(space,0,0,undefined,host);
 expect(thread.run(0)).toBe('waiting');
 expect(thread.ip).toBe(0);expect(thread.terminated).toBe(false);expect(set50).toEqual([]);
 // Still building the next frame: it waits again.
 expect(thread.run(20)).toBe('waiting');expect(thread.ip).toBe(0);
 built=true;
 expect(thread.run(40)).toBe('terminated');
 expect(set50).toEqual([50]);
});
