import {describe,expect,it} from 'vitest';
import {COL_DAMAGE_EFFECT,OBJECT_FX,bulletHitsObject,sniperHitsObject,impulseVelocityChange,pedHitsObject,newObjectState,objectDamage,objectDamagePlaysFx,twoBodyCollision,vehicleHitsObject,vehicleUprootsObject} from '../src/simulation/nativeObjectDamage';

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

describe('CPhysical::ApplyCollision general two-body branch',()=>{
 const zero={x:0,y:0,z:0};
 const car={mass:1500,turnMass:4000,elasticity:.05,offset:{x:0,y:2,z:0},moveSpeed:{x:0,y:.3,z:0},turnSpeed:zero};
 const bin={mass:200,turnMass:140,elasticity:.05,offset:{x:0,y:-.4,z:0},moveSpeed:zero,turnSpeed:zero};
 const back={x:0,y:-1,z:0};
 it('shares momentum through the common normal speed with the mean elasticity',()=>{
  const hit=twoBodyCollision(car,bin,back)!;
  const common=-(1500*.3)/1700,afterCar=common-.05*(-.3-common),afterBin=common-(0-common)*.05;
  expect(hit.intensityA).toBeCloseTo((afterCar+.3)*1500,6);
  expect(hit.intensityB).toBeCloseTo(-(afterBin*200),6);
  // Momentum along the normal is conserved.
  expect(1500*(.3-hit.intensityA/1500)+200*(hit.entity.y/200)).toBeCloseTo(1500*.3,6);
 });
 it('does nothing for bodies already separating',()=>{
  expect(twoBodyCollision({...car,moveSpeed:{x:0,y:-.3,z:0}},bin,back)).toBeUndefined();
 });
 it('knocks an uprooted bin ahead of the car and keeps most of the car speed',()=>{
  const out=vehicleUprootsObject({...car,armFromPosition:{x:0,y:2,z:0},com:zero},bin,back,1.05*1500*.3,100);
  // Common speed 0.2647 units per frame; with elasticity 0.05 the car leaves at 0.2629 and the bin at 0.2779.
  const common=1500*.3/1700;
  expect(out.car.move.y).toBeCloseTo(common-.05*(.3-common),9);
  expect(out.object.move.y).toBeCloseTo(common*1.05,9);
  expect(out.object.move.y).toBeGreaterThan(out.car.move.y);
 });
 it('adds the 0.2 intensity push back only above an uproot limit of 200',()=>{
  const light=vehicleUprootsObject({...car,armFromPosition:{x:0,y:2,z:0},com:zero},bin,back,400,100);
  const heavy=vehicleUprootsObject({...car,armFromPosition:{x:0,y:2,z:0},com:zero},{...bin,mass:1500,turnMass:12000},back,400,280);
  const noPush=vehicleUprootsObject({...car,armFromPosition:{x:0,y:2,z:0},com:zero},{...bin,mass:1500,turnMass:12000},back,400,200);
  expect(noPush.car.move.y-heavy.car.move.y).toBeGreaterThan(0);
  expect(light.car.move.y).toBeGreaterThan(heavy.car.move.y);
 });
 it('cuts the vertical part of the car force for steep normals and shortens the player car lever arm',()=>{
  const slope={x:0,y:-Math.SQRT1_2,z:Math.SQRT1_2};
  const ai=vehicleUprootsObject({...car,offset:{x:1,y:2,z:0},armFromPosition:{x:1,y:2,z:0},com:zero},bin,slope,300,100);
  const player=vehicleUprootsObject({...car,offset:{x:1,y:2,z:0},armFromPosition:{x:1,y:2,z:0},com:zero,player:true},bin,slope,300,100);
  // Normal z 0.707 is not below 0.7, so the vertical force is kept whole.
  expect(ai.car.move.z).toBeGreaterThan(0);
  expect(Math.abs(player.car.turn.z)).toBeCloseTo(Math.abs(ai.car.turn.z)*.8,6);
  const flat=vehicleUprootsObject({...car,armFromPosition:{x:0,y:2,z:0},com:zero},bin,{x:0,y:-.8,z:.6},300,100);
  const full=twoBodyCollision({...car},bin,{x:0,y:-.8,z:.6})!;
  expect(flat.car.move.z).toBeCloseTo(full.self.z*.3/1500,9);
 });
});

describe('CWeapon::DoBulletImpact on an object',()=>{
 const BIN1={effect:1,colDamageMultiplier:1,uprootLimit:100,mass:200};
 it('knocks a loose prop free and pushes it, a fifth as hard for a pellet',()=>{
  expect(bulletHitsObject(BLACKBAG2,true,false)).toEqual({unfreeze:true,force:-2});
  expect(bulletHitsObject(BLACKBAG2,true,true).force).toBeCloseTo(-.4,9);
 });
 it('leaves a static prop with an uproot limit in place but pushes it once moving',()=>{
  expect(bulletHitsObject(BIN1,true,false)).toEqual({unfreeze:false,force:undefined});
  expect(bulletHitsObject(BIN1,false,false)).toEqual({unfreeze:false,force:-2});
 });
 it('ignores infinite-mass props',()=>{
  expect(bulletHitsObject({...BIN1,mass:99999},false,false)).toEqual({unfreeze:false});
 });
 it('damages breakables by gun-break mode',()=>{
  expect(bulletHitsObject({...LAMPPOST3,gunBreakMode:0},true,false).damage).toBe(50);
  expect(bulletHitsObject({...ROADBARRIER,gunBreakMode:1},true,false).damage).toBe(151);
  expect(bulletHitsObject({...ROADBARRIER,gunBreakMode:2,smashMultiplier:1.5},true,false).damage).toBeCloseTo(226.5,9);
  // One mode-1 shot breaks a road barrier; a lamppost needs repeated 50-point hits.
  expect(objectDamage(newObjectState(),151,COL_DAMAGE_EFFECT.breakable,1).removed).toBe(true);
  expect(objectDamage(newObjectState(),50,COL_DAMAGE_EFFECT.breakable,1).removed).toBe(false);
 });
});

describe('CPhysical::ApplyCollision for a ped walking into a prop',()=>{
 const box={mass:10,elasticity:.03,uprootLimit:0,isStatic:true};
 it('kicks a loose box along at the ten-times-mass common speed',()=>{
  const out=pedHitsObject({...box,closing:-.03});
  const m=100,common=70*-.03/(m+70),after=common-(0-common)*.04;
  expect(out.unfreeze).toBe(true);expect(out.push).toBeCloseTo(-(after*m)/10/10,9);
  expect(out.push!).toBeGreaterThan(0);
 });
 it('only unfreezes a cone when sprinting beats its uproot limit of 10',()=>{
  const cone={mass:25,elasticity:.03,uprootLimit:10,isStatic:true};
  // Running at 5.7 m/s (0.114 units per frame) is 8 under the limit; sprinting at 9.5 m/s is 13.3.
  expect(pedHitsObject({...cone,closing:-.114}).unfreeze).toBe(false);
  expect(pedHitsObject({...cone,closing:-.19}).unfreeze).toBe(true);
 });
 it('never moves infinite-mass or unmovable props, nor props the ped walks away from',()=>{
  expect(pedHitsObject({mass:99999,elasticity:.1,uprootLimit:0,isStatic:true,closing:-.2})).toEqual({unfreeze:false});
  expect(pedHitsObject({mass:200,elasticity:.05,uprootLimit:9999,isStatic:true,closing:-.2})).toEqual({unfreeze:false});
  expect(pedHitsObject({...box,closing:.1})).toEqual({unfreeze:false});
 });
});

it('a sniper round pushes a prop by -7.5 with no turn, breaks a gun-breakable one, and deals 50 to every prop (CBulletInfo)',()=>{
 const prop={effect:COL_DAMAGE_EFFECT.none,colDamageMultiplier:1,uprootLimit:0,mass:50};
 expect(sniperHitsObject(prop,true)).toEqual({damages:[50],unfreeze:true,moveForce:-7.5});
 expect(sniperHitsObject({...prop,uprootLimit:100},true)).toEqual({damages:[50],unfreeze:false,moveForce:undefined});
 expect(sniperHitsObject({...prop,mass:99999},false)).toEqual({damages:[50],unfreeze:false});
 const glass={effect:COL_DAMAGE_EFFECT.breakable,colDamageMultiplier:1,uprootLimit:0};
 expect(sniperHitsObject({...glass,gunBreakMode:1},true).damages).toEqual([151,50]);
 expect(sniperHitsObject({...glass,gunBreakMode:2,smashMultiplier:2},true).damages).toEqual([302,50]);
 expect(sniperHitsObject(glass,true).damages).toEqual([50]);
});
