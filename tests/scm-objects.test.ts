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
function threadAt(bytes:Uint8Array,offset:number,game=new ScmGameState(),world?:Partial<ScmWorldCommands>,locals?:DataView<ArrayBuffer>){
 const names=readScmHeader(bytes).objectNames;
 return {thread:new ScmThread(bytes,offset,0,locals,host(game,names,world)),game};
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

 test('CREATE_OBJECT keeps a point above the map\'s low limit and lifts the object off its base',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const code=decodeScmInstructions(bytes,header.missions[0].start,header.missions[0].end);
  const create=code.find(i=>i.name==='CREATE_OBJECT')!;
  expect(create).toBeDefined();
  // CWorld::PutToGroundIfTooLow leaves a z above -100 alone, whatever ground is above or below it.
  const {thread,game}=threadAt(bytes,create.offset,new ScmGameState(),{groundLevel:()=>1000,modelBaseOffset:()=>0.5});
  runOne(thread);
  const object=game.objects.at(game.objects.handles[0]);
  expect(object.position.z).toBeCloseTo((create.parameters[3].value as number)+.5,4);
  const id=create.parameters[0].value as number;
  expect(object.model).toBe(id>=0?id:readScmHeader(bytes).objectNames[-id]);
  expect(object.objectType).toBe(OBJECT_MISSION);
  expect(object.scale).toBe(1);
  expect(object.usesCollision).toBe(true);
 });

 test('CREATE_OBJECT at z = -100 (DRIV2) drops to FindGroundZForCoord, 20 where there is no ground',()=>{
  const bytes=file(),header=readScmHeader(bytes);
  const mission=header.missions.map(m=>({m,code:decodeScmInstructions(bytes,m.start,m.end)})).find(({code})=>String(code[0].parameters?.[0]?.value)==='DRIV2')!;
  const create=mission.code.find(i=>i.name==='CREATE_OBJECT'&&(i.parameters[3].value as number)<=-100)!;
  expect(create).toBeDefined();
  const asked:number[]=[];
  const missionLocals=()=>new DataView(new ArrayBuffer(1024*4));
  const ground=threadAt(bytes,create.offset,new ScmGameState(),{groundLevel:(_x,_y,z)=>{asked.push(z);return 12;},modelBaseOffset:()=>0.5},missionLocals());
  runOne(ground.thread);
  expect(ground.game.objects.at(ground.game.objects.handles[0]).position.z).toBe(12.5);
  expect(asked).toEqual([1000]);
  const none=threadAt(bytes,create.offset,new ScmGameState(),{groundLevel:()=>undefined,modelBaseOffset:()=>0.5},missionLocals());
  runOne(none.thread);
  expect(none.game.objects.at(none.game.objects.handles[0]).position.z).toBe(20.5);
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

describe('an object\'s turn speed',()=>{
 test('SET, ADD_TO and GET_OBJECT_ROTATION_VELOCITY keep m_vecTurnSpeed per frame and answer per second',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.setTurnSpeed(object.handle,{x:0,y:.6,z:0});
  expect(object.turnSpeed.y).toBeCloseTo(.012,9);
  game.objects.addToTurnSpeed(object.handle,{x:0,y:.4,z:5});
  const w=game.objects.getTurnSpeed(object.handle);
  expect(w.x).toBe(0);expect(w.y).toBeCloseTo(1,9);expect(w.z).toBeCloseTo(5,9);
  // A new object (basketb's ball made again in place) turns not at all.
  expect(game.objects.getTurnSpeed(game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle)).toEqual({x:0,y:0,z:0});
 });
 test('ADD_VELOCITY_RELATIVE_TO_OBJECT_VELOCITY adds across and along the way the object travels',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  // Travelling east at 2 units a second: along it is east, to its right is south.
  game.objects.setVelocity(object.handle,{x:2,y:0,z:0});
  game.objects.addVelocityRelativeToVelocity(object.handle,{x:1,y:.5,z:0});
  const v=game.objects.getVelocity(object.handle);
  expect(v.x).toBeCloseTo(2.5,6);expect(v.y).toBeCloseTo(-1,6);expect(v.z).toBe(0);
  // Standing still: CVector::Normalise makes the way of travel east, so along is east, right south, up up.
  const still=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.addVelocityRelativeToVelocity(still.handle,{x:1,y:2,z:3});
  const u=game.objects.getVelocity(still.handle);
  expect(u.x).toBeCloseTo(2,5);expect(u.y).toBeCloseTo(-1,5);expect(u.z).toBeCloseTo(3,5);
  // The speed is scaled by the frame's length: a 30 fps frame adds 5/3 of a 50 fps one.
  const slow=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.setVelocity(slow.handle,{x:2,y:0,z:0});
  game.objects.addVelocityRelativeToVelocity(slow.handle,{x:0,y:3,z:0},1/30);
  expect(game.objects.getVelocity(slow.handle).x).toBeCloseTo(2+3*50/30,4);
  // Climbing: up is the right crossed with the way of travel, tipped back from the vertical.
  const climbing=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.setVelocity(climbing.handle,{x:3,y:0,z:3});
  game.objects.addVelocityRelativeToVelocity(climbing.handle,{x:0,y:0,z:Math.SQRT2});
  const c=game.objects.getVelocity(climbing.handle);
  expect(c.x).toBeCloseTo(2,4);expect(c.z).toBeCloseTo(4,4);
  // Straight up: nothing is added.
  const rising=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.setVelocity(rising.handle,{x:0,y:0,z:5});
  game.objects.addVelocityRelativeToVelocity(rising.handle,{x:1,y:1,z:1});
  expect(game.objects.getVelocity(rising.handle)).toEqual({x:0,y:0,z:5});
 });
});

describe('object rotation',()=>{
 test('the tilts are kept in radians, and the turn about the vertical axis is the heading',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  game.objects.setRotation(object.handle,0,90,180);
  expect(object.rotation.y).toBeCloseTo(Math.PI/2,6);
  // The turn about the vertical axis lives in the heading alone, so nothing draws it twice.
  expect(object.rotation.z).toBe(0);
  expect(game.objects.getHeading(object.handle)).toBeCloseTo(180,4);
  // The matrix turns with it: a half turn puts forward to the south.
  game.objects.setRotation(object.handle,0,0,180);
  expect(game.objects.matrix(object.handle).forward.y).toBeCloseTo(-1,6);
  // A negative angle about the vertical axis is fixed into range for the heading, as SetObjectHeading does.
  game.objects.setRotation(object.handle,0,0,-90);
  expect(game.objects.getHeading(object.handle)).toBeCloseTo(270,4);
 });
});

describe('what an object carries for the script',()=>{
 test('a new object starts on CObject::Init’s health, visible and undamaged',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:1,y:2,z:3},{external:false,missionCleanup:false});
  expect(object.health).toBe(1000);expect(object.visible).toBe(true);expect(object.damaged).toBe(false);
 });

 test('health never falls below nothing, and anything taken from it counts as damage',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  // Raising the health leaves the object undamaged.
  game.objects.setHealth(object.handle,2000);
  expect(object.health).toBe(2000);expect(object.damaged).toBe(false);
  game.objects.setHealth(object.handle,500);
  expect(object.health).toBe(500);expect(object.damaged).toBe(true);
  game.objects.setHealth(object.handle,-100);
  expect(object.health).toBe(0);
 });

 test('speed is the move speed a frame carries, times fifty',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  expect(game.objects.speed(object.handle)).toBe(0);
  object.velocity={x:.3,y:.4,z:0};
  expect(game.objects.speed(object.handle)).toBeCloseTo(25,6);
 });
});

describe('an object that hangs from something',()=>{
 test('attaching keeps what the script named, and letting go leaves the object where it was',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:5,y:6,z:7},{external:false,missionCleanup:false});
  expect(game.objects.isAttached(object.handle)).toBe(false);
  game.objects.attach(object.handle,'vehicle',1024,{x:0,y:1,z:2},{x:0,y:0,z:Math.PI/2});
  expect(game.objects.isAttached(object.handle)).toBe(true);
  expect(object.attachedTo).toEqual({kind:'vehicle',handle:1024,offset:{x:0,y:1,z:2},rotation:{x:0,y:0,z:Math.PI/2}});
  game.objects.detach(object.handle);
  expect(game.objects.isAttached(object.handle)).toBe(false);
  // Detaching is not a move: the object is still where it had got to.
  expect(object.position).toEqual({x:5,y:6,z:7});
 });

 test('an attachment that is not a number is refused',()=>{
  const game=new ScmGameState();
  const object=game.objects.create(1337,{x:0,y:0,z:0},{external:false,missionCleanup:false});
  expect(()=>game.objects.attach(object.handle,'ped',1,{x:Number.NaN,y:0,z:0},{x:0,y:0,z:0})).toThrow(/Invalid/);
 });
});

describe('object orientation and area',()=>{
 test('GET/SET_OBJECT_QUATERNION go through the object matrix both ways, and a heading reads back as a turn about z',()=>{
  const game=new ScmGameState(),objects=game.objects;
  const h=objects.create('cardboardbox',{x:1,y:2,z:3},{external:false,missionCleanup:false}).handle;
  // Unturned: the identity.
  const id=objects.getQuaternion(h);expect(id.w).toBeCloseTo(1,6);expect(Math.hypot(id.x,id.y,id.z)).toBeCloseTo(0,6);
  // A quarter turn anticlockwise about z: forward points west.
  objects.setHeading(h,90);const q=objects.getQuaternion(h);
  expect(q.z).toBeCloseTo(Math.SQRT1_2,5);expect(q.w).toBeCloseTo(Math.SQRT1_2,5);
  // Set back from a tilted quaternion: the matrix and the quaternion agree, and forward gives the heading.
  const t={x:.2,y:-.1,z:.5,w:.84},l=Math.hypot(t.x,t.y,t.z,t.w);
  objects.setQuaternion(h,t);const back=objects.getQuaternion(h);
  expect(back.x).toBeCloseTo(t.x/l,5);expect(back.y).toBeCloseTo(t.y/l,5);expect(back.z).toBeCloseTo(t.z/l,5);expect(back.w).toBeCloseTo(t.w/l,5);
  const f=objects.at(h).matrix!.forward;expect(objects.at(h).heading).toBeCloseTo(Math.atan2(-f.x,f.y),6);
 });
 test('IS_OBJECT_IN_AREA_3D takes the corners either way round; SET_OBJECT_MASS and _TURN_MASS keep the figures',()=>{
  const objects=new ScmGameState().objects,h=objects.create('cardboardbox',{x:1,y:2,z:3},{external:false,missionCleanup:false}).handle;
  expect(objects.isInArea3d(h,{x:0,y:0,z:0},{x:2,y:3,z:4})).toBe(true);
  expect(objects.isInArea3d(h,{x:2,y:3,z:4},{x:0,y:0,z:0})).toBe(true);
  expect(objects.isInArea3d(h,{x:0,y:0,z:0},{x:2,y:3,z:2.9})).toBe(false);
  objects.setMass(h,40);objects.setTurnMass(h,12);expect(objects.at(h).mass).toBe(40);expect(objects.at(h).turnMass).toBe(12);
  expect(()=>objects.setMass(h,0)).toThrow();
 });
});
