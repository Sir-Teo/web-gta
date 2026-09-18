import {describe,expect,it} from 'vitest';
import {EXPLOSION,explosionDirection,explosionFalloff,explosionOnObject,explosionOnPed,explosionOnVehicle,explosionParams,explosionUnfreezes} from '../src/combat/nativeExplosion';

describe('CExplosion::AddExplosion parameters',()=>{
 it('sets radius, force and damage share per type',()=>{
  expect(explosionParams(EXPLOSION.grenade)).toMatchObject({radius:9,force:300,damagePercentage:1});
  expect(explosionParams(EXPLOSION.car)).toMatchObject({radius:9,force:300,durationMs:4250});
  expect(explosionParams(EXPLOSION.aircraft)).toMatchObject({radius:25,force:600});
  expect(explosionParams(EXPLOSION.weakRocket)).toMatchObject({radius:10,force:200,damagePercentage:.2});
  expect(explosionParams(EXPLOSION.object)).toMatchObject({radius:10,force:150});
  expect(explosionParams(EXPLOSION.small)).toMatchObject({radius:3,force:90});
  // A molotov's blast has no force: TriggerExplosion never runs for it.
  expect(explosionParams(EXPLOSION.molotov).force).toBe(0);
 });
});

describe('CWorld::TriggerExplosionSectorList',()=>{
 it('is at full strength inside half the radius and fades to nothing at its edge',()=>{
  expect(explosionFalloff(9,2)).toBe(1);expect(explosionFalloff(9,6.75)).toBeCloseTo(.5,9);expect(explosionFalloff(9,9)).toBe(0);
 });
 it('never pushes down',()=>{
  expect(explosionDirection({x:0,y:0,z:5},{x:3,y:0,z:1})).toMatchObject({z:0});
 });
 it('lifts a standing ped and deals up to 250 damage',()=>{
  const out=explosionOnPed({falloff:1,force:300,direction:{x:1,y:0,z:0},moveSpeed:{x:0,y:0,z:0},standing:true});
  // mass / 1400 x 300 = 15, under the mass / 4 = 17.5 cap.
  expect(out.impulse).toEqual({x:15,y:0,z:4});expect(out.damage).toBe(250);
  const edge=explosionOnPed({falloff:.2,force:300,direction:{x:1,y:0,z:0},moveSpeed:{x:0,y:0,z:0},standing:false});
  expect(edge.damage).toBeCloseTo(50,9);expect(edge.impulse.x).toBeCloseTo(3,9);expect(edge.impulse.z).toBeCloseTo(20*70/125,9);
 });
 it('caps the ped push and discounts a ped already flying away',()=>{
  expect(explosionOnPed({falloff:1,force:600,direction:{x:1,y:0,z:0},moveSpeed:{x:0,y:0,z:0},standing:false}).impulse.x).toBeCloseTo(17.5,9);
  expect(explosionOnPed({falloff:1,force:300,direction:{x:1,y:0,z:0},moveSpeed:{x:.5,y:0,z:0},standing:true}).impulse.x).toBe(0);
 });
 it('throws an unfrozen object up and spins it, and damages it 300 at the centre',()=>{
  const out=explosionOnObject({falloff:1,force:300,direction:{x:1,y:0,z:0},mass:200,turnMass:140,moveSpeed:{x:0,y:0,z:0},boundRadius:1});
  const factor=200/1400*300;
  expect(out.move!.x).toBeCloseTo(factor,9);expect(out.move!.z).toBeCloseTo(.2*factor,9);
  expect(out.turn!.impulse.x).toBeCloseTo(factor*.7,9);expect(out.turn!.arm).toEqual({x:0,y:0,z:.5});
  expect(out.damage).toBe(300);
  expect(explosionOnObject({falloff:1,force:300,direction:{x:1,y:0,z:0},mass:200,turnMass:140,moveSpeed:{x:0,y:0,z:0},boundRadius:1,disableCollisionForce:true}).move).toBeUndefined();
 });
 it('unfreezes static objects whose uproot limit is below the force',()=>{
  expect(explosionUnfreezes(300,240)).toBe(true);expect(explosionUnfreezes(150,240)).toBe(false);expect(explosionUnfreezes(300,9999)).toBe(false);
 });
 it('wrecks a car inside half the radius and spins it about the struck side',()=>{
  const identity=(v:{x:number;y:number;z:number})=>({...v});
  const out=explosionOnVehicle({falloff:1,force:300,damagePercentage:1,radius:9,mass:1500,local:{x:3,y:0,z:0},boundsMin:{x:-1,y:-2.5,z:-.5},boundsMax:{x:1,y:2.5,z:1},isVictim:false,toWorld:identity,speedAt:()=>({x:0,y:0,z:0})});
  expect(out.damage).toBe(1100);
  // Blast on the right: the struck point is the right side, pushed left, with a 0.2 lift added to a flat normal.
  expect(out.point).toEqual({x:1,y:0,z:0});
  const factor=Math.min(1,(9-2)/9*2)*(1500/3000)*300;
  expect(out.turnForce.x).toBeCloseTo(-factor,9);expect(out.turnForce.z).toBeCloseTo(0,9);
  const victim=explosionOnVehicle({falloff:1,force:300,damagePercentage:1,radius:9,mass:1500,local:{x:3,y:0,z:0},boundsMin:{x:-1,y:-2.5,z:-.5},boundsMax:{x:1,y:2.5,z:1},isVictim:true,toWorld:identity,speedAt:()=>({x:0,y:0,z:0})});
  expect(victim.turnForce.x).toBeCloseTo(-factor*.2,9);
 });
});
