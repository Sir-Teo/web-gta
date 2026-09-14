import {expect,test} from 'vitest';
import {readProcObjects} from '../src/assets/vegetation';
import {prepareNativeProcRules} from '../src/world/nativeProcRules';
const row='GRASS_SHORT_LUSH shrub 4 60 -90 360 2 1 3 1 -2.4 -3.4 -1 256';
test('procedural rules preserve repeated surfaces, reversed ranges and native conversions',()=>{
 const raw=readProcObjects(row+'\n'+row.replace('shrub','OTHER').replace('256','-1')),copy=structuredClone(raw);
 const rules=prepareNativeProcRules(raw);expect(rules).toHaveLength(2);expect(rules[0].surface).toBe(rules[1].surface);
 expect(rules.map(rule=>rule.modelName)).toEqual(['shrub','other']);
 expect(rules[0]).toMatchObject({line:1,spacing:4,inverseSpacingSquared:1/16,minimumDistanceSquared:6400,minimumScaleXY:2,maximumScaleXY:1,minimumScaleZ:3,maximumScaleZ:1,align:true,useGrid:0});
 expect(rules[1].useGrid).toBe(255);
 expect(rules[0].minimumOffsetZ).toBe(Math.fround(-2.4));expect(rules[0].maximumOffsetZ).toBe(Math.fround(-3.4));
 expect(rules[0].minimumRotation).toBe(Math.fround(-Math.PI/2));expect(rules[0].maximumRotation).toBe(Math.fround(2*Math.PI));expect(raw).toEqual(copy);
 expect(prepareNativeProcRules(readProcObjects(row.replace('4 60','4 120')))[0].minimumDistanceSquared).toBe(14400);
});
test('procedural preparation bounds capacity and rejects unusable surfaces and grid steps',()=>{
 const raw=readProcObjects(row);
 expect(prepareNativeProcRules(Array.from({length:128},()=>raw[0]))).toHaveLength(128);
 expect(()=>prepareNativeProcRules(Array.from({length:129},()=>raw[0]))).toThrow('128');
 for(const replacement of ['0 60','-4 60','1e-40 60','1e30 60','4 1e30'])expect(()=>prepareNativeProcRules(readProcObjects(row.replace('4 60',replacement)))).toThrow();
 expect(()=>prepareNativeProcRules(readProcObjects(row.replace('GRASS_SHORT_LUSH','UNKNOWN')))).toThrow('surface');
});
