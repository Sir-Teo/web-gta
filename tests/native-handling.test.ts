import {expect,test} from 'vitest';
import {readHandling} from '../src/assets/handling';
import {prepareHandling} from '../src/simulation/nativeHandling';
const raw=()=>readHandling('DIAGNOSTIC 1200 2400 0 0.1 -0.2 -0.3 75 0.8 0.9 0.52 5 180 24 10 R P 8 0.6 0 35 1.2 0.15 0.02 0.3 -0.2 0.55 0.1 0.25 0.7 12345 0 0 1 2 3').records[0];
test('zero-drag preparation keeps raw input intact and exposes source-unit conversions',()=>{
  const record=raw(),before=structuredClone(record),p=prepareHandling(record,0);
  expect(record).toEqual(before);expect(p.values).not.toBe(record.values);expect(p.dragIterations).toBe(1);
  expect(p.reciprocalMass).toBeCloseTo(1/1200,8);expect(p.buoyancy).toBeCloseTo(12.8,5);
  expect(p.values.collisionDamageMultiplier).toBeCloseTo(7/6,6);expect(p.values.brakeDeceleration).toBeCloseTo(.0032,8);
  expect(p.values.engineAcceleration).toBeCloseTo(.00192,8);expect(p.maxFlatVelocity).toBeCloseTo(.99,5);
  expect(p.values.maxVelocity).toBeCloseTo(1.188,5);expect(p.maxReverseVelocity).toBeCloseTo(-.297,5);
  record.values.driveType='4';expect(prepareHandling(record,0).values.engineAcceleration).toBeCloseTo(.00096,8);
});
test('RC, maximum-speed flag and bike reverse branches preserve their source precedence',()=>{
  const record=raw();record.values.handlingFlags=0x01000000;
  const limited=prepareHandling(record,0);expect(limited.values.maxVelocity).toBeCloseTo(1,5);expect(limited.maxFlatVelocity).toBeCloseTo(.825,5);expect(limited.maxReverseVelocity).toBeCloseTo(-.20625,5);
  const rc=prepareHandling(record,38);expect(rc.maxReverseVelocity).toBe(-rc.maxFlatVelocity);expect(rc.values.maxVelocity).toBeCloseTo(1,5);
  expect(prepareHandling(record,162).maxReverseVelocity).toBeCloseTo(-.20625,5);
  record.values.handlingFlags=0;
  for(const id of [162,174])expect(prepareHandling(record,id).maxReverseVelocity).toBe(Math.fround(-.05));
  for(const id of [161,175])expect(prepareHandling(record,id).maxReverseVelocity).toBeCloseTo(-.297,5);
  record.values.maxVelocity=10;expect(prepareHandling(record,0).maxReverseVelocity).toBe(Math.fround(-.2));
});
test('both drag regimes stop at the first decrement satisfying the acceleration limit',()=>{
  for(const drag of [2.5,.001]){
    const record=raw();record.values.dragMultiplier=drag;const p=prepareHandling(record,0),v=p.maxFlatVelocity;
    const resistance=(speed:number)=>drag>=.01?speed*speed*drag/2000:(1-1/(speed*speed*drag+1))*speed;
    const limit=24*.4/2500/6;
    expect(p.dragIterations).toBeGreaterThan(1);expect(resistance(v)).toBeLessThanOrEqual(limit+1e-7);expect(resistance(v+.01)).toBeGreaterThan(limit);
  }
});
test('six transmission slots retain reverse, forward shift thresholds and cleared unused gears',()=>{
  const p=prepareHandling(raw(),0);expect(p.gears).toHaveLength(6);
  expect(p.gears[0]).toEqual({maxVelocity:p.maxReverseVelocity,changeUpVelocity:Math.fround(-.01),changeDownVelocity:p.maxReverseVelocity});
  expect(p.gears[1].maxVelocity).toBeCloseTo(.33264,5);expect(p.gears[1].changeUpVelocity).toBeCloseTo(.221771088,5);
  expect(p.gears[2].changeDownVelocity).toBeCloseTo(.1397088,5);expect(p.gears[5].changeUpVelocity).toBe(p.values.maxVelocity);
  const record=raw();record.values.gears=1;const one=prepareHandling(record,0);expect(one.gears[1].changeUpVelocity).toBe(one.values.maxVelocity);expect(one.gears.slice(2)).toEqual(Array(4).fill({maxVelocity:0,changeUpVelocity:0,changeDownVelocity:0}));
});
test('byte preparation is explicit and unsafe conversion inputs reject without mutating records',()=>{
  const record=raw();record.values.percentSubmerged=331;record.values.gears=261;
  const p=prepareHandling(record,0);expect(p.values.percentSubmerged).toBe(75);expect(p.values.gears).toBe(5);expect(record.values.gears).toBe(261);
  for(const [field,value] of [['mass',0],['percentSubmerged',256],['gears',6],['maxVelocity',1e12],['dragMultiplier',-1],['engineAcceleration',-1]] as const){
    const invalid=raw();invalid.values[field]=value;const before=structuredClone(invalid);expect(()=>prepareHandling(invalid,0)).toThrow();expect(invalid).toEqual(before);
  }
  expect(()=>prepareHandling(raw(),400)).toThrow(/handling-table ID/);
});


test('pathological but finite drag searches stop at the work budget',()=>{
  const record=raw();record.values.maxVelocity=360000;record.values.engineAcceleration=0;record.values.dragMultiplier=2.5;
  expect(()=>prepareHandling(record,0)).toThrow(/work limit/);expect(record.values.maxVelocity).toBe(360000);
});
