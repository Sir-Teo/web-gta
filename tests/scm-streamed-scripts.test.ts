import {describe,expect,test} from 'vitest';
import {readFile} from 'node:fs/promises';
import {readImgIndex,readImgEntry} from '../src/assets/img';
import {readScmHeader,decodeScmInstruction} from '../src/assets/scm';
import {NUM_STREAMED_SCRIPTS,ScmStreamedScripts} from '../src/engine/ScmStreamedScripts';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {ScmGameState} from '../src/engine/ScmGameState';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {scmOpcode} from '../src/engine/scmOpcodes';

const script=async()=>new Uint8Array(await readFile('public/play/world/files/scripts/main.scm'));
const archive=async()=>new Blob([await readFile('public/play/world/files/scripts/script.img')]);
/** The archive's files registered in the order it lists them, as CStreaming does. */
async function registered(){
 const file=await archive(),entries=await readImgIndex(file);
 const scripts=new ScmStreamedScripts();
 for(const entry of entries)scripts.registerScript(entry.name.replace(/\.scm$/i,''));
 return {scripts,entries,file};
}

describe('streamed scripts',()=>{
 test('every external script the header names is in the archive',async()=>{
  const {scripts}=await registered(),header=readScmHeader(await script());
  expect(header.streamed.length).toBe(79);
  expect(scripts.count).toBeLessThanOrEqual(NUM_STREAMED_SCRIPTS);
  scripts.readStreamedScriptData(header.streamed.map(s=>({name:s.name,size:s.size})),header.largestStreamedSize);
  expect(scripts.largestExternalSize).toBe(header.largestStreamedSize);
  for(const [scriptIndex,entry] of header.streamed.entries()){
   const index=scripts.findStreamedScript(entry.name);
   expect(index,entry.name).toBeGreaterThanOrEqual(0);
   expect(scripts.at(index).sizeInBytes).toBe(entry.size);
   expect(scripts.properIndexFromScriptIndex(scriptIndex)).toBe(index);
  }
 });

 test('a name the archive does not carry stops the read',async()=>{
  const scripts=new ScmStreamedScripts();
  scripts.registerScript('present');
  expect(()=>scripts.readStreamedScriptData([{name:'missing',size:4}],4)).toThrow('not in the archive');
 });

 test('a loaded script runs as its own external thread over its own bytes',async()=>{
  const {scripts,entries,file}=await registered(),bytes=await script(),header=readScmHeader(bytes);
  scripts.readStreamedScriptData(header.streamed.map(s=>({name:s.name,size:s.size})),header.largestStreamedSize);
  const name=header.streamed[0].name,index=scripts.findStreamedScript(name);
  const entry=entries.find(e=>e.name.replace(/\.scm$/i,'').toLowerCase()===name.toLowerCase())!;
  expect(entry).toBeDefined();
  // Nothing starts while the slot is empty.
  expect(scripts.startNewStreamedScript(index)).toBeUndefined();
  scripts.loadStreamedScript(index,await readImgEntry(file,entry));
  const started=scripts.startNewStreamedScript(index)!;
  expect(started.bytes.length).toBe(scripts.at(index).sizeInBytes);
  expect(scripts.at(index).users).toBe(1);
  expect(scripts.indexOfMemory(started.bytes)).toBe(index);
  // The thread reads its own file, not the script space, and says it is external.
  const {runtime}=ScmRuntime.load(bytes);
  const {thread}=runtime.startStreamed(started.bytes);
  expect(thread.isExternal).toBe(true);
  expect(thread.scriptSpace).toBe(started.bytes);
  // Its first instruction decodes where the file begins, and it is the name every script opens with.
  const first=decodeScmInstruction(started.bytes,0);
  expect(first.name).toBe('SCRIPT_NAME');
  expect(thread.ip).toBe(0);
 });

 test('re-initialising drops every hold without unloading the files',async()=>{
  const {scripts,entries,file}=await registered(),header=readScmHeader(await script());
  scripts.readStreamedScriptData(header.streamed.map(s=>({name:s.name,size:s.size})),header.largestStreamedSize);
  const index=scripts.findStreamedScript(header.streamed[1].name);
  const entry=entries.find(e=>e.name.replace(/\.scm$/i,'').toLowerCase()===header.streamed[1].name.toLowerCase())!;
  scripts.loadStreamedScript(index,await readImgEntry(file,entry));
  scripts.startNewStreamedScript(index);scripts.startNewStreamedScript(index);
  expect(scripts.at(index).users).toBe(2);
  scripts.reInitialise();
  expect(scripts.at(index).users).toBe(0);
  expect(scripts.at(index).memory).toBeDefined();
  scripts.removeFromMemory(index);
  expect(scripts.at(index).memory).toBeUndefined();
  expect(scripts.startNewStreamedScript(index)).toBeUndefined();
 });

 test('the registry holds eighty-two files and refuses the next',()=>{
  const scripts=new ScmStreamedScripts();
  for(let i=0;i<NUM_STREAMED_SCRIPTS;i++)scripts.registerScript(`file${i}`);
  expect(()=>scripts.registerScript('one too many')).toThrow('eighty-two');
  scripts.initialise();
  expect(scripts.count).toBe(0);
 });

 test('the script asks after a file by its own index, starts it and lets it go',async()=>{
  const {scripts,entries,file}=await registered(),bytes=await script(),header=readScmHeader(bytes);
  scripts.readStreamedScriptData(header.streamed.map(s=>({name:s.name,size:s.size})),header.largestStreamedSize);
  const game=new ScmGameState();
  for(const slot of scripts.registered)game.streamedScripts.registerScript(slot.filename);
  game.streamedScripts.readStreamedScriptData(header.streamed.map(s=>({name:s.name,size:s.size})),header.largestStreamedSize);
  const started:number[]=[];
  const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands,startStreamedScript:index=>{started.push(index);}};
  // HAS_STREAMED_SCRIPT_LOADED, then START_NEW_STREAMED_SCRIPT, both naming script index zero.
  const ask=new Uint8Array(4);new DataView(ask.buffer).setUint16(0,scmOpcode('HAS_STREAMED_SCRIPT_LOADED'),true);ask[2]=4;ask[3]=0;
  const empty=new ScmThread(ask,0,0,undefined,host);
  try{empty.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(empty.condition).toBe(false);
  const index=game.streamedScripts.properIndexFromScriptIndex(0);
  const entry=entries.find(e=>e.name.replace(/\.scm$/i,'').toLowerCase()===game.streamedScripts.filename(index).toLowerCase())!;
  game.streamedScripts.loadStreamedScript(index,await readImgEntry(file,entry));
  const loaded=new ScmThread(ask,0,0,undefined,host);
  try{loaded.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(loaded.condition).toBe(true);
  // The command takes a variable argument list, which ends with a zero type byte.
  const start=new Uint8Array(7);const view=new DataView(start.buffer);
  view.setUint16(0,scmOpcode('START_NEW_STREAMED_SCRIPT'),true);start[2]=4;start[3]=0;start[4]=4;start[5]=7;start[6]=0;
  const runner=new ScmThread(start,0,0,undefined,host);
  try{runner.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  expect(started).toEqual([index]);
 });
});
