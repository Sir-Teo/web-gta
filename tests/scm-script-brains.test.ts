import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {BRAIN_ATTRACTOR,BRAIN_CODE,BRAIN_OBJECT,BRAIN_RANDOM_PED,NUM_SCRIPT_BRAINS} from '../src/engine/ScmScriptBrains';
import {scmOpcode} from '../src/engine/scmOpcodes';

function run(bytes:Uint8Array,game:ScmGameState){
 const host:ScmThreadHost={startScript(){},game,world:{fade(){}} as ScmWorldCommands};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
/** An instruction whose operands are given as [type,value] pairs; strings are written as short strings. */
function assemble(opcode:number,operands:(readonly [number,number]|string)[]){
 const parts:number[][]=[[opcode&0xff,opcode>>8&0xff]];
 for(const operand of operands){
  if(typeof operand==='string'){
   parts.push([14,operand.length,...[...operand].map(character=>character.charCodeAt(0))]);
   continue;
  }
  const [type,value]=operand;
  if(type===1){const b=new Uint8Array(4);new DataView(b.buffer).setInt32(0,value,true);parts.push([1,...b]);}
  else if(type===4)parts.push([4,value&0xff]);
  else if(type===6){const b=new Uint8Array(4);new DataView(b.buffer).setFloat32(0,value,true);parts.push([6,...b]);}
  else if(type===2||type===3){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,value,true);parts.push([type,...b]);}
  else throw new Error('Unhandled operand type.');
 }
 return new Uint8Array(parts.flat());
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;

describe('the script brains a script allocates',()=>{
 test('an object brain keeps the script, the model, the chance, the radius and the grouping id',()=>{
  const game=new ScmGameState();
  run(assemble(scmOpcode('ALLOCATE_STREAMED_SCRIPT_TO_OBJECT'),[int(4),int(2900),int(100),float(20),int(7)]),game);
  expect(game.scriptBrains.count).toBe(1);
  expect(game.scriptBrains.brains[0]).toMatchObject({
   streamedScriptIndex:4,typeOfBrain:BRAIN_OBJECT,model:2900,percentageChance:100,
   activationRadius:20,objectGroupingId:7,active:true,
  });
 });

 test('a random-ped brain has no grouping and takes the default radius',()=>{
  const game=new ScmGameState();
  run(assemble(scmOpcode('ALLOCATE_STREAMED_SCRIPT_TO_RANDOM_PED'),[int(9),int(105),int(30)]),game);
  expect(game.scriptBrains.brains[0]).toMatchObject({
   typeOfBrain:BRAIN_RANDOM_PED,percentageChance:30,activationRadius:5,objectGroupingId:-1,
  });
 });

 test('code-use brains are found by name, and the two kinds do not answer for each other',()=>{
  const game=new ScmGameState();
  run(assemble(scmOpcode('REGISTER_SCRIPT_BRAIN_FOR_CODE_USE'),[int(11),'copcar']),game);
  run(assemble(scmOpcode('REGISTER_ATTRACTOR_SCRIPT_BRAIN_FOR_CODE_USE'),[int(12),'seat']),game);
  expect(game.scriptBrains.brains.map(brain=>brain.typeOfBrain)).toEqual([BRAIN_CODE,BRAIN_ATTRACTOR]);
  expect(game.scriptBrains.indexOfName('COPCAR',false)).toBe(0);
  expect(game.scriptBrains.indexOfName('SEAT',true)).toBe(1);
  expect(game.scriptBrains.indexOfName('SEAT',false)).toBe(-1);
  expect(game.scriptBrains.indexOfName('nothing',false)).toBe(-1);
 });

 test('switching a grouping turns every object brain of that id, and nothing else, off',()=>{
  const game=new ScmGameState();
  const allocate=(script:number,grouping:number)=>run(assemble(scmOpcode('ALLOCATE_STREAMED_SCRIPT_TO_OBJECT'),
   [int(script),int(2900),int(100),float(5),int(grouping)]),game);
  allocate(1,3);allocate(2,3);allocate(3,4);
  run(assemble(scmOpcode('ALLOCATE_STREAMED_SCRIPT_TO_RANDOM_PED'),[int(4),int(105),int(50)]),game);
  run(assemble(scmOpcode('SWITCH_OBJECT_BRAINS'),[int(3),int(0)]),game);
  expect(game.scriptBrains.brains.map(brain=>brain.active)).toEqual([false,false,true,true]);
  run(assemble(scmOpcode('SWITCH_OBJECT_BRAINS'),[int(3),int(1)]),game);
  expect(game.scriptBrains.brains.every(brain=>brain.active)).toBe(true);
 });

 test('the table holds seventy brains and refuses the seventy-first',()=>{
  const game=new ScmGameState();
  for(let i=0;i<NUM_SCRIPT_BRAINS;i++)game.scriptBrains.addRandomPedBrain(i,105,50);
  expect(game.scriptBrains.count).toBe(NUM_SCRIPT_BRAINS);
  expect(()=>game.scriptBrains.addRandomPedBrain(70,105,50)).toThrow(/seventy/);
 });
});

describe('the model animation files and the item placement groups a script asks for',()=>{
 test('a model takes the animation block the script attaches to it',()=>{
  const game=new ScmGameState();
  run(assemble(scmOpcode('ATTACH_ANIMS_TO_MODEL'),[int(2900),'shopping']),game);
  expect(game.modelAnimFiles.get(2900)).toBe('shopping');
 });

 test('a group is requested, then removed, and a discreet removal says so',()=>{
  const game=new ScmGameState();
  run(assemble(scmOpcode('REQUEST_IPL'),['countryN_stream0']),game);
  expect(game.iplGroups.get('countryn_stream0')).toEqual({requested:true,discreet:false});
  run(assemble(scmOpcode('REMOVE_IPL'),['COUNTRYN_STREAM0']),game);
  expect(game.iplGroups.get('countryn_stream0')).toEqual({requested:false,discreet:false});
  run(assemble(scmOpcode('REMOVE_IPL_DISCREETLY'),['countryn_stream0']),game);
  expect(game.iplGroups.get('countryn_stream0')).toEqual({requested:false,discreet:true});
 });
});
