import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {AWKWARD_SAY_INACTIVE,AWKWARD_SAY_LOADING,AWKWARD_SAY_PLAYING,CONVERSATION_INACTIVE,CONVERSATION_PED_SPEAKING,CONVERSATION_PLAYER_SPEAKING,
 CONVERSATION_WAITING_FOR_INPUT,MAX_NUM_CONVERSATIONS,ScmConversations,MAX_NUM_TEMP_CONVERSATION_NODES,conversationNodeName,type ScmConversationWorld} from '../src/engine/ScmConversations';
import {scmOpcode} from '../src/engine/scmOpcodes';

function instruction(opcode:number,operands:readonly (readonly [number,number]|string)[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const operand of operands){
  if(typeof operand==='string'){out.push(14,operand.length,...[...operand].map(c=>c.charCodeAt(0)));continue;}
  const [type,value]=operand;
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
function run(game:ScmGameState,world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),0);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
const PED=7;
const op=scmOpcode;

describe('the conversations a script builds',()=>{
 test('a name is cut to six characters and raised to upper case as it is stored',()=>{
  expect(conversationNodeName('hellothere')).toBe('HELLOT');
  expect(conversationNodeName('yes')).toBe('YES');
  const game=new ScmGameState();
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['greeting',int(500)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  expect(game.conversations.forPed(PED)?.nodes[0].name).toBe('GREETI');
 });

 test('the scripted-speech forms negate their speech ids and the ordinary ones do not',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_NODE_WITH_SPEECH'),['q','y','n',int(10),int(11),int(12)]),
   instruction(op('SET_UP_CONVERSATION_NODE_WITH_SCRIPTED_SPEECH'),['q2','y2','n2',int(20),int(21),int(22)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  const nodes=game.conversations.forPed(PED)!.nodes;
  expect(nodes[0]).toMatchObject({name:'Q',yes:'Y',no:'N',speech:10,speechYes:11,speechNo:12});
  expect(nodes[1]).toMatchObject({name:'Q2',yes:'Y2',no:'N2',speech:-20,speechYes:-21,speechNo:-22});
 });

 test('an end node carries no answers, and its two answer speeches are nothing',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SCRIPTED_SPEECH'),['bye',int(99)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION_NO_SUBTITLES'),[]));
  const conversation=game.conversations.forPed(PED)!;
  expect(conversation.nodes[0]).toMatchObject({name:'BYE',yes:undefined,no:undefined,speech:-99,speechYes:0,speechNo:0});
  expect(conversation.suppressSubtitles).toBe(true);
 });

 test('the at-node question compares names, and answers no while the player is speaking',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['start',int(1)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  expect(run(game,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(PED),'START'])).condition).toBe(true);
  expect(run(game,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(PED),'start'])).condition).toBe(true);
  expect(run(game,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(PED),'other'])).condition).toBe(false);
  game.conversations.setStatus(PED,CONVERSATION_PLAYER_SPEAKING);
  expect(run(game,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(PED),'START'])).condition).toBe(false);
  // A ped with no conversation of its own is at no node.
  expect(run(game,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(99),'START'])).condition).toBe(false);
  // Stored as six characters, asked with the whole name: a longer name never matches.
  const long=new ScmGameState();
  run(long,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['greeting',int(1)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  expect(run(long,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(PED),'greeting'])).condition).toBe(false);
  expect(run(long,{},instruction(op('IS_CONVERSATION_AT_NODE'),[int(PED),'greeti'])).condition).toBe(true);
 });

 test('clearing one ped’s conversation frees its slot but leaves its status, and clearing all drops them',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['a',int(1)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  // Only CConversationForPed::Update, not reversed, moves the status on.
  expect(game.conversations.goingOn).toBe(false);
  game.conversations.setStatus(PED,CONVERSATION_PED_SPEAKING);
  run(game,{},instruction(op('CLEAR_CONVERSATION_FOR_CHAR'),[int(PED)]));
  expect(game.conversations.count).toBe(0);expect(game.conversations.forPed(PED)).toBeUndefined();
  // CConversationForPed::Clear leaves m_Status alone, so the freed slot still counts as going on.
  expect(game.conversations.goingOn).toBe(true);
  // A new conversation takes the freed slot.
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED+1)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['b',int(1)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  expect(game.conversations.all.length).toBe(1);expect(game.conversations.forPed(PED+1)?.currentNode).toBe('B');
  // CLEAR_ALL_CONVERSATIONS is one of the commands PC 1.0 does nothing with, so the slot survives it.
  run(game,{},instruction(op('CLEAR_ALL_CONVERSATIONS'),[]));
  expect(game.conversations.count).toBe(1);
  game.conversations.clearAll();
  expect(game.conversations.count).toBe(0);
 });

 test('enabling acts on the ped’s own conversation and makes none',()=>{
  const game=new ScmGameState();
  run(game,{},instruction(op('ENABLE_CONVERSATION'),[int(PED),int(0)]));
  expect(game.conversations.forPed(PED)).toBeUndefined();
  run(game,{},instruction(op('START_SETTING_UP_CONVERSATION'),[int(PED)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['a',int(1)]),
   instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  run(game,{},instruction(op('ENABLE_CONVERSATION'),[int(PED),int(0)]));
  expect(game.conversations.forPed(PED)).toMatchObject({enabled:false});
  run(game,{},instruction(op('ENABLE_CONVERSATION'),[int(PED),int(1)]));
  expect(game.conversations.forPed(PED)).toMatchObject({enabled:true});
 });

 test('the three table sizes are the ones the source declares',()=>{
  const game=new ScmGameState();
  game.conversations.startSettingUp(PED);
  for(let index=0;index<MAX_NUM_TEMP_CONVERSATION_NODES;index++)game.conversations.setUpNode(`n${index}`,undefined,undefined,0,0,0);
  expect(()=>game.conversations.setUpNode('one-too-many',undefined,undefined,0,0,0)).toThrow(/twelve/);
  game.conversations.finishSettingUp(false);
  // The finish above already took one of the fourteen slots.
  for(let ped=0;ped<MAX_NUM_CONVERSATIONS-1;ped++){game.conversations.startSettingUp(ped+100);game.conversations.finishSettingUp(false);}
  game.conversations.startSettingUp(999);expect(()=>game.conversations.finishSettingUp(false)).toThrow(/fourteen/);
 });

 test('a node set up with no conversation started is refused',()=>{
  const game=new ScmGameState();
  expect(()=>game.conversations.setUpNode('a',undefined,undefined,0,0,0)).toThrow(/no conversation started/);
  expect(()=>game.conversations.finishSettingUp(false)).toThrow(/none started/);
 });

 test('whether the player stands in position is the host’s to answer',()=>{
  const asked:number[]=[];
  const game=new ScmGameState();
  const thread=run(game,{isPlayerInPositionForConversation:(ped:number)=>{asked.push(ped);return true;}},
   instruction(op('IS_PLAYER_IN_POSITION_FOR_CONVERSATION'),[int(PED)]));
  expect(asked).toEqual([PED]);
  expect(thread.condition).toBe(true);
 });
});

describe('conversations of deleted peds',()=>{
 test('a ped deleted without CLEAR_CONVERSATION_FOR_CHAR frees its slot (CPed::~CPed), so a fifteenth set-up fits',()=>{
  const game=new ScmGameState(),alive=new Set<number>();
  const setUp=(ped:number)=>run(game,{pedExists:h=>alive.has(h)},instruction(op('START_SETTING_UP_CONVERSATION'),[int(ped)]),
   instruction(op('SET_UP_CONVERSATION_END_NODE_WITH_SPEECH'),['hi',int(1)]),instruction(op('FINISH_SETTING_UP_CONVERSATION'),[]));
  for(let ped=1;ped<=MAX_NUM_CONVERSATIONS;ped++){alive.add(ped);setUp(ped);}
  expect(game.conversations.count).toBe(MAX_NUM_CONVERSATIONS);
  // The first ped is culled; a new one's conversation takes its slot.
  alive.delete(1);alive.add(100);setUp(100);
  expect(game.conversations.forPed(100)?.nodes[0].name).toBe('HI');
  expect(game.conversations.forPed(1)).toBeUndefined();
 });
});

describe('DoneSettingUpConversation (iOS 0x1001a5b50)',()=>{
 test('the yes and no names become indices, the last node of a name when two share it, or -1',()=>{
  const c=new ScmConversations();c.startSettingUp(7);
  c.setUpNode('A','B','NONE',1,2,3);c.setUpNode('B',undefined,undefined,4,0,0);c.setUpNode('B',undefined,undefined,5,0,0);
  const conversation=c.finishSettingUp(false,1234);
  expect(conversation.nodes.map(n=>[n.yesIndex,n.noIndex])).toEqual([[2,-1],[-1,-1],[-1,-1]]);
  expect(conversation).toMatchObject({current:0,currentNode:'A',lastChange:1234,lastCloseEnough:0,enabled:true,status:CONVERSATION_INACTIVE});
 });
 test('a second set-up for a ped takes another free slot, and the first stays the one found for it',()=>{
  const c=new ScmConversations();
  c.startSettingUp(7);c.setUpNode('A',undefined,undefined,1,0,0);c.finishSettingUp(false);
  c.startSettingUp(7);c.setUpNode('B',undefined,undefined,1,0,0);c.finishSettingUp(false);
  expect(c.count).toBe(2);expect(c.forPed(7)?.currentNode).toBe('A');
 });
});

describe('CConversationForPed::Update (iOS 0x1001a541c)',()=>{
 const dealer=()=>{
  const c=new ScmConversations();c.startSettingUp(7);
  c.setUpNode('DEAL1','DEAL2','DEAL3',192,77,78);c.setUpNode('DEAL2',undefined,undefined,79,0,0);c.setUpNode('DEAL3',undefined,undefined,75,0,0);
  c.finishSettingUp(false,0);return c;
 };
 const world=(near:{value:boolean}):{log:string[];w:ScmConversationWorld}=>{const log:string[]=[];return {log,w:{inPosition:()=>near.value,clearSmallMessages:()=>{log.push('clear');},
  message:(key,flag,instant)=>{log.push(`${instant?'now':'queue'} ${key} ${flag}`);},say:(ped,context)=>{log.push(`${ped===undefined?'player':'ped'} says ${context}`);}}};};
 test('in position, the ped greets; an answer 400 ms on makes the player say it, and the ped goes on 4 s later',()=>{
  const c=dealer(),near={value:true},{log,w}=world(near),conversation=c.forPed(7)!;
  c.update(20000,w);
  expect(log).toEqual(['clear','now DEAL1 1','ped says 192']);expect(conversation.status).toBe(CONVERSATION_PED_SPEAKING);
  // Too soon after the change, a Yes is not taken.
  c.answer('yes');c.update(20400,w);expect(log.length).toBe(3);
  // The ped's line need not have ended: from 400 ms on, a Yes is the player's line.
  expect(c.answer('yes')).toBe(true);c.update(20500,w);
  expect(log.slice(3)).toEqual(['clear','now DEAL1Y 3','player says 77','queue DEAL2 1']);
  expect(conversation.status).toBe(CONVERSATION_PLAYER_SPEAKING);expect(c.isAtNode(7,'DEAL2')).toBe(false);
  c.update(24500,w);expect(conversation.status).toBe(CONVERSATION_PLAYER_SPEAKING);
  c.update(24501,w);expect(log.slice(7)).toEqual(['clear','now DEAL2 1','ped says 79']);expect(c.isAtNode(7,'DEAL2')).toBe(true);
  c.update(28502,w);expect(conversation.status).toBe(CONVERSATION_WAITING_FOR_INPUT);
  // A node with no answers ends nothing: the conversation stays at it.
  c.answer('yes');c.update(29000,w);c.answer('no');c.update(29100,w);expect(c.isAtNode(7,'DEAL2')).toBe(true);expect(log.length).toBe(10);
 });
 test('either button hands the player\'s turn to the ped at once; No is asked before Yes',()=>{
  const c=dealer(),{log,w}=world({value:true});
  c.update(20000,w);c.answer('no');c.answer('yes');c.update(21000,w);
  expect(log.slice(3)).toEqual(['clear','now DEAL1N 3','player says 78','queue DEAL3 1']);
  c.answer('yes');c.update(21100,w);expect(log.slice(7)).toEqual(['clear','now DEAL3 1','ped says 75']);
 });
 test('out of position a conversation goes inactive where it is; back within 10 s it still takes an answer, after 10 s the ped greets again',()=>{
  const c=dealer(),near={value:true},{log,w}=world(near),conversation=c.forPed(7)!;
  c.update(20000,w);near.value=false;c.update(21000,w);expect(conversation.status).toBe(CONVERSATION_INACTIVE);
  near.value=true;c.answer('yes');c.update(25000,w);expect(log.at(-1)).toBe('queue DEAL2 1');
  near.value=false;c.update(26000,w);near.value=true;c.update(40000,w);expect(log.slice(-2)).toEqual(['now DEAL2 1','ped says 79']);
 });
 test('a disabled conversation goes inactive and says nothing; the conversations run side by side',()=>{
  const off=dealer(),x=world({value:true});off.enable(7,false);off.update(20000,x.w);expect(x.log).toEqual([]);
  const c=new ScmConversations(),{log,w}=world({value:true});
  for(const ped of [1,2]){c.startSettingUp(ped);c.setUpNode(`HI${ped}`,undefined,undefined,10+ped,0,0);c.finishSettingUp(true,0);}
  c.update(20000,w);expect(log).toEqual(['ped says 11','ped says 12']);
 });
 test('a scripted line goes to mission audio, and no conversation updates until it has played',()=>{
  const c=new ScmConversations(),{log,w}=world({value:true}),audio={loaded:false,finished:false,played:0,preloaded:[] as unknown[]};
  w.awkward={preload:(sample,ped)=>{audio.preloaded.push([sample,ped]);},loaded:()=>audio.loaded,play:()=>{audio.played++;},finished:()=>audio.finished};
  c.startSettingUp(7);c.setUpNode('Q','A',undefined,-1800,-1801,0);c.setUpNode('A',undefined,undefined,5,0,0);c.finishSettingUp(true,0);
  c.update(20000,w);expect(audio.preloaded).toEqual([[1800,7]]);expect(c.awkwardSayStatus).toBe(AWKWARD_SAY_LOADING);
  c.answer('yes');c.update(20500,w);expect(c.forPed(7)!.currentNode).toBe('Q');
  audio.loaded=true;c.update(20600,w);expect(audio.played).toBe(1);expect(c.awkwardSayStatus).toBe(AWKWARD_SAY_PLAYING);
  audio.finished=true;c.answer('yes');c.update(20700,w);expect(c.awkwardSayStatus).toBe(AWKWARD_SAY_LOADING);
  expect(audio.preloaded.at(-1)).toEqual([1801,undefined]);expect(c.forPed(7)!.currentNode).toBe('A');
  expect(log).toEqual([]);expect(AWKWARD_SAY_INACTIVE).toBe(0);
 });
});
