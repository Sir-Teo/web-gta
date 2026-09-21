import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
/** A stand-in world holding vehicles and which ped sits in which. */
function carHost(){
 const cars=new Map<number,{model:number|string;position:{x:number;y:number;z:number};heading:number;wrecked:boolean;proofs:unknown;needed:boolean}>();
 const inside=new Map<number,number>();
 let next=200;
 const world:ScmWorldCommands={
  fade(){},
  createCar:(model,x,y,z)=>{const handle=next++;cars.set(handle,{model,position:{x,y,z},heading:0,wrecked:false,proofs:undefined,needed:true});return handle;},
  deleteVehicle:handle=>{cars.delete(handle);},
  vehicleExists:handle=>cars.has(handle),
  vehicleIsDeadForScript:handle=>!!cars.get(handle)?.wrecked,
  vehiclePosition:handle=>cars.get(handle)!.position,
  setVehicleCoordinates:(handle,x,y,z)=>{cars.get(handle)!.position={x,y,z};},
  vehicleHeading:handle=>cars.get(handle)!.heading,
  setVehicleHeading:(handle,degrees)=>{cars.get(handle)!.heading=degrees;},
  setVehicleProofs:(handle,proofs)=>{cars.get(handle)!.proofs=proofs;},
  markVehicleNoLongerNeeded:handle=>{cars.get(handle)!.needed=false;},
  pedVehicle:handle=>inside.get(handle),
  vehicleModel:handle=>cars.get(handle)?.model,
 };
 return {cars,inside,world};
}
function thread(bytes:Uint8Array,world:ScmWorldCommands){
 const header=readScmHeader(file());
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world,objectNames:header.objectNames};
 return new ScmThread(bytes,0,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(t:ScmThread)=>{try{t.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
/** opcode, then an int32 handle, then the operands given as [type,bytes] writers. */
function command(opcode:number,handle:number|undefined,rest:{size:number;write:(view:DataView,at:number,bytes:Uint8Array)=>void}[]){
 const head=handle===undefined?2:7;
 const bytes=new Uint8Array(head+rest.reduce((n,r)=>n+r.size,0));
 const view=new DataView(bytes.buffer);
 view.setUint16(0,opcode,true);
 if(handle!==undefined){bytes[2]=1;view.setInt32(3,handle,true);}
 let at=head;for(const r of rest){r.write(view,at,bytes);at+=r.size;}
 return bytes;
}
const float=(value:number)=>({size:5,write:(view:DataView,at:number,bytes:Uint8Array)=>{bytes[at]=6;view.setFloat32(at+1,value,true);}});
const int=(value:number)=>({size:5,write:(view:DataView,at:number,bytes:Uint8Array)=>{bytes[at]=1;view.setInt32(at+1,value,true);}});
const byte=(value:number)=>({size:2,write:(_view:DataView,at:number,bytes:Uint8Array)=>{bytes[at]=4;bytes[at+1]=value;}});
const local=(index:number)=>({size:3,write:(view:DataView,at:number,bytes:Uint8Array)=>{bytes[at]=3;view.setUint16(at+1,index,true);}});

describe('the vehicles a script holds',()=>{
 test('the script’s own CREATE_CAR asks the world for a car and keeps its handle',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
  for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
  const create=blocks.flat().find(i=>i.name==='CREATE_CAR')!;
  const host=carHost();
  const header2=readScmHeader(bytes);
  const scriptHost:ScmThreadHost={startScript(){},game:new ScmGameState(),world:host.world,objectNames:header2.objectNames};
  const runner=new ScmThread(bytes,create.offset,0,new DataView(new ArrayBuffer(1024*4)),scriptHost);
  runOne(runner);
  expect(host.cars.size).toBe(1);
 });

 test('a handle that names no car is dead, and a wrecked one is too',()=>{
  const host=carHost();
  const handle=host.world.createCar!(400,1,2,3);
  const alive=thread(command(0x119,handle,[]),host.world);runOne(alive);
  expect(alive.condition).toBe(false);
  host.cars.get(handle)!.wrecked=true;
  const wrecked=thread(command(0x119,handle,[]),host.world);runOne(wrecked);
  expect(wrecked.condition).toBe(true);
  host.cars.delete(handle);
  const gone=thread(command(0x119,handle,[]),host.world);runOne(gone);
  expect(gone.condition).toBe(true);
 });

 test('a heading is fixed into range on its way in and out',()=>{
  const host=carHost();
  const handle=host.world.createCar!(400,0,0,0);
  runOne(thread(command(0x175,handle,[float(-90)]),host.world));
  expect(host.cars.get(handle)!.heading).toBe(270);
  host.cars.get(handle)!.heading=400;
  const reader=thread(command(0x174,handle,[local(3)]),host.world);runOne(reader);
  expect(reader.locals.getFloat32(3*4,true)).toBeCloseTo(40,4);
 });

 test('the script moves a car, reads it back, proofs it and lets it go',()=>{
  const host=carHost();
  const handle=host.world.createCar!(400,0,0,0);
  runOne(thread(command(0xab,handle,[float(7),float(8),float(9)]),host.world));
  expect(host.cars.get(handle)!.position).toEqual({x:7,y:8,z:9});
  const reader=thread(command(0xaa,handle,[local(1),local(2),local(3)]),host.world);runOne(reader);
  expect([1,2,3].map(index=>reader.locals.getFloat32(index*4,true))).toEqual([7,8,9]);
  runOne(thread(command(0x2ac,handle,[byte(1),byte(1),byte(0),byte(0),byte(1)]),host.world));
  expect(host.cars.get(handle)!.proofs).toEqual({bullet:true,fire:true,explosion:false,collision:false,melee:true});
  runOne(thread(command(0x1c3,handle,[]),host.world));
  expect(host.cars.get(handle)!.needed).toBe(false);
 });

 test('a ped counts as in a car only while the world says it holds one',()=>{
  const host=carHost();
  const car=host.world.createCar!(400,0,0,0),other=host.world.createCar!(401,0,0,0);
  const ped=50;
  const any=thread(command(0xdf,ped,[]),host.world);runOne(any);
  expect(any.condition).toBe(false);
  host.inside.set(ped,car);
  const nowAny=thread(command(0xdf,ped,[]),host.world);runOne(nowAny);
  expect(nowAny.condition).toBe(true);
  const inThis=thread(command(0xdb,ped,[int(car)]),host.world);runOne(inThis);
  expect(inThis.condition).toBe(true);
  const inThat=thread(command(0xdb,ped,[int(other)]),host.world);runOne(inThat);
  expect(inThat.condition).toBe(false);
  const model=thread(command(0xdd,ped,[int(400)]),host.world);runOne(model);
  expect(model.condition).toBe(true);
  const wrongModel=thread(command(0xdd,ped,[int(401)]),host.world);runOne(wrongModel);
  expect(wrongModel.condition).toBe(false);
 });
});
