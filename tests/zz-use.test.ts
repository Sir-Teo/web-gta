import {test} from 'vitest';
import {readFileSync} from 'node:fs';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';
import {SCM_COMMANDS} from '../src/assets/scmCommands';
const WANT=process.env.WANT??'TASK_DEAD',N=+(process.env.N??4);
test('usage',()=>{
 const bytes=new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
 const header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const m of header.missions)blocks.push(decodeScmInstructions(bytes,m.start,m.end));
 const fmt=(ins:any)=>`${SCM_COMMANDS[ins.opcode&0x7fff]?.name} ${ins.parameters?.map((p:any)=>`${p.type}:${p.value}`).join(' ')}`;
 let shown=0;
 for(const [bi,b] of blocks.entries())for(let i=0;i<b.length;i++){
  if(SCM_COMMANDS[b[i].opcode&0x7fff]?.name!==WANT)continue;
  if(shown++<N)console.log('block',bi,'\n  '+b.slice(Math.max(0,i-3),i+4).map(fmt).join('\n  '));(globalThis as any).__a=((globalThis as any).__a??new Map());const k=b[i].parameters.map((p:any)=>p.type+':'+p.value).join(' ');(globalThis as any).__a.set(k,((globalThis as any).__a.get(k)??0)+1);
 }
 console.log(JSON.stringify([...((globalThis as any).__a??new Map())].sort((a,b)=>b[1]-a[1]).slice(0,30)));
});
