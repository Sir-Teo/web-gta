import {expect,test} from 'vitest';
import fixture from './fixtures/native-char-velocity.json';
import {ScmThread,type ScmThreadHost} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';

for(const row of fixture.cases)test(`captured GET_CHAR_VELOCITY: ${row.name}`,()=>{
 const code=new Uint8Array(18),view=new DataView(code.buffer);
 view.setUint16(0,0x083d,true);code[2]=1;view.setInt32(3,row.handle,true);
 for(let i=0;i<3;i++){code[7+i*3]=3;view.setUint16(8+i*3,i,true);}view.setUint16(16,0x004e,true);
 const handles:number[]=[],host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},pedVelocity:handle=>{handles.push(handle);return{x:row.velocity[0],y:row.velocity[1],z:row.velocity[2]};}}};
 const thread=new ScmThread(code,0,0,new DataView(new ArrayBuffer(34*4)),host);thread.condition=true;thread.run(0,20);
 expect(handles).toEqual([row.handle]);expect([0,1,2].map(i=>thread.locals.getUint32(i*4,true))).toEqual(row.outputBits);expect(thread.condition).toBe(true);expect(thread.terminated).toBe(true);
});
