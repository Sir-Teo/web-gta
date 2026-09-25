import {describe,expect,test} from 'vitest';
import {WorldCar} from '../src/simulation/WorldCar';
import {ScmThread,type ScmThreadHost,type ScmWorldCommands} from '../src/engine/ScmThread';
import {ScmGameState} from '../src/engine/ScmGameState';
import {checkDamagedWeaponType} from '../src/engine/ScmGameCommands';
import {scmOpcode} from '../src/engine/scmOpcodes';

const car=(extra:object={})=>({wrecked:false,canBeDamaged:true,occupied:false,health:1000,lastWeaponDamage:-1,blowUp(){this.wrecked=true;},...extra} as any);
const damage=(target:any,amount:number,explosive=false,options:object={})=>(WorldCar.prototype as any).damage.call(target,amount,undefined,explosive,undefined,options);

function ask(opcode:number,ints:number[],world:Partial<ScmWorldCommands>){
 const out:number[]=[opcode&0xff,opcode>>8&0xff];
 for(const value of ints){const bytes=new Uint8Array(4);new DataView(bytes.buffer).setInt32(0,value,true);out.push(1,...bytes);}
 const space=new Uint8Array(128);space.set(out,0);
 const host:ScmThreadHost={startScript(){},game:new ScmGameState(),world:{fade(){},...world} as ScmWorldCommands};
 const thread=new ScmThread(space,0,0,undefined,host);
 try{thread.run(0,1);}catch(error){if(!String(error).includes('watchdog'))throw error;}
 return thread.condition;
}

describe('who last damaged a car, and with what',()=>{
 test('InflictDamage keeps the weapon and the damager while the car has health',()=>{
  const target=car(),shooter={};
  damage(target,20,false,{weapon:22,by:{ped:shooter}});
  expect(target.lastWeaponDamage).toBe(22);expect(target.lastDamagedBy).toEqual({ped:shooter});
  // The player's harm is his own ped's; a blast is WEAPON_EXPLOSION and a fire WEAPON_FLAMETHROWER.
  damage(target,20,true,{byPlayer:true});
  expect(target.lastWeaponDamage).toBe(51);expect(target.lastDamagedBy).toEqual({player:true});
  damage(target,5,false,{kind:'fire'});
  expect(target.lastWeaponDamage).toBe(37);expect(target.lastDamagedBy).toBeUndefined();
 });

 test('a car that refuses the damage keeps what it had',()=>{
  const proof=car({proofs:{bullet:true,explosion:false}});
  damage(proof,20,false,{weapon:31,by:{player:true}});
  expect(proof.lastWeaponDamage).toBe(-1);expect(proof.lastDamagedBy).toBeUndefined();
  // Only the player may hurt a bInvulnerable car.
  const guarded=car({onlyDamagedByPlayer:true});
  damage(guarded,20,false,{weapon:31,by:{ped:{}},byPlayer:false});
  expect(guarded.lastWeaponDamage).toBe(-1);
 });

 test('CDarkel::CheckDamagedWeaponType sorts the two wildcards',()=>{
  expect(checkDamagedWeaponType(-1,57)).toBe(false);
  expect(checkDamagedWeaponType(15,56)).toBe(true);expect(checkDamagedWeaponType(16,56)).toBe(false);
  for(const weapon of [0,16,22,38,45,51,52])expect(checkDamagedWeaponType(weapon,57)).toBe(true);
  // The parachute, a ram, a run over, drowning and a fall are no weapon.
  for(const weapon of [46,49,50,53,54])expect(checkDamagedWeaponType(weapon,57)).toBe(false);
  expect(checkDamagedWeaponType(22,22)).toBe(false);
 });

 test('HAS_CAR_BEEN_DAMAGED_BY_WEAPON takes a wildcard through the check and any other type as it is',()=>{
  const op=scmOpcode('HAS_CAR_BEEN_DAMAGED_BY_WEAPON');
  const world=(last:number)=>({vehicleLastWeaponDamage:()=>last});
  expect(ask(op,[5,49],world(49))).toBe(true);
  expect(ask(op,[5,57],world(49))).toBe(false);
  expect(ask(op,[5,56],world(8))).toBe(true);
  expect(ask(op,[5,57],world(31))).toBe(true);
  // A car nothing has hurt matches no type.
  expect(ask(op,[5,-1],world(-1))).toBe(false);
 });
});
