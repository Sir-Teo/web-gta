// Stage 1 of the porting pipeline: a census of the original script against this port.
//
// Every instruction of MAIN and of each mission block in the packaged main.scm is decoded with the game's own
// decoder. Each command is then placed by how the browser answers it and by what the reference offers:
//
//   ours      core | faithful | authored | silent | skipped | stops
//             `silent` is a command whose handler calls an optional host member that no layer implements, so it
//             does nothing; `skipped` is one whose required host member is missing: the game skips it (its outputs
//             read as nothing found, a condition as false) and the mission runs on without it; `stops` is one with
//             no handler at all, where the thread gives up.
//             `authored` is a handler (or the ScmMission adapter behind it) whose comments say it is an authored
//             stand-in or rests on unreversed code. Everything else that dispatches is `faithful` as far as a
//             static read can tell: the census cannot see behaviour, only what the source claims.
//   ref       handler | handler-disabled | nop | unimplemented | absent (gta-reversed Scripts/Commands/*.cpp),
//             plus whether the reversed handler's body still calls into the executable (plugin::Call).
//
// The output is a work queue: the commands to look at next, ranked by how early in the story and how often they
// run, with the reference function to port from where one exists.
//
//   node scripts/port/census.mjs [--ref <gta-reversed checkout>] [--offline] [--out docs/port]
//
// The gta-reversed checkout defaults to ../gta-reversed/gta-reversed or $GTA_REVERSED; without one the reference
// columns read `unknown`. The Sanny Builder library (command descriptions) is fetched once into
// scripts/port/.cache unless --offline.
import {existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {withSources} from './ts.mjs';

const args=process.argv.slice(2),flag=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1]??'';};
const root=process.cwd();
const refRoot=resolve(flag('--ref')??process.env.GTA_REVERSED??join(root,'..','gta-reversed','gta-reversed'));
const outDir=resolve(flag('--out')??join(root,'docs','port'));
const offline=args.includes('--offline');
const cacheDir=join(root,'scripts','port','.cache');

/** Comments that say the browser answers with something of its own rather than the original's behaviour. */
const AUTHORED=/\bAUTHORED\b|stands? in for|stand-in|approximat|invented|no counterpart|does nothing|plays none|no cutscene player|browser has no\b|not yet (?:ported|modelled|traced|drawn|played)|is not (?:ported|modelled|drawn|played|reproduced)/i;
/** Comments that say only the command's dispatch is unreversed: the port follows the routines it reaches. */
const DISPATCH=/handler unreversed|dispatch (?:is )?unreversed|unreversed|not reversed/i;

/** The handlers table in ScmGameCommands.ts: each command's body and the comment that introduces it or its group. */
function parseHandlers(text){
 const lines=text.split('\n'),out=new Map();
 const starts=[];
 for(let i=0;i<lines.length;i++){const m=/^ ([A-Z][A-Z0-9_]*):/.exec(lines[i]);if(m)starts.push([m[1],i]);}
 for(let k=0;k<starts.length;k++){
  const [name,line]=starts[k],end=k+1<starts.length?starts[k+1][1]:Math.min(lines.length,line+40);
  let body=lines.slice(line,end).join('\n');
  // The comment block above: contiguous comment lines, walking past sibling handlers up to the group's header.
  const comment=[];
  for(let j=line-1,seen=0;j>=0&&seen<60;j--,seen++){
   const l=lines[j];
   if(/^\s*(\/\/|\/\*|\*)/.test(l)){comment.unshift(l);if(/^\s*(\/\/|\/\*) ---/.test(l))break;continue;}
   if(/^ [A-Z][A-Z0-9_]*:/.test(l)||/^\s{2,}\S/.test(l)){if(comment.length)break;continue;}
   if(!l.trim())break;
   break;
  }
  // Comments inside the body count too.
  out.set(name,{line:line+1,body,comment:comment.join('\n')});
 }
 return out;
}

/** Members an object literal defines at a given indentation (`   name:` or `   name(`). */
function membersAt(text,indent){
 const re=new RegExp(`^ {${indent}}([a-zA-Z_$][\\w$]*)\\s*(?::|\\()`,'gm'),found=new Map();let m;
 while((m=re.exec(text)))if(!found.has(m[1]))found.set(m[1],text.slice(0,m.index).split('\n').length);
 return found;
}
/** The body of the member defined at `line` (1-based) up to the next member at the same indentation. */
function memberBody(text,line,indent){
 const lines=text.split('\n'),re=new RegExp(`^ {${indent}}[a-zA-Z_$][\\w$]*\\s*(?::|\\()`);
 let end=line;while(end<lines.length&&!(end>line&&re.test(lines[end])))end++;
 // Comment lines just before the next member are that member's.
 while(end>line&&/^\s*(\/\/|\/\*|\*)/.test(lines[end-1]))end--;
 // The comment lines just above belong to it.
 let start=line-1;while(start>0&&/^\s*(\/\/|\/\*|\*)/.test(lines[start-1]))start--;
 return lines.slice(start,end).join('\n');
}

/** gta-reversed's command registrations: NAME -> {kind, fn, file, line, stub}. */
function readReference(){
 const dir=join(refRoot,'source','game_sa','Scripts','Commands');
 if(!existsSync(dir))return undefined;
 const reg=new Map(),defs=new Map();
 const files=readdirSync(dir).filter(f=>f.endsWith('.cpp'));
 for(const file of files){
  const text=readFileSync(join(dir,file),'utf8'),lines=text.split('\n');
  lines.forEach((l,i)=>{
   let m=/^\s*(\/\/)?\s*REGISTER_COMMAND_HANDLER\(\s*COMMAND_([A-Z0-9_]+)\s*,\s*([\w:]+)/.exec(l);
   if(m){reg.set(m[2],{kind:m[1]?'handler-disabled':'handler',fn:m[3],file,line:i+1});return;}
   m=/^\s*REGISTER_COMMAND_(NOP|UNIMPLEMENTED)\(\s*COMMAND_([A-Z0-9_]+)/.exec(l);
   if(m&&!reg.has(m[2]))reg.set(m[2],{kind:m[1]==='NOP'?'nop':'unimplemented',file,line:i+1});
   // Function definitions at column zero: `auto Name(`, `void Name(`, `bool Name(` ...
   const d=/^(?:[\w:<>,*&]+\s+)+([A-Za-z_]\w*)\s*\(/.exec(l);
   if(d&&!l.trimEnd().endsWith(';')&&!defs.has(`${file}:${d[1]}`)){
    let end=i+1;while(end<lines.length&&!/^}/.test(lines[end]))end++;
    defs.set(`${file}:${d[1]}`,{line:i+1,stub:/plugin::Call/.test(lines.slice(i,end+1).join('\n'))});
   }
  });
 }
 for(const entry of reg.values()){
  if(!entry.fn)continue;
  const def=defs.get(`${entry.file}:${entry.fn}`)??[...defs.entries()].find(([k])=>k.endsWith(`:${entry.fn}`))?.[1];
  if(def){entry.defLine=def.line;entry.stub=def.stub;}
 }
 const head=existsSync(join(refRoot,'.git'))?readFileSync(join(refRoot,'.git','HEAD'),'utf8').trim():'';
 let commit=head;if(head.startsWith('ref:')){const p=join(refRoot,'.git',head.slice(5));commit=existsSync(p)?readFileSync(p,'utf8').trim():head;}
 return {reg,commit};
}

async function sannyLibrary(){
 const file=join(cacheDir,'sa.json');
 if(!existsSync(file)&&!offline){
  try{
   const response=await fetch('https://raw.githubusercontent.com/sannybuilder/library/master/sa/sa.json');
   if(response.ok){mkdirSync(cacheDir,{recursive:true});writeFileSync(file,await response.text());}
  }catch{/* offline: descriptions stay empty */}
 }
 if(!existsSync(file))return new Map();
 const data=JSON.parse(readFileSync(file,'utf8')),out=new Map();
 for(const ext of data.extensions??[])if(ext.name==='default')for(const c of ext.commands??[])out.set(c.name,{desc:c.short_desc??'',params:(c.input??[]).map(p=>p.name).filter(Boolean)});
 return out;
}

await withSources(async load=>{
 const {readScmHeader,decodeScmInstructions}=await load('/src/assets/scm.ts');
 const {SCM_COMMANDS}=await load('/src/assets/scmCommands.ts');
 const {SCM_GAME_COMMANDS}=await load('/src/engine/ScmGameCommands.ts');
 const {NATIVE_NOP_OPCODES}=await load('/src/engine/ScmNativeNops.ts');
 const nameOf=op=>SCM_COMMANDS[op]?.name??`OPCODE_${op.toString(16)}`;

 // --- How this port answers each command.
 const commandsText=readFileSync(join(root,'src/engine/ScmGameCommands.ts'),'utf8');
 const missionText=readFileSync(join(root,'src/simulation/ScmMission.ts'),'utf8');
 const mainText=readFileSync(join(root,'src/main.ts'),'utf8');
 const handlers=parseHandlers(commandsText);
 // Layer 1: the ScmWorldCommands adapter ScmMission hands the runtime (three-space members).
 const adapter=membersAt(missionText,3);
 // Layer 2: the ScmMissionWorld host main.ts gives ScmMission (members at any of its object indentations).
 const hostMembers=new Set([...mainText.matchAll(/^\s+([a-zA-Z_$][\w$]*)\s*(?::\s*(?:async\s*)?(?:\(|[a-zA-Z_$][\w$]*\s*=>)|\([^)]*\)\s*\{)/gm)].map(m=>m[1]));
 const interfaceStart=missionText.indexOf('export interface ScmMissionWorld'),interfaceEnd=missionText.indexOf('\n}\n',interfaceStart);
 const hostInterface=missionText.slice(interfaceStart,interfaceEnd);
 const optionalHost=new Set([...hostInterface.matchAll(/^ ([a-zA-Z_$][\w$]*)\?\s*[(:]/gm)].map(m=>m[1]));
 const ours=new Map();
 for(const [name,h] of handlers){
  const required=[...h.body.matchAll(/world\(t,i,'(\w+)'\)/g)].map(m=>m[1]);
  const optional=[...h.body.matchAll(/world\?\.(\w+)\?\./g)].map(m=>m[1]);
  let status='faithful';const notes=[],members=[...new Set([...required,...optional])];
  const missing=required.filter(m=>!adapter.has(m)),silent=optional.filter(m=>!adapter.has(m));
  // What the adapter does with each member: its comments, and the host calls it makes that nothing answers.
  let adapterText='';
  for(const m of members)if(adapter.has(m))adapterText+=memberBody(missionText,adapter.get(m),3)+'\n';
  const hostCalls=[...adapterText.matchAll(/this\.world\.(\w+)\?\.\(/g)].map(m=>m[1]).filter(m=>optionalHost.has(m)&&!hostMembers.has(m));
  if(AUTHORED.test(h.comment)||AUTHORED.test(h.body)){status='authored';notes.push('handler comments name an authored stand-in');}
  else if(AUTHORED.test(adapterText)){status='authored';notes.push(`adapter comments name an authored stand-in (${members.filter(m=>adapter.has(m)&&AUTHORED.test(memberBody(missionText,adapter.get(m),3))).join(', ')})`);}
  else if(DISPATCH.test(h.comment)||DISPATCH.test(h.body))notes.push('dispatch unreversed; follows the routines it reaches');
  if(hostCalls.length){status='silent';notes.push(`host lacks ${[...new Set(hostCalls)].join(', ')}`);}
  if(silent.length){status='silent';notes.push(`adapter lacks ${silent.join(', ')}`);}
  if(missing.length){status='skipped';notes.push(`adapter lacks ${missing.join(', ')} (skipped: outputs read as none)`);}
  ours.set(name,{status,line:h.line,members,notes});
 }
 /** The opcodes ScmThread runs itself (tests/scm-coverage.test.ts keeps the same list). */
 const isCore=op=>[0,1,2,197,198,1198,1199,1449,1450,1745,1746,1453,1454,2297,2298,153,520,521,0x4a3,0x4a4,0x871,0x872,0x4d,0x4e,0x4f,0x50,0x51,0xd6,0x16a,0xd7,0x417,0x459,0x3a4].includes(op)
  ||[[4,23],[88,119],[120,131],[132,139],[140,147],[148,151],[24,60],[66,70],[0x4b0,0x4b7],[2116,2119]].some(([low,high])=>op>=low&&op<=high);
 const oursFor=op=>{
  const name=nameOf(op);
  if(NATIVE_NOP_OPCODES.has(op))return {status:'nop'};
  // Neither the interpreter's own nor a game command: nothing dispatches it, so the thread gives up there. MAIN and
  // the missions have none left; the streamed scripts still use a few.
  if(!SCM_GAME_COMMANDS.has(op))return isCore(op)?{status:'core'}:{status:'stops',notes:['no handler (the thread gives up)']};
  return ours.get(name)??{status:'faithful'};
 };

 // --- The reference.
 const reference=readReference(),library=await sannyLibrary();
 const refFor=name=>{
  if(!reference)return {kind:'unknown'};
  const r=reference.reg.get(name);if(!r)return {kind:'absent'};
  return {kind:r.kind,fn:r.fn,where:`${r.file}:${r.defLine??r.line}`,stub:!!r.stub};
 };

 // --- The script.
 const bytes=new Uint8Array(readFileSync(join(root,'public/play/world/files/scripts/main.scm')));
 const header=readScmHeader(bytes);
 const blocks=[{id:'MAIN',index:-1,instructions:decodeScmInstructions(bytes,header.entry,header.mainSize)}];
 for(const m of header.missions)blocks.push({id:m.index,index:m.index,instructions:decodeScmInstructions(bytes,m.start,m.end)});
 // The streamed scripts beside MAIN.SCM in script.img (shops, gyms, vending machines, casino games): each file is its
 // own block, read to the size MAIN's header gives it. They run in free roam, so they sit right after MAIN.
 const {readImgIndex,readImgEntry}=await load('/src/assets/img.ts');
 const scriptImg=readFileSync(join(root,'public/play/world/files/scripts/script.img'));
 const imgBlob=new Blob([scriptImg]),imgEntries=await readImgIndex(imgBlob);
 const streamedIds=new Set();
 for(const [i,s] of header.streamed.entries()){
  const entry=imgEntries.find(e=>e.name.toLowerCase()===`${s.name.toLowerCase()}.scm`);if(!entry)continue;
  const file=await readImgEntry(imgBlob,entry),id=`${s.name.toLowerCase()}.scm`;
  let instructions;try{instructions=decodeScmInstructions(file,0,s.size);}catch(error){console.warn(`census: ${id} does not decode (${error.message}); left out`);continue;}
  blocks.push({id,index:-1,streamed:i,instructions});streamedIds.add(id);
 }
 // Mission names from their SCRIPT_NAME; story order from where MAIN (and the missions) launch them.
 const launchOrder=new Map();
 for(const block of blocks)for(const ins of block.instructions){
  if(nameOf(ins.opcode&0x7fff)!=='LOAD_AND_LAUNCH_MISSION_INTERNAL')continue;
  const id=ins.parameters?.[0]?.value??ins.args?.[0]?.value;if(typeof id==='number'&&!launchOrder.has(id))launchOrder.set(id,launchOrder.size);
 }
 const scriptName=block=>{const i=block.instructions.find(x=>nameOf(x.opcode&0x7fff)==='SCRIPT_NAME');const v=(i?.parameters??i?.args)?.[0]?.value;return typeof v==='string'?v:undefined;};

 const commandRows=new Map(),missionRows=[];
 for(const block of blocks){
  const counts=new Map();
  for(const ins of block.instructions){const op=ins.opcode&0x7fff;counts.set(op,(counts.get(op)??0)+1);}
  const byStatus={core:0,nop:0,faithful:0,authored:0,silent:0,skipped:0,stops:0},gaps=[];
  let sites=0;
  for(const [op,n] of counts){
   const o=oursFor(op);byStatus[o.status]+=n;sites+=n;
   const name=nameOf(op);
   let row=commandRows.get(name);
   if(!row){row={name,opcode:op.toString(16).padStart(4,'0'),ours:o,ref:refFor(name),doc:library.get(name)?.desc??'',sites:0,missions:[]};commandRows.set(name,row);}
   row.sites+=n;row.missions.push(block.id);
   if(o.status==='authored'||o.status==='silent'||o.status==='skipped'||o.status==='stops')gaps.push({name,status:o.status,sites:n});
  }
  gaps.sort((a,b)=>b.sites-a.sites);
  missionRows.push({id:block.id,name:block.id==='MAIN'?'MAIN':block.streamed!==undefined?block.id:scriptName(block)??`mission ${block.id}`,order:block.id==='MAIN'?-1:block.streamed!==undefined?-1+(block.streamed+1)/1000:launchOrder.get(block.id)??9999,
   instructions:block.instructions.length,distinct:counts.size,byStatus,gaps:gaps.slice(0,12)});
 }
 missionRows.sort((a,b)=>a.order-b.order);
 const order=new Map(missionRows.map((m,i)=>[m.id,i]));

 // --- The work queue: every command the census flags, earliest story use first, then by how much it runs.
 const queue=[...commandRows.values()].filter(r=>['authored','silent','skipped','stops'].includes(r.ours.status)).map(r=>{
  const first=Math.min(...r.missions.map(id=>order.get(id)??9999));
  const portable=r.ref.kind==='handler'&&!r.ref.stub;
  return {...r,firstMission:missionRows[first]?.name,firstIndex:first,portable,missions:r.missions.length};
 }).sort((a,b)=>a.firstIndex-b.firstIndex||b.sites-a.sites);

 mkdirSync(outDir,{recursive:true});
 const summary={generated:new Date().toISOString(),reference:reference?{path:relative(root,refRoot),commit:reference.commit}:null,
  totals:{instructions:missionRows.reduce((n,m)=>n+m.instructions,0),commands:commandRows.size,
   byStatus:Object.fromEntries(['core','nop','faithful','authored','silent','skipped','stops'].map(s=>[s,[...commandRows.values()].filter(r=>r.ours.status===s).length]))},
  missions:missionRows,queue:queue.map(({name,opcode,ours,ref,doc,sites,missions,firstMission,portable})=>({name,opcode,status:ours.status,notes:ours.notes??[],handlerLine:ours.line,ref,doc,sites,missions,firstMission,portable}))};
 writeFileSync(join(outDir,'census.json'),JSON.stringify(summary,null,1)+'\n');

 const pct=(n,d)=>d?`${Math.round(n/d*1000)/10}%`:'–';
 const md=[];
 md.push('# Script census','',`Generated by \`node scripts/port/census.mjs\` on ${summary.generated.slice(0,10)}${reference?` against gta-reversed \`${reference.commit.slice(0,10)}\``:' (no gta-reversed checkout: reference columns unknown)'}.`,'',
  'A static read of the original `main.scm` against this port. **ours**: `core`/`nop`/`faithful` dispatch as the source claims; `authored` handlers say in their comments that they stand in for unreversed code; `silent` ones call a host member nothing implements, so they do nothing; `skipped` ones lack a required member, so the game skips them (outputs read as nothing found, conditions as false) and the mission runs on without them; `stops` ones have no handler at all, so the thread gives up there. The census reads source, not behaviour: `faithful` is a claim to check in play, not a proof.','',
  `Commands: ${summary.totals.commands} distinct, ${summary.totals.instructions} instruction sites. `+Object.entries(summary.totals.byStatus).map(([k,v])=>`${k} ${v}`).join(', ')+'.','',
  '## Missions','','In the order the script first launches them (where MAIN and the missions start each block), which is close to but not the story order.','','| # | Mission | Sites | Faithful or core | Authored | Silent | Skipped | Stops | Largest gaps |','|---|---|---|---|---|---|---|---|---|');
 for(const m of missionRows){
  const s=m.byStatus,ok=s.core+s.nop+s.faithful;
  md.push(`| ${m.id} | ${m.name} | ${m.instructions} | ${pct(ok,m.instructions)} | ${s.authored} | ${s.silent} | ${s.skipped} | ${s.stops} | ${m.gaps.slice(0,4).map(g=>`${g.name} (${g.status}, ${g.sites})`).join('; ')} |`);
 }
 md.push('','## Work queue','','Earliest story use first. **Portable** means gta-reversed registers a handler for the command whose own body does not call into the executable: port that function (the engine routines it calls may still, as the mission audio ones do). Otherwise the reference offers no handler (research the engine routines it reaches, or keep the authored stand-in).','',
  '| Command | Ours | Why | Sites | Missions | First in | Reference | Portable |','|---|---|---|---|---|---|---|---|');
 for(const q of summary.queue)md.push(`| ${q.name} | ${q.status} | ${(q.notes.join('; ')||'').replace(/\|/g,'/')} | ${q.sites} | ${q.missions} | ${q.firstMission} | ${q.ref.kind}${q.ref.where?` \`${q.ref.where}\``:''}${q.ref.stub?' (plugin::Call)':''} | ${q.portable?'yes':''} |`);
 writeFileSync(join(outDir,'CENSUS.md'),md.join('\n')+'\n');
 console.log(`census: ${summary.totals.commands} commands, ${summary.queue.length} queued (${summary.queue.filter(q=>q.portable).length} portable) -> ${relative(root,outDir)}/CENSUS.md`);
});
