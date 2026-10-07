import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {NativeAngledRect} from '../src/engine/nativeAngledRect';
import {scmOpcode} from '../src/engine/scmOpcodes';

function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else {view.setFloat32(0,value,true);out.push(6,...bytes);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
function run(world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(1024);space.set(instructions.flat(),0);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,8);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}
const PED=7;

describe('the tilted rectangle the angled-area commands use',()=>{
 test('the width is laid off to the left of the A-to-B line when it is positive',()=>{
  // A to B runs east; a positive width puts the far side to the north.
  const left=new NativeAngledRect({x:0,y:0},{x:10,y:0},4);
  expect(left.contains({x:5,y:2})).toBe(true);
  expect(left.contains({x:5,y:-2})).toBe(false);
  expect(left.cornerD).toEqual({x:0,y:4});
  // A negative width only changes the side, not the distance.
  const right=new NativeAngledRect({x:0,y:0},{x:10,y:0},-4);
  expect(right.contains({x:5,y:-2})).toBe(true);
  expect(right.contains({x:5,y:2})).toBe(false);
  expect(right.width).toBe(4);
 });

 test('a point past either end or past the width is outside',()=>{
  const area=new NativeAngledRect({x:0,y:0},{x:10,y:0},4);
  expect(area.contains({x:-1,y:1})).toBe(false);
  expect(area.contains({x:11,y:1})).toBe(false);
  expect(area.contains({x:5,y:5})).toBe(false);
  // The edges themselves count as inside, which the source's inclusive bounds give.
  expect(area.contains({x:0,y:0})).toBe(true);
  expect(area.contains({x:10,y:4})).toBe(true);
 });

 test('a tilted rectangle holds points the axis-aligned box around it would not',()=>{
  const area=new NativeAngledRect({x:0,y:0},{x:10,y:10},2);
  expect(area.height).toBeCloseTo(Math.hypot(10,10),5);
  expect(area.contains({x:5,y:5})).toBe(true);
  // The corner of the surrounding box is outside the tilted shape.
  expect(area.contains({x:9,y:1})).toBe(false);
 });

 test('a rectangle with no length holds nothing but its own corner',()=>{
  const area=new NativeAngledRect({x:3,y:4},{x:3,y:4},5);
  expect(area.height).toBe(0);
  expect(area.contains({x:3,y:4})).toBe(true);
  expect(area.contains({x:4,y:4})).toBe(false);
 });
});

describe('the angled-area commands',()=>{
 const at=(x:number,y:number,z=0)=>({pedPosition:()=>({x,y,z}),pedVehicle:()=>undefined,pedIsStopped:()=>true});
 test('the two-dimensional form reads its corners, width and highlight in order',()=>{
  const operands=[int(PED),float(0),float(0),float(10),float(0),float(4),int(0)] as const;
  expect(run(at(5,2),instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_2D'),operands)).condition).toBe(true);
  expect(run(at(5,-2),instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_2D'),operands)).condition).toBe(false);
 });

 test('the three-dimensional form adds a height band taken in either order',()=>{
  const lowFirst=[int(PED),float(0),float(0),float(5),float(10),float(0),float(15),float(4),int(0)] as const;
  expect(run(at(5,2,10),instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_3D'),lowFirst)).condition).toBe(true);
  expect(run(at(5,2,20),instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_3D'),lowFirst)).condition).toBe(false);
  // The same band with its two heights the other way round answers the same.
  const highFirst=[int(PED),float(0),float(0),float(15),float(10),float(0),float(5),float(4),int(0)] as const;
  expect(run(at(5,2,10),instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_3D'),highFirst)).condition).toBe(true);
 });

 test('the on-foot and in-car forms gate on where the ped is',()=>{
  const operands=[int(PED),float(0),float(0),float(10),float(0),float(4),int(0)] as const;
  const inCar={pedPosition:()=>({x:5,y:2,z:0}),pedVehicle:()=>9,pedIsStopped:()=>true};
  expect(run(at(5,2),instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_ON_FOOT_2D'),operands)).condition).toBe(true);
  expect(run(inCar,instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_ON_FOOT_2D'),operands)).condition).toBe(false);
  expect(run(inCar,instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_IN_CAR_2D'),operands)).condition).toBe(true);
 });

 test('the area is highlighted whether the ped is in it or not',()=>{
  const drawn:{centre:{x:number;y:number;z?:number};halfX:number}[]=[];
  const world={...at(50,50),highlightArea:(_id:number,centre:{x:number;y:number;z?:number},halfX:number)=>{drawn.push({centre,halfX});}};
  run(world,instruction(scmOpcode('IS_CHAR_IN_ANGLED_AREA_2D'),
   [int(PED),float(0),float(0),float(10),float(0),float(4),int(1)]));
  expect(drawn.length).toBe(1);
  // HighlightImportantAngledArea: the box round the edges' midpoints (0..10 by 0..4 here), on the ground.
  expect(drawn[0].centre.x).toBeCloseTo(5,5);expect(drawn[0].centre.y).toBeCloseTo(2,5);expect(drawn[0].centre.z).toBeUndefined();
  expect(drawn[0].halfX).toBeCloseTo(5,5);
 });
});

describe('the stopped forms of the locate commands',()=>{
 test('a moving ped is not located, and a stopped one in the box is',()=>{
  const operands=[int(PED),float(0),float(0),float(5),float(5),int(0)] as const;
  const stopped={pedPosition:()=>({x:1,y:1,z:0}),pedVehicle:()=>undefined,pedIsStopped:()=>true};
  const moving={...stopped,pedIsStopped:()=>false};
  expect(run(stopped,instruction(scmOpcode('LOCATE_STOPPED_CHAR_ANY_MEANS_2D'),operands)).condition).toBe(true);
  expect(run(moving,instruction(scmOpcode('LOCATE_STOPPED_CHAR_ANY_MEANS_2D'),operands)).condition).toBe(false);
 });
});

describe('the object angled-area commands (iOS ObjectInAngledAreaCheckCommand 0x1001de724)',()=>{
 function ask(at:{x:number;y:number;z:number},opcode:string,operands:readonly (readonly [number,number])[]){
  const game=new ScmGameState(),handle=game.objects.create(1234,at,{external:false,missionCleanup:false}).handle;
  const space=new Uint8Array(1024);space.set(instruction(scmOpcode(opcode),[int(handle),...operands]),0);
  const thread=new ScmThread(space,0,0,undefined,{startScript(){},game,world:{fade(){}} as ScmWorldCommands});
  try{thread.run(0,8);}catch(error){if(!String(error).includes('watchdog'))throw error;}
  return thread.condition;
 }
 test('the object stands in the rectangle the ped form measures, with a height band in 3D',()=>{
  const flat=[float(0),float(0),float(10),float(0),float(4),int(0)] as const;
  expect(ask({x:5,y:2,z:99},'IS_OBJECT_IN_ANGLED_AREA_2D',flat)).toBe(true);
  expect(ask({x:5,y:-2,z:0},'IS_OBJECT_IN_ANGLED_AREA_2D',flat)).toBe(false);
  const tall=[float(0),float(0),float(10),float(10),float(0),float(0),float(4),int(0)] as const;
  expect(ask({x:5,y:2,z:-1},'IS_OBJECT_IN_ANGLED_AREA_3D',tall)).toBe(false);
  expect(ask({x:5,y:2,z:3},'IS_OBJECT_IN_ANGLED_AREA_3D',tall)).toBe(true);
 });
});

test('GET_OBJECT_MASS reads the object\'s m_fMass, OBJECT.DAT\'s or 99999 without a row (iOS 0x100201cb4)',()=>{
 const game=new ScmGameState();
 game.objects.objectInfo=model=>model===1234?{mass:150,colDamageEffect:0,colDamageMultiplier:1,smashMultiplier:1} as never:undefined;
 const light=game.objects.create(1234,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
 const fixed=game.objects.create(999,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
 const space=new Uint8Array(1024),view=new DataView(space.buffer);
 space.set([...instruction(scmOpcode('GET_OBJECT_MASS'),[int(light)]),2,64,0,...instruction(scmOpcode('GET_OBJECT_MASS'),[int(fixed)]),2,68,0],0);
 const thread=new ScmThread(space,0,0,undefined,{startScript(){},game,world:{fade(){}} as ScmWorldCommands});
 try{thread.run(0,8);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 expect([view.getFloat32(64,true),view.getFloat32(68,true)]).toEqual([150,99999]);
});
