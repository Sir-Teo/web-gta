import {expect,test} from 'vitest';
import {readObjectData,indexObjectData,placedEntityKind,OBJECT_DATA_FIELDS} from '../src/assets/objectData';
const basic='prop 10 20 .99 .1 50 0 1 0 0 0 0 0';
test('object definitions retain every field and raw input units without filling omitted fields',()=>{
  const row=readObjectData(basic+' 1 2 3 sparks 1.5 4 5 6 .25 1 0')[0];
  expect(OBJECT_DATA_FIELDS).toHaveLength(24);expect(row.fieldCount).toBe(24);expect(row.effectName).toBe('sparks');
  expect(row.values).toEqual({mass:10,turnMass:20,airResistance:.99,elasticity:.1,percentSubmerged:50,uprootLimit:0,collisionDamageMultiplier:1,
    collisionDamageEffect:0,specialCollisionResponse:0,cameraAvoid:0,causesExplosion:0,fxType:0,fxOffsetX:1,fxOffsetY:2,fxOffsetZ:3,
    smashMultiplier:1.5,breakVelocityX:4,breakVelocityY:5,breakVelocityZ:6,breakVelocityRandom:.25,gunBreakMode:1,sparksOnImpact:0});
  const minimal=readObjectData(basic)[0];expect(minimal.values.fxOffsetX).toBeUndefined();expect(minimal.effectName).toBeUndefined();
});
test('line normalization, comments and the terminator match the supported loader contract',()=>{
  const rows=readObjectData('\uFEFF; comment\r\n# comment\r\n'+basic.replace(/ /g,',\t')+'\r\n* end\r\ninvalid');
  expect(rows).toHaveLength(1);expect(rows[0].line).toBe(3);expect(rows[0].model).toBe('prop');
});
test('partial optional rows remain inspectable with explicit effect and buoyancy issues',()=>{
  const row=readObjectData('prop 10 20 .99 .1 0 0 1 0 0 0 0 1 5')[0];
  expect(row.values.fxOffsetX).toBe(5);expect(row.values.fxOffsetY).toBeUndefined();expect(row.issues).toHaveLength(2);
});
test('classification depends on a loaded definition rather than mass or guessing missing data',()=>{
  const records=readObjectData(basic+'\n'+basic.replace('prop 10','PROP 99999')),table=indexObjectData(records);
  expect(records).toHaveLength(2);expect(table.get('prop')).toBe(records[1]);expect(placedEntityKind('Prop',table)).toBe('dummy');
  expect(placedEntityKind('building',table)).toBe('building');expect(placedEntityKind('building',undefined)).toBe('unknown');
});
test('invalid scanning tokens and unsupported row lengths fail with line diagnostics',()=>{
  for(const bad of ['prop 1',basic+' 0 0 0 fx 0 0 0 0 0 0 0 extra',basic.replace('10','NaN'),basic.replace('10','1e100'),basic.replace(' 0 0 0 0 0',' .5 0 0 0 0')]){
    expect(()=>readObjectData(bad)).toThrow(/line 1/);
  }
});
