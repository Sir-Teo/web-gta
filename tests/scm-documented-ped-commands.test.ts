import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

const CODE=512;
function instruction(opcode:number,operands:readonly (readonly [number,number]|string)[]){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const operand of operands){
  if(typeof operand==='string'){out.push(14,operand.length,...[...operand].map(c=>c.charCodeAt(0)));continue;}
  const [type,value]=operand;
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
/** Every call the script makes, recorded in order, so a test can read the operands a command passed on. */
function recording(extra:Record<string,unknown>={}){
 const calls:unknown[][]=[];
 const method=(name:string,result?:unknown)=>(...args:unknown[])=>{calls.push([name,...args]);return result;};
 const world={
  setPedInformRespectedFriends:method('friends'),setPedFollowNodeThresholdDistance:method('threshold'),
  setPedSenseRange:method('sense'),setPedAnimGroup:method('animGroup'),setNextDesiredMoveState:method('moveState'),
  pedSequenceProgress:method('progress',3),pedSequenceProgressRecursive:method('progressDeep',5),
  performSequenceTaskFromProgress:method('fromProgress'),
  addArmourToPed:method('armour'),addAmmoToPed:method('ammo'),removeWeaponFromPed:method('disarm'),
  givePedMeleeAttack:method('melee'),damagePed:method('damage'),setPedDropsObject:method('drop'),
  setPedListensToPlayerGroupCommands:method('listen'),setPedDontRemove:method('keep'),
  setPedDeathWeaponsPersist:method('deathWeapons'),pedIsGroupLeader:method('leader',true),
  pedFollowerCount:method('followers',4),pedType:method('pedType',6),setPedSwimSpeed:method('swim'),
  pedSayContextImportant:method('say',77),attachFxSystemToPedBone:method('fx'),
  setHeadingLimitForAttachedPed:method('headingLimit'),attachPedToBike:method('bike'),
  pedIsInSearchlight:method('searchlight',true),pedIsAtScriptedAttractor:method('attractor',true),
  closestPedNode:method('node',{x:7,y:8,z:9}),randomPedInZone:method('randomInZone',21),
  createSwatRope:method('swat',22),
  ...extra,
 } as unknown as Partial<ScmWorldCommands>;
 return {world,calls};
}
function run(world:Partial<ScmWorldCommands>,...instructions:number[][]){
 const space=new Uint8Array(2048);space.set(instructions.flat(),CODE);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,CODE,0,undefined,host);
 try{thread.run(0,32);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 const view=new DataView(space.buffer);
 return {thread,readInt:(offset:number)=>view.getInt32(offset,true),readFloat:(offset:number)=>view.getFloat32(offset,true)};
}
const PED=7,CAR=9;
const op=scmOpcode;

describe('the ped commands the reference documents but does not register',()=>{
 test('the ranges and groups pass their operands in the order the documentation lists',()=>{
  const {world,calls}=recording();
  run(world,
   instruction(op('SET_INFORM_RESPECTED_FRIENDS'),[int(PED),float(25),int(3)]),
   instruction(op('SET_FOLLOW_NODE_THRESHOLD_DISTANCE'),[int(PED),float(8.5)]),
   instruction(op('SET_SENSE_RANGE'),[int(PED),float(30)]),
   // The anim group is named, as main.scm writes it (a string operand): CAnimManager finds the group by its name.
   instruction(op('SET_ANIM_GROUP_FOR_CHAR'),[int(PED),'GANG1']),
   // SET_NEXT_DESIRED_MOVE_STATE is the runtime's own, for the next enter-car task: the world is not asked.
   instruction(op('SET_NEXT_DESIRED_MOVE_STATE'),[int(2)]));
  expect(calls).toEqual([
   ['friends',PED,25,3],['threshold',PED,8.5],['sense',PED,30],['animGroup',PED,'GANG1'],
  ]);
 });

 test('the sequence progress is read, and the ranged form takes both task indices',()=>{
  const {world,calls}=recording();
  const plain=run(world,instruction(op('GET_SEQUENCE_PROGRESS'),[int(PED),gvar(40)]));
  expect(plain.readInt(40)).toBe(3);
  run(world,instruction(op('PERFORM_SEQUENCE_TASK_FROM_PROGRESS'),[int(PED),int(2),int(1),int(4)]));
  expect(calls).toEqual([['progress',PED],['fromProgress',PED,2,1,4]]);
 });

 test('the weapon and damage commands carry what the documentation names',()=>{
  const {world,calls}=recording();
  run(world,
   instruction(op('ADD_ARMOUR_TO_CHAR'),[int(PED),int(50)]),
   instruction(op('ADD_AMMO_TO_CHAR'),[int(PED),int(22),int(120)]),
   instruction(op('REMOVE_WEAPON_FROM_CHAR'),[int(PED),int(22)]),
   instruction(op('GIVE_MELEE_ATTACK_TO_CHAR'),[int(PED),int(4),int(2)]),
   instruction(op('DAMAGE_CHAR'),[int(PED),int(30),int(1)]));
  expect(calls).toEqual([
   ['armour',PED,50],['ammo',PED,22,120],['disarm',PED,22],['melee',PED,4,2],['damage',PED,30,true],
  ]);
 });

 test('the ped switches and the group questions answer for the ped the command names',()=>{
  const {world,calls}=recording();
  const {thread,readInt}=run(world,
   instruction(op('DROP_OBJECT'),[int(PED),int(1)]),
   instruction(op('LISTEN_TO_PLAYER_GROUP_COMMANDS'),[int(PED),int(0)]),
   instruction(op('DONT_REMOVE_CHAR'),[int(PED)]),
   instruction(op('SET_DEATH_WEAPONS_PERSIST'),[int(PED),int(1)]),
   instruction(op('GET_NUMBER_OF_FOLLOWERS'),[int(PED),gvar(40)]),
   instruction(op('GET_PED_TYPE'),[int(PED),gvar(44)]),
   instruction(op('IS_GROUP_LEADER'),[int(PED),int(3)]));
  expect(calls).toEqual([
   ['drop',PED,true],['listen',PED,false],['keep',PED],['deathWeapons',PED,true],
   ['followers',PED],['pedType',PED],['leader',PED,3],
  ]);
  expect([readInt(40),readInt(44)]).toEqual([4,6]);
  expect(thread.condition).toBe(true);
 });

 test('the say command gives back the line it started',()=>{
  const {world,calls}=recording();
  const {readInt}=run(world,instruction(op('SET_CHAR_SAY_CONTEXT_IMPORTANT'),
   [int(PED),int(150),int(1),int(0),int(1),gvar(40)]));
  expect(calls).toEqual([['say',PED,150,true,false,true]]);
  expect(readInt(40)).toBe(77);
 });

 test('the bike attachment carries two ranges where the car form takes one',()=>{
  const {world,calls}=recording();
  run(world,instruction(op('ATTACH_CHAR_TO_BIKE'),
   [int(PED),int(CAR),float(0),float(1),float(2),float(90),float(45),float(10),int(22)]),
   instruction(op('SET_HEADING_LIMIT_FOR_ATTACHED_CHAR'),[int(PED),float(180),float(30)]));
  expect(calls).toEqual([
   ['bike',PED,CAR,{x:0,y:1,z:2},90,45,10,22],
   ['headingLimit',PED,180,30],
  ]);
 });

 test('the searchlight question names the light first and the ped second',()=>{
  const {world,calls}=recording();
  const {thread}=run(world,instruction(op('IS_CHAR_IN_SEARCHLIGHT'),[int(11),int(PED)]));
  expect(calls).toEqual([['searchlight',11,PED]]);
  expect(thread.condition).toBe(true);
 });

 test('the lookups give back a point, a ped and a roped officer',()=>{
  const {world,calls}=recording();
  const node=run(world,instruction(op('GET_CLOSEST_CHAR_NODE'),[float(1),float(2),float(3),gvar(40),gvar(44),gvar(48)]));
  expect([node.readFloat(40),node.readFloat(44),node.readFloat(48)]).toEqual([7,8,9]);
  const zone=run(world,instruction(op('GET_RANDOM_CHAR_IN_ZONE'),['LAN',int(1),int(0),int(1),gvar(40)]));
  expect(zone.readInt(40)).toBe(21);
  const swat=run(world,instruction(op('CREATE_SWAT_ROPE'),[int(6),int(287),float(10),float(20),float(30),gvar(40)]));
  expect(swat.readInt(40)).toBe(22);
  expect(calls).toEqual([
   ['node',1,2,3],['randomInZone','LAN',true,false,true],['swat',6,287,10,20,30],
  ]);
 });

 test('the swim speed and the particle attachment reach the host',()=>{
  const {world,calls}=recording();
  run(world,instruction(op('SET_SWIM_SPEED'),[int(PED),float(1.5)]),
   instruction(op('ATTACH_FX_SYSTEM_TO_CHAR_BONE'),[int(3),int(PED),int(24)]),
   instruction(op('IS_CHAR_AT_SCRIPTED_ATTRACTOR'),[int(PED),int(5)]));
  expect(calls).toEqual([['swim',PED,1.5],['fx',3,PED,24],['attractor',PED,5]]);
 });
});
