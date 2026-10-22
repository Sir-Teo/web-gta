import {expect,test} from 'vitest';
import fixture from './fixtures/native-vehicle-damage-gates.json';
import {vehicleRefusesWeaponDamage} from '../src/simulation/carDamageHost';
import type {PhysicalProofs} from '../src/combat/nativePhysicalProofs';
import {WorldCar} from '../src/simulation/WorldCar';
import {WorldBike} from '../src/simulation/WorldBike';
import {WorldBoat} from '../src/simulation/WorldBoat';
import {WorldPlane} from '../src/simulation/WorldPlane';

for(const [index,row]of fixture.cases.entries())test(`captured vehicle damage gate ${index}: ${JSON.stringify(row.input)}`,()=>{
 const c=row.input as {weapon:number;proof?:string;occupied?:boolean;health?:number;onlyPlayer?:boolean;source?:string;canBeDamaged?:boolean;attached?:boolean};
 const proofs:PhysicalProofs={bullet:false,fire:false,explosion:false,collision:false,melee:false};if(c.proof&&c.proof!=='none')proofs[c.proof as keyof PhysicalProofs]=true;
 const source=c.source??'other',byPlayer=source==='player'||source==='playerVehicle';
 expect(!vehicleRefusesWeaponDamage({health:c.health??1000,occupied:c.occupied??false,canBeDamaged:c.canBeDamaged??true,onlyDamagedByPlayer:c.onlyPlayer,proofs},c.weapon,byPlayer,!!c.attached&&source==='player')).toBe(row.allowed);
});
const other={},ownCar={};const sources:Record<string,any>={none:undefined,player:{player:true},other:{ped:other},playerVehicle:{car:ownCar}};
for(const row of fixture.storage)test(`captured attacker storage: ${row.previousSource} then ${row.source}`,()=>{
 const target={health:100,occupied:false,canBeDamaged:true,wrecked:false,modelId:400,lastWeaponDamage:17,lastDamagedBy:sources[row.previousSource]};
 WorldCar.prototype.damage.call(target as any,20,undefined,false,undefined,{weapon:31,by:sources[row.source]});expect(target.lastDamagedBy).toEqual(sources[row.lastSource]);expect(target.lastWeaponDamage).toBe(row.lastWeapon);expect(target.health).toBe(row.health);
});
for(const [name,Vehicle]of [['car',WorldCar],['bike',WorldBike],['boat',WorldBoat],['aircraft',WorldPlane]]as const){
 const make=(extra:object={})=>({health:1000,occupied:false,canBeDamaged:true,onlyDamagedByPlayer:false,wrecked:false,modelId:487,lastWeaponDamage:-1,lastDamagedBy:undefined,...extra}as any);
 const damage=(target:any,weapon:number,byPlayer?:boolean,by?:any)=>Vehicle===WorldPlane?WorldPlane.prototype.damage.call(target,20,weapon,byPlayer,by):(Vehicle.prototype.damage as any).call(target,20,undefined,weapon===51,undefined,{weapon,byPlayer,by});
 for(const [proof,weapon]of [['bullet',31],['explosion',51],['fire',37],['collision',49],['melee',4],['explosion',18]]as const)test(`${name} rejects ${weapon} through ${proof} proof without changing attribution`,()=>{
  const target=make({proofs:{[proof]:true},lastWeaponDamage:22,lastDamagedBy:{player:true}});damage(target,weapon,false,{ped:other});expect(target.health).toBe(1000);expect(target.lastWeaponDamage).toBe(22);expect(target.lastDamagedBy).toEqual({player:true});
 });
 test(`${name} honors script immunity and the player-only gate`,()=>{
  const immune=make({canBeDamaged:false});damage(immune,31,true);expect(immune.health).toBe(1000);expect(immune.lastWeaponDamage).toBe(-1);
  const target=make({onlyDamagedByPlayer:true});damage(target,31,false,{ped:other});expect(target.health).toBe(1000);damage(target,31,true);expect(target.health).toBeLessThan(1000);expect(target.lastDamagedBy).toEqual({player:true});
 });
 test(`${name} reads occupied health as float32 at the 250 boundary`,()=>{
  const target=make({health:249.999999,occupied:true});damage(target,31,true);expect(target.health).toBeLessThan(249.999999);expect(target.lastWeaponDamage).toBe(31);
 });
 test(`${name} records accepted damage, preserves a null source and replaces a known other source`,()=>{
  const target=make();damage(target,31,true);expect(target.lastWeaponDamage).toBe(31);expect(target.lastDamagedBy).toEqual({player:true});
  damage(target,37);expect(target.lastWeaponDamage).toBe(37);expect(target.lastDamagedBy).toEqual({player:true});
  damage(target,31,false,{ped:other});expect(target.lastDamagedBy).toEqual({ped:other});
  damage(target,31,true);damage(target,31,false);expect(target.lastDamagedBy).toBeUndefined();
 });
 test(`${name} does not overwrite attribution after health reaches zero`,()=>{
  const target=make({health:0,lastWeaponDamage:22,lastDamagedBy:{player:true}});damage(target,31,false,{ped:other});expect(target.lastWeaponDamage).toBe(22);expect(target.lastDamagedBy).toEqual({player:true});
 });
}
