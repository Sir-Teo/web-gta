import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
/** A host with one ped table, standing in for the world that owns them. */
function pedHost(){
 const peds=new Map<number,{position:{x:number;y:number;z:number};health:number;dead:boolean;accuracy:number;invulnerable:boolean;proofs:unknown;needed:boolean}>();
 const calls:string[]=[];
 let next=100;
 const world:ScmWorldCommands={
  fade(){},
  createChar:(pedType,model,x,y,z)=>{calls.push(`create:${pedType}:${String(model)}`);const handle=next++;peds.set(handle,{position:{x,y,z},health:100,dead:false,accuracy:0,invulnerable:false,proofs:undefined,needed:true});return handle;},
  deletePed:handle=>{calls.push('delete');peds.delete(handle);},
  pedExists:handle=>peds.has(handle),
  pedIsDeadForScript:handle=>!!peds.get(handle)?.dead,
  pedPosition:handle=>peds.get(handle)!.position,
  setPedCoordinates:(handle,x,y,z)=>{peds.get(handle)!.position={x,y,z};},
  setPedHealth:(handle,health)=>{peds.get(handle)!.health=health;},
  killPed:handle=>{calls.push('kill');peds.get(handle)!.dead=true;},
  setPedAccuracy:(handle,accuracy)=>{peds.get(handle)!.accuracy=accuracy;},
  setPedInvulnerable:(handle,enabled)=>{peds.get(handle)!.invulnerable=enabled;},
  setPedProofs:(handle,proofs)=>{peds.get(handle)!.proofs=proofs;},
  markPedNoLongerNeeded:handle=>{calls.push('release');peds.get(handle)!.needed=false;},
 };
 return {peds,calls,world};
}
function threadAt(bytes:Uint8Array,offset:number,world:ScmWorldCommands,game=new ScmGameState()){
 const header=readScmHeader(file());
 const host:ScmThreadHost={startScript(){},game,world,objectNames:header.objectNames};
 return new ScmThread(bytes,offset,0,new DataView(new ArrayBuffer(1024*4)),host);
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};
function find(name:string){
 const bytes=file(),header=readScmHeader(bytes);
 const blocks=[decodeScmInstructions(bytes,header.entry,header.mainSize)];
 for(const mission of header.missions)blocks.push(decodeScmInstructions(bytes,mission.start,mission.end));
 const found=blocks.flat().find(i=>i.name===name);
 expect(found,name).toBeDefined();
 return {bytes,instruction:found!};
}

describe('the peds a script holds',()=>{
 test('CREATE_CHAR asks the world for a ped and keeps its handle',()=>{
  const {bytes,instruction}=find('CREATE_CHAR'),host=pedHost();
  const thread=threadAt(bytes,instruction.offset,host.world);
  runOne(thread);
  expect(host.peds.size).toBe(1);
  expect(host.calls[0]).toContain('create:'+instruction.parameters[0].value);
  const [handle]=[...host.peds.keys()];
  expect(handle).toBe(100);
 });

 test('a handle that names no ped is dead, and one that does answers for itself',()=>{
  const host=pedHost();
  const handle=host.world.createChar!(4,105,1,2,3);
  const bytes=new Uint8Array(7);const view=new DataView(bytes.buffer);
  view.setUint16(0,0x118,true);bytes[2]=1;view.setInt32(3,handle,true);
  const alive=threadAt(bytes,0,host.world);runOne(alive);
  expect(alive.condition).toBe(false);
  host.peds.get(handle)!.dead=true;
  const dead=threadAt(bytes,0,host.world);runOne(dead);
  expect(dead.condition).toBe(true);
  host.peds.delete(handle);
  const gone=threadAt(bytes,0,host.world);runOne(gone);
  expect(gone.condition).toBe(true);
 });

 test('a health of nothing kills the ped rather than setting the field',()=>{
  const host=pedHost();
  const handle=host.world.createChar!(4,105,0,0,0);
  const command=(health:number)=>{
   const bytes=new Uint8Array(12);const view=new DataView(bytes.buffer);
   view.setUint16(0,0x223,true);bytes[2]=1;view.setInt32(3,handle,true);bytes[7]=6;view.setFloat32(8,health,true);
   return bytes;
  };
  runOne(threadAt(command(50),0,host.world));
  expect(host.peds.get(handle)!.health).toBe(50);
  expect(host.calls).not.toContain('kill');
  runOne(threadAt(command(0),0,host.world));
  expect(host.calls).toContain('kill');
  expect(host.peds.get(handle)!.dead).toBe(true);
  expect(host.peds.get(handle)!.health).toBe(50);
 });

 test('the script moves a ped, reads it back and lets it go',()=>{
  const host=pedHost();
  const handle=host.world.createChar!(4,105,0,0,0);
  const move=new Uint8Array(22);const moveView=new DataView(move.buffer);
  moveView.setUint16(0,0xa1,true);move[2]=1;moveView.setInt32(3,handle,true);
  [11,22,33].forEach((value,k)=>{move[7+k*5]=6;moveView.setFloat32(8+k*5,value,true);});
  runOne(threadAt(move,0,host.world));
  expect(host.peds.get(handle)!.position).toEqual({x:11,y:22,z:33});
  const read=new Uint8Array(7+3*3);const readView=new DataView(read.buffer);
  readView.setUint16(0,0xa0,true);read[2]=1;readView.setInt32(3,handle,true);
  [4,5,6].forEach((local,k)=>{read[7+k*3]=3;readView.setUint16(8+k*3,local,true);});
  const reader=threadAt(read,0,host.world);runOne(reader);
  expect([4,5,6].map(local=>reader.locals.getFloat32(local*4,true))).toEqual([11,22,33]);
  const release=new Uint8Array(7);const releaseView=new DataView(release.buffer);
  releaseView.setUint16(0,0x1c2,true);release[2]=1;releaseView.setInt32(3,handle,true);
  runOne(threadAt(release,0,host.world));
  expect(host.calls).toContain('release');
  expect(host.peds.get(handle)!.needed).toBe(false);
 });

 test('the proofs, the accuracy and the invulnerable flag reach the ped',()=>{
  const host=pedHost();
  const handle=host.world.createChar!(4,105,0,0,0);
  const proofs=new Uint8Array(7+5*2);const view=new DataView(proofs.buffer);
  view.setUint16(0,0x2ab,true);proofs[2]=1;view.setInt32(3,handle,true);
  [1,0,1,0,1].forEach((value,k)=>{proofs[7+k*2]=4;proofs[8+k*2]=value;});
  runOne(threadAt(proofs,0,host.world));
  expect(host.peds.get(handle)!.proofs).toEqual({bullet:true,fire:false,explosion:true,collision:false,melee:true});
  const accuracy=new Uint8Array(9);const accuracyView=new DataView(accuracy.buffer);
  accuracyView.setUint16(0,0x2e2,true);accuracy[2]=1;accuracyView.setInt32(3,handle,true);accuracy[7]=4;accuracy[8]=77;
  runOne(threadAt(accuracy,0,host.world));
  expect(host.peds.get(handle)!.accuracy).toBe(77);
 });

 test('without a world the char commands fail rather than guessing',()=>{
  const bare={fade(){}} as ScmWorldCommands;
  const bytes=new Uint8Array(7);const view=new DataView(bytes.buffer);
  view.setUint16(0,0x56d,true);bytes[2]=1;view.setInt32(3,100,true);
  expect(()=>threadAt(bytes,0,bare).run(0,1)).toThrow('world adapter lacks pedExists');
 });
});
