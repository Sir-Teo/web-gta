import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function locateHost(){
 const peds=new Map<number,{position:{x:number;y:number;z:number};vehicle?:number}>();
 const highlights:{point:{x:number;y:number;z:number};radius:{x:number;y:number;z:number}}[]=[];
 const world:ScmWorldCommands={
  fade(){},
  pedPosition:handle=>peds.get(handle)!.position,
  pedVehicle:handle=>peds.get(handle)?.vehicle,
  highlightArea:(point,radius)=>{highlights.push({point:{...point},radius:{...radius}});},
 };
 return {peds,highlights,world};
}
function run(bytes:Uint8Array,world:ScmWorldCommands){
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world};
 const thread=new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
/** opcode, an int32 handle, float operands, then a byte flag. */
function locate(opcode:number,handle:number,floats:number[],flag:number,extraInt?:number){
 const ints=extraInt===undefined?1:2;
 const bytes=new Uint8Array(2+ints*5+floats.length*5+2);
 const view=new DataView(bytes.buffer);
 view.setUint16(0,opcode,true);
 bytes[2]=1;view.setInt32(3,handle,true);
 let at=7;
 if(extraInt!==undefined){bytes[at]=1;view.setInt32(at+1,extraInt,true);at+=5;}
 for(const value of floats){bytes[at]=6;view.setFloat32(at+1,value,true);at+=5;}
 bytes[at]=4;bytes[at+1]=flag;
 return bytes;
}

describe('locating a ped',()=>{
 test('the area is a box around the point, a radius per axis',()=>{
  const host=locateHost();
  host.peds.set(1,{position:{x:10,y:20,z:5}});
  const inside=run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_2D'),1,[10,20,3,3],0),host.world);
  expect(inside.condition).toBe(true);
  const outside=run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_2D'),1,[10,30,3,3],0),host.world);
  expect(outside.condition).toBe(false);
  // The flat forms ignore height entirely; the three-dimensional ones do not.
  const flat=run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_2D'),1,[10,20,3,3],0),host.world);
  expect(flat.condition).toBe(true);
  const tall=run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_3D'),1,[10,20,100,3,3,3],0),host.world);
  expect(tall.condition).toBe(false);
 });

 test('the on-foot and in-car forms gate on what the ped is doing',()=>{
  const host=locateHost();
  host.peds.set(1,{position:{x:0,y:0,z:0}});
  expect(run(locate(scmOpcode('LOCATE_CHAR_ON_FOOT_2D'),1,[0,0,1,1],0),host.world).condition).toBe(true);
  expect(run(locate(scmOpcode('LOCATE_CHAR_IN_CAR_2D'),1,[0,0,1,1],0),host.world).condition).toBe(false);
  host.peds.get(1)!.vehicle=99;
  expect(run(locate(scmOpcode('LOCATE_CHAR_ON_FOOT_2D'),1,[0,0,1,1],0),host.world).condition).toBe(false);
  expect(run(locate(scmOpcode('LOCATE_CHAR_IN_CAR_2D'),1,[0,0,1,1],0),host.world).condition).toBe(true);
  expect(run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_2D'),1,[0,0,1,1],0),host.world).condition).toBe(true);
 });

 test('the char forms measure against the other ped’s own position',()=>{
  const host=locateHost();
  host.peds.set(1,{position:{x:0,y:0,z:0}});
  host.peds.set(2,{position:{x:4,y:0,z:0}});
  expect(run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_CHAR_2D'),1,[5,5],0,2),host.world).condition).toBe(true);
  expect(run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_CHAR_2D'),1,[3,3],0,2),host.world).condition).toBe(false);
  expect(run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_CHAR_3D'),1,[5,5,5],0,2),host.world).condition).toBe(true);
 });

 test('the last operand asks for the area to be highlighted, whatever the answer',()=>{
  const host=locateHost();
  host.peds.set(1,{position:{x:100,y:100,z:0}});
  run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_2D'),1,[0,0,1,1],1),host.world);
  expect(host.highlights).toHaveLength(1);
  expect(host.highlights[0].point).toEqual({x:0,y:0,z:0});
  run(locate(scmOpcode('LOCATE_CHAR_ANY_MEANS_2D'),1,[0,0,1,1],0),host.world);
  expect(host.highlights).toHaveLength(1);
 });
});

describe('locating a car',()=>{
 test('the same box rule applies to a vehicle',()=>{
  const host=locateHost();
  const world={...host.world,vehiclePosition:()=>({x:50,y:50,z:5})} as ScmWorldCommands;
  const inside=run(locate(scmOpcode('LOCATE_CAR_2D'),9,[50,50,4,4],0),world);
  expect(inside.condition).toBe(true);
  const outside=run(locate(scmOpcode('LOCATE_CAR_2D'),9,[60,50,4,4],0),world);
  expect(outside.condition).toBe(false);
  const tall=run(locate(scmOpcode('LOCATE_CAR_3D'),9,[50,50,100,4,4,4],0),world);
  expect(tall.condition).toBe(false);
 });

 test('the car form highlights its area too',()=>{
  const host=locateHost();
  const world={...host.world,vehiclePosition:()=>({x:0,y:0,z:0})} as ScmWorldCommands;
  run(locate(scmOpcode('LOCATE_CAR_2D'),9,[10,10,1,1],1),world);
  expect(host.highlights).toHaveLength(1);
 });
});
