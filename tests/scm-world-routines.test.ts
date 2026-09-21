import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function host(){
 const seen:Record<string,unknown>={};
 const world:ScmWorldCommands={
  fade(){},
  clearExcitingStuffFromArea:(point,radius,removeProjectilesAndShadows)=>{seen.cleared={point:{...point},radius,removeProjectilesAndShadows};},
  // A car turned a quarter turn: its right points north and its forward points west.
  vehicleMatrix:()=>({right:{x:0,y:1,z:0},forward:{x:-1,y:0,z:0},up:{x:0,y:0,z:1},position:{x:10,y:20,z:2}}),
  scriptTaskStatus:(_ped,opcode)=>opcode===1506?7:-1,
 };
 return {seen,world};
}
function run(bytes:Uint8Array,world:ScmWorldCommands,game=new ScmGameState()){
 const threadHost:ScmThreadHost={startScript(){},game,world};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),threadHost);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return {thread,game};
}
function build(opcode:number,parts:{type:number;value:number}[]){
 const size=(type:number)=>type===4?2:type===3?3:5;
 const bytes=new Uint8Array(2+parts.reduce((n,part)=>n+size(part.type),0));
 const view=new DataView(bytes.buffer);view.setUint16(0,opcode,true);
 let at=2;
 for(const part of parts){
  bytes[at]=part.type;
  if(part.type===4)bytes[at+1]=part.value;
  else if(part.type===3)view.setUint16(at+1,part.value,true);
  else if(part.type===6)view.setFloat32(at+1,part.value,true);
  else view.setInt32(at+1,part.value,true);
  at+=size(part.type);
 }
 return bytes;
}
const int=(value:number)=>({type:1,value});
const flt=(value:number)=>({type:6,value});
const byte=(value:number)=>({type:4,value});
const local=(index:number)=>({type:3,value:index});

describe('commands over reversed engine routines',()=>{
 test('clearing an area passes the point, radius and the projectile flag',()=>{
  const h=host();
  run(build(scmOpcode('CLEAR_AREA'),[flt(1),flt(2),flt(3),flt(40),byte(1)]),h.world);
  expect(h.seen.cleared).toEqual({point:{x:1,y:2,z:3},radius:40,removeProjectilesAndShadows:true});
 });

 test('an offset in a car’s own space comes back in world coordinates',()=>{
  const h=host();
  // One unit right of the car, which points west, is one unit north of it.
  const reader=run(build(scmOpcode('GET_OFFSET_FROM_CAR_IN_WORLD_COORDS'),[int(1),flt(1),flt(0),flt(0),local(1),local(2),local(3)]),h.world);
  expect([1,2,3].map(index=>reader.thread.locals.getFloat32(index*4,true))).toEqual([10,21,2]);
  // And one unit forward is one unit west.
  const forward=run(build(scmOpcode('GET_OFFSET_FROM_CAR_IN_WORLD_COORDS'),[int(1),flt(0),flt(1),flt(0),local(4),local(5),local(6)]),h.world);
  expect([4,5,6].map(index=>forward.thread.locals.getFloat32(index*4,true))).toEqual([9,20,2]);
 });

 test('placing an object relative to a car moves the script’s own object',()=>{
  const h=host(),game=new ScmGameState();
  const object=game.objects.create(1234,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  run(build(scmOpcode('PLACE_OBJECT_RELATIVE_TO_CAR'),[int(object.handle),int(1),flt(0),flt(0),flt(5)]),h.world,game);
  expect(object.position).toEqual({x:10,y:20,z:7});
 });

 test('the task status answers for the command the script names',()=>{
  const h=host();
  const found=run(build(scmOpcode('GET_SCRIPT_TASK_STATUS'),[int(1),int(1506),local(2)]),h.world);
  expect(found.thread.locals.getInt32(2*4,true)).toBe(7);
  const missing=run(build(scmOpcode('GET_SCRIPT_TASK_STATUS'),[int(1),int(1507),local(3)]),h.world);
  expect(missing.thread.locals.getInt32(3*4,true)).toBe(-1);
 });
});
