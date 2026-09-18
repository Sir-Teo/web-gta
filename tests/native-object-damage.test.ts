import {describe,expect,it} from 'vitest';
import {COL_DAMAGE_EFFECT,OBJECT_FX,impulseVelocityChange,newObjectState,objectDamage,objectDamagePlaysFx,vehicleHitsObject} from '../src/simulation/nativeObjectDamage';

/* Rows from the retail OBJECT.DAT: mass, uproot limit, damage multiplier, damage effect. */
const BLACKBAG2={effect:20,colDamageMultiplier:1,uprootLimit:0,mass:100};
const CARDBOARDBOX={effect:20,colDamageMultiplier:2.5,uprootLimit:0,mass:10};
const LAMPPOST3={effect:200,colDamageMultiplier:1,uprootLimit:240,mass:700};
const ROADBARRIER={effect:200,colDamageMultiplier:1,uprootLimit:.2,mass:1500};

/** A car driving along native +y into a prop whose face is at the centre line in front. */
const headOn=(speed:number,extra:{mass?:number;bike?:boolean;hitWall?:boolean}={})=>({
 mass:extra.mass??1500,turnMass:4000,offset:{x:0,y:2,z:0},normal:{x:0,y:-1,z:0},
 moveSpeed:{x:0,y:speed,z:0},turnSpeed:{x:0,y:0,z:0},bike:extra.bike,hitWall:extra.hitWall,
});

describe('CObject::ObjectDamage',()=>{
 it('smashes a smash-completely prop only above 150 scaled damage',()=>{
  const state=newObjectState();
  expect(objectDamage(state,100,COL_DAMAGE_EFFECT.smashCompletely,1)).toEqual({removed:false,changedModel:false,destroyed:false});
  expect(state.health).toBe(900);
  expect(objectDamage(state,151,COL_DAMAGE_EFFECT.smashCompletely,1)).toEqual({removed:true,changedModel:false,destroyed:true});
  expect(state).toMatchObject({destroyed:true,health:0});
  // A destroyed object ignores further damage.
  expect(objectDamage(state,500,COL_DAMAGE_EFFECT.smashCompletely,1).removed).toBe(false);
 });
 it('scales damage by the collision damage multiplier',()=>{
  const state=newObjectState();
  expect(objectDamage(state,70,COL_DAMAGE_EFFECT.smashCompletely,2.5).removed).toBe(true);
 });
 it('applies the effect once repeated small hits drain health to zero',()=>{
  const state=newObjectState();
  for(let i=0;i<9;i++)expect(objectDamage(state,100,COL_DAMAGE_EFFECT.smashCompletely,1).removed).toBe(false);
  expect(objectDamage(state,100,COL_DAMAGE_EFFECT.smashCompletely,1).removed).toBe(true);
 });
 it('changes the model first and smashes on the next heavy hit for change-then-smash',()=>{
  const state=newObjectState();
  // The first stage swaps the model without counting as destroyed.
  expect(objectDamage(state,200,COL_DAMAGE_EFFECT.changeThenSmash,1)).toEqual({removed:false,changedModel:true,destroyed:false});
  expect(objectDamage(state,200,COL_DAMAGE_EFFECT.changeThenSmash,1)).toEqual({removed:true,changedModel:false,destroyed:true});
 });
 it('only swaps the model once for change-model props',()=>{
  const state=newObjectState();
  // The first swap counts as destroyed (bWasDestroyed), so it can explode and play the destroyed FX.
  expect(objectDamage(state,200,COL_DAMAGE_EFFECT.changeModel,1)).toEqual({removed:false,changedModel:true,destroyed:true});
  expect(objectDamage(state,200,COL_DAMAGE_EFFECT.changeModel,1)).toEqual({removed:false,changedModel:false,destroyed:false});
  expect(state.destroyed).toBe(false);
 });
 it('only loses health when the prop has no damage effect',()=>{
  const state=newObjectState();
  expect(objectDamage(state,2000,COL_DAMAGE_EFFECT.none,1)).toEqual({removed:false,changedModel:false,destroyed:false});
  expect(state).toMatchObject({health:0,destroyed:false});
 });
});

describe('CObject::ObjectDamage particles',()=>{
 it('plays on-hit FX above 30 damage and destroyed FX only on destruction',()=>{
  expect(objectDamagePlaysFx(OBJECT_FX.playOnHit,30,false,false)).toBe(false);
  expect(objectDamagePlaysFx(OBJECT_FX.playOnHit,31,false,false)).toBe(true);
  expect(objectDamagePlaysFx(OBJECT_FX.playOnDestroyed,500,false,false)).toBe(false);
  expect(objectDamagePlaysFx(OBJECT_FX.playOnDestroyed,21,true,false)).toBe(true);
  expect(objectDamagePlaysFx(OBJECT_FX.playOnHitDestroyed,21,false,false)).toBe(true);
  expect(objectDamagePlaysFx(OBJECT_FX.none,500,true,false)).toBe(false);
 });
 it('skips the FX when the destroyed object exploded',()=>{
  expect(objectDamagePlaysFx(OBJECT_FX.playOnHitDestroyed,500,true,true)).toBe(false);
  expect(objectDamagePlaysFx(OBJECT_FX.playOnHit,500,false,true)).toBe(true);
 });
});

describe('CPhysical::ApplyCollision against a static object',()=>{
 it('ploughs through a black bag and keeps the half-intensity push back',()=>{
  const state=newObjectState(),out=vehicleHitsObject(headOn(.3),state,BLACKBAG2);
  // Head on, the lever arm is zero, so the collision mass is the car mass.
  expect(out.intensity).toBeCloseTo(1.05*1500*.3,6);
  expect(out.damage?.removed).toBe(true);expect(out.objectDamage).toBeCloseTo(out.intensity,9);
  expect(out.impulse!.y).toBeCloseTo(-1.05*1500*.3/2,6);
  const dv=impulseVelocityChange(out.impulse!,{x:0,y:2,z:0},1500,4000);
  expect(.3+dv.move.y).toBeCloseTo(.3*(1-1.05/2),6);
  for(const axis of [dv.turn.x,dv.turn.y,dv.turn.z])expect(axis).toBeCloseTo(0,9);
 });
 it('divides the push back by twice the damage multiplier',()=>{
  const out=vehicleHitsObject(headOn(.3),newObjectState(),CARDBOARDBOX);
  expect(out.impulse!.y).toBeCloseTo(-1.05*1500*.3/5,6);
 });
 it('treats a slow hit on a lamppost as a wall and a fast one as a break',()=>{
  const slow=vehicleHitsObject(headOn(.05),newObjectState(),LAMPPOST3);
  expect(slow).toMatchObject({damaged:true,wall:true,uprooted:false});
  expect(slow.damage?.removed).toBe(false);
  const fast=vehicleHitsObject(headOn(.3),newObjectState(),LAMPPOST3);
  expect(fast.damage?.removed).toBe(true);
 });
 it('uproots a light barrier that survives the hit',()=>{
  const out=vehicleHitsObject(headOn(.05),newObjectState(),ROADBARRIER);
  expect(out).toMatchObject({damaged:true,wall:false,uprooted:true});
 });
 it('never uproots an infinite-mass prop',()=>{
  const out=vehicleHitsObject(headOn(.05),newObjectState(),{...ROADBARRIER,mass:99999});
  expect(out).toMatchObject({wall:true,uprooted:false});
 });
 it('skips damage below the gate of 20 and triples it for bikes',()=>{
  const car=vehicleHitsObject(headOn(.02,{mass:500}),newObjectState(),BLACKBAG2);
  expect(car.intensity).toBeCloseTo(10.5,6);expect(car.damaged).toBe(false);
  const bike=vehicleHitsObject(headOn(.02,{mass:500,bike:true}),newObjectState(),BLACKBAG2);
  expect(bike.damaged).toBe(true);expect(bike.objectDamage).toBeCloseTo(31.5,6);
 });
 it('drops elasticity after a wall hit',()=>{
  const out=vehicleHitsObject(headOn(.3,{hitWall:true}),newObjectState(),BLACKBAG2);
  expect(out.intensity).toBeCloseTo(1500*.3,6);
 });
 it('ignores a car moving away from the object',()=>{
  const state=newObjectState(),out=vehicleHitsObject(headOn(-.3),state,BLACKBAG2);
  expect(out).toMatchObject({separating:true,damaged:false});
  expect(state.health).toBe(1000);
 });
 it('reduces the collision mass for an off-centre hit and adds spin',()=>{
  const impact={...headOn(.3),offset:{x:1,y:2,z:0}};
  const out=vehicleHitsObject(impact,newObjectState(),BLACKBAG2);
  expect(out.intensity).toBeCloseTo(1.05*.3/(1/4000+1/1500),6);
  const dv=impulseVelocityChange(out.impulse!,impact.offset,1500,4000);
  // A push back on the right front corner yaws the car to the right (negative z spin).
  expect(dv.turn.z).toBeLessThan(0);
 });
});
