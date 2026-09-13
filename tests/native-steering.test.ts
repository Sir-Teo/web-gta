import {expect,test} from 'vitest';
import {nativeSteering,type NativeSteeringInput} from '../src/simulation/nativeSteering';
const input=():NativeSteeringInput=>({angle:.4,secondAngle:.2,forwardSpeed:1,rightSpeed:0,playerStatus:true,frontLeftContact:4,rearLeftContact:0,handbrake:false,tarmacAdhesion:1,traction:.01,steeringLockDegrees:30,handlingFlags:0});
test('player steering uses fixed tarmac adhesion and inverse squared forward speed',()=>{
  const r=nativeSteering(input()),expected=Math.asin(.16)/(Math.PI/6);
  expect(r.factor).toBeCloseTo(expected,6);expect(r.angle).toBeCloseTo(.4*expected,6);expect(r.frontAngle).toBe(r.angle);expect(r.rearAngle).toBe(0);
  expect(nativeSteering({...input(),forwardSpeed:2}).factor).toBeCloseTo(Math.asin(.04)/(Math.PI/6),6);
});
test('reverse, low speed, nonplayer and absence of retained left contacts bypass attenuation',()=>{
  for(const patch of [{forwardSpeed:-1},{forwardSpeed:.01},{playerStatus:false},{frontLeftContact:0}])expect(nativeSteering({...input(),...patch}).factor).toBe(1);
  expect(nativeSteering({...input(),frontLeftContact:0,rearLeftContact:1}).factor).toBeLessThan(1);
});
test('countersteer thresholds are strict and handbrake or excessive computed factors restore full steering',()=>{
  expect(nativeSteering({...input(),rightSpeed:-.05}).factor).toBeLessThan(1);
  expect(nativeSteering({...input(),rightSpeed:-.051}).factor).toBe(1);
  expect(nativeSteering({...input(),angle:-.4,rightSpeed:.051}).factor).toBe(1);
  expect(nativeSteering({...input(),handbrake:true}).factor).toBe(1);
  expect(nativeSteering({...input(),traction:1}).factor).toBe(1);
});
test('rear steering overrides secondary rear steering while the secondary path retains front steering',()=>{
  const rear=nativeSteering({...input(),handlingFlags:0x60});expect(rear.frontAngle).toBe(0);expect(rear.rearAngle).toBe(-rear.angle);
  const secondary=nativeSteering({...input(),handlingFlags:0x40});expect(secondary.frontAngle).toBe(secondary.angle);expect(secondary.rearAngle).toBeCloseTo(.2,7);
});
test('invalid input rejects without modifying caller state',()=>{
  const i=input(),before=structuredClone(i);nativeSteering(i);expect(i).toEqual(before);
  for(const patch of [{steeringLockDegrees:0},{traction:-1},{frontLeftContact:5},{angle:NaN},{handlingFlags:-1}])expect(()=>nativeSteering({...i,...patch})).toThrow();
});
