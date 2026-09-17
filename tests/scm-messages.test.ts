import {expect,test} from 'vitest';
import {ScmHelpMessage,ScmIntroText,ScmMessages,USE_TEXT_DISABLED,USE_TEXT_ENABLED_BY_SCRIPT} from '../src/engine/ScmMessages';
import {ScmRuntime} from '../src/engine/ScmRuntime';
import {scmOpcode} from '../src/engine/scmOpcodes';
import type {ScmWorldCommands} from '../src/engine/ScmThread';

const int=(n:number)=>{const a=new Uint8Array(5);a[0]=1;new DataView(a.buffer).setInt32(1,n,true);return [...a];};
const float=(n:number)=>{const a=new Uint8Array(5);a[0]=6;new DataView(a.buffer).setFloat32(1,n,true);return [...a];};
const global=(n:number)=>[2,n&255,n>>8];
const key=(s:string)=>[9,...Array.from({length:8},(_,i)=>s.charCodeAt(i)||0)];
const op=(name:string|number,...args:number[][])=>{const n=typeof name==='number'?name:scmOpcode(name);return [n&255,n>>8,...args.flat()];};
function run(code:number[][],nowMs=0,world?:ScmWorldCommands){
 const space=new Uint8Array(2048);space.set([...code.flat(),0x4e,0],128);
 const runtime=new ScmRuntime(space,world);const {thread}=runtime.start(128);runtime.process(nowMs,20);
 return {runtime,thread,game:runtime.game,globals:new DataView(space.buffer)};
}
const keys=(slots:readonly ({key:string}|undefined)[])=>slots.map(s=>s?.key??null);

test('brief messages queue into free slots, jump to the front instantly and record previous briefs',()=>{
 const m=new ScmMessages();
 m.addMessageQ('A',1000,0,true,10);m.addMessageQ('B',1000,0,true,10);
 expect(keys(m.briefs).slice(0,3)).toEqual(['A','B',null]);
 expect(keys(m.previousBriefs).slice(0,2)).toEqual(['A',null]); // only the front slot registers on queueing
 m.addMessageJump('C',500,1,true,20);
 expect(keys(m.briefs).slice(0,3)).toEqual(['C','B',null]);expect(m.briefs[0]).toMatchObject({flags:1,visibleTime:500,createdAt:20});
 expect(keys(m.previousBriefs).slice(0,3)).toEqual(['C','A',null]);
 for(let i=0;i<10;i++)m.addMessageQ(`Q${i}`,1,0,false,30);
 expect(m.briefs.every(Boolean)).toBe(true);expect(keys(m.briefs).at(-1)).toBe('Q5'); // eight slots, overflow dropped
 m.addMessageQ('A',1000,0,true,10);expect(keys(m.previousBriefs).slice(0,3)).toEqual(['C','A',null]);
});

test('previous briefs skip exact duplicates, keep twenty entries and shift older ones down',()=>{
 const m=new ScmMessages();
 m.addToPreviousBriefArray('K',[1,-1,-1,-1,-1,-1]);
 m.addToPreviousBriefArray('K',[1,-1,-1,-1,-1,-1]);
 m.addToPreviousBriefArray('K',[2,-1,-1,-1,-1,-1]);
 expect(keys(m.previousBriefs).slice(0,3)).toEqual(['K','K',null]);expect(m.previousBriefs[0]?.numbers[0]).toBe(2);
 for(let i=0;i<25;i++)m.addToPreviousBriefArray(`P${i}`);
 expect(m.previousBriefs).toHaveLength(20);expect(m.previousBriefs[0]?.key).toBe('P24');expect(m.previousBriefs[19]?.key).toBe('P5');
 expect(()=>m.addToPreviousBriefArray('X',[1,2])).toThrow('six');
});

test('process expires the front message, promotes the next with a fresh timestamp and mirrors the front into previous briefs',()=>{
 const m=new ScmMessages();
 m.addMessageQ('A',100,0,false,0);m.addMessageQ('B',100,0,false,0);
 m.process(100);expect(keys(m.briefs).slice(0,2)).toEqual(['A','B']); // inclusive boundary keeps A
 expect(keys(m.previousBriefs)[0]).toBe('A');
 m.process(101);expect(keys(m.briefs).slice(0,3)).toEqual(['B',null,null]);expect(m.briefs[0]?.createdAt).toBe(101);
 expect(keys(m.previousBriefs).slice(0,2)).toEqual(['B','A']);
 m.addBigMessage2('T',50,4,true,101);m.process(151);expect(m.big[4][0]?.key).toBe('T');m.process(152);expect(m.big[4][0]).toBeUndefined();
});

test('big message stacks are per style, clear-with-title keeps mission titles and clear-this removes every match',()=>{
 const m=new ScmMessages();let blanked:number[]=[];m.onClearBigMessage=style=>{blanked.push(style);};
 m.addBigMessage2('M',1000,0,false,0);m.addBigMessage2('M2',1000,0,false,0);m.addBigMessage2('TITLE',1000,4,true,0);m.addBigMessage2('BR',1000,1,true,0);
 expect(()=>m.addBigMessage2('X',1,7,true,0)).toThrow('eMessageStyle');
 m.addMessageQ('S',1,0,false,0);
 m.clearMessages(true);
 expect(m.big[0][0]).toBeUndefined();expect(m.big[4][0]?.key).toBe('TITLE');expect(m.big[1][0]?.key).toBe('BR');expect(m.briefs[0]).toBeUndefined();
 m.clearThisPrintBigNow(4,5);expect(m.big[4][0]).toBeUndefined();expect(blanked).toEqual([4]);
 m.addMessageQ('X',1,0,false,0);m.addMessageQ('Y',1,0,false,0);m.addMessageQ('X',1,0,false,0);m.addMessageQ('Z',1,0,false,0);
 m.clearThisPrint('X',77);
 expect(keys(m.briefs).slice(0,3)).toEqual(['Y','Z',null]);expect(m.briefs[0]?.createdAt).toBe(77);expect(keys(m.previousBriefs)[0]).toBe('Y');
 m.clearMessages(false);expect(m.big[1][0]).toBeUndefined();
});

test('help message blanks its buffers before the permanent comparison and honours the blocking conditions',()=>{
 const messages=new ScmMessages(),help=new ScmHelpMessage();
 help.set('HELP1',false,false,true,messages);
 expect([help.message,help.state,help.permanent,help.quick]).toEqual(['HELP1',0,false,false]);expect(keys(messages.previousBriefs)[0]).toBe('HELP1');
 help.set('HELP2',false,true,false,messages);
 expect([help.message,help.toPrint,help.last,help.state,help.permanent]).toEqual(['HELP2','HELP2','HELP2',1,true]);
 help.set(undefined,true,false,false,messages); // CLEAR_HELP while permanent: buffers blank, early return keeps state
 expect([help.message,help.toPrint,help.state,help.permanent]).toEqual(['','',1,true]);
 help.set('HELP3',false,false,false,messages);expect([help.message,help.state,help.permanent]).toEqual(['HELP3',0,false]);
 let blocked=true;help.blocked=()=>blocked;
 help.set('HELP4',false,false,false,messages);expect(help.message).toBe('HELP3');
 blocked=false;help.setWithNumber('NUM',7,false,true);expect([help.message,help.state,help.toPrint]).toEqual(['NUM#7',1,'NUM#7']);
});

test('intro text lines carry tScriptText defaults, reset each frame and need USE_TEXT_COMMANDS',()=>{
 const text=new ScmIntroText(640,448);
 expect(()=>text.display(0,0,'K',-1,-1)).toThrow('USE_TEXT_COMMANDS');
 text.useTextCommands=USE_TEXT_ENABLED_BY_SCRIPT;text.pending.scale={x:1,y:2};text.display(10,20,'K',3,4);
 expect(text.count).toBe(1);expect(text.lines[0]).toMatchObject({scale:{x:1,y:2},position:{x:10,y:20},key:'K',number1:3,number2:4,wrapX:448,centreSize:640,colour:[225,225,225,255],dropShadow:2});
 text.beginFrame();expect(text.count).toBe(0);expect(text.lines[0].scale).toEqual({x:0.48,y:1.12});
 text.useTextCommands=1;text.beginFrame();expect(text.useTextCommands).toBe(USE_TEXT_DISABLED);
});

test('print commands route through the queues with the previous-brief flag consumed once',()=>{
 const {game}=run([op('ADD_NEXT_MESSAGE_TO_PREVIOUS_BRIEFS',int(0)),op('PRINT_NOW',key('FIRST'),int(3000),int(1)),op('PRINT',key('SECOND'),int(2000),int(0)),
  op('PRINT_WITH_2_NUMBERS_BIG',key('BIG'),int(5),int(6),int(4000),int(2)),op('PRINT_WITH_2_NUMBERS_NOW',key('N3'),int(1),int(2),int(100),int(0)),
  op('PRINT_BIG_Q',key('QUEUED'),int(50),int(2)),op('CLEAR_THIS_BIG_PRINT',key('BIG')),op('FLASH_HUD_OBJECT',int(3))],500);
 const {messages}=game;
 expect(keys(messages.briefs).slice(0,3)).toEqual(['N3','SECOND',null]); // FIRST was replaced by the later jump
 expect(messages.briefs[0]).toMatchObject({numbers:[1,2,-1,-1,-1,-1],createdAt:500,visibleTime:100,previousBrief:true});
 expect(keys(messages.previousBriefs).slice(0,3)).toEqual(['N3',null,null]); // FIRST was suppressed by the flag; SECOND queued behind the front
 expect(keys(messages.big[1]).slice(0,2)).toEqual(['QUEUED',null]);expect(game.hudItemToFlash).toBe(3);expect(game.addNextMessageToPreviousBriefs).toBe(true);
});

test('subtitle-only prints are dropped when subtitles are off and the resolver reports a ~z~ label',()=>{
 const world:ScmWorldCommands={fade(){},resolveText:k=>k==='ZONLY'?'~z~Only in subtitles':'Spoken'};
 const off=run([op('PRINT_NOW',key('ZONLY'),int(1),int(0)),op('PRINT',key('OTHER'),int(1),int(0))],0,world);
 off.game.showSubtitles=true;
 const {game}=(()=>{const space=new Uint8Array(512);space.set([...op('PRINT_NOW',key('ZONLY'),int(1),int(0)),...op('PRINT',key('OTHER'),int(1),int(0)),0x4e,0],128);const runtime=new ScmRuntime(space,world);runtime.game.showSubtitles=false;runtime.start(128);runtime.process(0,20);return runtime;})();
 expect(keys(game.messages.briefs).slice(0,2)).toEqual(['OTHER',null]);
 expect(keys(off.game.messages.briefs).slice(0,2)).toEqual(['ZONLY','OTHER']);
});

test('help, text-line and streaming commands update state or call the adapter with resolved model names',()=>{
 const calls:unknown[][]=[];
 const world:ScmWorldCommands={fade(){},isFading:()=>true,loadMissionText(name){calls.push(['text',name]);},requestModel(m){calls.push(['request',m]);},hasModelLoaded:m=>m===400,markModelNotNeeded(m){calls.push(['mark',m]);},loadAllModelsNow(){calls.push(['loadAll']);}};
 const space=new Uint8Array(2048);
 space.set([...op('PRINT_HELP',key('HLP')),...op('PRINT_HELP_FOREVER',key('HLPF')),...op('CLEAR_HELP'),...op('USE_TEXT_COMMANDS',int(1)),...op('SET_TEXT_COLOUR',int(1),int(2),int(3),int(4)),...op('SET_TEXT_DROPSHADOW',int(1),int(9),int(8),int(7),int(6)),
  ...op('DISPLAY_TEXT_WITH_FLOAT',float(100),float(200),key('FLT'),float(3.75),float(2)),...op('DISPLAY_TEXT_WITH_2_NUMBERS',float(1),float(2),key('TWO'),int(8),int(9)),
  ...op('LOAD_MISSION_TEXT',key('INTRO')),...op('REQUEST_MODEL',int(400)),...op('REQUEST_MODEL',int(-2)),...op('HAS_MODEL_LOADED',int(400)),...op('MARK_MODEL_AS_NO_LONGER_NEEDED',int(-1)),...op('LOAD_ALL_MODELS_NOW'),
  ...op(scmOpcode('GET_FADING_STATUS')|0x8000),...op('DISPLAY_NON_MINIGAME_HELP_MESSAGES',int(0)),...op('PRINT_HELP',key('HID')),0x4e,0],128);
 const runtime=new ScmRuntime(space,world,undefined,undefined,{file:new Uint8Array(0),offsets:[],exclusiveMissions:0,objectNames:['','CJ_PHONE','LOD_LAND']});
 const {thread}=runtime.start(128);runtime.game.miniGameInProgress=true;
 runtime.process(0,20);
 const {game}=runtime;
 expect([game.help.message,game.help.state,game.help.permanent]).toEqual(['',1,true]);
 expect(keys(game.messages.previousBriefs).slice(0,3)).toEqual(['HLPF','HLP',null]);
 expect(game.introText.count).toBe(2);
 expect(game.introText.lines[0]).toMatchObject({colour:[1,2,3,4],dropShadow:1,dropShadowColour:[9,8,7,6],position:{x:100,y:200},key:'FLT',number1:3,number2:75});
 expect(game.introText.lines[1]).toMatchObject({key:'TWO',number1:8,number2:9,colour:[225,225,225,255]});
 expect(calls).toEqual([['text','INTRO'],['request',400],['request','LOD_LAND'],['mark','CJ_PHONE'],['loadAll']]);
 expect(thread.condition).toBe(false); // negated GET_FADING_STATUS while fading
 expect(game.displayNonMiniGameHelpMessages).toBe(false);expect(game.help.message).toBe(''); // minigame suppression left the help untouched
 runtime.process(20,20);expect(game.introText.count).toBe(0); // lines reset each processing frame while text commands are in use
});
