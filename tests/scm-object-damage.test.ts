import {describe,expect,test} from 'vitest';
import {ScmObjects} from '../src/engine/ScmObjects';

/* CObject::ObjectDamage on the script's objects, with OBJECT.DAT's values as CObjectData::SetObjectData copies them. */
const PISTOL=22,BAT=5,ROCKET=35,UNIDENTIFIED=55,RUNOVER=50;
function pool(rows:Record<number,{colDamageEffect:number;colDamageMultiplier?:number;smashMultiplier?:number;mass?:number}>={}){
 const objects=new ScmObjects();
 objects.objectInfo=model=>{const row=rows[model as number];return row&&{colDamageMultiplier:1,smashMultiplier:1,mass:50,...row};};
 const make=(model:number)=>objects.create(model,{x:0,y:0,z:0},{external:false,missionCleanup:false}).handle;
 return {objects,make};
}

describe('ObjectDamage on a script object',()=>{
 test('SetObjectData gives the effect; a model without a row is heavy and explosion proof',()=>{
  const {objects,make}=pool({1:{colDamageEffect:20}});
  const withRow=objects.at(make(1)),without=objects.at(make(2));
  expect([withRow.colDamageEffect,withRow.mass,withRow.proofs.explosion]).toEqual([20,50,false]);
  expect([without.colDamageEffect,without.mass,without.proofs.explosion]).toEqual([0,99999,true]);
 });

 test('health always drops; the effect and the last weapon wait for an effect, and over 150 or none left',()=>{
  const {objects,make}=pool({1:{colDamageEffect:0},2:{colDamageEffect:20}});
  const plain=make(1);
  objects.damage(plain,100,PISTOL,'player');
  expect(objects.at(plain).health).toBe(900);
  expect(objects.at(plain).lastWeaponDamage).toBe(-1);
  const smash=make(2);
  expect(objects.damage(smash,100,PISTOL,'player')).toEqual({destroyed:false,removed:false,changedModel:false});
  expect(objects.at(smash).lastWeaponDamage).toBe(PISTOL);
  expect(objects.hasBeenDamaged(smash)).toBe(false);
  expect(objects.damage(smash,151,BAT,'player')).toMatchObject({destroyed:true,removed:true});
  const o=objects.at(smash);
  expect([o.usesCollision,o.visible,o.health,o.lastWeaponDamage]).toEqual([false,false,0,BAT]);
  expect(objects.hasBeenDamaged(smash)).toBe(true);
  // Without collision, nothing reaches it any more.
  objects.clearLastWeaponDamage(smash);
  objects.damage(smash,500,PISTOL,'player');
  expect(objects.at(smash).lastWeaponDamage).toBe(-1);
 });

 test('change-model swaps once, change-then-smash swaps and then smashes',()=>{
  const {objects,make}=pool({1:{colDamageEffect:1},2:{colDamageEffect:21}});
  const change=make(1);
  expect(objects.damage(change,200,PISTOL,'other')).toEqual({destroyed:true,removed:false,changedModel:true});
  expect(objects.damage(change,200,PISTOL,'other')).toEqual({destroyed:false,removed:false,changedModel:false});
  expect(objects.hasBeenDamaged(change)).toBe(true);
  const both=make(2);
  expect(objects.damage(both,200,PISTOL,'other')).toMatchObject({changedModel:true,removed:false});
  expect(objects.damage(both,200,PISTOL,'other')).toMatchObject({removed:true,destroyed:true});
 });

 test('a breakable goes to the break manager, with just its faces past the smash multiplier',()=>{
  const {objects,make}=pool({1:{colDamageEffect:200,smashMultiplier:2}});
  const a=make(1),b=make(1);
  expect(objects.damage(a,200,PISTOL,'other').broken).toEqual({justFaces:false});
  expect(objects.damage(b,301,PISTOL,'other').broken).toEqual({justFaces:true});
  expect(objects.at(a).broken).toBe(true);
  // The host takes both from the queue to spawn their pieces.
  expect(objects.broken).toEqual([{handle:a,justFaces:false},{handle:b,justFaces:true}]);
 });

 test('BREAK_OBJECT breaks and hides an object whatever its effect, and queues its pieces once',()=>{
  // WUZI5 breaks a padlock whose row has no effect; DECON waits on HAS_OBJECT_BEEN_DAMAGED.
  const {objects,make}=pool({1:{colDamageEffect:0}});
  const lock=make(1);
  objects.breakObject(lock,false);
  const o=objects.at(lock);
  expect([o.usesCollision,o.visible,o.broken,o.health,o.proofs.explosion]).toEqual([false,false,true,0,true]);
  expect(objects.hasBeenDamaged(lock)).toBe(true);
  objects.breakObject(lock,true);
  expect(objects.broken).toEqual([{handle:lock,justFaces:false}]);
 });

 test('only the player sets off an object only he may damage, though its health still goes',()=>{
  const {objects,make}=pool({1:{colDamageEffect:20}});
  const handle=make(1);objects.at(handle).onlyDamagedByPlayer=true;
  objects.damage(handle,500,PISTOL,'other');
  expect([objects.at(handle).visible,objects.at(handle).health,objects.at(handle).lastWeaponDamage]).toEqual([true,500,-1]);
  objects.damage(handle,500,PISTOL,'playerVehicle');
  expect(objects.at(handle).visible).toBe(false);
 });

 test('the proofs turn a weapon away, and an unnamed hit from a car counts as running it over',()=>{
  const {objects,make}=pool({1:{colDamageEffect:20}});
  const handle=make(1);objects.at(handle).proofs.bullet=true;
  objects.damage(handle,500,PISTOL,'player');
  expect(objects.at(handle).health).toBe(1000);
  objects.damage(handle,10,UNIDENTIFIED,'vehicle');
  expect(objects.at(handle).lastWeaponDamage).toBe(RUNOVER);
  objects.at(handle).proofs.explosion=true;
  objects.damage(handle,10,ROCKET,'player');
  expect(objects.at(handle).lastWeaponDamage).toBe(RUNOVER);
 });
});
