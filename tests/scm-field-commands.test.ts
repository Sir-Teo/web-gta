import {describe,expect,test} from 'vitest';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {scmOpcode} from '../src/engine/scmOpcodes';

function host(){
 const seen:Record<string,unknown>={};
 const world:ScmWorldCommands={
  fade(){},
  givePedWeapon:(handle,weaponType,ammo)=>{seen.weapon={handle,weaponType,ammo};},
  setPedMaxHealth:(_h,health)=>{seen.maxHealth=health;},
  setPedShootRate:(_h,rate)=>{seen.shootRate=rate;},
  setPedRelationship:(_h,relationship,pedType)=>{seen.relationship={relationship,pedType};},
  clearPedRelationship:(_h,relationship,pedType)=>{seen.cleared={relationship,pedType};},
  clearPedTasks:handle=>{seen.cleared_tasks=handle;},
  vehicleHealth:()=>640.7,
  setVehicleHealth:(_h,health)=>{seen.carHealth=health;},
  freezeVehiclePosition:(_h,frozen)=>{seen.frozen=frozen;},
  setVehicleDoorLock:(_h,lock)=>{seen.lock=lock;},
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

describe('the one-field commands',()=>{
 test('the weapon, max health, shoot rate and both relationship commands reach the ped',()=>{
  const h=host();
  run(build(scmOpcode('GIVE_WEAPON_TO_CHAR'),[int(1),int(24),int(200)]),h.world);
  expect(h.seen.weapon).toEqual({handle:1,weaponType:24,ammo:200});
  run(build(scmOpcode('SET_CHAR_MAX_HEALTH'),[int(1),flt(250)]),h.world);
  expect(h.seen.maxHealth).toBe(250);
  run(build(scmOpcode('SET_CHAR_SHOOT_RATE'),[int(1),int(70)]),h.world);
  expect(h.seen.shootRate).toBe(70);
  run(build(scmOpcode('SET_CHAR_RELATIONSHIP'),[int(1),int(2),int(9)]),h.world);
  expect(h.seen.relationship).toEqual({relationship:2,pedType:9});
  run(build(scmOpcode('CLEAR_CHAR_RELATIONSHIP'),[int(1),int(2),int(9)]),h.world);
  expect(h.seen.cleared).toEqual({relationship:2,pedType:9});
 });

 test('clearing tasks is not the immediate flush',()=>{
  const h=host();
  run(build(scmOpcode('CLEAR_CHAR_TASKS'),[int(6)]),h.world);
  expect(h.seen.cleared_tasks).toBe(6);
  // The immediate form has its own adapter, which this host does not answer.
  expect(()=>run(build(scmOpcode('CLEAR_CHAR_TASKS_IMMEDIATELY'),[int(6)]),h.world)).toThrow('clearPedTasksImmediately');
 });

 test('the car health, freeze and door lock reach the vehicle',()=>{
  const h=host();
  const reader=run(build(scmOpcode('GET_CAR_HEALTH'),[int(1),local(3)]),h.world);
  expect(reader.thread.locals.getInt32(3*4,true)).toBe(640);
  run(build(scmOpcode('SET_CAR_HEALTH'),[int(1),flt(300)]),h.world);
  expect(h.seen.carHealth).toBe(300);
  run(build(scmOpcode('FREEZE_CAR_POSITION'),[int(1),byte(1)]),h.world);
  expect(h.seen.frozen).toBe(true);
  run(build(scmOpcode('LOCK_CAR_DOORS'),[int(1),int(2)]),h.world);
  expect(h.seen.lock).toBe(2);
 });

 test('the densities, widescreen and area sit on the game state',()=>{
  const h=host();
  const density=run(build(scmOpcode('SET_CAR_DENSITY_MULTIPLIER'),[flt(0.5)]),h.world);
  expect(density.game.carDensityMultiplier).toBe(0.5);
  const wide=run(build(scmOpcode('SWITCH_WIDESCREEN'),[byte(1)]),h.world,density.game);
  expect(wide.game.widescreenOn).toBe(true);
  const area=run(build(scmOpcode('SET_AREA_VISIBLE'),[int(4)]),h.world,wide.game);
  expect(area.game.currentArea).toBe(4);
 });
});
