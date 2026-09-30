// Prints a mission block (or MAIN) of the packaged main.scm as text, one instruction a line with its offset, for
// reading what a mission does while porting it: `npm run port -- disasm INTRO` or `node scripts/port/disasm.mjs 2`.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {withSources} from './ts.mjs';
const want=process.argv[2]??'MAIN';
await withSources(async load=>{
 const {readScmHeader,decodeScmInstructions}=await load('/src/assets/scm.ts');
 const {SCM_COMMANDS}=await load('/src/assets/scmCommands.ts');
 const nameOf=op=>SCM_COMMANDS[op]?.name??`OPCODE_${op.toString(16)}`;
 const bytes=new Uint8Array(readFileSync(join(process.cwd(),'public/play/world/files/scripts/main.scm')));
 const header=readScmHeader(bytes);
 const blocks=[{id:'MAIN',start:header.entry,end:header.mainSize},...header.missions.map(m=>({id:String(m.index),start:m.start,end:m.end}))];
 for(const b of blocks){
  const ins=decodeScmInstructions(bytes,b.start,b.end);
  const name=ins.find(x=>nameOf(x.opcode&0x7fff)==='SCRIPT_NAME');
  const label=(name?.parameters??name?.args)?.[0]?.value;
  if(b.id!==want&&label!==want)continue;
  for(const i of ins){
   const params=i.parameters.map(p=>{const v=p.value;
    // Globals are byte offsets (Sanny's $n is offset / 4), locals indices; jumps below zero are mission-relative.
    if(p.type===2||p.type===10||p.type===16)return `$${v/4}`;if(p.type===3||p.type===11||p.type===17)return `${v}@`;
    if(Array.isArray(v))return `arr[${v.join(',')}]`;return p.type===6?Number(v).toFixed(3):JSON.stringify(v);});
   console.log(`${String(i.offset).padStart(7)} ${i.opcode&0x8000?'NOT ':''}${nameOf(i.opcode&0x7fff)} ${params.join(' ')}`);
  }
  return;
 }
 console.error('no block',want);
});
