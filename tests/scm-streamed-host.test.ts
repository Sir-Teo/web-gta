import {expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {ScmMissionAudio} from '../src/engine/ScmMissionAudio';
import {ScmObjects} from '../src/engine/ScmObjects';
import {readTwoDEffects} from '../src/assets/twoDEffect';
import {validRandomPedType} from '../src/simulation/ScmMission';

const main=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
/** script.img's files by name, as ScmMission.loadStreamedScripts reads the VER2 directory. */
function scriptImg(){
 const img=new Uint8Array(readFileSync('public/play/world/files/scripts/script.img')),view=new DataView(img.buffer,img.byteOffset,img.byteLength),files:{name:string;bytes:Uint8Array}[]=[];
 for(let i=0;i<view.getUint32(4,true);i++){
  const at=8+i*32,offset=view.getUint32(at,true)*2048,length=view.getUint16(at+4,true)*2048;
  let name='';for(let c=0;c<24&&img[at+8+c];c++)name+=String.fromCharCode(img[at+8+c]);
  files.push({name:name.replace(/\.scm$/i,''),bytes:img.subarray(offset,offset+length)});
 }
 return files;
}

test('script.img registers against MAIN\'s streamed table, and a started file runs over its own bytes with MAIN\'s globals',()=>{
 const {runtime,header}=ScmRuntime.load(main()),scripts=runtime.game.streamedScripts,files=scriptImg();
 expect(files).toHaveLength(79);expect(header.streamed).toHaveLength(79);
 for(const file of files)scripts.registerScript(file.name);
 scripts.readStreamedScriptData(header.streamed,header.largestStreamedSize);
 // MAIN names AMMU as its streamed script 60; the archive lists it second.
 const ammu=scripts.properIndexFromScriptIndex(60);
 expect(scripts.filename(ammu).toLowerCase()).toBe('ammu');
 // Nothing starts before the file has streamed in (StartNewStreamedScript on an empty slot).
 expect(runtime.startNewStreamedScript(ammu)).toBeUndefined();
 scripts.loadStreamedScript(ammu,files.find(f=>f.name.toLowerCase()==='ammu')!.bytes);
 const started=runtime.startNewStreamedScript(ammu,[7])!;
 expect(started.thread.isExternal).toBe(true);expect(scripts.at(ammu).users).toBe(1);
 // The command's argument is the thread's first local.
 expect(started.thread.locals.getInt32(0,true)).toBe(7);
 // ammu.scm opens by zeroing its globals (SET_VAR_FLOAT $38340 0 ...): they are MAIN's script space, not the file.
 const globals=new DataView(runtime.scriptSpace.buffer,runtime.scriptSpace.byteOffset,runtime.scriptSpace.byteLength);
 globals.setFloat32(38340,5,true);
 const before=started.thread.scriptSpace.slice(0,64);
 // With no world behind it the script stops at its first REQUEST_MODEL, after the globals.
 const stopped:string[]=[];runtime.onUnsupported=error=>{stopped.push(error.command);};
 runtime.process(0,20);
 expect(globals.getFloat32(38340,true)).toBe(0);
 expect([...started.thread.scriptSpace.slice(0,64)]).toEqual([...before]);
 expect(stopped).toEqual(['REQUEST_MODEL']);
 // A thread that ends gives its file's user back (ShutdownThisScript).
 expect(scripts.at(ammu).users).toBe(0);
});

test('a sample a mission audio slot already holds is not loaded again',()=>{
 const audio=new ScmMissionAudio();
 audio.preload(4,42600);expect(audio.hasLoaded(4)).toBe(false);
 audio.service(20);expect(audio.hasLoaded(4)).toBe(true);
 // The vending machine asks again every frame it waits for the button.
 audio.preload(4,42600);expect(audio.hasLoaded(4)).toBe(true);
 // Another sample does reload the slot.
 audio.preload(4,42601);expect(audio.hasLoaded(4)).toBe(false);
});

test('a map object a brain is allocated to is a script object with no view of its own',()=>{
 const objects=new ScmObjects(),object=objects.adoptWorld('CJ_SPRUNK1',{x:-19,y:-57.8,z:1003.6},180,'cj_sprunk1:0:-19.0:-57.8');
 expect(objects.exists(object.handle)).toBe(true);expect(object.worldPlacement).toBe('cj_sprunk1:0:-19.0:-57.8');
 expect(objects.getHeading(object.handle)).toBeCloseTo(180,4);expect(objects.hasModel(object.handle,'CJ_SPRUNK1')).toBe(true);
 expect(object.missionCleanup).toBe(false);
});

test('ThisIsAValidRandomPed: civilians, the nine gangs, or criminals and prostitutes',()=>{
 expect(validRandomPedType(4,true,false,false)).toBe(true);expect(validRandomPedType(5,false,true,true)).toBe(false);
 expect(validRandomPedType(7,false,true,false)).toBe(true);expect(validRandomPedType(15,false,true,false)).toBe(true);expect(validRandomPedType(16,true,true,true)).toBe(false);
 expect(validRandomPedType(20,false,false,true)).toBe(true);expect(validRandomPedType(22,false,false,true)).toBe(true);
 expect(validRandomPedType(6,true,true,true)).toBe(false);
});

test('a trigger point 2d effect carries the index FindTriggerPointCoors looks it up by',()=>{
 // One effect: position (1, 2, 3), type 8 (EFFECT_TRIGGER_POINT), four bytes of data, index 5.
 const bytes=new Uint8Array(4+12+8+4),view=new DataView(bytes.buffer);
 view.setUint32(0,1,true);view.setFloat32(4,1,true);view.setFloat32(8,2,true);view.setFloat32(12,3,true);view.setUint32(16,8,true);view.setUint32(20,4,true);view.setUint32(24,5,true);
 const [effect]=readTwoDEffects(bytes);
 expect(effect.position).toEqual([1,2,3]);expect(effect.triggerPoint).toBe(5);
});

test('releasing a streamed file leaves its count of running instances alone (MAIN\'s CRANES starts crane2.scm while none runs)',async()=>{
 const {ScmThread}=await import('../src/engine/ScmThread');
 const {readScmHeader,decodeScmInstructions}=await import('../src/assets/scm');
 const bytes=main(),{runtime,header}=ScmRuntime.load(bytes),scripts=runtime.game.streamedScripts,files=scriptImg();
 for(const file of files)scripts.registerScript(file.name);
 scripts.readStreamedScriptData(header.streamed,header.largestStreamedSize);
 const crane=scripts.properIndexFromScriptIndex(68);
 expect(scripts.filename(crane).toLowerCase()).toBe('crane2');
 scripts.loadStreamedScript(crane,files.find(f=>f.name.toLowerCase()==='crane2')!.bytes);
 runtime.startNewStreamedScript(crane,[]);
 expect(scripts.at(crane).users).toBe(1);
 // CRANES' own MARK_STREAMED_SCRIPT_AS_NO_LONGER_NEEDED 68, which it runs every tenth of a second while crane2 runs.
 const main0=readScmHeader(bytes),mark=decodeScmInstructions(bytes,main0.entry,main0.mainSize)
  .find(i=>i.name==='MARK_STREAMED_SCRIPT_AS_NO_LONGER_NEEDED'&&(i.parameters[0] as {value?:unknown})?.value===68)!;
 expect(mark).toBeDefined();
 const thread=new ScmThread(bytes,mark.offset,0,undefined,{startScript(){throw new Error('unexpected');},game:runtime.game,world:{fade(){}} as never});
 try{thread.run(0,1);}catch{/* the commands after it ask for a world this test has not got */}
 expect(scripts.at(crane).users).toBe(1);
});
