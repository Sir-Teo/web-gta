import {describe,expect,test} from 'vitest';
import {readFileSync} from 'node:fs';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {COL_DAMAGE_EFFECT_SMASH_COMPLETELY,OBJECT_MISSION,OBJECT_MISSION2,fixAngleDegrees} from '../src/engine/ScmObjects';
import {readScmHeader,decodeScmInstructions} from '../src/assets/scm';

const file=()=>new Uint8Array(readFileSync('public/play/world/files/scripts/main.scm'));
/** A host whose world answers the two lookups CREATE_OBJECT needs. */
function host(game:ScmGameState,objectNames:readonly string[],world?:Partial<ScmWorldCommands>){
 const adapter={fade(){},groundLevel:()=>10,modelBaseOffset:()=>0.5,...world} as ScmWorldCommands;
 return {startScript(){throw new Error('unexpected');},game,world:adapter,objectNames} satisfies ScmThreadHost;
}
function threadAt(bytes:Uint8Array,offset:number,game=new ScmGameState(),world?:Partial<ScmWorldCommands>){
 const names=readScmHeader(bytes).objectNames;
 return {thread:new ScmThread(bytes,offset,0,undefined,host(game,names,world)),game};
}
const runOne=(thread:ScmThread)=>{try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}};

describe('script objects',()=>{
 test('FixAngleDegrees moves an angle one step, not a modulo',()=>{
  expect(fixAngleDegrees(-90)).toBe(270);
  expect(fixAngleDegrees(400)).toBe(40);
  expect(fixAngleDegrees(180)).toBe(180);
  // Two turns out of range stay out, exactly as the source's single step leaves them.
  expect(fixAngleDegrees(-450)).toBe(-90);
 });

 test('CREATE_OBJECT drops the point to the ground and lifts the object off its base',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const create=code.find(i=>i.name==='CREATE_OBJECT')!;
  expect(create).toBeDefined();
  const {thread,game}=threadAt(bytes,create.offset,new ScmGameState(),{groundLevel:()=>1000,modelBaseOffset:()=>0.5});
  runOne(thread);
  const object=game.objects.at(game.objects.handles[0]);
  expect(object.position.z).toBe(1000.5);
  const id=create.parameters[0].value as number;
  expect(object.model).toBe(id>=0?id:readScmHeader(bytes).objectNames[-id]);
  expect(object.objectType).toBe(OBJECT_MISSION);
  expect(object.scale).toBe(1);
  expect(object.usesCollision).toBe(true);
 });

 test('CREATE_OBJECT_NO_OFFSET leaves the point where the script put it',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const create=code.find(i=>i.name==='CREATE_OBJECT_NO_OFFSET')!;
  const {thread,game}=threadAt(bytes,create.offset,new ScmGameState(),{groundLevel:()=>1000,modelBaseOffset:()=>9});
  runOne(thread);
  const object=game.objects.at(game.objects.handles[0]);
  expect(object.position.z).toBeCloseTo(create.parameters[3].value as number,3);
  // The handle the command wrote back names the object the script can now address.
  const globals=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  expect(globals.getInt32(create.parameters[4].value as number,true)).toBe(object.handle);
 });

 test('an external script creates mission-two objects',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const create=code.find(i=>i.name==='CREATE_OBJECT_NO_OFFSET')!;
  const game=new ScmGameState(),{thread}=threadAt(bytes,create.offset,game);
  thread.isExternal=true;
  runOne(thread);
  expect(game.objects.at(game.objects.handles[0]).objectType).toBe(OBJECT_MISSION2);
 });

 test('the script sets the collision damage, freeze, dynamic and proof fields of its objects',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const create=code.find(i=>i.name==='CREATE_OBJECT_NO_OFFSET')!;
  const game=new ScmGameState();
  runOne(threadAt(bytes,create.offset,game).thread);
  const handle=game.objects.handles[0],object=game.objects.at(handle);
  expect(object.isStatic).toBe(true);
  expect(object.colDamageEffect).toBe(0);
  game.objects.setColDamageEffect(handle,COL_DAMAGE_EFFECT_SMASH_COMPLETELY);
  expect(object.colDamageEffect).toBe(4);
  game.objects.freezePosition(handle,true);
  expect(object.dontApplySpeed).toBe(true);
  game.objects.setDynamic(handle,true);
  expect(object.isStatic).toBe(false);
  game.objects.setProofs(handle,{bullet:true,fire:false,explosion:true,collision:false,melee:true});
  expect(object.proofs).toEqual({bullet:true,fire:false,explosion:true,collision:false,melee:true});
 });

 test('the INITIAL block runs on through its objects without meeting an unported command',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const first=code.find(i=>i.name==='CREATE_OBJECT_NO_OFFSET')!;
  const {thread,game}=threadAt(bytes,first.offset);
  // The block's objects all run now; the four hundred instruction budget is what ends the run.
  expect(()=>thread.run(0,400)).toThrow('watchdog');
  expect(game.objects.count).toBeGreaterThan(0);
  // Every object the block made is a mission object the cleanup list holds, since INITIAL is not external.
  for(const handle of game.objects.handles)expect(game.objects.at(handle).objectType).toBe(OBJECT_MISSION);
 });

 test('the table answers what the script asks of an object it made',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:1,y:2,z:3},{external:false,missionCleanup:true});
  game.objects.setHeading(object.handle,-90);
  expect(game.objects.getHeading(object.handle)).toBeCloseTo(270,4);
  game.objects.setVelocity(object.handle,{x:50,y:0,z:-100});
  expect(object.velocity).toEqual({x:1,y:0,z:-2});
  expect(game.objects.getVelocity(object.handle)).toEqual({x:50,y:0,z:-100});
  expect(game.objects.hasModel(object.handle,1337)).toBe(true);
  expect(game.objects.hasModel(object.handle,1338)).toBe(false);
  game.objects.releaseFromCleanup(object.handle);
  expect(object.missionCleanup).toBe(false);
  expect(game.objects.exists(object.handle)).toBe(true);
  game.objects.remove(object.handle);
  expect(game.objects.exists(object.handle)).toBe(false);
  // A handle is not reused, so a stale one never names the next object.
  expect(game.objects.create(1,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle).not.toBe(object.handle);
 });
});

describe('object rotation',()=>{
 test('the three angles are kept in radians, and the last is the heading',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.setRotation(object.handle,0,90,180);
  expect(object.rotation.y).toBeCloseTo(Math.PI/2,6);
  expect(object.rotation.z).toBeCloseTo(Math.PI,6);
  expect(game.objects.getHeading(object.handle)).toBeCloseTo(180,4);
  // A negative angle about the vertical axis is fixed into range for the heading, as SetObjectHeading does.
  game.objects.setRotation(object.handle,0,0,-90);
  expect(game.objects.getHeading(object.handle)).toBeCloseTo(270,4);
 });
});
