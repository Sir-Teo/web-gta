import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number])[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [type,value] of operands){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(type===1){view.setInt32(0,value,true);out.push(1,...bytes);}
  else if(type===6){view.setFloat32(0,value,true);out.push(6,...bytes);}
  else {view.setUint16(0,value,true);out.push(type,bytes[0],bytes[1]);}
 }
 return out;
}
const int=(value:number)=>[1,value] as const;
const float=(value:number)=>[6,value] as const;
const gvar=(offset:number)=>[2,offset] as const;
function run(world:Partial<ScmWorldCommands>,game=new ScmGameState(),...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game,world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,16);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,game,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7;
/** eModelID: the two taxis, the Predator, and an ordinary car. */
const MODEL_TAXI=420,MODEL_CABBIE=438,MODEL_PREDATOR=430,MODEL_SANCHEZ=468;

describe('the touching questions',()=>{
 test('each names the kind of thing it asks about',()=>{
  const asked:unknown[]=[];
  const world={pedIsTouching:(handle:number,other:unknown)=>{asked.push([handle,other]);return true;}};
  const {thread}=run(world,undefined,
   instruction(scmOpcode('IS_CHAR_TOUCHING_CHAR'),[int(PED),int(8)]),
   instruction(scmOpcode('IS_CHAR_TOUCHING_VEHICLE'),[int(PED),int(9)]),
   instruction(scmOpcode('IS_CHAR_TOUCHING_OBJECT'),[int(PED),int(10)]));
  expect(asked).toEqual([
   [PED,{kind:'ped',handle:8}],[PED,{kind:'vehicle',handle:9}],[PED,{kind:'object',handle:10}],
  ]);
  expect(thread.condition).toBe(true);
 });
});

describe('what the car a ped rides is',()=>{
 const riding=(model?:number,law=false)=>({pedVehicleModelId:()=>model,pedVehicleIsLawEnforcement:()=>law});
 test('a police vehicle is any law-enforcement one except the Predator',()=>{
  const ask=(model?:number,law=false)=>run(riding(model,law),undefined,
   instruction(scmOpcode('IS_CHAR_IN_ANY_POLICE_VEHICLE'),[int(PED)])).thread.condition;
  expect(ask(596,true)).toBe(true);
  expect(ask(MODEL_PREDATOR,true)).toBe(false);
  expect(ask(MODEL_SANCHEZ,false)).toBe(false);
  expect(ask(undefined)).toBe(false);
 });
 test('a taxi is one of the two taxi models by name',()=>{
  const ask=(model?:number)=>run(riding(model),undefined,
   instruction(scmOpcode('IS_CHAR_IN_TAXI'),[int(PED)])).thread.condition;
  expect(ask(MODEL_TAXI)).toBe(true);
  expect(ask(MODEL_CABBIE)).toBe(true);
  expect(ask(MODEL_SANCHEZ)).toBe(false);
  expect(ask(undefined)).toBe(false);
 });
});

describe('the speeds and slots a script reads',()=>{
 test('a speed crosses the boundary fifty times larger than the engine keeps it',()=>{
  const {readFloat}=run({pedSpeed:()=>0.2},undefined,
   instruction(scmOpcode('GET_CHAR_SPEED'),[int(PED),gvar(40)]));
  expect(readFloat(40)).toBeCloseTo(10,5);
 });

 test('a velocity crosses the other way, fifty times smaller',()=>{
  const set:unknown[]=[];
  run({setPedVelocity:(...args)=>{set.push(args);}},undefined,
   instruction(scmOpcode('SET_CHAR_VELOCITY'),[int(PED),float(50),float(100),float(-25)]));
  expect(set.length).toBe(1);
  const [,velocity]=set[0] as [number,{x:number;y:number;z:number}];
  expect(velocity.x).toBeCloseTo(1,5);
  expect(velocity.y).toBeCloseTo(2,5);
  expect(velocity.z).toBeCloseTo(-0.5,5);
 });

 test('the script counts weapon slots from one and the ped from nothing',()=>{
  const asked:number[]=[];
  const {readInt}=run({pedWeaponInSlot:(_handle:number,slot:number)=>{asked.push(slot);return {type:22,ammo:60,model:346};}},
   undefined,instruction(scmOpcode('GET_CHAR_WEAPON_IN_SLOT'),[int(PED),int(3),gvar(40),gvar(44),gvar(48)]));
  expect(asked).toEqual([2]);
  expect([readInt(40),readInt(44),readInt(48)]).toEqual([22,60,346]);
 });

 test('the dead ped pickup point is its own call, not the ped’s position',()=>{
  const {readFloat}=run({deadPedPickupCoordinates:()=>({x:4,y:5,z:6})},undefined,
   instruction(scmOpcode('GET_DEAD_CHAR_PICKUP_COORDS'),[int(PED),gvar(40),gvar(44),gvar(48)]));
  expect([readFloat(40),readFloat(44),readFloat(48)]).toEqual([4,5,6]);
 });
});

describe('the camera the script reads and the in-car modes it sets',()=>{
 test('the point the camera looks at is its source plus its forward',()=>{
  const world={activeCameraSource:()=>({x:10,y:20,z:30}),activeCameraFront:()=>({x:0,y:1,z:0})};
  const source=run(world,undefined,instruction(scmOpcode('GET_ACTIVE_CAMERA_COORDINATES'),[gvar(40),gvar(44),gvar(48)]));
  expect([source.readFloat(40),source.readFloat(44),source.readFloat(48)]).toEqual([10,20,30]);
  const at=run(world,undefined,instruction(scmOpcode('GET_ACTIVE_CAMERA_POINT_AT'),[gvar(40),gvar(44),gvar(48)]));
  expect([at.readFloat(40),at.readFloat(44),at.readFloat(48)]).toEqual([10,21,30]);
 });

 test('a car zoom of four is refused, and turning first person off drops the zoom to two',()=>{
  const game=new ScmGameState();
  run({},game,instruction(scmOpcode('SET_PLAYER_IN_CAR_CAMERA_MODE'),[int(3)]));
  expect(game.camera.carZoom).toBe(3);
  run({},game,instruction(scmOpcode('SET_PLAYER_IN_CAR_CAMERA_MODE'),[int(4)]));
  expect(game.camera.carZoom).toBe(3);
  run({},game,instruction(scmOpcode('SET_FIRST_PERSON_IN_CAR_CAMERA_MODE'),[int(0)]));
  expect(game.camera).toMatchObject({disableFirstPersonInCar:true,carZoom:2});
  run({},game,instruction(scmOpcode('SET_FIRST_PERSON_IN_CAR_CAMERA_MODE'),[int(1)]));
  expect(game.camera).toMatchObject({disableFirstPersonInCar:false,carZoom:2});
 });
});
