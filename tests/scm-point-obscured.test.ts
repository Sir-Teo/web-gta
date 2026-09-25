import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {OBJECT_MISSION,OBJECT_MISSION2,OBJECT_TEMPORARY,isMissionObjectType} from '../src/engine/ScmObjects';
import {insideMissionCube} from '../src/simulation/ScmMission';
import {scmOpcode} from '../src/engine/scmOpcodes';

function run(world:Partial<ScmWorldCommands>,opcode:number,ints:number[],floats:number[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const [value,float] of [...ints.map(v=>[v,false] as const),...floats.map(v=>[v,true] as const)]){
  const bytes=new Uint8Array(4),view=new DataView(bytes.buffer);
  if(float){view.setFloat32(0,value,true);out.push(6,...bytes);}else {view.setInt32(0,value,true);out.push(1,...bytes);}
 }
 const space=new Uint8Array(256);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread;
}

describe('IS_POINT_OBSCURED_BY_A_MISSION_ENTITY',()=>{
 test('the command hands the point and its three radii over and takes the answer',()=>{
  const asked:number[][]=[];
  const thread=run({pointIsObscuredByMissionEntity:(...a)=>{asked.push(a);return true;}},scmOpcode('IS_POINT_OBSCURED_BY_A_MISSION_ENTITY'),[],[1,2,3,4,5,6]);
  expect(asked).toEqual([[1,2,3,4,5,6]]);
  expect(thread.condition).toBe(true);
 });

 test('the box spans each radius either way of the point, its faces included, whatever the radii’s signs',()=>{
  expect(insideMissionCube(0,0,0,2,3,1,{x:2,y:-3,z:1})).toBe(true);
  expect(insideMissionCube(0,0,0,2,3,1,{x:2.01,y:0,z:0})).toBe(false);
  // Only the ends' order is swapped, so negative radii span the same box.
  expect(insideMissionCube(10,10,10,-2,-3,-1,{x:8,y:13,z:9.5})).toBe(true);
  expect(insideMissionCube(10,10,10,-2,-3,-1,{x:10,y:10,z:11.5})).toBe(false);
  // A zero radius leaves a plane, which a position exactly on it still meets.
  expect(insideMissionCube(0,0,0,0,5,5,{x:0,y:1,z:1})).toBe(true);
 });

 test('an object the script lets go of is temporary, which no longer counts as the mission’s',()=>{
  const game=new ScmGameState();
  const own=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:true});
  const external=game.objects.create(1337,{x:0,y:0,z:0},{external:true,missionCleanup:false});
  // eObjectType: OBJECT_MISSION2 is six, clear of OBJECT_TEMPORARY's three.
  expect([own.objectType,external.objectType]).toEqual([OBJECT_MISSION,OBJECT_MISSION2]);
  expect(isMissionObjectType(external.objectType)).toBe(true);
  game.objects.markNoLongerNeeded(own.handle);game.objects.markNoLongerNeeded(external.handle);
  expect([own.objectType,external.objectType]).toEqual([OBJECT_TEMPORARY,OBJECT_TEMPORARY]);
  expect(own.missionCleanup).toBe(false);
  expect(isMissionObjectType(own.objectType)).toBe(false);
  // It stays in the world, still named by its handle.
  expect(game.objects.exists(own.handle)).toBe(true);
  // DONT_REMOVE_OBJECT only takes it off the cleanup list.
  const kept=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:true});
  game.objects.releaseFromCleanup(kept.handle);
  expect(kept.objectType).toBe(OBJECT_MISSION);expect(kept.missionCleanup).toBe(false);
 });
});
